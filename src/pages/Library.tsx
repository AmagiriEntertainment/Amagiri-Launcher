import { useEffect, useMemo, useState } from 'react'
import InstanceIcon from '../components/InstanceIcon'
import { Button, Form } from 'react-bootstrap'
import { Archive, Clock3, Plus, Search, SlidersHorizontal, Sparkles, ArrowUpRight, ChevronRight, Layers3 } from 'lucide-react'
import { Empty, PageHead } from '../components/ui'
import { ago, fmtTime } from '../services/launcher'
import type { Ctx, Instance } from '../types'

type SortMode = 'recent' | 'name' | 'playtime'

function InstanceCard({ item, selected, missing, onOpen }: {
  item: Instance; selected: boolean; missing: boolean; onOpen: () => void
}) {
  return <article className={`library-instance ${selected ? 'is-selected' : ''}`}>
    <button className="library-instance-main" onClick={onOpen} aria-label={`Open ${item.name}`}>
      <div className="library-instance-art"><InstanceIcon icon={item.icon} size={64}/><div className="library-art-shine" /></div>
      <div className="library-instance-copy">
        <div className="library-instance-title-row"><strong title={item.name}>{item.name}</strong>{selected && <span className="library-selected">SELECTED</span>}</div>
        <div className="library-instance-meta"><span>MINECRAFT {item.mc}</span><i /> <span>{item.loader || 'Vanilla'}</span></div>
        <div className="library-instance-stats"><span><Clock3 size={12}/>{ago(item.lastPlayed)}</span><span><Layers3 size={12}/>{fmtTime(item.playtime)}</span></div>
      </div>
      <ChevronRight className="library-chevron" size={16}/>
    </button>
    <div className="library-instance-footer">
      <span className={`library-install-state ${missing ? 'missing' : item.installed ? 'ready' : 'pending'}`}><span />{missing ? 'Missing files' : item.installed ? 'Ready to play' : 'Installation required'}</span>
      <Button size="sm" className="library-play" onClick={onOpen}><ArrowUpRight size={12}/> {missing ? 'Review' : 'Open'}</Button>
    </div>
  </article>
}

export default function Library({ c }: { c: Ctx }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortMode>('recent')
  const [missingIds, setMissingIds] = useState<string[]>([])
  useEffect(() => {
    let cancelled = false
    Promise.all(c.instances.map(async (instance) => {
      try { return (await window.api.instExists(c.settings.dir, instance.id)) ? null : instance.id }
      catch { return instance.id }
    })).then((results) => { if (!cancelled) setMissingIds(results.filter((id): id is string => Boolean(id))) })
    return () => { cancelled = true }
  }, [c.instances, c.settings.dir])
  const list = useMemo(() => {
    const filtered = c.instances.filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase()) || i.mc.toLowerCase().includes(q.trim().toLowerCase()) || i.loader.toLowerCase().includes(q.trim().toLowerCase()))
    return filtered.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'playtime' ? (b.playtime ?? 0) - (a.playtime ?? 0) : (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))
  }, [c.instances, q, sort])

  return <div className="library-page">
    <PageHead title="Minecraft Library" sub="Your installations, versions, and adventures in one place." actions={<Button onClick={c.openNew}><Plus size={15} className="me-1"/>New instance</Button>} />
    <section className="library-summary">
      <div className="library-summary-icon"><Archive size={19}/></div>
      <div><span>YOUR COLLECTION</span><strong>{c.instances.length} {c.instances.length === 1 ? 'instance' : 'instances'}</strong><small>All your Minecraft profiles, ready when you are.</small></div>
      <div className="library-summary-divider"/>
      <div className="library-summary-stat"><span>INSTALLED</span><strong>{c.instances.filter(i => i.installed).length.toString().padStart(2, '0')}</strong></div>
      <div className="library-summary-stat"><span>NEEDS SETUP</span><strong>{c.instances.filter(i => !i.installed).length.toString().padStart(2, '0')}</strong></div>
    </section>
    <div className="library-toolbar">
      <div className="library-search"><Search size={15}/><Form.Control aria-label="Search instances" placeholder="Search by name, version, or loader…" value={q} onChange={(e) => setQ(e.target.value)}/>{q && <button onClick={() => setQ('')} aria-label="Clear search">×</button>}</div>
      <label className="library-sort"><SlidersHorizontal size={14}/><span>Sort</span><Form.Select aria-label="Sort instances" value={sort} onChange={(e) => setSort(e.target.value as SortMode)}><option value="recent">Recently played</option><option value="name">Name</option><option value="playtime">Playtime</option></Form.Select></label>
    </div>
    {list.length === 0 ? <div className="library-empty"><Empty icon={Sparkles} title={q ? 'No matching instances' : 'Your next world starts here'} text={q ? 'Try another search term or clear your search.' : 'Create a Minecraft instance to choose your version, loader, and game directory.'} action={q ? <Button variant="outline-light" onClick={() => setQ('')}>Clear search</Button> : <Button onClick={c.openNew}><Plus size={14} className="me-1"/>Create instance</Button>}/></div> :
      <div className="library-grid">{list.map((item) => <InstanceCard key={item.id} item={item} selected={c.selected === item.id} missing={missingIds.includes(item.id)} onOpen={() => c.openInstance(item.id)}/>)}</div>}
  </div>
}
