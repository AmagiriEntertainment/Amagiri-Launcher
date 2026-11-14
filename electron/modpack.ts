/* eslint-disable @typescript-eslint/no-explicit-any */
// Installs a whole modpack (Modrinth .mrpack or CurseForge zip) into a brand-new instance folder.
import { createHash } from 'crypto'
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, promises as fsp, createReadStream } from 'fs'
import { dirname, join, resolve, sep } from 'path'
import { inflateRaw } from 'zlib'
import { promisify } from 'util'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'

type Emit = (ch: string, data: unknown) => void
export interface ModpackMeta { name: string; mc: string; loader: string; loaderVersion?: string; icon?: string; version?: string; skipped: number }
export interface ModpackArgs { source: 'modrinth' | 'curseforge'; projectId: string; instanceRoot: string; curseForgeKey: string }

const inflateRawAsync = promisify(inflateRaw)
async function sha1File(file: string): Promise<string> { const h = createHash('sha1'); for await (const chunk of createReadStream(file)) h.update(chunk as Buffer); return h.digest('hex') }

const UA = { 'User-Agent': 'AmagiriLauncher/1.0' }
const LOADER_NAMES: Record<string, string> = { 'fabric-loader': 'Fabric', 'quilt-loader': 'Quilt', forge: 'Forge', neoforge: 'NeoForge', fabric: 'Fabric', quilt: 'Quilt' }

// ---- zip ----
interface ZipEntry { name: string; data: () => Promise<Buffer> }
async function readZip(file: string): Promise<ZipEntry[]> {
  const b = await fsp.readFile(file)
  let e = b.length - 22
  while (e >= 0 && b.readUInt32LE(e) !== 0x06054b50) e--
  if (e < 0) throw new Error('The modpack download is not a valid zip file.')
  let n = b.readUInt16LE(e + 10), p = b.readUInt32LE(e + 16)
  const out: ZipEntry[] = []
  while (n-- > 0) {
    const method = b.readUInt16LE(p + 10), csize = b.readUInt32LE(p + 20), nl = b.readUInt16LE(p + 28), xl = b.readUInt16LE(p + 30), cl = b.readUInt16LE(p + 32), lo = b.readUInt32LE(p + 42)
    const name = b.toString('utf8', p + 46, p + 46 + nl).replace(/\\/g, '/')
    p += 46 + nl + xl + cl
    if (name.endsWith('/')) continue
    out.push({ name, data: async () => { const s = lo + 30 + b.readUInt16LE(lo + 26) + b.readUInt16LE(lo + 28); const d = b.subarray(s, s + csize); if (method === 0) return d; if (method === 8) return await inflateRawAsync(d); throw new Error(`Unsupported zip compression method ${method}`) } })
  }
  return out
}
const inside = (root: string, target: string) => resolve(target).startsWith(resolve(root) + sep)
async function extractFolder(entries: ZipEntry[], folder: string, root: string): Promise<void> {
  const prefix = folder.replace(/\/?$/, '/')
  for (const en of entries) {
    if (!en.name.startsWith(prefix)) continue
    const dest = join(root, en.name.slice(prefix.length))
    if (!inside(root, dest)) continue // never write outside the instance (zip-slip)
    await fsp.mkdir(dirname(dest), { recursive: true }); await fsp.writeFile(dest, await en.data())
  }
}

// ---- network ----
async function getJson(url: string, signal: AbortSignal, headers: Record<string, string> = {}, init: RequestInit = {}): Promise<any> {
  const r = await fetch(url, { ...init, headers: { ...UA, ...headers, ...(init.headers as object) }, signal })
  if (!r.ok) throw new Error(`${new URL(url).host} returned ${r.status}`)
  return r.json()
}
async function downloadTo(url: string, dest: string, signal: AbortSignal, headers: Record<string, string> = {}): Promise<void> {
  if (!/^https:\/\//.test(url)) throw new Error('Modpack contains a non-HTTPS download link.')
  mkdirSync(dirname(dest), { recursive: true })
  const r = await fetch(url, { headers: { ...UA, ...headers }, signal })
  if (!r.ok || !r.body) throw new Error(`${new URL(url).host} returned ${r.status}`)
  await pipeline(Readable.fromWeb(r.body as never), createWriteStream(dest + '.part'))
  renameSync(dest + '.part', dest)
}
async function pool<T>(items: T[], size: number, fn: (x: T) => Promise<void>) {
  let i = 0
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => { while (i < items.length) await fn(items[i++] as T) }))
}

