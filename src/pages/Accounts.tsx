import { useState } from 'react'
import { Alert, Badge, Button, Form, Modal } from 'react-bootstrap'
import { UserPlus, Trash2, ShieldCheck, User } from 'lucide-react'
import { Empty, PageHead, Panel } from '../components/ui'
import { isValidUsername, localId } from '../services/launcher'
import type { Ctx } from '../types'

export default function Accounts({ c }: { c: Ctx }) {
  const [show, setShow] = useState(false)
  const [name, setName] = useState('')
  const valid = isValidUsername(name)
  const add = async () => {
    if (!valid) return
    const a = { id: localId(), name, type: 'offline' as const, uuid: await window.api.offlineUuid(name) }
    c.setAccounts([...c.accounts, a]); if (!c.activeId) c.setActiveId(a.id)
    setShow(false); setName(''); c.notify(`Offline profile ${a.name} added`, 'success')
  }
  const remove = (id: string) => { c.setAccounts(c.accounts.filter((a) => a.id !== id)); if (c.activeId === id) c.setActiveId(''); c.notify('Profile removed', 'success') }
  return (
    <>
      <PageHead title="Accounts" sub="Microsoft accounts and local offline profiles" actions={<Button onClick={() => setShow(true)}><UserPlus size={16} className="me-2" />Add account</Button>} />
      <Alert variant="dark" className="border">Microsoft sign-in is not available yet. It will use the official Microsoft OAuth, Xbox and Minecraft entitlement flow; passwords are never collected here. Offline profiles are for single-player and servers that allow offline mode.</Alert>
      <Panel>
        {c.accounts.length === 0 ? <Empty icon={User} title="No accounts" text="Add an offline profile to get started." /> : c.accounts.map((a) => (
          <div className="row-item" key={a.id}>
            <div><strong>{a.name}</strong> <Badge bg={a.type === 'microsoft' ? 'success' : 'secondary'} className="ms-2">{a.type === 'microsoft' ? 'Microsoft' : 'Offline'}</Badge>{c.activeId === a.id && <Badge bg="danger" className="ms-2"><ShieldCheck size={12} /> Active</Badge>}
              <div className="small text-muted">{a.type === 'offline' ? 'Offline UUID' : 'UUID'}: {a.uuid}</div></div>
            <div className="d-flex gap-2"><Button size="sm" variant="outline-light" disabled={c.activeId === a.id} onClick={() => c.setActiveId(a.id)}>Select</Button><Button size="sm" variant="outline-danger" onClick={() => remove(a.id)}><Trash2 size={14} /></Button></div>
          </div>))}
      </Panel>
      <Modal show={show} onHide={() => setShow(false)} centered>
        <Modal.Header closeButton><Modal.Title>Add account</Modal.Title></Modal.Header>
        <Modal.Body>
          <Button variant="outline-light" className="w-100 mb-3" disabled>Sign in with Microsoft (needs auth backend)</Button>
          <Form.Group><Form.Label>Offline username</Form.Label><Form.Control value={name} isInvalid={!!name && !valid} onChange={(e) => setName(e.target.value)} placeholder="Steve" /><Form.Control.Feedback type="invalid">Use 3–16 letters, numbers or underscores.</Form.Control.Feedback></Form.Group>
        </Modal.Body>
        <Modal.Footer><Button variant="outline-light" onClick={() => setShow(false)}>Cancel</Button><Button disabled={!valid} onClick={add}>Add offline profile</Button></Modal.Footer>
      </Modal>
    </>
  )
}
