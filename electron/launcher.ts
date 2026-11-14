/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from 'crypto'
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, promises as fsp } from 'fs'
import { dirname, join, resolve } from 'path'
import { spawn } from 'child_process'
import { inflateRaw } from 'zlib'
import { promisify } from 'util'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { serverLaunchArgs } from '../src/services/settings'
import type { LaunchOpts } from '../src/types'
import { pickNeoForgeVersion } from './loaderSupport'

type Emit = (ch: string, data: unknown) => void
type Job = { url: string; dest: string; sha1?: string; size: number }
const inflateRawAsync = promisify(inflateRaw)

async function sha1File(file: string): Promise<string> {
  const hash = createHash('sha1')
  await pipeline(createReadStream(file), hash as any)
  return hash.digest('hex')
}

const MANIFEST = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json'

export interface JavaFound { name: string; path: string; major: number }
const majorOf = (v: string) => { const m = /^1\.(\d+)/.exec(v) ?? /^(\d+)/.exec(v); return m ? Number(m[1]) : 0 }

export function detectJava(): JavaFound[] {
  const pf = process.env['ProgramFiles'] ?? 'C:\\Program Files'
  const roots = ['Java', 'Eclipse Adoptium', 'Eclipse Foundation', 'Microsoft', 'Zulu', 'Amazon Corretto', 'BellSoft', 'Semeru'].map((d) => join(pf, d))
  const out: JavaFound[] = []
  const add = (home: string, name: string) => {
    const exe = join(home, 'bin', 'javaw.exe')
    if (!existsSync(exe) || out.some((j) => j.path === exe)) return
    let major = 0
    try { const m = /JAVA_VERSION="([^"]+)"/.exec(readFileSync(join(home, 'release'), 'utf8')); if (m) major = majorOf(m[1]) } catch { /* no release file */ }
    out.push({ name, path: exe, major })
  }
  for (const r of roots) if (existsSync(r)) for (const d of readdirSync(r)) add(join(r, d), d)
  if (process.env['JAVA_HOME']) add(process.env['JAVA_HOME'], 'JAVA_HOME')
  return out
}

// Picks the Java the game needs: manual choice, a runtime we or Mojang's launcher already have, an installed JDK of the exact major version, else downloads Mojang's runtime.
async function resolveJava(o: LaunchOpts, meta: any, signal: AbortSignal): Promise<{ java: string; jobs: Job[]; marker?: string; major: number }> {
  const runtimeCatalog: Record<string, { component: string; major: number }> = {
    legacy: { component: 'jre-legacy', major: 8 },
    alpha: { component: 'java-runtime-alpha', major: 16 },
    beta: { component: 'java-runtime-beta', major: 17 },
    gamma: { component: 'java-runtime-gamma', major: 17 },
    delta: { component: 'java-runtime-delta', major: 21 },
    epsilon: { component: 'java-runtime-epsilon', major: 25 }
  }
  const selected = o.javaRuntime && o.javaRuntime !== 'auto' ? runtimeCatalog[o.javaRuntime] : undefined
  const comp: string = selected?.component ?? meta.javaVersion?.component ?? 'jre-legacy'
  const major: number = selected?.major ?? meta.javaVersion?.majorVersion ?? 8
  if (o.java && existsSync(o.java)) return { java: o.java, jobs: [], major }
  // Mojang stores each platform runtime beneath runtime/<component>/<platform>/<component>.
  const rt = join(o.dir, 'runtime', comp, 'windows-x64', comp)
  const own = join(rt, 'bin', 'javaw.exe')
  if (existsSync(join(rt, '.ok')) && existsSync(own)) return { java: own, jobs: [], major }
  const mc = join(process.env['APPDATA'] ?? '', '.minecraft', 'runtime', comp, 'windows-x64', comp, 'bin', 'javaw.exe')
  if (existsSync(mc)) return { java: mc, jobs: [], major }
  const hit = selected ? undefined : detectJava().find((j) => j.major === major)
  if (hit) return { java: hit.path, jobs: [], major }
  const all = await getJson('https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json', signal)
  const entry = all['windows-x64']?.[comp]?.[0]
  if (!entry) throw new Error(`Mojang has no Java runtime "${comp}" for Windows`)
  const man = await getJson(entry.manifest.url, signal)
  const jobs: Job[] = Object.entries(man.files as Record<string, any>).filter(([, f]) => f.type === 'file').map(([p, f]) => ({ url: f.downloads.raw.url, dest: join(rt, p), sha1: f.downloads.raw.sha1, size: f.downloads.raw.size }))
  return { java: own, jobs, marker: join(rt, '.ok'), major }
}

