export type PageId = 'overview' | 'hub' | 'servers' | 'skins' | 'library' | 'instance' | 'accounts' | 'java' | 'downloads' | 'settings'
export interface Account { id: string; name: string; type: 'offline' | 'microsoft'; uuid: string }
export interface Instance {
  id: string; name: string; mc: string; loader: string; icon: string; installed?: boolean; lastPlayed?: number; playtime?: number
  notes?: string; javaRuntime?: string; javaPath?: string
  memoryMode?: 'global' | 'custom'; minRam?: number; maxRam?: number
  windowMode?: 'global' | 'custom'; w?: number; h?: number; fullscreen?: boolean
  jvmMode?: 'global' | 'custom'; jvm?: string; server?: string
  loaderVersion?: string; source?: 'modpack'
}
export interface ModpackResult { name: string; mc: string; loader: string; loaderVersion?: string; icon?: string; version?: string; skipped: number }
export interface JavaInst { name: string; path: string; major: number }
export interface McVersion { id: string; type: string; releaseTime: string }
export type ContentSource = 'modrinth' | 'curseforge'
export type ContentType = 'modpack' | 'mod' | 'resourcepack' | 'shader' | 'datapack' | 'world'
export type ModEnvironment = 'client' | 'server' | 'both' | 'unknown'
export interface HubItem {
  id: string; slug: string; type: ContentType; title: string; desc: string; icon: string | null
  author: string; downloads: number; follows?: number; categories: string[]; versions: string[]
  loaders: string[]; clientSide?: string; serverSide?: string; dateCreated?: string; dateModified?: string
  source: ContentSource; projectUrl: string
}
export interface HubSearchParams {
  source: ContentSource; query: string; type: ContentType; sort: 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'
  versions: string[]; loaders: string[]; categories: string[]; environment: ModEnvironment[]; offset: number; limit: number
}
export interface HubSearchResult { items: HubItem[]; total: number; offset: number; limit: number }
export interface Settings { minRam: number; maxRam: number; java: string; javaRuntime: string; jvm: string; w: number; h: number; fullscreen: boolean; dir: string; closeOnLaunch: boolean; lang: string; autoUpdate: boolean }
export interface LaunchOpts { mc: string; loader: string; instId: string; dir: string; java: string; minRam: number; maxRam: number; jvm: string; w: number; h: number; fullscreen?: boolean; server?: string; name: string; closeOnLaunch: boolean; javaRuntime?: string; installOnly?: boolean; loaderVersion?: string }
export interface GameState { status: 'idle' | 'preparing' | 'running' | 'error'; phase: string; done: number; total: number; files: number; totalFiles: number; speed: number; log: string[]; error: string }
export type Progress = Partial<GameState> & { phase: string }
export type Notify = (msg: string, variant?: 'success' | 'danger' | 'warning' | 'info') => void
export interface Ctx {
  accounts: Account[]; setAccounts: (a: Account[]) => void
  activeId: string; setActiveId: (id: string) => void
  instances: Instance[]; setInstances: (i: Instance[]) => void
  selected: string; setSelected: (id: string) => void
  settings: Settings; setSettings: (s: Settings) => void
  notify: Notify; go: (p: PageId) => void; version: string
  game: GameState; play: () => void; installModpack: (item: HubItem) => Promise<void>; install: (i: Instance, andPlay?: boolean) => void; cancel: () => void
  openNew: () => void; openInstance: (id: string) => void; hubTargetId: string; hubTargetType: ContentType; openHubForInstance: (id: string, type: ContentType) => void
}
declare global {
  interface Window {
    api: {
      appVersion(): Promise<string>
      systemInfo(): Promise<{ totalMemMb: number }>
      openDir(dir: string): Promise<void>
      curseForgeKeyStatus(): Promise<{ configured: boolean }>
      setCurseForgeKey(value: string): Promise<{ configured: boolean }>
      versions(): Promise<McVersion[]>
      detectJava(): Promise<JavaInst[]>
      loaderSupport(mcIds: string[]): Promise<Record<string, string[] | null>>
      modpackInstall(args: { dir: string; instanceId: string; source: ContentSource; projectId: string }): Promise<ModpackResult>
      javaRuntimes(dir: string): Promise<{ id: string; name: string; component: string; major: number; installed: boolean }[]>
      pickFile(ext?: string[]): Promise<string | null>
      pickDir(): Promise<string | null>
      openExternal(url: string): Promise<void>
      offlineUuid(name: string): Promise<string>
      launch(o: LaunchOpts): Promise<void>
      cancelLaunch(): Promise<void>
      onProgress(cb: (p: Progress) => void): () => void
      onLog(cb: (line: string) => void): () => void
      onExit(cb: (code: number) => void): () => void
      hubSearch(q: string, type: string, loader: string): Promise<HubItem[]>
      hubBrowse(params: HubSearchParams): Promise<HubSearchResult>
      hubVersions(): Promise<string[]>
      hubInstall(args: { dir: string; instanceId: string; source: ContentSource; projectId: string; type: ContentType; mc: string; loader: string; world?: string }): Promise<{ fileName: string; path: string }>
      instList(dir: string, id: string, kind: string): Promise<string[]>
      instBrowse(dir: string, id: string, relativePath?: string): Promise<{ name: string; type: 'directory' | 'file'; size: number; modified: number }[]>
      instToggle(dir: string, id: string, kind: string, name: string): Promise<void>
      instRemove(dir: string, id: string, kind: string, name: string): Promise<void>
      instAdd(dir: string, id: string, kind: string): Promise<number>
      instOpen(dir: string, id: string): Promise<void>
      instExists(dir: string, id: string): Promise<boolean>
      instDelete(dir: string, id: string): Promise<{ folderFound: boolean }>
    }
  }
}
