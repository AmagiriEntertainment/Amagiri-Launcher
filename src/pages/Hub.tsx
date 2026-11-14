import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDownWideNarrow, ArrowUpRight, Check, ChevronLeft, ChevronRight, CircleHelp, Download, ExternalLink, Filter, Grid2X2, List, Package, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react'
import { PageHead } from '../components/ui'
import type { ContentSource, ContentType, HubItem, HubSearchParams, HubSearchResult, ModEnvironment, Ctx } from '../types'

const TYPES: { id: ContentType; label: string; description: string; placeholder: string }[] = [
  { id: 'modpack', label: 'Modpacks', description: 'Curated adventures, progression systems, and complete Minecraft experiences.', placeholder: 'Search modpacks…' },
  { id: 'mod', label: 'Mods', description: 'Discover gameplay additions, utilities, performance tools, and libraries.', placeholder: 'Search mods…' },
  { id: 'resourcepack', label: 'Resource Packs', description: 'Change the look and feel of blocks, items, interfaces, and worlds.', placeholder: 'Search resource packs…' },
  { id: 'shader', label: 'Shaders', description: 'Bring atmosphere, lighting, shadows, and cinematic visuals to Minecraft.', placeholder: 'Search shaders…' },
  { id: 'datapack', label: 'Data Packs', description: 'Customize vanilla mechanics with new recipes, loot, and features.', placeholder: 'Search data packs…' },
  { id: 'world', label: 'Worlds', description: 'Explore maps, builds, challenges, and ready-to-play worlds.', placeholder: 'Search worlds…' }
]
const LOADERS = ['fabric', 'forge', 'neoforge', 'quilt', 'liteloader', 'legacy-fabric']
const SORTS = [{ id: 'downloads', label: 'Most downloaded' }, { id: 'relevance', label: 'Relevance' }, { id: 'follows', label: 'Most followed' }, { id: 'newest', label: 'Newest' }, { id: 'updated', label: 'Recently updated' }] as const
const ENVIRONMENTS: { id: ModEnvironment; label: string; help: string }[] = [
  { id: 'client', label: 'Client side', help: 'Client required; server unsupported.' },
  { id: 'server', label: 'Server side', help: 'Server required; client unsupported.' },
  { id: 'both', label: 'Server and client', help: 'Supported on both sides, including optional support.' },
  { id: 'unknown', label: 'Unknown', help: 'The provider has not supplied reliable environment metadata.' }
]
const compact = (n: number) => Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n)

function Section({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return <section className="discover-filter-section"><div className="discover-filter-title">{title}{hint && <span title={hint}><CircleHelp size={12}/></span>}</div>{children}</section>
}
function Choice({ active, children, onClick, disabled = false }: { active: boolean; children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" disabled={disabled} className={`discover-choice ${active ? 'active' : ''}`} onClick={onClick}>{children}</button>
}
function ContentCard({ item, onOpen }: { item: HubItem; onOpen: (h: HubItem) => void }) {
  return <motion.article layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }} transition={{ duration: .18 }} className="discover-card" onClick={() => onOpen(item)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(item) }}>
    <div className="discover-card-cover"><div className="discover-card-cover-fallback"><Package size={34}/></div>{item.icon && <img src={item.icon} loading="lazy" alt="" onError={(e) => { e.currentTarget.style.display = 'none' }}/>}<span className="discover-provider">{item.source === 'modrinth' ? 'MODRINTH' : 'CURSEFORGE'}</span><span className="discover-type-tag">{item.type}</span></div>
    <div className="discover-card-body"><div className="discover-card-heading"><div className="discover-card-title" title={item.title}>{item.title}</div><span className="discover-downloads"><Download size={11}/> {compact(item.downloads)}</span></div>
      <p className="discover-card-desc">{item.desc || 'No description provided by the project.'}</p>
      <div className="discover-card-meta"><span>by {item.author}</span><span>{item.categories.slice(0, 2).join(' · ') || item.type}</span></div>
      <div className="discover-card-footer"><div className="discover-tags">{item.versions.slice(0, 2).map((v) => <span key={v}>{v}</span>)}{item.loaders.slice(0, 1).map((l) => <span key={l}>{l}</span>)}</div><span className="discover-open-label">Details <ArrowUpRight size={13}/></span></div>
    </div>
  </motion.article>
}


