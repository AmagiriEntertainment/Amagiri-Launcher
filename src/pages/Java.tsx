import { useEffect, useState } from 'react'
import { Badge, Button, Form, Spinner } from 'react-bootstrap'
import { Coffee } from 'lucide-react'
import { Empty, PageHead, Panel } from '../components/ui'
import type { Ctx, JavaInst } from '../types'

type Runtime = { id: string; name: string; component: string; major: number; installed: boolean }

export default function Java({ c }: { c: Ctx }) {
  const [list, setList] = useState<JavaInst[] | null>(null)
  const [runtimes, setRuntimes] = useState<Runtime[] | null>(null)
  const [extra, setExtra] = useState<JavaInst[]>([])
  const scan = async () => {
    setList(null); setRuntimes(null)
    try { const [found, managed] = await Promise.all([window.api.detectJava(), window.api.javaRuntimes(c.settings.dir)]); setList(found); setRuntimes(managed) }
    catch { setList([]); setRuntimes([]); c.notify('Java scan failed', 'danger') }
  }
  useEffect(() => { void scan() }, [c.settings.dir])
  const add = async () => {
    const p = await window.api.pickFile(['exe'])
    if (!p) return
    if (!/java(w)?\.exe$/i.test(p)) return c.notify('Select java.exe or javaw.exe', 'danger')
    setExtra([...extra, { name: 'Custom Java', path: p, major: 0 }])
  }
  const selected = c.settings.javaRuntime || 'auto'
  const all = [...(list ?? []), ...extra]
  return <>
    <PageHead title="Java Manager" sub="Install and manage Java runtimes for Minecraft" actions={<><Button variant="outline-light" onClick={() => void scan()}>Rescan</Button><Button variant="outline-light" onClick={add}>Add Java</Button></>} />
    <Panel title="Default Java runtime" className="mb-3">
      <Form.Select value={selected} onChange={e => { c.setSettings({ ...c.settings, javaRuntime: e.target.value }); c.notify('Default runtime updated. Save Settings to keep this choice.', 'info') }}>
        <option value="auto">Auto — choose the version required by Minecraft</option><option value="legacy">Java 8 (Legacy)</option><option value="alpha">Java 16 (Alpha)</option><option value="beta">Java 17 (Beta)</option><option value="gamma">Java 17 (Gamma)</option><option value="delta">Java 21 (Delta)</option><option value="epsilon">Java 25 (Epsilon)</option>
      </Form.Select>
      <div className="small text-muted mt-2">Managed runtimes are downloaded automatically the first time a game needs them. Auto follows the Java requirement in the Minecraft version metadata.</div>
    </Panel>
    <Panel title="Managed runtimes">
      {!runtimes ? <div className="empty"><Spinner /></div> : runtimes.map(r => <div className="row-item" key={r.id}><div><strong>{r.name}</strong><div className="small text-muted">{r.component}</div></div><div className="d-flex align-items-center gap-2">{r.installed ? <Badge bg="success">Installed</Badge> : <Badge bg="secondary">Installs on demand</Badge>}</div></div>)}
    </Panel>
    <Panel title="Detected Java installations" className="mt-3">
      {!list ? <div className="empty"><Spinner /></div> : all.length === 0 ? <Empty icon={Coffee} title="No system Java found" text="That's okay: managed Java runtimes are installed automatically when needed." /> : all.map(j => <div className="row-item" key={j.path}><div><strong>{j.name}</strong> <span className="text-muted small">Java {j.major || '?'}</span><div className="small text-muted text-break">{j.path}</div></div><Button size="sm" variant="outline-light" onClick={() => { c.setSettings({ ...c.settings, java: j.path }); c.notify('Custom Java override selected. Save Settings to keep it.', 'success') }}>Use custom</Button></div>)}
    </Panel>
  </>
}
