import type { McVersion } from '../types'

export const LOADERS = ['Vanilla', 'Fabric', 'Forge', 'NeoForge', 'Quilt'] as const
let cache: Promise<McVersion[]> | null = null
export const fetchVersions = (): Promise<McVersion[]> => (cache ??= window.api.versions().catch((e) => { cache = null; throw e }))
// Loader -> supported Minecraft ids (null = unknown, e.g. offline). Cached for the session.
let supportCache: Promise<Record<string, Set<string> | null>> | null = null
export const fetchLoaderSupport = (ids: string[]): Promise<Record<string, Set<string> | null>> => (supportCache ??= window.api.loaderSupport(ids)
  .then((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ? new Set(v) : null])))
  .then((r) => { if (Object.values(r).some((v) => v === null)) supportCache = null; return r }) // retry later when a source was unreachable
  .catch((e) => { supportCache = null; throw e }))
export const isValidUsername = (n: string) => /^[A-Za-z0-9_]{3,16}$/.test(n)
// Offline profiles get a random local id. This is NOT a Mojang UUID and never impersonates a premium account.
export const localId = () => crypto.randomUUID()

export { BLOCK_ICONS as ICONS } from '../components/InstanceIcon'
export const fmtTime = (ms = 0) => { const m = Math.round(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m` }
export const ago = (t?: number) => { if (!t) return 'Never'; const d = Math.floor((Date.now() - t) / 86400000); return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago` }
