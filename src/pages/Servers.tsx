import { useState } from 'react'
import { Button, Form, Modal } from 'react-bootstrap'
import { Globe } from 'lucide-react'
import { Empty, PageHead, Panel } from '../components/ui'
import { useLocal } from '../hooks/useLocal'
import type { Ctx } from '../types'

interface Srv { id: string; name: string; addr: string }

export default function Servers({ c }: { c: Ctx }) {
  const [list, setList] = useLocal<Srv[]>('servers', [])
  const [show, setShow] = useState(false); const [name, setName] = useState(''); const [addr, setAddr] = useState('')
  const ok = name.trim().length > 0 && /^[\w.-]+(:\d{1,5})?$/.test(addr)
  return (
    <>
      <PageHead title="Servers" sub="Your saved multiplayer servers" actions={<Button onClick={() => setShow(true)}>Add server</Button>} />
      <Panel>{list.length === 0 ? <Empty icon={Globe} title="No servers" text="Save a server address to copy it quickly. Remember that offline profiles only work on servers that allow offline mode." /> : list.map((s) => (
        <div className="row-item" key={s.id}><div><strong>{s.name}</strong><div className="small text-muted">{s.addr}</div></div>
          <div className="d-flex gap-2"><Button size="sm" variant="outline-light" onClick={() => { void navigator.clipboard.writeText(s.addr); c.notify('Address copied', 'success') }}>Copy address</Button><Button size="sm" variant="outline-danger" onClick={() => setList(list.filter((x) => x.id !== s.id))}>Remove</Button></div></div>))}</Panel>
      <Modal show={show} onHide={() => setShow(false)} centered><Modal.Header closeButton><Modal.Title>Add server</Modal.Title></Modal.Header>
        <Modal.Body className="d-grid gap-3"><Form.Control placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} /><Form.Control placeholder="play.example.net:25565" value={addr} isInvalid={!!addr && !ok} onChange={(e) => setAddr(e.target.value)} /></Modal.Body>
        <Modal.Footer><Button variant="outline-light" onClick={() => setShow(false)}>Cancel</Button><Button disabled={!ok} onClick={() => { setList([...list, { id: crypto.randomUUID(), name: name.trim(), addr }]); setShow(false); setName(''); setAddr('') }}>Save</Button></Modal.Footer></Modal>
    </>
  )
}
