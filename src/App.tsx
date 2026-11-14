import { useCallback, useEffect, useRef, useState } from 'react'
import { NoticeCenter, type Toast } from './components/FeedbackSystem'
import MainLayout from './layouts/MainLayout'
import NewInstance from './components/NewInstance'
import { useLocal } from './hooks/useLocal'
import { useGame } from './hooks/useGame'
import { fetchVersions } from './services/launcher'
import { DEFAULT_SETTINGS } from './services/settings'
import type { Account, Ctx, Instance, Notify, PageId, ContentType, Settings } from './types'
import Overview from './pages/Overview'
import Hub from './pages/Hub'
import Servers from './pages/Servers'
import Skins from './pages/Skins'
import Library from './pages/Library'
import InstanceView from './pages/InstanceView'
import Accounts from './pages/Accounts'
import Java from './pages/Java'
import Downloads from './pages/Downloads'
import SettingsPage from './pages/SettingsPage'

const DEFAULTS = DEFAULT_SETTINGS
const PAGES: Record<PageId, (p: { c: Ctx }) => JSX.Element> = { overview: Overview, hub: Hub, servers: Servers, skins: Skins, library: Library, instance: InstanceView, accounts: Accounts, java: Java, downloads: Downloads, settings: SettingsPage }

export default function App() {
  const [page, setPage] = useState<PageId>('overview')
  const go = (next: PageId) => { if (next !== 'hub') setHubTargetId(''); setPage(next) }
  const [version, setVersion] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [hubTargetId, setHubTargetId] = useState('')
  const [hubTargetType, setHubTargetType] = useState<ContentType>('mod')
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)
  const [accounts, setAccounts] = useLocal<Account[]>('accounts', [])
  const [activeId, setActiveId] = useLocal<string>('activeId', '')
  const [instances, setInstances] = useLocal<Instance[]>('instances2', [])
  const [selected, setSelected] = useLocal<string>('selected', '')
  const [settings, setSettings] = useLocal<Settings>('settings', DEFAULTS)
  useEffect(() => { fetchVersions().catch(() => undefined); window.api.appVersion().then(setVersion).catch(() => setVersion('dev')) }, [])
  const closeToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  // Stable on purpose: useGame keeps it in long-lived listeners. A repeated message replaces itself (and restarts its timer); max 4 on screen.
  const notify: Notify = useCallback((msg, variant = 'info') => { const id = ++toastId.current; setToasts((t) => [...t.filter((x) => x.msg !== msg || x.variant !== variant), { id, msg, variant }].slice(-4)) }, [])
  const st = { ...DEFAULTS, ...settings }
  const { game, play, install, cancel, installModpack } = useGame(instances, setInstances, selected, accounts.find((a) => a.id === activeId), st, notify, go, (id) => { setSelected(id); go('instance') })
  const c: Ctx = { accounts, setAccounts, activeId, setActiveId, instances, setInstances, selected, setSelected, settings: st, setSettings, go, version, notify, game, play, install, cancel, installModpack, hubTargetId, hubTargetType, openHubForInstance: (id, type) => { setHubTargetId(id); setHubTargetType(type); go('hub') }, openNew: () => setNewOpen(true), openInstance: (id) => { setSelected(id); go('instance') } }
  const Page = PAGES[page]
  return (
    <>
      <MainLayout page={page} c={c}><Page c={c} /></MainLayout>
      <NewInstance c={c} show={newOpen} onHide={() => setNewOpen(false)} />
      <NoticeCenter toasts={toasts} onClose={closeToast} />
    </>
  )
}