// Minimal zip extractor (no external tools needed): reads the central directory and inflates each entry.
async function unzipTo(file: string, out: string): Promise<void> {
  // File reads and decompression are asynchronous so large native archives do not
  // monopolize Electron's main-process event loop.
  const b = await fsp.readFile(file)
  let e = b.length - 22
  while (e >= 0 && b.readUInt32LE(e) !== 0x06054b50) e--
  if (e < 0) throw new Error(`Not a valid zip: ${file}`)
  let n = b.readUInt16LE(e + 10), p = b.readUInt32LE(e + 16)
  while (n-- > 0) {
    const method = b.readUInt16LE(p + 10), csize = b.readUInt32LE(p + 20), nl = b.readUInt16LE(p + 28), xl = b.readUInt16LE(p + 30), cl = b.readUInt16LE(p + 32), lo = b.readUInt32LE(p + 42)
    const name = b.toString('utf8', p + 46, p + 46 + nl).replace(/\\/g, '/')
    p += 46 + nl + xl + cl
    if (name.endsWith('/') || name.startsWith('META-INF/')) continue
    const dest = resolve(out, name)
    if (!dest.startsWith(resolve(out) + (process.platform === 'win32' ? '\\' : '/'))) continue
    const offset = lo + 30 + b.readUInt16LE(lo + 26) + b.readUInt16LE(lo + 28)
    const compressed = b.subarray(offset, offset + csize)
    const data = method === 0 ? compressed : method === 8 ? await inflateRawAsync(compressed) : null
    if (!data) throw new Error(`Unsupported zip compression method ${method}`)
    await fsp.mkdir(dirname(dest), { recursive: true })
    await fsp.writeFile(dest, data)
  }
}

