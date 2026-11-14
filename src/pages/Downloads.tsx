import { Button, ProgressBar } from 'react-bootstrap'
import { DownloadCloud } from 'lucide-react'
import { Empty, PageHead, Panel } from '../components/ui'
import type { Ctx } from '../types'

const mb = (n: number) => (n / 1048576).toFixed(1)
const fmt = (s: number) => (isFinite(s) && s > 0 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : '—')

export default function Downloads({ c }: { c: Ctx }) {
  const g = c.game
  const active = g.status === 'preparing' && g.total > 0
  const pct = g.total ? (g.done / g.total) * 100 : 0
  return (
    <>
      <PageHead title="Downloads" sub={`Game files for the selected installation (launcher v${c.version || '…'})`} />
      <Panel title="Queue">
        {active ? (<>
          <div className="d-flex justify-content-between mb-2"><strong>{g.phase}</strong><span className="text-muted small">{g.files}/{g.totalFiles} files</span></div>
          <ProgressBar now={pct} label={`${pct.toFixed(0)}%`} animated />
          <div className="d-flex justify-content-between align-items-center mt-2 small text-muted"><span>{mb(g.done)} / {mb(g.total)} MB · {mb(g.speed)} MB/s · ETA {fmt((g.total - g.done) / g.speed)}</span><Button size="sm" variant="outline-danger" onClick={c.cancel}>Cancel</Button></div>
        </>) : g.status === 'preparing' ? (<div className="d-flex justify-content-between align-items-center"><span>{g.phase}…</span><Button size="sm" variant="outline-danger" onClick={c.cancel}>Cancel</Button></div>)
          : g.status === 'error' ? (<div className="d-flex justify-content-between align-items-center"><span className="text-danger">{g.error}</span><Button size="sm" onClick={c.play}>Retry</Button></div>)
          : <Empty icon={DownloadCloud} title="Nothing downloading" text="Files download automatically the first time you press Play." />}
      </Panel>
      <div className="mt-3"><Panel title="Game log">{g.log.length ? <pre className="small mb-0" style={{ maxHeight: 280, overflow: 'auto', color: 'var(--muted)', whiteSpace: 'pre-wrap' }}>{g.log.join('\n')}</pre> : <div className="text-muted">No game output yet.</div>}</Panel></div>
    </>
  )
}
