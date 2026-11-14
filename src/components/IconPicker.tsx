import { useMemo, useRef, useState } from 'react'
import { Button, Form, Modal } from 'react-bootstrap'
import { Search, Upload, X } from 'lucide-react'

const iconFiles = import.meta.glob('../assets/instance-icons/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
export const INSTANCE_PICKER_ICONS = Object.keys(iconFiles).sort().map((path) => `picker:${path.match(/(\d+)\.png$/)?.[1] ?? '01'}`)
export const pickerIconUrl = (value: string) => {
  const id = value.match(/^picker:(\d+)$/)?.[1]
  return id ? iconFiles[`../assets/instance-icons/${id}.png`] ?? '' : ''
}

export default function IconPicker({ show, value, onSelect, onHide }: { show: boolean; value: string; onSelect: (value: string) => void; onHide: () => void }) {
  const [query, setQuery] = useState('')
  const uploadRef = useRef<HTMLInputElement>(null)
  const filtered = useMemo(() => INSTANCE_PICKER_ICONS.filter((icon) => {
    const id = Number(icon.split(':')[1])
    return !query.trim() || `block ${id} icon ${id}`.includes(query.trim().toLowerCase())
  }), [query])
  const chooseUpload = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 2 * 1024 * 1024) return
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === 'string') { onSelect(reader.result); onHide() } }
    reader.readAsDataURL(file)
  }
  return <Modal show={show} onHide={onHide} centered animation={false} dialogClassName="instance-icon-dialog">
    <Modal.Header><Modal.Title>Choose Icon</Modal.Title><button className="icon-picker-close" onClick={onHide} aria-label="Close"><X size={19}/></button></Modal.Header>
    <Modal.Body>
      <div className="icon-picker-search"><Search size={17}/><Form.Control type="search" placeholder="Search icons..." value={query} onChange={(e) => setQuery(e.target.value)}/></div>
      <div className="icon-picker-grid">
        <button type="button" className="icon-picker-upload" title="Upload custom icon" onClick={() => uploadRef.current?.click()}><Upload size={20}/></button>
        {filtered.map((icon) => <button type="button" key={icon} title={`Block ${icon.split(':')[1]}`} className={`icon-picker-tile ${value === icon ? 'selected' : ''}`} onClick={() => { onSelect(icon); onHide() }}><img src={pickerIconUrl(icon)} alt=""/></button>)}
      </div>
      <input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { chooseUpload(e.target.files?.[0]); e.currentTarget.value = '' }}/>
      <div className="icon-picker-footer"><span>{filtered.length + (query ? 0 : 5)} icons</span><Button variant="outline-light" onClick={onHide}>Cancel</Button></div>
    </Modal.Body>
  </Modal>
}