// Standard Minecraft offline UUID (md5 of "OfflinePlayer:<name>", version 3). Matches what offline-mode servers compute.
export function offlineUuid(name: string): string {
  const h = createHash('md5').update('OfflinePlayer:' + name).digest()
  h[6] = (h[6] & 0x0f) | 0x30; h[8] = (h[8] & 0x3f) | 0x80
  const x = h.toString('hex')
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`
}

const allowed = (rules?: any[]): boolean => {
  if (!rules) return true
  let ok = false
  const currentArch = process.arch
  for (const r of rules) {
    const osNameOk = !r.os?.name || r.os.name === 'windows'
    const ruleArch = String(r.os?.arch ?? '').toLowerCase()
    // Mojang metadata has used both x64 and x86_64 for 64-bit Windows.
    // Do not accidentally discard LWJGL's Windows native classifier.
    const archOk = !ruleArch || (currentArch === 'x64'
      ? ['x64', 'x86_64', 'amd64'].includes(ruleArch)
      : currentArch === 'ia32' && ['x86', 'ia32'].includes(ruleArch))
    if (osNameOk && archOk && !r.features) ok = r.action === 'allow'
  }
  return ok
}

async function getJson(url: string, signal: AbortSignal): Promise<any> {
  const r = await fetch(url, { signal })
  if (!r.ok) throw new Error(`${url} returned ${r.status}`)
  return r.json()
}

async function download(j: Job, signal: AbortSignal, onBytes: (n: number) => void, onSize?: (n: number) => void): Promise<void> {
  if (existsSync(j.dest) && (!j.sha1 || await sha1File(j.dest) === j.sha1)) { const cachedSize = j.size || statSync(j.dest).size; if (!j.size) onSize?.(cachedSize); onBytes(cachedSize); return }
  mkdirSync(dirname(j.dest), { recursive: true })
  const r = await fetch(j.url, { signal })
  if (!r.ok || !r.body) throw new Error(`${j.url} returned ${r.status}`)
  const contentLength = Number(r.headers.get('content-length') || 0)
  if (!j.size && contentLength > 0) { j.size = contentLength; onSize?.(contentLength) }
  const src = Readable.fromWeb(r.body as never)
  src.on('data', (c: Buffer) => onBytes(c.length))
  await pipeline(src, createWriteStream(j.dest + '.part'))
  renameSync(j.dest + '.part', j.dest)
}

async function runInstaller(java: string, installer: string, gameDir: string, signal: AbortSignal, emit: Emit): Promise<void> {
  // Forge/NeoForge installers refuse to run unless the official launcher's profile file exists in the target dir.
  mkdirSync(gameDir, { recursive: true })
  const profiles = join(gameDir, 'launcher_profiles.json')
  if (!existsSync(profiles)) writeFileSync(profiles, JSON.stringify({ profiles: {}, settings: {}, version: 3 }, null, 2))
  await new Promise<void>((resolveRun, reject) => {
    if (signal.aborted) return reject(new Error('Cancelled'))
    const child = spawn(java, ['-jar', installer, '--installClient', gameDir], { cwd: gameDir, windowsHide: true })
    let output = ''
    const collect = (b: Buffer) => { const line = b.toString(); output += line; line.split(/\r?\n/).filter(Boolean).forEach(v => emit('game:log', v)) }
    child.stdout.on('data', collect); child.stderr.on('data', collect)
    const abort = () => child.kill()
    signal.addEventListener('abort', abort, { once: true })
    child.on('error', e => { signal.removeEventListener('abort', abort); reject(e) })
    child.on('exit', code => { signal.removeEventListener('abort', abort); if (signal.aborted) reject(new Error('Cancelled')); else if (code === 0) resolveRun(); else reject(new Error(`Loader installer exited with code ${code}. ${output.slice(-1200)}`)) })
  })
}

async function installExternalLoader(loader: 'Forge' | 'NeoForge', mc: string, gameDir: string, java: string, signal: AbortSignal, emit: Emit, wanted?: string): Promise<any> {
  emit('game:progress', { phase: `Resolving ${loader} version` })
  let installerUrl = '', picked = ''
  if (loader === 'Forge') {
    const promotions = await getJson('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json', signal)
    const promos = promotions.promos as Record<string, string>
    let version = wanted || promos[`${mc}-recommended`] || promos[`${mc}-latest`]
    if (!version) {
      const metadata = await fetch('https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml', { signal })
      if (!metadata.ok) throw new Error(`Forge version metadata returned ${metadata.status}`)
      const xml = await metadata.text()
      version = [...xml.matchAll(/<version>([^<]+)<\/version>/g)].map(x => x[1]).filter((v): v is string => typeof v === 'string' && v.startsWith(`${mc}-`)).map(v => v.slice(mc.length + 1)).sort((a,b) => a.localeCompare(b, undefined, { numeric: true })).at(-1) ?? ''
    }
    if (!version) throw new Error(`Forge has no installer published for Minecraft ${mc}. This version/loader combination is not available upstream.`)
    picked = version
    installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${mc}-${version}/forge-${mc}-${version}-installer.jar`
  } else {
    const r = await fetch('https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml', { signal }); if (!r.ok) throw new Error(`NeoForge metadata returned ${r.status}`)
    const xml = await r.text()
    const version = wanted || pickNeoForgeVersion(mc, [...xml.matchAll(/<version>([^<]+)<\/version>/g)].map(x => x[1] as string))
    if (!version) throw new Error(`NeoForge has no published build for Minecraft ${mc}`)
    picked = version
    installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${version}/neoforge-${version}-installer.jar`
  }
  const installer = join(gameDir, 'amagiri-installers', `${loader.toLowerCase()}-${mc}.jar`)
  await download({ url: installerUrl, dest: installer, size: 0 }, signal, () => {})
  emit('game:progress', { phase: `Installing ${loader}` })
  const versionsDir = join(gameDir, 'versions')
  await runInstaller(java, installer, gameDir, signal, emit)
  // The installer writes versions/<name>/<name>.json (e.g. 1.20.1-forge-47.2.0, neoforge-21.1.172). Find the one it just made.
  const wantedName = (n: string) => n.toLowerCase().includes(loader.toLowerCase()) && n.includes(picked) && existsSync(join(versionsDir, n, `${n}.json`))
  const found = (existsSync(versionsDir) ? readdirSync(versionsDir) : []).filter(wantedName).sort((x, y) => statSync(join(versionsDir, y, `${y}.json`)).mtimeMs - statSync(join(versionsDir, x, `${x}.json`)).mtimeMs)[0]
  const profileFile = found ? join(versionsDir, found, `${found}.json`) : undefined
  if (!profileFile) throw new Error(`${loader} installer completed but its client profile was not found. Check the installer log.`)
  return JSON.parse(readFileSync(profileFile, 'utf8'))
}

export async function launch(o: LaunchOpts, emit: Emit, signal: AbortSignal, appVersion: string): Promise<void> {
  if (!/^[\w.\-]+$/.test(o.mc)) throw new Error('Invalid Minecraft version id')
  if (!o.installOnly && !/^[A-Za-z0-9_]{3,16}$/.test(o.name)) throw new Error('Invalid offline username')
  mkdirSync(o.dir, { recursive: true })
  emit('game:progress', { phase: 'Fetching version data' })
  const entry = (await getJson(MANIFEST, signal)).versions.find((v: any) => v.id === o.mc)
  if (!entry) throw new Error(`Minecraft ${o.mc} was not found in the manifest`)
  let meta = await getJson(entry.url, signal)
  const rj = await resolveJava(o, meta, signal)
  if (o.loader === 'Forge' || o.loader === 'NeoForge') {
    for (const j of rj.jobs) await download(j, signal, () => {})
    const installerJava = rj.java.replace(/javaw\.exe$/i, 'java.exe')
    const profile = await installExternalLoader(o.loader, o.mc, o.dir, existsSync(installerJava) ? installerJava : rj.java, signal, emit, o.loaderVersion)
    meta = { ...meta, ...profile, id: profile.id || `${o.mc}-${o.loader.toLowerCase()}`, assetIndex: meta.assetIndex, downloads: meta.downloads, javaVersion: meta.javaVersion, libraries: [...(meta.libraries || []), ...(profile.libraries || [])], arguments: profile.arguments || meta.arguments, minecraftArguments: profile.minecraftArguments || meta.minecraftArguments }
  }
  if (o.loader === 'Fabric' || o.loader === 'Quilt') {
    const base = o.loader === 'Fabric' ? 'https://meta.fabricmc.net/v2' : 'https://meta.quiltmc.org/v3'
    const lv = await getJson(`${base}/versions/loader/${o.mc}`, signal)
    const ver = o.loaderVersion && lv.some((x: any) => x.loader.version === o.loaderVersion) ? o.loaderVersion : (lv.find((x: any) => x.loader.stable) ?? lv[0])?.loader?.version
    if (!ver) throw new Error(`${o.loader} does not support Minecraft ${o.mc}`)
    const prof = await getJson(`${base}/versions/loader/${o.mc}/${ver}/profile/json`, signal)
    meta.mainClass = prof.mainClass
    meta.libraries.push(...prof.libraries.map((l: any) => {
      const [g, a, v] = String(l.name).split(':')
      const path = `${g.replace(/\./g, '/')}/${a}/${v}/${a}-${v}.jar`
      return { name: l.name, downloads: { artifact: { path, url: (l.url ?? 'https://maven.fabricmc.net/') + path, sha1: l.sha1, size: l.size ?? 0 } } }
    }))
    meta.arguments ??= { game: String(meta.minecraftArguments).split(' '), jvm: ['-Djava.library.path=${natives_directory}', '-cp', '${classpath}'] }
    meta.arguments.jvm.push(...(prof.arguments?.jvm ?? [])); meta.arguments.game.push(...(prof.arguments?.game ?? []))
    delete meta.minecraftArguments
  } else if (!['Vanilla', 'Forge', 'NeoForge'].includes(o.loader)) throw new Error(`${o.loader} is not supported by this launcher build`)
  const vdir = join(o.dir, 'versions', o.mc)
  const jar = join(vdir, o.mc + '.jar')
  const gameDir = join(o.dir, 'instances', o.instId)
  mkdirSync(gameDir, { recursive: true })
  mkdirSync(vdir, { recursive: true })
  writeFileSync(join(vdir, o.mc + '.json'), JSON.stringify(meta))

  if (rj.jobs.length) emit('game:progress', { phase: `Installing Java ${rj.major} runtime` })
  const jobs: Job[] = [{ url: meta.downloads.client.url, dest: jar, sha1: meta.downloads.client.sha1, size: meta.downloads.client.size }]
  jobs.push(...rj.jobs)
  emit('game:log', `Using Java ${rj.major}: ${rj.java}`)
  const cp: string[] = []; const natives: string[] = []
  const addLib = (a: any): string => { const dest = join(o.dir, 'libraries', a.path); jobs.push({ url: a.url, dest, sha1: a.sha1, size: a.size }); return dest }
  for (const lib of meta.libraries) {
    if (!allowed(lib.rules)) continue
    const classifiers = lib.downloads?.classifiers ?? {}
    const nativeTemplate = lib.natives?.windows
    const nativeKey = typeof nativeTemplate === 'string'
      ? nativeTemplate.replace(/\$\{arch\}/g, process.arch === 'ia32' ? '32' : '64')
      : undefined
    // Prefer the exact classifier declared by Mojang, with the common Windows
    // classifier as a compatibility fallback for metadata variants.
    const nativeArtifact = (nativeKey && classifiers[nativeKey]) || classifiers['natives-windows']
    if (nativeArtifact?.url && nativeArtifact?.path) natives.push(addLib(nativeArtifact))
    let art = lib.downloads?.artifact
    if (!art && lib.name) {
      const parts = String(lib.name).split(':')
      if (parts.length >= 3) {
        const [group, artifact, version, classifier] = parts
        const suffix = classifier ? `-${classifier}` : ''
        const path = `${group.replace(/\./g, '/')}/${artifact}/${version}/${artifact}-${version}${suffix}.jar`
        const base = String(lib.url || 'https://libraries.minecraft.net/').replace(/\/?$/, '/')
        art = { path, url: base + path, sha1: lib.checksum || lib.sha1, size: 0 }
      }
    }
    if (!art?.url || !art?.path) continue
    const dest = addLib(art)
    if (/:natives-windows$/.test(lib.name)) natives.push(dest); else cp.push(dest)
  }
  const idx = meta.assetIndex
  const idxPath = join(o.dir, 'assets', 'indexes', idx.id + '.json')
  await download({ url: idx.url, dest: idxPath, sha1: idx.sha1, size: idx.size }, signal, () => {})
  const objects = JSON.parse(readFileSync(idxPath, 'utf8')).objects as Record<string, { hash: string; size: number }>
  for (const { hash, size } of Object.values(objects)) jobs.push({ url: `https://resources.download.minecraft.net/${hash.slice(0, 2)}/${hash}`, dest: join(o.dir, 'assets', 'objects', hash.slice(0, 2), hash), sha1: hash, size })

  const uniq = [...new Map(jobs.map((j) => [j.dest, j])).values()] // many assets share one hash; never download the same file twice at once
  let total = uniq.reduce((n, j) => n + j.size, 0)
  let done = 0, files = 0, last = Date.now(), lastDone = 0
  const tick = (force = false) => {
    const now = Date.now()
    if (!force && now - last < 300) return
    emit('game:progress', { phase: 'Downloading game files', done, total, files, totalFiles: uniq.length, speed: ((done - lastDone) * 1000) / Math.max(now - last, 1) })
    last = now; lastDone = done
  }
  const queue = [...uniq]
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let j = queue.shift(); j; j = queue.shift()) {
      for (let t = 0; ; t++) {
        try { await download(j, signal, (n) => { done += n; tick() }, (n) => { total += n; tick(true) }); break } catch (e) { if (signal.aborted || t >= 2) throw e }
      }
      files++; tick()
    }
  }))
  tick(true)
  if (rj.marker) writeFileSync(rj.marker, '1')

  emit('game:progress', { phase: 'Extracting natives' })
  const nativesDir = join(vdir, 'natives')
  // Rebuild this version's native directory from the currently resolved
  // classifiers. This prevents stale or partial DLLs from previous launches.
  rmSync(nativesDir, { recursive: true, force: true })
  mkdirSync(nativesDir, { recursive: true })
  for (const n of [...new Set(natives)]) {
    try { await unzipTo(n, nativesDir) } catch (e) { throw new Error(`Extracting natives failed (${n}): ${(e as Error).message}`) }
  }
  const hasLwjglDll = (dir: string): boolean => readdirSync(dir, { withFileTypes: true }).some((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? hasLwjglDll(path) : entry.isFile() && entry.name.toLowerCase() === 'lwjgl.dll'
  })
  if (!hasLwjglDll(nativesDir)) {
    const nativeNames = [...new Set(natives)].map((n) => n.split(/[\\/]/).pop()).join(', ') || '(no Windows native classifiers selected)'
    throw new Error(`LWJGL native file lwjgl.dll is missing after extraction. Selected native archives: ${nativeNames}. Check Minecraft library metadata and Windows architecture.`)
  }

  if (o.installOnly) { emit('game:progress', { phase: 'installed' }); return }
  const sub: Record<string, string> = {
    auth_player_name: o.name, auth_uuid: offlineUuid(o.name), auth_access_token: '0', auth_xuid: '0', clientid: '0', user_type: 'legacy', user_properties: '{}',
    version_name: meta.id || o.mc, version_type: meta.type, game_directory: gameDir, assets_root: join(o.dir, 'assets'), assets_index_name: idx.id, game_assets: join(o.dir, 'assets', 'virtual', 'legacy'),
    natives_directory: nativesDir, launcher_name: 'AmagiriLauncher', launcher_version: appVersion, classpath: [...cp, jar].join(';'), classpath_separator: ';', library_directory: join(o.dir, 'libraries')
  }
  const fill = (s: string) => s.replace(/\$\{(\w+)\}/g, (_, k: string) => sub[k] ?? '')
  const flat = (a: any[]): string[] => a.flatMap((x) => (typeof x === 'string' ? [x] : allowed(x.rules) ? ([] as string[]).concat(x.value) : []))
  const jvmArgs = meta.arguments ? flat(meta.arguments.jvm) : ['-Djava.library.path=${natives_directory}', '-cp', '${classpath}']
  const resolvedJvmArgs = jvmArgs.map(fill)
  // Some third-party loader profiles omit or override this JVM property.
  // Always point LWJGL at the natives extracted for this exact MC version.
  const nativePathArg = `-Djava.library.path=${nativesDir}`
  const nativePathIndex = resolvedJvmArgs.findIndex((arg) => arg.startsWith('-Djava.library.path='))
  if (nativePathIndex >= 0) resolvedJvmArgs[nativePathIndex] = nativePathArg
  else resolvedJvmArgs.unshift(nativePathArg)
  const gameArgs = meta.arguments ? flat(meta.arguments.game) : String(meta.minecraftArguments).split(' ')
  const windowArgs = o.fullscreen ? ['--fullscreen'] : ['--width', String(o.w), '--height', String(o.h)]
  const args = [`-Xms${o.minRam}M`, `-Xmx${o.maxRam}M`, ...o.jvm.split(/\s+/).filter(Boolean), ...resolvedJvmArgs, meta.mainClass, ...gameArgs.map(fill), ...windowArgs, ...serverLaunchArgs(o.server)]

  emit('game:progress', { phase: 'running', msg: `Needs Java ${meta.javaVersion?.majorVersion ?? 8}` })
  // Use javaw.exe (no console window) and never windowsHide: that flag would also hide the game window itself.
  const jw = rj.java.replace(/java\.exe$/i, 'javaw.exe')
  const child = spawn(existsSync(jw) ? jw : rj.java, args, { cwd: gameDir, windowsHide: false, detached: o.closeOnLaunch })
  const log = (b: Buffer) => b.toString().split(/\r?\n/).filter(Boolean).forEach((l) => emit('game:log', l))
  child.stdout.on('data', log); child.stderr.on('data', log)
  child.on('error', (e) => emit('game:log', `Failed to start Java: ${e.message}`))
  child.on('exit', (code) => emit('game:exit', code ?? 0))
  if (o.closeOnLaunch) child.unref()
}
