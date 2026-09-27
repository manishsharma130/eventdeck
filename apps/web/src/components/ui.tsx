import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren, ReactNode, SelectHTMLAttributes } from 'react'
import {
  ChevronDown, CirclePlay, Copy, FileText, GitBranch, Pause,
  Play, Radio, Smartphone, Square, UserRound,
} from 'lucide-react'

export type TabId = 'live' | 'rules' | 'build' | 'execution'

const navItems: { id: TabId; label: string; icon: typeof Radio }[] = [
  { id: 'live', label: 'Live Stream', icon: Radio },
  { id: 'rules', label: 'Event Rules', icon: FileText },
  { id: 'build', label: 'Build Flow', icon: GitBranch },
  { id: 'execution', label: 'Flow Execution', icon: CirclePlay },
]

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand-compact' : ''}`} aria-label="EventDeck">
      <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
      {!compact && <span>EventDeck</span>}
    </div>
  )
}

export function Sidebar({ active, onNavigate }: { active: TabId; onNavigate: (tab: TabId) => void }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand"><Logo /></div>
      <nav aria-label="Main navigation">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`nav-item ${active === id ? 'active' : ''}`} onClick={() => onNavigate(id)}>
            <Icon size={22} strokeWidth={1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}

export function StickyHeader({ active, streaming, onStreamingChange }: {
  active: TabId
  streaming: boolean
  onStreamingChange: (value: boolean) => void
}) {
  return (
    <header className="topbar">
      <button className="device-select"><Smartphone size={18} /> <span>iPhone 15 Pro (iOS)</span><ChevronDown size={17} /></button>
      {active !== 'live' && (
        <>
          <IconButton label={streaming ? 'Pause stream' : 'Play stream'} onClick={() => onStreamingChange(!streaming)}>
            {streaming ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </IconButton>
          <IconButton label="Stop stream" onClick={() => onStreamingChange(false)} disabled={!streaming}><Square size={17} fill="currentColor" /></IconButton>
        </>
      )}
      <div className="topbar-spacer" />
      {active !== 'live' && <div className={`topbar-status ${streaming ? 'live' : 'inactive'}`} role="status"><span className={`dot ${streaming ? 'success' : ''}`} />{streaming ? 'Live' : 'Inactive'}</div>}
    </header>
  )
}

export function AppShell({ active, onNavigate, streaming, onStreamingChange, children }: PropsWithChildren<{
  active: TabId
  onNavigate: (tab: TabId) => void
  streaming: boolean
  onStreamingChange: (value: boolean) => void
}>) {
  return (
    <div className="app-shell">
      <Sidebar active={active} onNavigate={onNavigate} />
      <StickyHeader active={active} streaming={streaming} onStreamingChange={onStreamingChange} />
      <main className="workspace">{children}</main>
    </div>
  )
}

export function PageHeader({ title, description }: { title: string; description: string }) {
  return <div className="page-header"><h1>{title}</h1><p>{description}</p></div>
}

export function Panel({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <section className={`panel ${className}`}>{children}</section>
}

export function Button({ variant = 'secondary', children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
}) {
  return <button className={`button ${variant} ${className}`} {...props}>{children}</button>
}

export function IconButton({ label, children, bare = false, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  children: ReactNode
  bare?: boolean
}) {
  return <button aria-label={label} title={label} className={`icon-button ${bare ? 'bare' : ''}`} {...props}>{children}</button>
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${className}`} {...props} />
}

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <span className={`select-wrap ${className}`}><select {...props}>{children}</select><ChevronDown size={16} /></span>
}

export function TagBadge({ children, tone = 'blue' }: PropsWithChildren<{ tone?: 'blue' | 'green' | 'purple' | 'muted' }>) {
  return <span className={`tag-badge ${tone}`}>{children}</span>
}

export function Checkbox({ checked, onChange, label }: { checked?: boolean; onChange?: () => void; label: string }) {
  return <button className={`checkbox ${checked ? 'checked' : ''}`} role="checkbox" aria-checked={checked} aria-label={label} onClick={onChange}>{checked && '✓'}</button>
}

export function Modal({ title, children, actions, onClose }: { title: string; children: ReactNode; actions: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head"><h2 id="modal-title">{title}</h2><IconButton label="Close" bare onClick={onClose}>×</IconButton></div>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  )
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const copy = () => void navigator.clipboard?.writeText(text)
  return <Button onClick={copy} className="copy-button"><Copy size={17} />{label}</Button>
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return <div className="empty-state"><strong>{title}</strong>{description && <span>{description}</span>}</div>
}

export { Play, Pause, Square, UserRound }
