import { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } from 'electron'
import { totalmem } from 'os'
import { basename, join, resolve } from 'path'
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, writeFileSync, readFileSync, unlinkSync, rmSync, statSync } from 'fs'
import { detectJava, launch, offlineUuid } from './launcher'
import { loaderSupport } from './loaderSupport'
import { installModpack } from './modpack'
import type { LaunchOpts } from '../src/types'

let ctrl: AbortController | null = null
const hubControllers = new Map<number, AbortController>()
const curseForgeKeyFile = () => join(app.getPath('userData'), 'curseforge-key.enc')
const readCurseForgeKey = () => { try { const p = curseForgeKeyFile(); return existsSync(p) && safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(readFileSync(p)) : (process.env.CURSEFORGE_API_KEY || '') } catch { return process.env.CURSEFORGE_API_KEY || '' } }

async function curseForgeRequestError(action: string, response: Response): Promise<Error> {
  let detail = ''
  try { detail = (await response.text()).trim().slice(0, 500) } catch { /* response body unavailable */ }
  if (response.status === 403) {
    return new Error(`CurseForge denied ${action} (HTTP 403). The request reached CurseForge, but this API key or application is not authorized. Open Settings → CurseForge and replace the key with the raw API key from your CurseForge developer console. If a newly generated key still receives 403, API access may need approval from CurseForge. ${detail ? `Provider detail: ${detail}` : ''}`)
  }
  return new Error(`CurseForge ${action} failed (HTTP ${response.status}). ${detail}`.trim())
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 1120, minHeight: 720,
    backgroundColor: '#00000000',
    backgroundMaterial: 'acrylic',
    title: 'Amagiri Launcher',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: '#f6e8f2', height: 54 },
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  if (process.env['ELECTRON_RENDERER_URL']) win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('app:system', () => ({ totalMemMb: Math.floor(totalmem() / (1024 * 1024)) }))
  ipcMain.handle('shell:openDir', async (_e, dir: string) => {
    const target = String(dir || '').trim() || join(app.getPath('appData'), '.amagiri')
    mkdirSync(target, { recursive: true })
    const error = await shell.openPath(target)
    if (error) throw new Error(error)
  })
  ipcMain.handle('curseforge:key-status', () => ({ configured: Boolean(readCurseForgeKey()) }))
  ipcMain.handle('curseforge:set-key', (_e, value: string) => { const key = String(value ?? ''); const file = curseForgeKeyFile(); if (key.length === 0) { if (existsSync(file)) unlinkSync(file); return { configured: false } } if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows secure storage is unavailable. Configure CURSEFORGE_API_KEY in the launcher environment instead.'); mkdirSync(app.getPath('userData'), { recursive: true }); writeFileSync(file, safeStorage.encryptString(key)); return { configured: true } })
  ipcMain.handle('mc:versions', async () => {
    const res = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json')
    if (!res.ok) throw new Error(`Mojang version manifest returned ${res.status}`)
    const data = (await res.json()) as { versions: { id: string; type: string; releaseTime: string }[] }
    return data.versions.map(({ id, type, releaseTime }) => ({ id, type, releaseTime }))
  })
  ipcMain.handle('loaders:support', (_e, ids: string[]) => loaderSupport(Array.isArray(ids) ? ids.map(String) : []))
  ipcMain.handle('java:detect', () => detectJava())
  ipcMain.handle('java:runtimes', (_e, dir: string) => { const root = join(dir || join(app.getPath('appData'), '.amagiri'), 'runtime'); return [{ id: 'legacy', name: 'Java 8 (Legacy)', component: 'jre-legacy', major: 8 }, { id: 'alpha', name: 'Java 16 (Alpha)', component: 'java-runtime-alpha', major: 16 }, { id: 'beta', name: 'Java 17 (Beta)', component: 'java-runtime-beta', major: 17 }, { id: 'gamma', name: 'Java 17 (Gamma)', component: 'java-runtime-gamma', major: 17 }, { id: 'delta', name: 'Java 21 (Delta)', component: 'java-runtime-delta', major: 21 }, { id: 'epsilon', name: 'Java 25 (Epsilon)', component: 'java-runtime-epsilon', major: 25 }].map(r => ({ ...r, installed: existsSync(join(root, r.component, 'windows-x64', r.component, '.ok')) && existsSync(join(root, r.component, 'windows-x64', r.component, 'bin', 'javaw.exe')) })) })
  ipcMain.handle('dialog:file', async (_e, ext: string[] | undefined) => {
    const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: ext ? [{ name: 'File', extensions: ext }] : undefined })
    return r.canceled ? null : r.filePaths[0]
  })
  ipcMain.handle('dialog:dir', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })
  ipcMain.handle('shell:open', (_e, url: string) => (/^https:\/\//.test(url) ? shell.openExternal(url) : undefined))
  ipcMain.handle('account:uuid', (_e, name: string) => offlineUuid(String(name)))
  ipcMain.handle('game:cancel', () => ctrl?.abort())
  ipcMain.handle('game:launch', async (e, o: LaunchOpts) => {
    if (ctrl) throw new Error('A launch is already in progress')
    const win = BrowserWindow.fromWebContents(e.sender)
    ctrl = new AbortController()
    const signal = ctrl.signal
    try {
      await launch({ ...o, dir: o.dir || join(app.getPath('appData'), '.amagiri') }, (ch, d) => e.sender.send(ch, d), signal, app.getVersion())
      if (o.closeOnLaunch) win?.close()
    } catch (err) {
      throw new Error(signal.aborted ? 'Cancelled' : (err as Error).message)
    } finally { ctrl = null }
  })
  const root = (d: string) => d || join(app.getPath('appData'), '.amagiri')
  const gdir = (d: string, id: string) => { if (!/^[\w-]+$/.test(id)) throw new Error('Bad instance id'); return join(root(d), 'instances', id) }
  const KINDS: Record<string, string> = { mods: 'mods', resourcepacks: 'resourcepacks', shaderpacks: 'shaderpacks', worlds: 'saves', datapacks: 'datapacks' }
  const kdir = (d: string, id: string, k: string) => join(gdir(d, id), KINDS[k] ?? 'mods')
  ipcMain.handle('inst:browse', (_e, d: string, id: string, relative = '') => {
    const base = gdir(d, id)
    const target = resolve(base, String(relative || '').replace(/\\/g, '/'))
    if (target !== base && !target.startsWith(base + (process.platform === 'win32' ? '\\' : '/'))) throw new Error('Invalid instance path')
    if (!existsSync(target)) return []
    return readdirSync(target, { withFileTypes: true }).map((entry) => {
      const full = join(target, entry.name)
      let size = 0, modified = 0
      try { const st = statSync(full); size = st.isFile() ? st.size : 0; modified = st.mtimeMs } catch { /* item may disappear while browsing */ }
      return { name: entry.name, type: entry.isDirectory() ? 'directory' : 'file', size, modified }
    }).sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1)
  })
  ipcMain.handle('inst:list', (_e, d: string, id: string, k: string) => {
    const p = kdir(d, id, k)
    return existsSync(p) ? readdirSync(p, { withFileTypes: true }).filter((e) => (k === 'worlds' ? e.isDirectory() : e.isFile())).map((e) => e.name) : []
  })
  ipcMain.handle('inst:toggle', (_e, d: string, id: string, k: string, n: string) => {
    const p = kdir(d, id, k), f = basename(n)
    renameSync(join(p, f), join(p, f.endsWith('.disabled') ? f.slice(0, -9) : f + '.disabled'))
  })
  ipcMain.handle('inst:remove', (_e, d: string, id: string, k: string, n: string) => shell.trashItem(join(kdir(d, id, k), basename(n))))
  ipcMain.handle('inst:add', async (_e, d: string, id: string, k: string) => {
    const r = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
    if (r.canceled) return 0
    const p = kdir(d, id, k); mkdirSync(p, { recursive: true })
    r.filePaths.forEach((f) => copyFileSync(f, join(p, basename(f))))
    return r.filePaths.length
  })
  ipcMain.handle('inst:exists', (_e, d: string, id: string) => existsSync(gdir(d, id)))
  ipcMain.handle('inst:open', async (_e, d: string, id: string) => {
    const p = gdir(d, id)
    if (!existsSync(p)) throw new Error('Instance folder is missing. Remove this entry from your Library or restore its folder.')
    const error = await shell.openPath(p)
    if (error) throw new Error(`Could not open instance folder: ${error}`)
  })
  ipcMain.handle('inst:delete', async (_e, d: string, id: string) => {
    const p = gdir(d, id)
    // A missing folder is an orphaned Library entry, not a failed filesystem delete.
    // Return a result so the renderer can safely remove its metadata only.
    if (!existsSync(p)) return { folderFound: false }
    try {
      await shell.trashItem(p)
      return { folderFound: true }
    } catch (error) {
      // The folder may have been removed externally after the existence check.
      if (!existsSync(p)) return { folderFound: false }
      throw error
    }
  })
  ipcMain.handle('modpack:install', async (e, a: { dir: string; instanceId: string; source: 'modrinth' | 'curseforge'; projectId: string }) => {
    if (ctrl) throw new Error('Another download is already in progress')
    if (!['modrinth', 'curseforge'].includes(a.source)) throw new Error('Unknown modpack source')
    const instanceRoot = gdir(a.dir, a.instanceId)
    ctrl = new AbortController()
    const signal = ctrl.signal
    try { return await installModpack({ source: a.source, projectId: String(a.projectId), instanceRoot, curseForgeKey: readCurseForgeKey() }, (ch, d) => e.sender.send(ch, d), signal) }
    catch (err) { rmSync(instanceRoot, { recursive: true, force: true }); throw new Error(signal.aborted ? 'Cancelled' : (err as Error).message) }
    finally { ctrl = null }
  })
  ipcMain.handle('hub:install', async (_e, args: { dir: string; instanceId: string; source: 'modrinth' | 'curseforge'; projectId: string; type: string; mc: string; loader: string; world?: string }) => {
    if (!/^[\w-]+$/.test(args.instanceId)) throw new Error('Invalid instance id')
    const instanceRoot = gdir(args.dir, args.instanceId)
    const allowedTypes = ['mod', 'resourcepack', 'shader', 'datapack']
    if (!allowedTypes.includes(args.type)) throw new Error('In-app install currently supports mods, resource packs, shaders and data packs.')
    let destination = join(instanceRoot, ({ mod: 'mods', resourcepack: 'resourcepacks', shader: 'shaderpacks', datapack: 'datapacks' } as Record<string, string>)[args.type])
    if (args.type === 'datapack') {
      if (!args.world || basename(args.world) !== args.world || args.world.includes('..')) throw new Error('Choose a world before installing a data pack.')
      destination = join(instanceRoot, 'saves', args.world, 'datapacks')
      if (!resolve(destination).startsWith(resolve(instanceRoot, 'saves') + (process.platform === 'win32' ? '\\' : '/'))) throw new Error('Invalid world destination')
    }
    let fileUrl = '', fileName = ''
    if (args.source === 'modrinth') {
      const q = new URLSearchParams()
      q.set('game_versions', JSON.stringify([args.mc]))
      if (args.type === 'mod' && args.loader && args.loader.toLowerCase() !== 'vanilla') q.set('loaders', JSON.stringify([args.loader.toLowerCase()]))
      const r = await fetch(`https://api.modrinth.com/v2/project/${encodeURIComponent(args.projectId)}/version?${q.toString()}`, { headers: { 'User-Agent': 'AmagiriLauncher/1.0' } })
      if (!r.ok) throw new Error(`Modrinth version lookup failed (${r.status})`)
      const versions = await r.json() as { version_type: string; files: { url: string; filename: string; primary?: boolean }[] }[]
      const version = versions.find(v => v.version_type === 'release' && v.files?.length) ?? versions.find(v => v.files?.length)
      const file = version?.files?.find(f => f.primary) ?? version?.files?.[0]
      if (!file) throw new Error(`No compatible ${args.type} release was found for Minecraft ${args.mc} (${args.loader}).`)
      fileUrl = file.url; fileName = file.filename
    } else {
      const key = readCurseForgeKey()
      if (!key) throw new Error('CurseForge API key is not configured. Add a valid API key in Settings → CurseForge.')
      const classId: Record<string, number> = { mod: 6, resourcepack: 12, shader: 6552, datapack: 6945 }
      if (!classId[args.type]) throw new Error('CurseForge in-app installation for this content type is not available yet.')
      const u = new URL(`https://api.curseforge.com/v1/mods/${encodeURIComponent(args.projectId)}/files`)
      u.searchParams.set('gameVersion', args.mc); u.searchParams.set('pageSize', '50'); u.searchParams.set('index', '0')
      const loaderIds: Record<string, number> = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 }
      if (args.type === 'mod' && loaderIds[args.loader.toLowerCase()]) u.searchParams.set('modLoaderType', String(loaderIds[args.loader.toLowerCase()]))
      const r = await fetch(u, { headers: { 'x-api-key': key, Accept: 'application/json' } })
      if (!r.ok) throw await curseForgeRequestError('file lookup', r)
      const body = await r.json() as { data: { id: number; fileName: string; downloadUrl?: string | null }[] }
      const file = body.data?.find(f => f.downloadUrl) ?? body.data?.[0]
      if (!file) throw new Error(`No compatible CurseForge file found for Minecraft ${args.mc}.`)
      fileName = file.fileName
      if (file.downloadUrl) fileUrl = file.downloadUrl
      else {
        const d = await fetch(`https://api.curseforge.com/v1/mods/${encodeURIComponent(args.projectId)}/files/${file.id}/download-url`, { headers: { 'x-api-key': key, Accept: 'application/json' } })
        if (!d.ok) throw await curseForgeRequestError('download URL lookup', d)
        const j = await d.json() as { data?: string }; fileUrl = j.data || ''
      }
    }
    if (!/^https:\/\//.test(fileUrl)) throw new Error('Provider returned an invalid download URL')
    mkdirSync(destination, { recursive: true })
    const safeName = basename(fileName).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    const target = join(destination, safeName)
    if (!resolve(target).startsWith(resolve(destination) + (process.platform === 'win32' ? '\\' : '/'))) throw new Error('Invalid file destination')
    const response = await fetch(fileUrl)
    if (!response.ok || !response.body) throw new Error(`Download failed (${response.status})`)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (!bytes.length) throw new Error('Provider returned an empty file')
    writeFileSync(target, bytes)
    return { fileName: safeName, path: target }
  })
  ipcMain.handle('hub:versions', async () => {
    const r = await fetch('https://api.modrinth.com/v2/tag/game_version', { headers: { 'User-Agent': 'AmagiriLauncher/1.0' } })
    if (!r.ok) throw new Error(`Modrinth versions returned ${r.status}`)
    const rows = await r.json() as { version: string; version_type: string }[]
    return rows.filter((v) => v.version_type === 'release').map((v) => v.version)
  })
  ipcMain.handle('hub:browse', async (e, params: {
    source: 'modrinth' | 'curseforge'; query: string; type: string; sort: string
    versions: string[]; loaders: string[]; categories: string[]; environment: string[]; offset: number; limit: number
  }) => {
    hubControllers.get(e.sender.id)?.abort()
    const requestController = new AbortController(); hubControllers.set(e.sender.id, requestController)
    const offset = Math.max(0, Math.floor(params.offset || 0)), limit = Math.min(50, Math.max(1, Math.floor(params.limit || 18)))
    if (params.source === 'curseforge') {
      const key = readCurseForgeKey()
      if (!key) throw new Error('CurseForge API key is not configured in Settings. Modrinth remains available.')
      const classIds: Record<string, number> = { modpack: 4471, mod: 6, resourcepack: 12, world: 17, shader: 6552, datapack: 6945 }
      const classId = classIds[params.type]
      if (!classId) throw new Error('CurseForge category search for this content type is not currently supported by the configured provider integration.')
      const u = new URL('https://api.curseforge.com/v1/mods/search')
      u.searchParams.set('gameId', '432'); u.searchParams.set('classId', String(classId)); u.searchParams.set('pageSize', String(limit)); u.searchParams.set('index', String(offset));
      if (params.query) u.searchParams.set('searchFilter', params.query)
      if (params.versions?.[0]) u.searchParams.set('gameVersion', params.versions[0])
      const loaderIds: Record<string, number> = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 }
      if (params.loaders?.[0] && loaderIds[params.loaders[0]]) u.searchParams.set('modLoaderType', String(loaderIds[params.loaders[0]]))
      if (params.sort === 'downloads') { u.searchParams.set('sortField', '6'); u.searchParams.set('sortOrder', 'desc') }
      else if (params.sort === 'newest') { u.searchParams.set('sortField', '11'); u.searchParams.set('sortOrder', 'desc') }
      const r = await fetch(u, { headers: { 'x-api-key': key, 'Accept': 'application/json' }, signal: requestController.signal })
      if (!r.ok) throw await curseForgeRequestError('project search', r)
      const body = await r.json() as { data: { id: number; name: string; slug: string; summary: string; logo?: { url: string }; authors?: { name: string }[]; downloadCount: number; categories?: { name: string }[]; dateCreated?: string; dateModified?: string }[]; pagination?: { totalCount?: number } }
      const items = body.data.map((h) => ({ id: String(h.id), slug: h.slug, type: params.type, title: h.name, desc: h.summary || '', icon: h.logo?.url || null, author: h.authors?.[0]?.name || 'Unknown', downloads: h.downloadCount || 0, categories: (h.categories || []).map((c) => c.name), versions: [], loaders: [], source: 'curseforge' as const, projectUrl: `https://www.curseforge.com/minecraft/${params.type === 'modpack' ? 'modpacks' : 'mc-mods'}/${h.slug}`, dateCreated: h.dateCreated, dateModified: h.dateModified }))
      return { items, total: body.pagination?.totalCount || items.length, offset, limit }
    }
    if (params.type === 'world') throw new Error('Modrinth does not expose a dedicated World project type. Switch to CurseForge for world projects.')
    const facets: string[][] = [[`project_type:${params.type}`]]
    if (params.versions?.length) facets.push(params.versions.map((v) => `versions:${v}`))
    if (params.loaders?.length) facets.push(params.loaders.map((l) => `categories:${l}`))
    if (params.categories?.length) facets.push(params.categories.map((c) => `categories:${c}`))
    const index = ({ relevance: 'relevance', downloads: 'downloads', follows: 'follows', newest: 'newest', updated: 'updated' } as Record<string, string>)[params.sort] || 'downloads'
    const u = new URL('https://api.modrinth.com/v2/search'); u.searchParams.set('query', params.query || ''); u.searchParams.set('index', index); u.searchParams.set('limit', String(limit)); u.searchParams.set('offset', String(offset)); u.searchParams.set('facets', JSON.stringify(facets))
    const r = await fetch(u, { headers: { 'User-Agent': 'AmagiriLauncher/1.0' }, signal: requestController.signal })
    if (!r.ok) throw new Error(`Modrinth returned ${r.status}`)
    const body = await r.json() as { total_hits: number; hits: { project_id: string; slug: string; project_type: string; title: string; description: string; icon_url: string | null; author: string; downloads: number; follows: number; categories: string[]; versions: string[]; date_created: string; date_modified: string; client_side?: string; server_side?: string }[] }
    let items = body.hits.map((h) => ({ id: h.project_id, slug: h.slug, type: h.project_type as 'modpack' | 'mod' | 'resourcepack' | 'shader' | 'datapack' | 'world', title: h.title, desc: h.description, icon: h.icon_url, author: h.author, downloads: h.downloads, follows: h.follows, categories: h.categories || [], versions: h.versions || [], loaders: (h.categories || []).filter((c) => ['fabric','forge','neoforge','quilt','liteloader','legacy-fabric'].includes(c)), clientSide: h.client_side, serverSide: h.server_side, dateCreated: h.date_created, dateModified: h.date_modified, source: 'modrinth' as const, projectUrl: `https://modrinth.com/${h.project_type}/${h.slug}` }))
    if (params.type === 'mod' && params.environment?.length) items = items.filter((h) => {
      const c = h.clientSide || 'unknown', sv = h.serverSide || 'unknown'
      const env = c === 'unsupported' && sv !== 'unsupported' ? 'server' : sv === 'unsupported' && c !== 'unsupported' ? 'client' : c === 'unknown' || sv === 'unknown' ? 'unknown' : 'both'
      return params.environment.includes(env)
    })
    return { items, total: body.total_hits, offset, limit }
  })
  ipcMain.handle('hub:search', async (_e, q: string, type: string, loader: string) => {
    const facets: string[][] = [[`project_type:${type}`]]
    if (loader) facets.push([`categories:${loader}`])
    const r = await fetch(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(q)}&index=${q ? 'relevance' : 'downloads'}&limit=18&facets=${encodeURIComponent(JSON.stringify(facets))}`, { headers: { 'User-Agent': 'AmagiriLauncher/1.0' } })
    if (!r.ok) throw new Error(`Modrinth returned ${r.status}`)
    const j = (await r.json()) as { hits: { project_id: string; slug: string; project_type: string; title: string; description: string; icon_url: string | null; author: string; downloads: number }[] }
    return j.hits.map((h) => ({ id: h.project_id, slug: h.slug, type: h.project_type, title: h.title, desc: h.description, icon: h.icon_url, author: h.author, downloads: h.downloads }))
  })
  createWindow()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit())
