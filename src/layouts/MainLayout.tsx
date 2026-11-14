import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Activity, CircleHelp, Command } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { DownloadCenter } from '../components/FeedbackSystem'
import type { Ctx, PageId } from '../types'

const PAGE_NAMES: Record<PageId, string> = {
  overview: 'Dashboard', hub: 'Discover', servers: 'Multiplayer', skins: 'Customization Studio', library: 'Minecraft Library',
  instance: 'Instance Manager', accounts: 'Account Management', java: 'Java Runtime', downloads: 'Download Manager', settings: 'Settings'
}
export default function MainLayout({ page, c, children }: { page: PageId; c: Ctx; children: ReactNode }) {
  const g = c.game
  const pct = g.total ? Math.round((g.done / g.total) * 100) : 0
  return <div className="shell">
    <Sidebar page={page} c={c} />
    <div className="main">
      <header className="top">
        <div className="top-context"><span className="top-kicker">AMAGIRI / CLIENT</span><span className="top-slash">·</span><strong>{PAGE_NAMES[page]}</strong></div>
        <div className="top-actions">
          {g.status === 'preparing' && <button className="status-pill preparing" onClick={() => c.go('downloads')}><span className="status-dot" />{g.phase} {pct ? `${pct}%` : ''}</button>}
          {g.status === 'running' && <span className="status-pill running"><span className="status-dot" />Game running</span>}
          {g.status !== 'running' && g.status !== 'preparing' && <span className="status-pill ready"><span className="status-dot" />All systems ready</span>}
          <button className="top-icon" title="Minecraft help" onClick={() => window.api.openExternal('https://www.minecraft.net/help')}><CircleHelp size={16}/></button>
          <span className="top-divider" /><span className="top-build"><Activity size={13}/> v{c.version || '…'}</span>
        </div>
      </header>
      <main className="content"><div className="content-inner"><AnimatePresence mode="wait"><motion.div key={page} initial={{ opacity: 0, y: 9, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .22, ease: 'easeOut' }}>{children}</motion.div></AnimatePresence></div></main>
      <DownloadCenter game={g} onCancel={c.cancel} />
      <footer className="foot"><span>© Amagiri Entertainment <i>·</i> Your world. Your way.</span><span><Command size={12}/> AMAGIRI LAUNCHER <b>•</b> DESKTOP</span></footer>
    </div>
  </div>
}
