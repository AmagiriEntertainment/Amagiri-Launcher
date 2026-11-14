import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Form, Modal, Spinner } from 'react-bootstrap'
import InstanceIcon from './InstanceIcon'
import IconPicker, { INSTANCE_PICKER_ICONS } from './IconPicker'
import { fetchLoaderSupport, fetchVersions, LOADERS } from '../services/launcher'
import type { Ctx, McVersion } from '../types'

// Memoized so typing or clicking elsewhere in the dialog never re-renders hundreds of <option>s.
const VersionSelect = memo(function VersionSelect({ list, value, onChange }: { list: McVersion[]; value: string; onChange: (v: string) => void }) {
  return <Form.Select value={value} onChange={(e) => onChange(e.target.value)}>{list.map((v) => <option key={v.id} value={v.id}>{v.id}</option>)}</Form.Select>
})

type Support = Record<string, Set<string> | null>

export default function NewInstance({ c, show, onHide }: { c: Ctx; show: boolean; onHide: () => void }) {
  const [list, setList] = useState<McVersion[] | null>(null)
  const [support, setSupport] = useState<Support | null>(null)
  const [checking, setChecking] = useState(false)
  const [err, setErr] = useState('')
  const [f, setF] = useState({ mc: '', loader: 'Vanilla', icon: INSTANCE_PICKER_ICONS[10] ?? 'block:crafting_table', all: false, play: false })
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null) // uncontrolled: no re-render per keystroke

  useEffect(() => { if (show && !list) fetchVersions().then(setList).catch((e: Error) => setErr(e.message)) }, [show])
  // Ask which loaders publish builds for which Minecraft versions (once the version list is known).
  useEffect(() => {
    if (!list || support) return
    let live = true
    setChecking(true)
    fetchLoaderSupport(list.map((v) => v.id)).then((s) => live && setSupport(s)).catch(() => undefined).finally(() => live && setChecking(false))
    return () => { live = false }
  }, [list])

  const vers = useMemo(() => (list ?? []).filter((v) => f.all || v.type === 'release'), [list, f.all])
  const mc = f.mc || vers[0]?.id || ''
  // Loaders that really exist for the selected version. Unknown support (offline) never hides anything.
  const loaders = useMemo(() => LOADERS.filter((l) => l === 'Vanilla' || (support ? (support[l] ? support[l]!.has(mc) : true) : !checking)), [support, checking, mc])
  const loader = loaders.includes(f.loader as never) ? f.loader : 'Vanilla'
  const pick = useCallback((v: string) => setF((p) => ({ ...p, mc: v })), [])
  if (!show) return null

  const create = () => {
    const name = nameRef.current?.value.trim() || `${loader === 'Vanilla' ? 'Minecraft' : loader} ${mc}`
    const i = { id: crypto.randomUUID(), name, mc, loader, icon: f.icon }
    c.setInstances([...c.instances, i]); c.setSelected(i.id); onHide(); setF((p) => ({ ...p, mc: '' }))
    c.install(i, f.play); c.go('instance')
  }
  return (
    <>
    <Modal show onHide={onHide} centered animation={false} dialogClassName="new-instance-dialog">
      <Modal.Header closeButton><Modal.Title>New Instance</Modal.Title></Modal.Header>
      <Modal.Body className="new-instance-body">
        <section className="ni-section">
          <Form.Label>Icon</Form.Label>
          <button type="button" className="ni-selected-icon" onClick={() => setIconPickerOpen(true)}><InstanceIcon icon={f.icon} size={34}/><span>Choose icon</span><small>77 icons · Upload custom</small></button>
        </section>
        <section className="ni-section">
          <Form.Label>Instance name</Form.Label>
          <Form.Control ref={nameRef} placeholder="Leave empty to name it automatically" />
        </section>
        <section className="ni-section">
          <div className="ni-row"><Form.Label className="mb-0">Minecraft version</Form.Label><Form.Check type="switch" label="Show snapshots" checked={f.all} onChange={(e) => setF((p) => ({ ...p, all: e.target.checked, mc: '' }))} /></div>
          {err ? <div className="text-danger small">Could not load versions: {err}</div> : !list ? <Spinner size="sm" /> : <VersionSelect list={vers} value={mc} onChange={pick} />}
        </section>
        <section className="ni-section">
          <div className="ni-row"><Form.Label className="mb-0">Mod loader</Form.Label>{checking && <span className="ni-hint"><Spinner size="sm" /> Checking support…</span>}</div>
          <div className="ni-loaders">{loaders.map((l) => <button key={l} type="button" className={`chip ${loader === l ? 'on' : ''}`} onClick={() => setF((p) => ({ ...p, loader: l }))}>{l}</button>)}</div>
          <div className="ni-hint">Only loaders available for Minecraft {mc || '…'} are shown. The loader version is picked automatically during installation.</div>
        </section>
      </Modal.Body>
      <Modal.Footer>
        <Form.Check type="switch" label="Launch after install" checked={f.play} onChange={(e) => setF((p) => ({ ...p, play: e.target.checked }))} />
        <div className="ni-actions"><Button variant="outline-light" onClick={onHide}>Cancel</Button><Button disabled={!mc || checking} onClick={create}>Create Instance</Button></div>
      </Modal.Footer>
    </Modal>
    <IconPicker show={iconPickerOpen} value={f.icon} onSelect={(icon) => setF((p) => ({ ...p, icon }))} onHide={() => setIconPickerOpen(false)}/>
    </>
  )
}