// Compact card used by the Overview dashboard. Keep this separate from the
// full Discover card because Overview passes the legacy `h` prop.
export function HubCard({ h }: { h: HubItem }) {
  const projectUrl = h.projectUrl || `https://modrinth.com/${h.type || 'modpack'}/${h.slug || h.id}`
  return <button type="button" className="discover-card overview-hub-card" onClick={() => window.api.openExternal(projectUrl)}>
    <div className="discover-card-cover">
      <div className="discover-card-cover-fallback"><Package size={30}/></div>
      {h.icon && <img src={h.icon} loading="lazy" alt="" onError={(e) => { e.currentTarget.style.display = 'none' }}/>} 
      <span className="discover-provider">{h.source === 'curseforge' ? 'CURSEFORGE' : 'MODRINTH'}</span>
      <span className="discover-type-tag">{h.type || 'modpack'}</span>
    </div>
    <div className="discover-card-body">
      <div className="discover-card-heading"><span className="discover-card-title">{h.title}</span><span className="discover-downloads"><Download size={11}/> {compact(h.downloads || 0)}</span></div>
      <p className="discover-card-desc">{h.desc || 'Explore this Minecraft project.'}</p>
      <div className="discover-card-meta"><span>by {h.author || 'Unknown'}</span><span>Open project <ExternalLink size={10}/></span></div>
    </div>
  </button>
}

