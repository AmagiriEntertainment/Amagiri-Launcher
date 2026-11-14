import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Form } from 'react-bootstrap'
import { FolderOpen, ImagePlus, Save, Sparkles, Trash2, UserRound, RotateCcw, Feather, X } from 'lucide-react'
import { PageHead, Panel } from '../components/ui'
import SkinViewer3D, { type SkinAnimation } from '../components/SkinViewer3D'
import type { Ctx } from '../types'

type SkinEntry = { id: string; name: string; data: string; model: 'Classic' | 'Slim'; createdAt: number }
type CapeEntry = { id: string; name: string; data: string; createdAt: number }
const CAPE_STORAGE_KEY = 'amagiri.cape-library.v1'
const STORAGE_KEY = 'amagiri.skin-library.v1'

export default function Skins({ c }: { c: Ctx }) {
  const [src, setSrc] = useState('')
  const [fileName, setFileName] = useState('')
  const [cape, setCape] = useState('')
  const [capeName, setCapeName] = useState('')
  const [capeErr, setCapeErr] = useState('')
  const [capeLibrary, setCapeLibrary] = useState<CapeEntry[]>([])
  const [selectedCape, setSelectedCape] = useState('')
  const [err, setErr] = useState('')
  const [model, setModel] = useState<'Classic' | 'Slim'>('Classic')
  const [animation, setAnimation] = useState<SkinAnimation>('idle')
  const [autoRotate, setAutoRotate] = useState(false)
  const [library, setLibrary] = useState<SkinEntry[]>([])
  const [selected, setSelected] = useState('')
  const [ready, setReady] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const capeFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) setLibrary(parsed.filter((x: any) => x && typeof x.data === 'string' && typeof x.id === 'string'))
      }
      const savedCapes = localStorage.getItem(CAPE_STORAGE_KEY)
      if (savedCapes) {
        const parsedCapes = JSON.parse(savedCapes)
        if (Array.isArray(parsedCapes)) setCapeLibrary(parsedCapes.filter((x: any) => x && typeof x.data === 'string' && typeof x.id === 'string'))
      }
      const activeCape = localStorage.getItem('amagiri.active-cape.v1')
      if (activeCape) setCape(activeCape)
    } catch { /* Ignore invalid local library data. */ }
    setReady(true)
  }, [])

  useEffect(() => {
    if (ready) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(library)) }
      catch { c.notify('Skin library storage is full. Remove a few saved skins and try again.', 'warning') }
    }
  }, [library, ready])

  useEffect(() => {
    if (!ready) return
    try { localStorage.setItem(CAPE_STORAGE_KEY, JSON.stringify(capeLibrary)) }
    catch { c.notify('Cape library storage is full. Remove a few saved capes and try again.', 'warning') }
  }, [capeLibrary, ready])

  useEffect(() => {
    if (!ready) return
    try { if (cape) localStorage.setItem('amagiri.active-cape.v1', cape); else localStorage.removeItem('amagiri.active-cape.v1') }
    catch { c.notify('Could not persist the active cape in local storage.', 'warning') }
  }, [cape, ready])

  const onFile = (file?: File) => {
    setErr('')
    if (!file) return
    if (file.type !== 'image/png') { setErr('Skin files must be PNG images.'); return }
    if (file.size > 1024 * 1024) { setErr('Please choose a PNG smaller than 1 MB.'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const data = String(reader.result || '')
      const img = new Image()
      img.onload = () => {
        if (img.width !== 64 || (img.height !== 64 && img.height !== 32)) {
          setErr(`Expected a 64×64 or legacy 64×32 skin. This image is ${img.width}×${img.height}.`)
          return
        }
        let normalized = data
        if (img.height === 32) {
          const canvas = document.createElement('canvas')
          canvas.width = 64; canvas.height = 64
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.imageSmoothingEnabled = false
            ctx.drawImage(img, 0, 0)
            // Legacy skins only contain the right-side limbs; copy them into the modern left-limb UV slots.
            ctx.drawImage(img, 40, 16, 16, 16, 32, 48, 16, 16)
            ctx.drawImage(img, 0, 16, 16, 16, 16, 48, 16, 16)
            normalized = canvas.toDataURL('image/png')
          }
        }
        setSrc(normalized)
        setFileName(file.name.replace(/\.png$/i, ''))
        setSelected('')
        setAnimation('idle')
        setAutoRotate(false)
      }
      img.onerror = () => setErr('Could not read this image. Please choose another PNG.')
      img.src = data
    }
    reader.onerror = () => setErr('Could not load this file.')
    reader.readAsDataURL(file)
  }

  const onCapeFile = (file?: File) => {
    setCapeErr('')
    if (!file) return
    if (file.type !== 'image/png') { setCapeErr('Cape files must be PNG images.'); return }
    if (file.size > 1024 * 1024) { setCapeErr('Please choose a PNG smaller than 1 MB.'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const data = String(reader.result || '')
      const img = new Image()
      img.onload = () => {
        // Standard Minecraft cape textures use a 2:1 texture canvas (commonly 64×32).
        if (img.width < 64 || img.height < 32 || img.width / img.height !== 2) {
          setCapeErr(`Expected a 2:1 cape texture (for example 64×32 or 128×64). This image is ${img.width}×${img.height}.`)
          return
        }
        setCape(data)
        setCapeName(file.name.replace(/\.png$/i, ''))
        setSelectedCape('')
      }
      img.onerror = () => setCapeErr('Could not read this cape image. Please choose another PNG.')
      img.src = data
    }
    reader.onerror = () => setCapeErr('Could not load this cape file.')
    reader.readAsDataURL(file)
  }

  const saveCape = () => {
    if (!cape) return
    if (capeLibrary.length >= 12) { c.notify('Your cape library has reached its 12-cape limit. Delete a saved cape first.', 'warning'); return }
    const name = capeName.trim() || `Amagiri Cape ${capeLibrary.length + 1}`
    const entry: CapeEntry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, data: cape, createdAt: Date.now() }
    setCapeLibrary(current => [entry, ...current])
    setSelectedCape(entry.id)
    c.notify('Cape saved to your local library.', 'success')
  }

  const useSavedCape = (entry: CapeEntry) => { setCape(entry.data); setCapeName(entry.name); setSelectedCape(entry.id); setCapeErr('') }
  const removeSavedCape = (id: string) => {
    const target = capeLibrary.find(item => item.id === id)
    setCapeLibrary(current => current.filter(item => item.id !== id))
    if (selectedCape === id) setSelectedCape('')
    if (target && cape === target.data) setCape('')
    c.notify('Cape removed from your library.', 'info')
  }

  const saveSkin = () => {
    if (!src) return
    if (library.length >= 12) { c.notify('Your library has reached its 12-skin limit. Delete a saved skin first.', 'warning'); return }
    const name = fileName.trim() || `Amagiri Skin ${library.length + 1}`
    const entry: SkinEntry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, data: src, model, createdAt: Date.now() }
    setLibrary(current => [entry, ...current])
    setSelected(entry.id)
    c.notify('Skin saved to your local library.', 'success')
  }

  const useSaved = (entry: SkinEntry) => {
    setSrc(entry.data); setFileName(entry.name); setModel(entry.model); setSelected(entry.id); setErr(''); setAnimation('idle')
  }

  const removeSaved = (id: string) => {
    setLibrary(current => current.filter(item => item.id !== id))
    if (selected === id) setSelected('')
    c.notify('Skin removed from your library.', 'info')
  }

  const microsoftConnected = c.accounts.some(account => account.type === 'microsoft')

  return <>
    <PageHead title="Customization" sub="Make your character yours — preview, pose and manage Minecraft skins." />
    <div className="row g-3 align-items-stretch customization-layout">
      <div className="col-xl-7 customization-stage-column">
        <Panel title="3D Skin Studio">
          {src ? <SkinViewer3D skin={src} cape={cape || undefined} model={model} animation={animation} autoRotate={autoRotate} /> : <div className="skin-stage skin-stage-empty"><div className="skin-empty-icon"><UserRound size={42} /></div><div className="fw-semibold mt-3">Your character is waiting</div><div className="small text-muted mt-1">Upload a Minecraft skin to see it in 3D.</div><Button variant="outline-light" size="sm" className="mt-3" onClick={() => fileRef.current?.click()}><ImagePlus size={15} className="me-2"/>Choose skin PNG</Button></div>}
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
            <div className="d-flex flex-wrap gap-2">
              <Button size="sm" variant={animation === 'idle' ? 'danger' : 'outline-secondary'} disabled={!src} onClick={() => setAnimation('idle')}>Idle</Button>
              <Button size="sm" variant={animation === 'walk' ? 'danger' : 'outline-secondary'} disabled={!src} onClick={() => setAnimation('walk')}>Walk</Button>
              <Button size="sm" variant={animation === 'run' ? 'danger' : 'outline-secondary'} disabled={!src} onClick={() => setAnimation('run')}>Run</Button>
              <Button size="sm" variant={animation === 'wave' ? 'danger' : 'outline-secondary'} disabled={!src} onClick={() => setAnimation('wave')}>Wave</Button>
              <Button size="sm" variant={animation === 'crouch' ? 'danger' : 'outline-secondary'} disabled={!src} onClick={() => setAnimation('crouch')}>Crouch</Button>
              <Button size="sm" variant={animation === 'fly' ? 'danger' : 'outline-secondary'} disabled={!src} onClick={() => setAnimation('fly')}>Fly</Button>
            </div>
            <div className="d-flex gap-2">
              <Button size="sm" variant={autoRotate ? 'danger' : 'outline-secondary'} disabled={!src} onClick={() => setAutoRotate(v => !v)}>Auto rotate</Button>
              <Button size="sm" variant="outline-secondary" disabled={!src} onClick={() => { setAnimation('idle'); setAutoRotate(false) }}><RotateCcw size={14} className="me-1"/>Reset</Button>
            </div>
          </div>
        </Panel>
        <div className="customization-library-stack">
    <div className="mt-3">
      <Panel title={`Skin Library · ${library.length}`}>
        {library.length === 0 ? <div className="skin-library-empty"><FolderOpen size={24}/><div className="fw-semibold mt-2">Your library is empty</div><div className="small text-muted">Save a skin to keep it here for your next session.</div></div> : <div className="row g-2">
          {library.map(entry => <div className="col-6 col-md-4 col-xl-3" key={entry.id}>
            <div className={`skin-library-card ${selected === entry.id ? 'active' : ''}`}>
              <button className="skin-library-preview" onClick={() => useSaved(entry)} title={`Preview ${entry.name}`}><img src={entry.data} alt={`${entry.name} texture`} /></button>
              <div className="d-flex align-items-center justify-content-between gap-2 p-2">
                <button className="skin-library-name" onClick={() => useSaved(entry)}>{entry.name}<span>{entry.model} model</span></button>
                <Button variant="outline-secondary" size="sm" className="skin-delete" aria-label={`Delete ${entry.name}`} onClick={() => removeSaved(entry.id)}><Trash2 size={14}/></Button>
              </div>
            </div>
          </div>)}
        </div>}
      </Panel>
    </div>

    <div className="mt-3">
      <Panel title={`Cape Library · ${capeLibrary.length}`}>
        {capeLibrary.length === 0 ? <div className="skin-library-empty"><Feather size={24}/><div className="fw-semibold mt-2">Your cape library is empty</div><div className="small text-muted">Upload and save a cape to keep it here.</div></div> : <div className="row g-2">
          {capeLibrary.map(entry => <div className="col-6 col-md-4 col-xl-3" key={entry.id}>
            <div className={`skin-library-card ${selectedCape === entry.id ? 'active' : ''}`}>
              <button className="skin-library-preview" onClick={() => useSavedCape(entry)} title={`Apply preview ${entry.name}`}><img src={entry.data} alt={`${entry.name} cape texture`} /></button>
              <div className="d-flex align-items-center justify-content-between gap-2 p-2">
                <button className="skin-library-name" onClick={() => useSavedCape(entry)}>{entry.name}<span>Custom cape</span></button>
                <Button variant="outline-secondary" size="sm" className="skin-delete" aria-label={`Delete ${entry.name}`} onClick={() => removeSavedCape(entry.id)}><Trash2 size={14}/></Button>
              </div>
            </div>
          </div>)}
        </div>}
      </Panel>
    </div>
        </div>
      </div>

      <div className="col-xl-5 customization-tools-column">
        <Panel title="Skin Setup">
          <div className="skin-upload-zone" onClick={() => fileRef.current?.click()} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click() }}>
            <div className="skin-upload-icon"><ImagePlus size={22}/></div>
            <div className="fw-semibold">{src ? 'Replace skin file' : 'Upload a skin'}</div>
            <div className="small text-muted mt-1">PNG · 64×64 (modern) or 64×32 (legacy) · max 1 MB</div>
            {fileName && <div className="small mt-2 text-danger">{fileName}.png</div>}
          </div>
          <input ref={fileRef} type="file" accept="image/png" className="d-none" onChange={e => { onFile(e.target.files?.[0]); e.currentTarget.value = '' }} />
          {err && <Alert variant="danger" className="mt-3 mb-0">{err}</Alert>}
          <Form.Group className="mt-3">
            <Form.Label className="small fw-semibold">Player model</Form.Label>
            <div className="d-flex gap-2">
              <Button className="flex-fill" variant={model === 'Classic' ? 'danger' : 'outline-secondary'} onClick={() => setModel('Classic')} disabled={!src}>Classic · Steve</Button>
              <Button className="flex-fill" variant={model === 'Slim' ? 'danger' : 'outline-secondary'} onClick={() => setModel('Slim')} disabled={!src}>Slim · Alex</Button>
            </div>
          </Form.Group>
          <Form.Group className="mt-3">
            <Form.Label className="small fw-semibold">Skin name</Form.Label>
            <Form.Control value={fileName} onChange={e => setFileName(e.target.value)} placeholder="My custom skin" disabled={!src}/>
          </Form.Group>
          <Button className="mt-3 w-100" variant="danger" disabled={!src} onClick={saveSkin}><Save size={15} className="me-2"/>Save to Skin Library</Button>
          <Button className="mt-2 w-100" variant="outline-secondary" disabled={!src} onClick={() => c.notify(microsoftConnected ? 'Microsoft profile skin upload is not implemented yet. Your skin is saved locally and ready to preview.' : 'Connect a Microsoft account first. Profile skin upload support is still being implemented.', 'warning')}>Apply to Minecraft Profile</Button>
          <div className="skin-info-note mt-3"><Sparkles size={16}/><span>Skin changes are previewed locally. Applying a skin to your online Minecraft profile requires Microsoft account profile-upload support, which is not yet implemented in this launcher.</span></div>
          {!microsoftConnected && <div className="small text-muted mt-2">No Microsoft account is connected yet. You can still preview and save skins on this device.</div>}
        </Panel>
        <Panel title="Cape Studio">
          <div className="skin-upload-zone" onClick={() => capeFileRef.current?.click()} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') capeFileRef.current?.click() }}>
            <div className="skin-upload-icon"><Feather size={22}/></div>
            <div className="fw-semibold">{cape ? 'Replace cape file' : 'Upload a cape'}</div>
            <div className="small text-muted mt-1">PNG · 2:1 texture · 64×32 or larger · max 1 MB</div>
            {capeName && <div className="small mt-2 text-danger">{capeName}.png</div>}
          </div>
          <input ref={capeFileRef} type="file" accept="image/png" className="d-none" onChange={e => { onCapeFile(e.target.files?.[0]); e.currentTarget.value = '' }} />
          {capeErr && <Alert variant="danger" className="mt-3 mb-0">{capeErr}</Alert>}
          <Form.Group className="mt-3">
            <Form.Label className="small fw-semibold">Cape name</Form.Label>
            <Form.Control value={capeName} onChange={e => setCapeName(e.target.value)} placeholder="My custom cape" disabled={!cape}/>
          </Form.Group>
          <div className="d-flex gap-2 mt-3">
            <Button className="flex-fill" variant="danger" disabled={!cape} onClick={saveCape}><Save size={15} className="me-2"/>Save cape</Button>
            <Button variant="outline-secondary" disabled={!cape} onClick={() => { setCape(''); setCapeName(''); setSelectedCape('') }}><X size={15} className="me-1"/>Remove</Button>
          </div>
          <div className="skin-info-note mt-3"><Feather size={16}/><span>Cape is shown on the 3D preview and saved locally. In-game offline cape injection still needs a compatible Minecraft client-side mod and launcher installation support.</span></div>
        </Panel>
      </div>
    </div>


  </>
}
