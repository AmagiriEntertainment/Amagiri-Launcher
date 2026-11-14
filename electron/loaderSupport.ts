// Which Minecraft versions each mod loader actually publishes builds for.
// Shared by the installer (launcher.ts) and the "New Instance" dialog so both agree.

const TTL = 60 * 60 * 1000
const timeout = () => AbortSignal.timeout(12000)

/** NeoForge version prefixes for a Minecraft release id, e.g. 1.21.1 -> "21.1", 26.1 -> "26.1". Snapshots have none. */
export function neoForgeFamilies(mc: string): string[] {
  const m = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(mc)
  if (!m) return []
  return Number(m[1]) === 1 ? [`${m[2]}.${m[3] ?? '0'}`] : [`${m[1]}.${m[2]}`]
}

/** Picks the newest NeoForge build that belongs to `mc`, or '' when none is published. */
export function pickNeoForgeVersion(mc: string, versions: string[]): string {
  const families = neoForgeFamilies(mc)
  return versions
    .filter((v) => v.startsWith(`${mc}-`) || families.some((f) => v.startsWith(f + '.')))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .at(-1) ?? ''
}

const xmlVersions = (xml: string) => [...xml.matchAll(/<version>([^<]+)<\/version>/g)].map((x) => x[1] as string)
const text = async (url: string) => { const r = await fetch(url, { signal: timeout() }); if (!r.ok) throw new Error(`${url} -> ${r.status}`); return r.text() }
const json = async (url: string) => { const r = await fetch(url, { signal: timeout() }); if (!r.ok) throw new Error(`${url} -> ${r.status}`); return r.json() as Promise<any> }

type Sources = { fabric: Set<string>; quilt: Set<string>; forge: Set<string>; neo: string[] }
let cache: { at: number; data: Partial<Sources> } | null = null

async function load(): Promise<Partial<Sources>> {
  if (cache && Date.now() - cache.at < TTL) return cache.data
  const [fabric, quilt, forge, neo] = await Promise.allSettled([
    json('https://meta.fabricmc.net/v2/versions/game').then((l: { version: string }[]) => new Set(l.map((x) => x.version))),
    json('https://meta.quiltmc.org/v3/versions/game').then((l: { version: string }[]) => new Set(l.map((x) => x.version))),
    text('https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml').then((x) => new Set(xmlVersions(x).map((v) => v.split('-')[0] as string))),
    text('https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml').then(xmlVersions)
  ])
  const data: Partial<Sources> = {}
  if (fabric.status === 'fulfilled') data.fabric = fabric.value
  if (quilt.status === 'fulfilled') data.quilt = quilt.value
  if (forge.status === 'fulfilled') data.forge = forge.value
  if (neo.status === 'fulfilled') data.neo = neo.value
  // Only cache a complete result, so a flaky network does not stick for an hour.
  if (Object.keys(data).length === 4) cache = { at: Date.now(), data }
  return data
}

/**
 * For each loader, the subset of `mcIds` it supports. A loader whose metadata
 * could not be fetched is `null` (unknown): the UI must keep showing it rather than hide it.
 */
export async function loaderSupport(mcIds: string[]): Promise<Record<string, string[] | null>> {
  const d = await load()
  const pick = (set: Set<string> | undefined) => (set ? mcIds.filter((id) => set.has(id)) : null)
  return {
    Vanilla: mcIds,
    Fabric: pick(d.fabric),
    Quilt: pick(d.quilt),
    Forge: pick(d.forge),
    NeoForge: d.neo ? mcIds.filter((id) => pickNeoForgeVersion(id, d.neo as string[]) !== '') : null
  }
}