export default function Hub({ c }: { c: Ctx }) {
  const [type, setType] = useState<ContentType>(c.hubTargetType || 'modpack'), [source, setSource] = useState<ContentSource>('modrinth')
  const [query, setQuery] = useState(''), [sort, setSort] = useState<HubSearchParams['sort']>('downloads')
  const [versions, setVersions] = useState<string[]>([]), [versionOptions, setVersionOptions] = useState<string[]>([])
  const [loaders, setLoaders] = useState<string[]>([]), [categories, setCategories] = useState<string[]>([]), [environment, setEnvironment] = useState<ModEnvironment[]>([])
  const [result, setResult] = useState<HubSearchResult | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid'), [page, setPage] = useState(0), [selected, setSelected] = useState<HubItem | null>(null)
  const [categorySearch, setCategorySearch] = useState(''), [filtersOpen, setFiltersOpen] = useState(true)
  const [installTargetId, setInstallTargetId] = useState(c.hubTargetId || ''), [installWorld, setInstallWorld] = useState('')
  const [worldOptions, setWorldOptions] = useState<string[]>([]), [installBusy, setInstallBusy] = useState(false)
  const sequence = useRef(0)
  const current = TYPES.find((t) => t.id === type) || TYPES[0]
  const maxPages = result ? Math.max(1, Math.ceil(result.total / 18)) : 1
  const categoryOptions = useMemo(() => Array.from(new Set((result?.items || []).flatMap((i) => i.categories))).sort(), [result])
  const activeCount = versions.length + loaders.length + categories.length + environment.length
  const toggle = <T extends string>(list: T[], value: T, setter: (v: T[]) => void) => setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

  useEffect(() => { window.api.hubVersions().then(setVersionOptions).catch(() => setVersionOptions([])) }, [])
  useEffect(() => { const target = c.instances.find(i => i.id === c.hubTargetId); if (target) { setType(c.hubTargetType); setInstallTargetId(target.id); setVersions([target.mc]); setLoaders(target.loader.toLowerCase() === 'vanilla' ? [] : [target.loader.toLowerCase()]); } }, [c.hubTargetId, c.hubTargetType])
  useEffect(() => { const target = c.instances.find(i => i.id === installTargetId); if (target && selected?.type === 'datapack') window.api.instList(c.settings.dir, target.id, 'worlds').then(setWorldOptions).catch(() => setWorldOptions([])); else { setWorldOptions([]); setInstallWorld('') } }, [installTargetId, selected?.id, selected?.type])
  const runSearch = useCallback(async (targetPage = page) => {
    const id = ++sequence.current; setBusy(true); setError('')
    const params: HubSearchParams = { source, query, type, sort, versions, loaders: ['mod','modpack'].includes(type) ? loaders : [], categories, environment: type === 'mod' ? environment : [], offset: targetPage * 18, limit: 18 }
    try { const data = await window.api.hubBrowse(params); if (id === sequence.current) setResult(data) }
    catch (e) { if (id === sequence.current) { setResult(null); setError(e instanceof Error ? e.message : 'Unable to load content.') } }
    finally { if (id === sequence.current) setBusy(false) }
  }, [source, query, type, sort, versions, loaders, categories, environment, page])
  useEffect(() => { const t = window.setTimeout(() => { runSearch(0); setPage(0) }, 320); return () => window.clearTimeout(t) }, [source, query, type, sort, versions, loaders, categories, environment])
  const clearFilters = () => { const target = c.instances.find(i => i.id === c.hubTargetId); setVersions(target ? [target.mc] : []); setLoaders(target && ['mod','modpack'].includes(type) && target.loader.toLowerCase() !== 'vanilla' ? [target.loader.toLowerCase()] : []); setCategories([]); setEnvironment([]); setQuery(''); setSort('downloads'); setPage(0) }
  const setCategoryType = (next: ContentType) => { const target = c.instances.find(i => i.id === c.hubTargetId); setType(next); setPage(0); setLoaders(target && ['mod','modpack'].includes(next) && target.loader.toLowerCase() !== 'vanilla' ? [target.loader.toLowerCase()] : []); setCategories([]); setVersions(target ? [target.mc] : []); setEnvironment([]) }
  const changePage = (next: number) => { const safe = Math.max(0, Math.min(maxPages - 1, next)); setPage(safe); runSearch(safe) }
  const openProject = (item: HubItem) => { setSelected(item); setInstallTargetId(c.hubTargetId || '') }
  const installSelected = async () => {
    if (!selected) return
    const target = c.instances.find(i => i.id === installTargetId)
    if (!target) { c.notify('Choose an instance first.', 'warning'); return }
    if (!['mod', 'resourcepack', 'shader', 'datapack'].includes(selected.type)) { c.notify('In-app installation currently supports mods, resource packs, shaders and data packs.', 'warning'); return }
    if (selected.type === 'datapack' && !installWorld) { c.notify('Choose a world for this data pack.', 'warning'); return }
    setInstallBusy(true)
    try { const out = await window.api.hubInstall({ dir: c.settings.dir, instanceId: target.id, source: selected.source, projectId: selected.id, type: selected.type, mc: target.mc, loader: target.loader, world: installWorld || undefined }); c.notify(`${out.fileName} installed in ${target.name}`, 'success'); setSelected(null) }
    catch (e) { c.notify((e as Error).message || 'Install failed.', 'danger') }
    finally { setInstallBusy(false) }
  }
  const listItems = result?.items || []
  const compatibleInstances = selected ? c.instances.filter(i => { const versionOk = !selected.versions?.length || selected.versions.includes(i.mc); const loaderOk = selected.type !== 'mod' || selected.source !== 'modrinth' || !selected.loaders?.length || selected.loaders.includes(i.loader.toLowerCase()); return versionOk && loaderOk }) : c.instances

  return <div className="discover-page">
    <div className="discover-main-column">
      <PageHead title="Discover" sub="Explore the Minecraft community and find your next world." />
      <div className="discover-intro"><div><div className="discover-eyebrow">AMAGIRI CONTENT NETWORK</div><h2>{current.label}</h2><p>{current.description}</p></div><div className="discover-result-total"><strong>{result ? compact(result.total) : '—'}</strong><span>projects found</span></div></div>
      <div className="discover-search"><Search size={18}/><Form.Control aria-label="Search content" placeholder={current.placeholder} value={query} onChange={(e) => { setQuery(e.target.value); setPage(0) }}/>{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={15}/></button>}</div>
      <div className="discover-toolbar"><div className="discover-type-tabs">{TYPES.map((t) => <button key={t.id} className={type === t.id ? 'active' : ''} onClick={() => setCategoryType(t.id)}>{t.label}</button>)}</div>
        <div className="discover-toolbar-actions"><label className="discover-sort"><ArrowDownWideNarrow size={14}/><Form.Select size="sm" value={sort} onChange={(e) => setSort(e.target.value as HubSearchParams['sort'])}>{SORTS.map((s) => <option value={s.id} key={s.id}>{s.label}</option>)}</Form.Select></label><div className="discover-view-switch"><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} title="Grid view"><Grid2X2 size={15}/></button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} title="List view"><List size={16}/></button></div><button className="discover-mobile-filter" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={15}/> Filters</button></div>
      </div>
      {activeCount > 0 && <div className="discover-active-filters"><span>ACTIVE FILTERS</span>{versions.map((v) => <button key={v} onClick={() => toggle(versions, v, setVersions)}>{v}<X size={11}/></button>)}{loaders.map((v) => <button key={v} onClick={() => toggle(loaders, v, setLoaders)}>{v}<X size={11}/></button>)}{categories.map((v) => <button key={v} onClick={() => toggle(categories, v, setCategories)}>{v}<X size={11}/></button>)}{environment.map((v) => <button key={v} onClick={() => toggle(environment, v, setEnvironment)}>{ENVIRONMENTS.find((e) => e.id === v)?.label}<X size={11}/></button>)}<button className="clear-inline" onClick={clearFilters}>Clear all</button></div>}
      {error && <Alert variant="danger" className="discover-alert">{error}<button onClick={() => runSearch(page)}>Retry</button></Alert>}
      {busy && !result && <div className="discover-loading"><Spinner animation="border" size="sm"/> Fetching projects from {source === 'modrinth' ? 'Modrinth' : 'CurseForge'}…</div>}
      {!error && result && listItems.length === 0 && !busy && <div className="discover-empty"><Package size={30}/><strong>No projects found</strong><span>Try another search or remove some filters.</span><button onClick={clearFilters}>Clear filters</button></div>}
      {busy && result && <div className="discover-refreshing"><Spinner animation="border" size="sm"/> Updating results…</div>}
      <div className={`discover-results ${view === 'list' ? 'list-view' : ''}`}><AnimatePresence mode="popLayout">{listItems.map((item) => <ContentCard key={`${item.source}-${item.id}`} item={item} onOpen={openProject}/>)}</AnimatePresence></div>
      {result && result.total > 0 && <div className="discover-pagination"><span>Showing {result.offset + 1}–{Math.min(result.offset + result.items.length, result.total)} of {result.total.toLocaleString()}</span><div><button disabled={page === 0 || busy} onClick={() => changePage(page - 1)}><ChevronLeft size={15}/></button><span>{page + 1} / {maxPages}</span><button disabled={page + 1 >= maxPages || busy} onClick={() => changePage(page + 1)}><ChevronRight size={15}/></button></div></div>}
    </div>
    <aside className={`discover-filter-panel ${filtersOpen ? 'show' : ''}`}>
      <div className="discover-filter-header"><div><Filter size={15}/><strong>Filters</strong></div><button onClick={clearFilters} disabled={activeCount === 0 && !query}>Clear all</button></div>
      <div className="discover-filter-scroll">
        <Section title="SOURCE"><div className="discover-source-switch"><Choice active={source === 'modrinth'} onClick={() => { setSource('modrinth'); setPage(0) }}>◈ Modrinth</Choice><Choice active={source === 'curseforge'} onClick={() => { setSource('curseforge'); setPage(0) }}>✦ CurseForge</Choice></div>{source === 'curseforge' && <p className="discover-filter-note">CurseForge search requires CURSEFORGE_API_KEY. Provider capabilities vary by content type.</p>}</Section>
        <Section title="CONTENT TYPE"><div className="discover-filter-pills">{TYPES.map((t) => <Choice key={t.id} active={type === t.id} onClick={() => setCategoryType(t.id)}>{t.label}</Choice>)}</div></Section>
        <Section title="GAME VERSION"><Form.Select size="sm" disabled={!!c.hubTargetId} value={versions[0] || ''} onChange={(e) => setVersions(e.target.value ? [e.target.value] : [])}><option value="">Any version</option>{versionOptions.map((v) => <option key={v} value={v}>{v}</option>)}</Form.Select>{versions.length > 0 && <button className="discover-latest" onClick={() => setVersions([])}>Remove version filter</button>}</Section>
        {['mod','modpack'].includes(type) && source === 'modrinth' && <Section title="MOD LOADERS"><div className="discover-filter-pills">{LOADERS.map((l) => <Choice key={l} active={loaders.includes(l)} disabled={!!c.hubTargetId} onClick={() => toggle(loaders, l, setLoaders)}>{l}</Choice>)}</div></Section>}
        {type === 'mod' && source === 'modrinth' && <Section title="MOD ENVIRONMENT" hint="Uses the project's client_side and server_side metadata. Optional support is treated as compatible, not unsupported."><div className="discover-filter-checks">{ENVIRONMENTS.map((env) => <label key={env.id} title={env.help}><Form.Check type="checkbox" checked={environment.includes(env.id)} onChange={() => toggle(environment, env.id, setEnvironment)} label={env.label}/></label>)}</div></Section>}
        <Section title="CATEGORIES"><Form.Control size="sm" className="discover-category-search" placeholder="Find category…" value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)}/><div className="discover-filter-pills">{categoryOptions.filter((v) => v.toLowerCase().includes(categorySearch.toLowerCase())).map((v) => <Choice key={v} active={categories.includes(v)} onClick={() => toggle(categories, v, setCategories)}>{v}</Choice>)}</div>{categoryOptions.length === 0 && <p className="discover-filter-note">Categories appear when provider results include category metadata.</p>}</Section>
      </div>
      <div className="discover-filter-footer"><span><Check size={12}/> Filters update automatically</span><button onClick={() => runSearch(0)}><RefreshCw size={13}/> Refresh</button></div>
    </aside>
    <Modal show={!!selected} onHide={() => setSelected(null)} centered className="discover-detail-modal" size="lg"><Modal.Header closeButton><Modal.Title>{selected?.title}</Modal.Title></Modal.Header><Modal.Body>{selected && <div className="discover-detail"><div className="discover-detail-head">{selected.icon ? <img src={selected.icon} alt=""/> : <Package size={30}/>}<div><strong>{selected.title}</strong><span>by {selected.author} · {selected.source}</span></div></div><p>{selected.desc}</p><div className="discover-detail-stats"><span><b>{compact(selected.downloads)}</b> downloads</span><span><b>{selected.follows ? compact(selected.follows) : '—'}</b> followers</span></div><div className="discover-detail-tags">{selected.versions.slice(0, 12).map((v) => <span key={v}>{v}</span>)}{selected.categories.slice(0, 8).map((v) => <span key={v}>{v}</span>)}</div>{selected.type === 'modpack' ? <div className="modpack-install"><div className="fw-semibold small mb-1">Install as a new instance</div><div className="small text-muted">A separate instance is created automatically with this modpack's Minecraft version, loader and files. Nothing is added to your existing instances.</div><div className="d-flex gap-2 mt-3"><Button size="sm" disabled={c.game.status === 'preparing'} onClick={() => { c.installModpack(selected); setSelected(null) }}><Download size={14} className="me-2"/>Install modpack</Button><Button size="sm" variant="outline-light" onClick={() => window.api.openExternal(selected.projectUrl)}>Project page <ExternalLink size={13}/></Button></div></div> : <div className="mt-3 p-3 rounded" style={{ background: 'var(--panel-2, rgba(255,255,255,.04))' }}><div className="fw-semibold small mb-2">Install destination</div><Form.Select size="sm" value={installTargetId} disabled={!!c.hubTargetId} onChange={(e) => setInstallTargetId(e.target.value)}><option value="">Choose an instance…</option>{compatibleInstances.map(i => <option key={i.id} value={i.id}>{i.name} · {i.loader} · {i.mc}</option>)}</Form.Select>{!c.hubTargetId && compatibleInstances.length === 0 && <div className="small text-warning mt-1">No instances match this project's listed game versions and loader.</div>}{c.hubTargetId && <div className="small text-muted mt-1">Using the instance you opened this browser from.</div>}{selected.type === 'datapack' && <><Form.Label className="small mt-2">World</Form.Label><Form.Select size="sm" value={installWorld} onChange={e => setInstallWorld(e.target.value)}><option value="">Choose a world…</option>{worldOptions.map(w => <option key={w} value={w}>{w}</option>)}</Form.Select><div className="small text-muted mt-1">Data packs are installed inside the selected world's datapacks folder.</div></>}{!['mod','resourcepack','shader','datapack'].includes(selected.type) && <div className="small text-warning mt-2">This content type does not yet support direct in-app installation.</div>}<div className="d-flex gap-2 mt-3"><Button size="sm" disabled={installBusy || !installTargetId || !compatibleInstances.some(i => i.id === installTargetId) || !['mod','resourcepack','shader','datapack'].includes(selected.type) || (selected.type === 'datapack' && !installWorld)} onClick={() => void installSelected()}>{installBusy ? <><Spinner size="sm" className="me-2"/>Installing…</> : <><Download size={14} className="me-2"/>Install to instance</>}</Button><Button size="sm" variant="outline-light" onClick={() => window.api.openExternal(selected.projectUrl)}>Project page <ExternalLink size={13}/></Button></div></div>}</div>}</Modal.Body></Modal>
  </div>
}
