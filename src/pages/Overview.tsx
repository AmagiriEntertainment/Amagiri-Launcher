import { useEffect, useState } from 'react'
import InstanceIcon from '../components/InstanceIcon'
import { Button, ProgressBar } from 'react-bootstrap'
import { Play, Plus, ArrowUpRight, Clock3, Layers3, Sparkles, Download, ChevronDown, Zap, Gamepad2 } from 'lucide-react'
import { Panel } from '../components/ui'
import { HubCard } from './Hub'
import { fmtTime, ago } from '../services/launcher'
import type { Ctx, HubItem } from '../types'
import launcherWordmark from '../assets/amagiri-launcher-wordmark-transparent.png'

export default function Overview({ c }: { c: Ctx }) {
  const acc = c.accounts.find((a) => a.id === c.activeId)
  const [hub, setHub] = useState<HubItem[]>([])
  useEffect(() => { window.api.hubSearch('', 'modpack', '').then((h) => setHub(h.slice(0, 3))).catch(() => setHub([])) }, [])
  const sel = c.instances.find((i) => i.id === c.selected)
  const busy = c.game.status === 'preparing' || c.game.status === 'running'
  const total = c.instances.reduce((n, i) => n + (i.playtime ?? 0), 0)
  const pct = c.game.total ? Math.round(c.game.done / c.game.total * 100) : 0
  return <div className="dashboard">
    <div className="welcome-line"><div><div className="eyebrow"><span className="eyebrow-pip"/> YOUR ADVENTURE CONTINUES</div><h1>Welcome back{acc ? `, ${acc.name}` : ''}<span className="title-period">.</span></h1><p>Your worlds are ready when you are. What will you play today?</p></div><div className="welcome-date"><span>AMAGIRI NETWORK</span><strong>PLAYER HUB <Sparkles size={14}/></strong></div></div>
    <section className="launch-hero">
      <div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-glow"/>
      <div className="hero-content"><div className="hero-tag"><span className="hero-tag-dot"/> QUICK LAUNCH <span className="hero-tag-line"/> JAVA EDITION</div>
        <div className="hero-title">Enter your<br/><em>next world.</em></div>
        <p className="hero-desc">A new adventure is only one click away.<br/>Pick an instance and make it yours.</p>
        <div className="hero-controls">
          <button className="hero-instance" title="Open Minecraft Library" onClick={() => c.go('library')}><span className="hero-instance-icon">{sel ? <InstanceIcon icon={sel.icon} size={30}/> : '✦'}</span><span><small>SELECTED INSTANCE</small><strong>{sel?.name ?? 'No instance selected'}</strong><small>{sel ? `${sel.loader} · Minecraft ${sel.mc}` : 'Create your first Minecraft instance'}</small></span><ChevronDown size={15}/></button>
          {sel ? <Button className="btn-play" disabled={busy} onClick={c.play}><Play size={17} fill="currentColor"/>{c.game.status === 'preparing' ? 'Preparing…' : c.game.status === 'running' ? 'Running' : 'PLAY NOW'}<ArrowUpRight size={16}/></Button> : <Button className="btn-play" onClick={c.openNew}><Plus size={17}/> CREATE INSTANCE<ArrowUpRight size={16}/></Button>}
        </div>
        {c.game.status === 'preparing' && <div className="hero-progress"><div className="d-flex justify-content-between"><span>{c.game.phase}</span><b>{pct}%</b></div><ProgressBar now={pct}/></div>}
      </div>
      <div className="hero-art" aria-label="Amagiri Launcher emblem"><div className="hero-art-ring ring-a"/><div className="hero-art-ring ring-b"/><img className="hero-brand-art" src={launcherWordmark} alt="Amagiri Launcher"/></div>
      <div className="hero-bottom"><span><span className="status-dot"/> LAUNCHER OPERATIONAL</span><span>CRAFTED FOR THE CURIOUS <Sparkles size={12}/></span></div>
    </section>
    <div className="dashboard-stats">
      <div className="stat-card"><span className="stat-icon"><Layers3 size={17}/></span><div><small>GAME INSTANCES</small><strong>{c.instances.length.toString().padStart(2,'0')}</strong><span>In your library</span></div><span className="stat-mark">01</span></div>
      <div className="stat-card"><span className="stat-icon"><Clock3 size={17}/></span><div><small>TOTAL PLAYTIME</small><strong>{fmtTime(total)}</strong><span>Across all worlds</span></div><span className="stat-mark">02</span></div>
      <div className="stat-card"><span className="stat-icon"><Gamepad2 size={17}/></span><div><small>ACTIVE PROFILE</small><strong className="stat-profile">{acc?.name ?? 'Guest'}</strong><span>{acc ? (acc.type === 'microsoft' ? 'Microsoft account' : 'Offline profile') : 'No account connected'}</span></div><span className="stat-mark">03</span></div>
    </div>
    <div className="dashboard-columns">
      <section className="dashboard-section"><div className="section-heading"><div><div className="eyebrow">PICK UP WHERE YOU LEFT OFF</div><h3>Your instances</h3></div><button className="text-action" onClick={() => c.go('library')}>VIEW LIBRARY <ArrowUpRight size={14}/></button></div>
        {c.instances.length ? <div className="recent-grid">{c.instances.slice().sort((a,b)=>(b.lastPlayed??0)-(a.lastPlayed??0)).slice(0,3).map(i=><button className={`recent-card ${c.selected===i.id?'selected':''}`} key={i.id} onClick={()=>c.openInstance(i.id)}><div className="recent-card-top"><span className="recent-icon"><InstanceIcon icon={i.icon} size={34}/></span><span className="recent-status">{i.installed?'INSTALLED':'NOT INSTALLED'}</span></div><strong>{i.name}</strong><span className="recent-meta">{i.loader} <i>·</i> {i.mc}</span><div className="recent-card-bottom"><span><Clock3 size={12}/> {ago(i.lastPlayed)}</span><ArrowUpRight size={15}/></div></button>)}</div> : <div className="empty-state"><Layers3 size={24}/><strong>Your library is waiting</strong><span>Create an instance to get started.</span><Button size="sm" onClick={c.openNew}><Plus size={14}/> Create instance</Button></div>}
      </section>
      <section className="dashboard-section activity-section"><div className="section-heading"><div><div className="eyebrow">LIVE ACTIVITY</div><h3>Launcher status</h3></div><span className="live-label"><i/> LIVE</span></div>
        <div className="activity-card"><div className="activity-row"><span className="activity-icon"><Zap size={16}/></span><div><strong>{c.game.status==='running'?'Minecraft is running':c.game.status==='preparing'?'Preparing your game':'Ready for takeoff'}</strong><small>{c.game.status==='error'?c.game.error:c.game.status==='preparing'?c.game.phase:'All launcher services are operational.'}</small></div></div>
          {c.game.status==='preparing'&&<ProgressBar now={pct} className="mt-3"/>}
          <div className="activity-divider"/><div className="activity-row"><span className="activity-icon muted"><Download size={16}/></span><div><strong>Game files & downloads</strong><small>{c.game.status==='preparing'?`${c.game.files} of ${c.game.totalFiles} files · ${pct}%`:'Downloads appear here when you install or update a game.'}</small></div><button className="icon-action" onClick={()=>c.go('downloads')}><ArrowUpRight size={15}/></button></div>
        </div>
        <div className="quick-actions"><button onClick={c.openNew}><Plus size={15}/> New instance</button><button onClick={()=>c.go('skins')}><Sparkles size={15}/> Customize skin</button></div>
      </section>
    </div>
    <section className="dashboard-section discover-preview"><div className="section-heading"><div><div className="eyebrow">FIND YOUR NEXT FAVORITE</div><h3>Featured from Discover</h3></div><button className="text-action" onClick={()=>c.go('hub')}>EXPLORE HUB <ArrowUpRight size={14}/></button></div>
      {hub.length ? <div className="row g-3">{hub.map(h=><div className="col-md-4" key={h.id}><HubCard h={h}/></div>)}</div> : <Panel><div className="discover-empty"><Sparkles size={18}/> Explore modpacks, mods, resource packs and shaders in Discover.</div></Panel>}
    </section>
  </div>
}
