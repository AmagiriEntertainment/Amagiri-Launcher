import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Download, Info, LoaderCircle, X, XCircle } from 'lucide-react'
import type { GameState } from '../types'

export type Toast = { id: number; msg: string; variant: string }

const ICONS: Record<string, typeof Info> = { success: CheckCircle2, danger: XCircle, warning: AlertTriangle, info: Info }
const TITLES: Record<string, string> = { success: 'Success', danger: 'Something went wrong', warning: 'Heads up', info: 'Info' }
const DURATION: Record<string, number> = { success: 4000, info: 4500, warning: 6500, danger: 9000 }

function ToastItem({ toast, onClose }: { toast: Toast; onClose: (id: number) => void }) {
  const [paused, setPaused] = useState(false)
  const left = useRef(DURATION[toast.variant] ?? 4500)
  const Icon = ICONS[toast.variant] ?? Info
  // Counts down only while the pointer is away; the same toast id restarts it (see App.notify).
  useEffect(() => {
    if (paused) return
    const start = Date.now()
    const t = setTimeout(() => onClose(toast.id), left.current)
    return () => { clearTimeout(t); left.current -= Date.now() - start }
  }, [paused, toast.id])
  return <motion.div layout className={`toast-card toast-${toast.variant}`} role={toast.variant === 'danger' ? 'alert' : 'status'}
    initial={{ opacity: 0, x: 36, scale: .96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 36, scale: .96 }} transition={{ duration: .2 }}
    onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
    <span className="toast-icon"><Icon size={17}/></span>
    <div className="toast-body"><strong>{TITLES[toast.variant] ?? 'Info'}</strong><p title={toast.msg}>{toast.msg}</p></div>
    <button className="toast-close" onClick={() => onClose(toast.id)} aria-label="Dismiss notification"><X size={14}/></button>
    <i className="toast-timer" style={{ animationDuration: `${DURATION[toast.variant] ?? 4500}ms`, animationPlayState: paused ? 'paused' : 'running' }} key={toast.id}/>
  </motion.div>
}

export function NoticeCenter({ toasts, onClose }: { toasts: Toast[]; onClose: (id: number) => void }) {
  return <div className="toast-host" aria-live="polite">
    <AnimatePresence initial={false} mode="popLayout">{toasts.map((t) => <ToastItem key={t.id} toast={t} onClose={onClose} />)}</AnimatePresence>
  </div>
}

const bytes = (n: number) => n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`
const eta = (remaining: number, speed: number) => speed > 0 ? `${Math.ceil(remaining / speed)}s remaining` : 'Calculating…'

export function DownloadCenter({ game, onCancel }: { game: GameState; onCancel: () => void }) {
  const [expanded, setExpanded] = useState(true)
  const active = game.status === 'preparing'
  if (!active) return null
  const pct = game.total > 0 ? Math.min(100, Math.round((game.done / game.total) * 100)) : 0
  const label = game.phase || 'Preparing'
  return <motion.section className={`download-center ${expanded ? 'is-expanded' : 'is-collapsed'}`} initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }}>
    <div className="download-summary">
      <button className="download-summary-main" onClick={() => setExpanded((v) => !v)}>
        <Download size={15}/><strong>1 download active</strong><span className="download-mini-track"><i style={{ width: `${pct}%` }}/></span><span className="download-percent">{pct}%</span><span className="download-summary-label">{label}</span>
      </button>
      <button className="download-collapse" onClick={() => setExpanded((v) => !v)} aria-label={expanded ? 'Collapse downloads' : 'Expand downloads'}>{expanded ? <ChevronDown size={16}/> : <ChevronUp size={16}/>}</button>
    </div>
    <AnimatePresence initial={false}>
      {expanded && <motion.div className="download-detail" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .2 }}>
        <div className="download-app-icon"><LoaderCircle size={23} className="download-spinner"/></div>
        <div className="download-detail-body"><div className="download-detail-heading"><strong>{game.phase === 'Starting' ? 'Minecraft' : 'Minecraft installation'}</strong><span>{label}</span></div><div className="download-progress-track"><i style={{ width: `${pct}%` }}/></div><div className="download-metrics"><span>{bytes(game.done)} / {bytes(game.total)}</span><span>{bytes(game.speed)}/s</span><span>{game.total > 0 ? eta(Math.max(0, game.total - game.done), game.speed) : 'Size pending'}</span><span>{game.files}/{game.totalFiles} files</span></div></div>
        <span className="download-detail-percent">{pct}%</span><button className="download-cancel" onClick={onCancel} title="Cancel download"><X size={17}/></button>
      </motion.div>}
    </AnimatePresence>
  </motion.section>
}
