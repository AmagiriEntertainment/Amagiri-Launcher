import { Children, isValidElement, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type SurfaceProps = { children: ReactNode; className?: string; title?: string }

export function GlassPanel({ children, className = '', title }: SurfaceProps) {
  return <section className={`glass-panel ${className}`}>{title && <h6>{title}</h6>}{children}</section>
}
export function GlassCard({ children, className = '' }: Omit<SurfaceProps, 'title'>) {
  return <div className={`glass-card ${className}`}>{children}</div>
}
export function IconButton({ children, className = '', title, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`icon-button ${className}`} title={title} aria-label={props['aria-label'] || title} {...props}>{children}</button>
}
export function PrimaryButton({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`primary-button ${className}`} {...props}>{children}</button>
}
export function SecondaryButton({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`secondary-button ${className}`} {...props}>{children}</button>
}
export function SearchInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="search" className={`design-search ${className}`} {...props}/>
}
export function ProgressTrack({ value, className = '' }: { value: number; className?: string }) {
  const safeValue = Math.max(0, Math.min(100, value))
  return <div className={`design-progress ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeValue}><span style={{ width: `${safeValue}%` }}/></div>
}

export const Panel = ({ title, children, className = '' }: SurfaceProps) => (
  <GlassPanel title={title} className={className}>{children}</GlassPanel>
)
export const PageHead = ({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) => (
  <div className="d-flex justify-content-between align-items-start mb-4 page-heading">
    <div><h3 className="mb-1">{title}</h3>{sub && <div className="text-muted">{sub}</div>}</div>
    <div className="d-flex gap-2">{actions}</div>
  </div>
)
export const Empty = ({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: ReactNode }) => (
  <div className="empty"><Icon size={34} strokeWidth={1.5}/><h6 className="text-light mb-1">{title}</h6><p className="mb-3">{text}</p>{action}</div>
)
export const Stat = ({ label, value }: { label: string; value: ReactNode }) => (
  <div><div className="text-muted small">{label}</div><div className="fw-semibold">{value}</div></div>
)

/* ---- Settings layout primitives (used by launcher settings and instance settings) ---- */
export const SettingsGrid = ({ children }: { children: ReactNode }) => {
  const items = Children.toArray(children)
  const wide = items.filter((item) => isValidElement(item) && Boolean((item.props as { wide?: boolean }).wide))
  const regular = items.filter((item) => !isValidElement(item) || !(item.props as { wide?: boolean }).wide)
  const left = regular.filter((_, index) => index % 2 === 0)
  const right = regular.filter((_, index) => index % 2 === 1)
  return <div className="sg-grid"><div className="sg-column">{left}</div><div className="sg-column">{right}</div>{wide}</div>
}
export const Group = ({ title, desc, aside, children, wide = false }: { title: string; desc?: string; aside?: ReactNode; children: ReactNode; wide?: boolean }) => (
  <section className={`sg ${wide ? 'sg-wide' : ''}`}>
    <header className="sg-head"><div><h6>{title}</h6>{desc && <p>{desc}</p>}</div>{aside && <div className="sg-aside">{aside}</div>}</header>
    <div className="sg-body">{children}</div>
  </section>
)
export const Field = ({ label, value, hint, error, children }: { label: ReactNode; value?: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode }) => (
  <div className="sf">
    <div className="sf-top"><label className="sf-label">{label}</label>{value !== undefined && <span className="sf-value">{value}</span>}</div>
    {children}
    {error ? <div className="sf-error">{error}</div> : hint ? <div className="sf-hint">{hint}</div> : null}
  </div>
)
export const Segment = ({ options, value, onChange }: { options: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) => (
  <div className="segment" role="tablist">{options.map((o) => <button key={o.id} type="button" role="tab" aria-selected={value === o.id} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>{o.label}</button>)}</div>
)
export const SaveBar = ({ dirty, disabled, message, onSave, onDiscard, saveLabel, savedLabel, unsavedLabel, discardLabel, extra }: {
  dirty: boolean; disabled?: boolean; message?: string; onSave: () => void; onDiscard: () => void
  saveLabel: string; savedLabel: string; unsavedLabel: string; discardLabel: string; extra?: ReactNode
}) => (
  <div className={`save-bar ${dirty ? 'dirty' : ''}`}>
    <span className="save-bar-status"><i/>{message ?? (dirty ? unsavedLabel : savedLabel)}</span>
    <div className="save-bar-actions">{extra}<SecondaryButton disabled={!dirty} onClick={onDiscard}>{discardLabel}</SecondaryButton><PrimaryButton disabled={!dirty || disabled} onClick={onSave}>{saveLabel}</PrimaryButton></div>
  </div>
)