export async function installModpack(a: ModpackArgs, emit: Emit, signal: AbortSignal): Promise<ModpackMeta> {
  mkdirSync(a.instanceRoot, { recursive: true })
  const pack = join(a.instanceRoot, '.modpack-download.zip')
  try { return a.source === 'modrinth' ? await modrinth(a, pack, emit, signal) : await curseforge(a, pack, emit, signal) }
  finally { rmSync(pack, { force: true }); rmSync(pack + '.part', { force: true }) }
}

async function modrinth(a: ModpackArgs, pack: string, emit: Emit, signal: AbortSignal): Promise<ModpackMeta> {
  emit('game:progress', { phase: 'Fetching modpack info' })
  const id = encodeURIComponent(a.projectId)
  const [project, versions] = await Promise.all([getJson(`https://api.modrinth.com/v2/project/${id}`, signal), getJson(`https://api.modrinth.com/v2/project/${id}/version`, signal)])
  const v = (versions as any[]).find((x) => x.version_type === 'release' && x.files?.length) ?? (versions as any[]).find((x) => x.files?.length)
  const file = v?.files?.find((f: any) => f.filename?.endsWith('.mrpack')) ?? v?.files?.find((f: any) => f.primary) ?? v?.files?.[0]
  if (!file) throw new Error('This modpack has no downloadable version on Modrinth.')
  emit('game:progress', { phase: 'Downloading modpack', done: 0, total: 1 })
  await downloadTo(file.url, pack, signal)
  const entries = await readZip(pack)
  const indexEntry = entries.find((e) => e.name === 'modrinth.index.json')
  if (!indexEntry) throw new Error('modrinth.index.json is missing from the modpack.')
  const index = JSON.parse((await indexEntry.data()).toString('utf8'))
  const dep: Record<string, string> = index.dependencies ?? {}
  const mc = dep.minecraft
  if (!mc) throw new Error('The modpack does not say which Minecraft version it needs.')
  const loaderKey = Object.keys(dep).find((k) => LOADER_NAMES[k] && k !== 'minecraft')
  const files = ((index.files ?? []) as any[]).filter((f) => f.env?.client !== 'unsupported')
  let done = 0
  emit('game:progress', { phase: 'Downloading modpack files', done: 0, total: files.length, files: 0, totalFiles: files.length })
  await pool(files, 4, async (f) => {
    const dest = join(a.instanceRoot, String(f.path))
    if (!inside(a.instanceRoot, dest)) throw new Error(`Unsafe file path in modpack: ${f.path}`)
    let lastErr: unknown
    for (const url of (f.downloads ?? []) as string[]) {
      try {
        await downloadTo(url, dest, signal)
        if (f.hashes?.sha1 && await sha1File(dest) !== f.hashes.sha1) { rmSync(dest, { force: true }); throw new Error('checksum mismatch') }
        lastErr = undefined; break
      } catch (e) { if (signal.aborted) throw e; lastErr = e }
    }
    if (lastErr || !(f.downloads ?? []).length) throw new Error(`Could not download ${f.path}: ${(lastErr as Error)?.message ?? 'no download link'}`)
    done++; emit('game:progress', { phase: 'Downloading modpack files', done, total: files.length, files: done, totalFiles: files.length })
  })
  await extractFolder(entries, 'overrides', a.instanceRoot)
  await extractFolder(entries, 'client-overrides', a.instanceRoot)
  return { name: project.title ?? index.name ?? 'Modpack', mc, loader: loaderKey ? LOADER_NAMES[loaderKey] as string : 'Vanilla', loaderVersion: loaderKey ? dep[loaderKey] : undefined, icon: project.icon_url ?? undefined, version: v.version_number, skipped: 0 }
}

