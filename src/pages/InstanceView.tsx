import { useEffect, useState } from 'react'
import InstanceIcon from '../components/InstanceIcon'
import { Button, Form, Nav, Modal } from 'react-bootstrap'
import { Play, Plus, Trash2, FolderOpen, ArrowLeft, ChevronRight, FileText, RefreshCw } from 'lucide-react'
import InstanceSettings from '../components/InstanceSettings'
import { Empty, Panel } from '../components/ui'
import { ago, fmtTime } from '../services/launcher'
import { usesCustomLaunch } from '../services/settings'
import type { Ctx, ContentType } from '../types'

const SUB = [['mods', 'Mods'], ['resourcepacks', 'Resource Packs'], ['shaderpacks', 'Shaders'], ['datapacks', 'Data Packs']]
const HUB_TYPES: Record<string, ContentType> = { mods: 'mod', resourcepacks: 'resourcepack', shaderpacks: 'shader', datapacks: 'datapack' }

const formatBytes = (n: number) => n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`

export default function InstanceView({ c }: { c: Ctx }) {
  const inst = c.instances.find((i) => i.id === c.selected)
  const [tab, setTab] = useState('content')
  const [sub, setSub] = useState('mods')
  const [files, setFiles] = useState<string[]>([])
  const [tick, setTick] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [folderExists, setFolderExists] = useState<boolean | null>(null)
  const [filePath, setFilePath] = useState('')
  const [fileEntries, setFileEntries] = useState<{ name: string; type: 'directory' | 'file'; size: number; modified: number }[]>([])
  const [fileBusy, setFileBusy] = useState(false)
  const kind = tab === 'worlds' ? 'worlds' : sub
  const dir = c.settings.dir
  useEffect(() => {
    let cancelled = false
    if (!inst) { setFolderExists(null); return }
    window.api.instExists(dir, inst.id).then((exists) => { if (!cancelled) setFolderExists(exists) }).catch(() => { if (!cancelled) setFolderExists(false) })
    return () => { cancelled = true }
  }, [inst?.id, dir, tick])
  useEffect(() => {
    if (inst && tab !== 'files' && tab !== 'settings' && folderExists !== false) window.api.instList(dir, inst.id, kind).then(setFiles).catch(() => setFiles([]))
    else if (folderExists === false) setFiles([])
  }, [inst?.id, kind, tick, c.game.status, folderExists, dir, tab])
  useEffect(() => {
    if (!inst || tab !== 'files' || folderExists === false) return
    let cancelled = false
    setFileBusy(true)
    window.api.instBrowse(dir, inst.id, filePath).then((items) => { if (!cancelled) setFileEntries(items) }).catch((e) => { if (!cancelled) { setFileEntries([]); c.notify((e as Error).message, 'danger') } }).finally(() => { if (!cancelled) setFileBusy(false) })
    return () => { cancelled = true }
  }, [inst?.id, tab, filePath, folderExists, dir, tick])
  if (!inst) return <Panel><Empty icon={ArrowLeft} title="No instance selected" text="Open one from the Library." action={<Button onClick={() => c.go('library')}>Go to Library</Button>} /></Panel>
  const busy = c.game.status === 'preparing' || c.game.status === 'running'
  const act = async (p: Promise<unknown>) => { try { await p } catch (e) { c.notify((e as Error).message, 'danger') } setTick((t) => t + 1) }
  return (
    <>
      <Button variant="link" className="p-0 mb-3 text-muted" onClick={() => c.go('library')}><ArrowLeft size={14} /> Back</Button>
      <Panel className="mb-3">
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex gap-3 align-items-center"><div className="tile" style={{ width: 72, height: 72 }}><InstanceIcon icon={inst.icon} size={54}/></div>
            <div><span className="chip">{inst.loader} · MC {inst.mc}</span>{usesCustomLaunch(inst) && <span className="chip on ms-2">Custom</span>}<h3 className="mt-2 mb-0">{inst.name}</h3>{inst.notes && <div className="small text-muted mt-1">{inst.notes}</div>}</div></div>
          <div className="d-flex gap-2"><Button variant="outline-light" onClick={() => setTab('settings')}>Instance Settings</Button>{!inst.installed && <Button variant="outline-light" disabled={busy || folderExists === false} onClick={() => c.install(inst)}>Install</Button>}
            <Button className="btn-play" disabled={busy || folderExists === false} onClick={c.play}><Play size={16} className="me-2" />{folderExists === false ? 'Unavailable' : c.game.status === 'running' ? 'Running' : 'Play'}</Button></div>
        </div>
        {folderExists === false && <div className="instance-missing-alert"><strong>Instance folder not found</strong><span>This entry still exists in your Library, but its files were removed or the Game Directory changed. You can remove the stale Library entry without deleting any files.</span></div>}
        <div className="d-flex gap-5 mt-4"><div><div className="small text-muted">Status</div>{folderExists === false ? 'Missing files' : folderExists === null ? 'Checking…' : inst.installed ? 'Ready to play' : 'Needs install'}</div><div><div className="small text-muted">Last played</div>{ago(inst.lastPlayed)}</div><div><div className="small text-muted">Playtime</div>{fmtTime(inst.playtime)}</div>
          <Button size="sm" variant="outline-danger" className="ms-auto align-self-center" onClick={() => setConfirmDelete(true)}><Trash2 size={14} /> Delete</Button></div>
      </Panel>
      <Modal show={confirmDelete} onHide={() => !deleting && setConfirmDelete(false)} centered className="amagiri-confirm-modal"><Modal.Header closeButton={!deleting}><Modal.Title>{folderExists === false ? 'Remove missing instance?' : 'Delete instance?'}</Modal.Title></Modal.Header><Modal.Body><div className="d-flex gap-3 align-items-start"><div className="tile"><InstanceIcon icon={inst.icon} size={34}/></div><div><strong>{inst.name}</strong><div className="small text-muted">{inst.loader} · Minecraft {inst.mc}</div><p className="mt-3 mb-0">{folderExists === false ? 'The instance folder is already missing. This will only remove its entry from your Amagiri Library. No Minecraft files will be deleted.' : 'This moves the instance folder to your system Recycle Bin. Its installed mods, worlds, resource packs, and settings will be included.'}</p></div></div></Modal.Body><Modal.Footer><Button variant="outline-light" disabled={deleting} onClick={() => setConfirmDelete(false)}>Cancel</Button><Button variant="danger" disabled={deleting} onClick={async () => { setDeleting(true); try { const result = await window.api.instDelete(dir, inst.id); c.setInstances(c.instances.filter((i) => i.id !== inst.id)); c.setSelected(''); c.go('library'); c.notify(result.folderFound ? 'Instance moved to Recycle Bin' : 'Missing instance entry removed from Library', 'success') } catch (e) { c.notify((e as Error).message, 'danger') } finally { setDeleting(false); setConfirmDelete(false) } }}> {deleting ? 'Removing…' : folderExists === false ? 'Remove from Library' : 'Delete instance'} </Button></Modal.Footer></Modal>
      <Nav variant="tabs" className="mb-3">{[['content', 'Content'], ['worlds', 'Worlds'], ['settings', 'Settings'], ['files', 'Files']].map(([k, l]) => <Nav.Item key={k}><Nav.Link active={tab === k} onClick={() => setTab(k)}>{l}</Nav.Link></Nav.Item>)}</Nav>
      {tab === 'settings' ? <InstanceSettings c={c} inst={inst} /> : tab === 'files' ? <Panel className="instance-file-browser">
        <div className="instance-file-toolbar"><div className="instance-file-breadcrumb"><button onClick={() => setFilePath('')}><FolderOpen size={14}/> {inst.name}</button>{filePath.split('/').filter(Boolean).map((part, index, all) => <span key={`${part}-${index}`}><ChevronRight size={13}/><button onClick={() => setFilePath(all.slice(0, index + 1).join('/'))}>{part}</button></span>)}</div><div className="d-flex gap-2"><Button size="sm" variant="outline-light" onClick={() => setTick(v => v + 1)}><RefreshCw size={13}/></Button><Button size="sm" variant="outline-light" disabled={folderExists === false} onClick={() => void window.api.instOpen(dir, inst.id)}><FolderOpen size={14} className="me-1"/>Open folder</Button></div></div>
        {folderExists === false && <p className="small text-warning mt-3 mb-0">The instance folder is missing. Restore it or remove this entry from your Library.</p>}
        {fileBusy ? <div className="small text-muted p-3">Loading folder…</div> : fileEntries.length === 0 ? <Empty icon={FolderOpen} title="This folder is empty" text="Files and folders inside this instance will appear here."/> : <div className="instance-file-list">{fileEntries.map((entry) => <button type="button" className="instance-file-row" key={entry.name} disabled={entry.type !== 'directory'} onClick={() => setFilePath([filePath, entry.name].filter(Boolean).join('/'))}><span className="instance-file-name">{entry.type === 'directory' ? <FolderOpen size={17}/> : <FileText size={16}/>}<span>{entry.name}</span></span><span className="instance-file-meta">{entry.type === 'directory' ? 'Folder' : formatBytes(entry.size)}</span></button>)}</div>}
      </Panel> : (
        <Panel>
          {tab === 'content' && <div className="d-flex justify-content-between mb-3"><div className="d-flex gap-2">{SUB.map(([k, l]) => <button key={k} className={`chip ${sub === k ? 'on' : ''}`} onClick={() => setSub(k)}>{l}</button>)}</div><Button size="sm" disabled={folderExists === false} onClick={() => c.openHubForInstance(inst.id, HUB_TYPES[sub] || 'mod')}><Plus size={14} /> Add from Content Browser</Button></div>}
          {files.length === 0 ? <Empty icon={FolderOpen} title={tab === 'worlds' ? 'No worlds yet' : 'Nothing here yet'} text={tab === 'worlds' ? 'Worlds appear after you play.' : 'Use Add to copy files into this instance.'} /> : files.map((f) => (
            <div className="row-item" key={f}><span className="text-break">{f.replace(/\.disabled$/, '')}</span>
              <div className="d-flex gap-2 align-items-center">{tab === 'content' && <Form.Check type="switch" checked={!f.endsWith('.disabled')} onChange={() => void act(window.api.instToggle(dir, inst.id, kind, f))} />}
                <Button size="sm" variant="outline-danger" onClick={() => void act(window.api.instRemove(dir, inst.id, kind, f))}><Trash2 size={14} /></Button></div></div>))}
        </Panel>)}
    </>
  )
}
