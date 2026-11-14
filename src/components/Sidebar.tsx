import { LayoutDashboard, Compass, Globe2, Shirt, Library, Plus, Settings, Sparkles, ChevronRight, UserRound, Download, Cpu, PanelsTopLeft } from 'lucide-react'
import InstanceIcon from './InstanceIcon'
import type { Ctx, PageId } from '../types'
import launcherIcon from '../assets/amagiri-launcher-icon.png'

const NAV: { id: PageId; label: string; icon: typeof Settings; section: string }[] = [
  { id: 'overview', label: 'Home', icon: LayoutDashboard, section: 'LAUNCHER' },
  { id: 'hub', label: 'Discover', icon: Compass, section: 'LAUNCHER' },
  { id: 'library', label: 'Minecraft Library', icon: Library, section: 'LIBRARY' },
  { id: 'servers', label: 'Multiplayer', icon: Globe2, section: 'LIBRARY' },
  { id: 'skins', label: 'Customization', icon: Shirt, section: 'PERSONALIZE' },
  { id: 'accounts', label: 'Accounts', icon: UserRound, section: 'PERSONALIZE' },
  { id: 'downloads', label: 'Downloads', icon: Download, section: 'SYSTEM' },
  { id: 'java', label: 'Java Runtime', icon: Cpu, section: 'SYSTEM' },
  { id: 'settings', label: 'Settings', icon: Settings, section: 'SYSTEM' }
]
export default function Sidebar({ page, c }: { page: PageId; c: Ctx }) {
  const account = c.accounts.find((a) => a.id === c.activeId)
  const name = account?.name ?? 'Guest Player'
  let lastSection = ''
  return <aside className="side">
    <div className="brand"><img className="brand-mark brand-logo-image" src={launcherIcon} alt="Amagiri Launcher"/><div className="brand-copy"><strong>AMAGIRI</strong><small>LAUNCHER</small></div><span className="brand-version">AE</span></div>
    <div className="side-divider"/><nav className="side-nav">
      {NAV.map(({ id, label, icon: Icon, section }) => { const showSection = section !== lastSection; lastSection = section; return <div key={id}>
        {showSection && <div className="nav-section">{section}</div>}
        <button className={`navbtn ${page === id ? 'on' : ''}`} onClick={() => c.go(id)}><Icon size={17} strokeWidth={1.8}/><span>{label}</span>{page === id && <ChevronRight className="nav-chevron" size={14}/>}</button>
      </div> })}
    </nav>
    <div className="instances-block"><div className="instances-heading"><span>YOUR INSTANCES</span><button title="Create instance" onClick={c.openNew}><Plus size={14}/></button></div>
      {c.instances.length ? c.instances.slice(0, 5).map((i) => <button key={i.id} className={`instance-link ${page === 'instance' && c.selected === i.id ? 'on' : ''}`} title={i.name} onClick={() => c.openInstance(i.id)}><span className="instance-emoji"><InstanceIcon icon={i.icon} size={22}/></span><span className="instance-name">{i.name}</span><span className="instance-version">{i.mc}</span></button>) : <div className="instance-empty">Your worlds are waiting.</div>}
      <button className="create-instance" onClick={c.openNew}><Plus size={14}/> New instance</button>
    </div>
    <div className="side-bottom"><div className="side-status"><span className="status-dot"/> Launcher operational <span className="side-status-ping"/></div>
      <button className="account-card" onClick={() => c.go('accounts')}><span className="account-avatar">{name[0]?.toUpperCase() ?? '?'}</span><span className="account-meta"><strong>{name}</strong><small>{account?.type === 'microsoft' ? 'Microsoft account' : account ? 'Offline profile' : 'Connect an account'}</small></span><Sparkles size={14} className="account-sparkle"/></button>
    </div>
  </aside>
}