async function curseforge(a: ModpackArgs, pack: string, emit: Emit, signal: AbortSignal): Promise<ModpackMeta> {
  if (!a.curseForgeKey) throw new Error('CurseForge API key is not configured. Add a valid API key in Settings → CurseForge.')
  const H = { 'x-api-key': a.curseForgeKey, Accept: 'application/json' }
  const id = encodeURIComponent(a.projectId)
  emit('game:progress', { phase: 'Fetching modpack info' })
  const project = (await getJson(`https://api.curseforge.com/v1/mods/${id}`, signal, H)).data
  const list = (await getJson(`https://api.curseforge.com/v1/mods/${id}/files?pageSize=20`, signal, H)).data as any[]
  const file = list.find((f) => f.releaseType === 1 && f.isAvailable !== false) ?? list.find((f) => f.isAvailable !== false) ?? list[0]
  if (!file) throw new Error('This modpack has no downloadable file on CurseForge.')
  let url: string = file.downloadUrl
  if (!url) url = (await getJson(`https://api.curseforge.com/v1/mods/${id}/files/${file.id}/download-url`, signal, H)).data
  if (!url) throw new Error('The author disabled third-party downloads for this modpack. Download it from the CurseForge website instead.')
  emit('game:progress', { phase: 'Downloading modpack', done: 0, total: 1 })
  await downloadTo(url, pack, signal)
  const entries = await readZip(pack)
  const mf = entries.find((e) => e.name === 'manifest.json')
  if (!mf) throw new Error('manifest.json is missing from the modpack.')
  const manifest = JSON.parse(mf.data().toString('utf8'))
  const mc = manifest.minecraft?.version as string
  if (!mc) throw new Error('The modpack does not say which Minecraft version it needs.')
  const ml = (manifest.minecraft.modLoaders ?? []).find((m: any) => m.primary) ?? manifest.minecraft.modLoaders?.[0]
  const [lname, ...lver] = String(ml?.id ?? '').split('-')
  const loader = LOADER_NAMES[lname as string] ?? 'Vanilla'
  const wanted = ((manifest.files ?? []) as any[]).filter((f) => f.required !== false)
  const info = new Map<number, any>()
  for (let i = 0; i < wanted.length; i += 200) {
    const body = await getJson('https://api.curseforge.com/v1/mods/files', signal, H, { method: 'POST', body: JSON.stringify({ fileIds: wanted.slice(i, i + 200).map((f) => f.fileID) }), headers: { 'Content-Type': 'application/json' } })
    for (const d of body.data as any[]) info.set(d.id, d)
  }
  let done = 0, skipped = 0
  emit('game:progress', { phase: 'Downloading modpack files', done: 0, total: wanted.length, files: 0, totalFiles: wanted.length })
  await pool(wanted, 4, async (f) => {
    const d = info.get(f.fileID)
    try {
      if (!d) throw new Error('file info missing')
      const link: string = d.downloadUrl || `https://edge.forgecdn.net/files/${Math.floor(d.id / 1000)}/${d.id % 1000}/${encodeURIComponent(d.fileName)}`
      const folder = /\.jar$/i.test(d.fileName) ? 'mods' : 'resourcepacks'
      const dest = join(a.instanceRoot, folder, String(d.fileName).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_'))
      if (!inside(a.instanceRoot, dest)) throw new Error('unsafe file name')
      await downloadTo(link, dest, signal)
    } catch (e) { if (signal.aborted) throw e; skipped++; emit('game:log', `Skipped CurseForge file ${f.fileID}: ${(e as Error).message}`) }
    done++; emit('game:progress', { phase: 'Downloading modpack files', done, total: wanted.length, files: done, totalFiles: wanted.length })
  })
  await extractFolder(entries, manifest.overrides || 'overrides', a.instanceRoot)
  return { name: project.name ?? manifest.name ?? 'Modpack', mc, loader, loaderVersion: lver.join('-') || undefined, icon: project.logo?.url ?? undefined, version: file.displayName, skipped }
}
