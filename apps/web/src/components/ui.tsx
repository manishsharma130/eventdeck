import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type PropsWithChildren, type ReactNode, type SelectHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronDown, CirclePlay, Copy, FileText, GitBranch, Pause,
  Play, Radio, Smartphone, Square, UserRound, Video,
} from 'lucide-react'
import { api, ApiError, type Device } from '../services/api'
import { useLiveStreamStore } from '../state/live-stream-store'

export type TabId = 'live' | 'rules' | 'build' | 'execution' | 'recordings'

const navItems: { id: TabId; label: string; icon: typeof Radio }[] = [
  { id: 'live', label: 'Live Stream', icon: Radio },
  { id: 'recordings', label: 'Recorded Sessions', icon: Video },
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

export function StickyHeader({ active }: {
  active: TabId
}) {
  const [blockedDevice, setBlockedDevice] = useState<string | null>(null)
  const [confirmDevice, setConfirmDevice] = useState<string | null>(null)
  const [sessionName, setSessionName] = useState('')
  const devices = useLiveStreamStore((state) => state.devices)
  const runtime = useLiveStreamStore((state) => state.runtime)
  const error = useLiveStreamStore((state) => state.error)
  const toast = useLiveStreamStore((state) => state.notice)
  const setDevices = useLiveStreamStore((state) => state.setDevices)
  const setRuntime = useLiveStreamStore((state) => state.setRuntime)
  const setError = useLiveStreamStore((state) => state.setError)
  const setToast = useLiveStreamStore((state) => state.setNotice)
  const hydrate = useLiveStreamStore((state) => state.hydrate)
  const knownDevices = useRef<Set<string> | null>(null)
  const deviceSnapshot = useRef<Device[]>([])
  useEffect(() => { void hydrate() }, [hydrate])
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 4000); return () => window.clearTimeout(timer) }, [toast])
  const runtimeRef = useRef(runtime)
  useEffect(() => { runtimeRef.current = runtime }, [runtime])
  useEffect(() => {
    if (active !== 'live') return
    let stopped = false
    const detectDevices = async () => {
      try {
        const latest = await api.devices()
        if (stopped) return
        const nextIds = new Set(latest.map((device) => device.id))
        const previous = knownDevices.current
        if (previous) {
          const connected = latest.find((device) => !previous.has(device.id))
          const disconnected = deviceSnapshot.current.find((device) => previous.has(device.id) && !nextIds.has(device.id))
          if (disconnected) {
            setToast(`${disconnected.name ?? disconnected.model ?? disconnected.id} disconnected.`)
            if (runtimeRef.current.selectedDeviceId === disconnected.id && runtimeRef.current.streamState !== 'STOPPED') void stream('stop')
          } else if (connected) setToast(`${connected.name ?? connected.model ?? connected.id} connected.`)
        }
        knownDevices.current = nextIds
        deviceSnapshot.current = latest
        setDevices(latest)
      } catch (cause) { if (!stopped) setError(cause instanceof Error ? cause.message : 'Could not detect devices.') }
    }
    void detectDevices()
    const timer = window.setInterval(() => void detectDevices(), 2000)
    return () => { stopped = true; window.clearInterval(timer); knownDevices.current = null; deviceSnapshot.current = [] }
  }, [active])
  const changeDevice = async (deviceId: string) => { try { setRuntime(await api.selectDevice(deviceId)); setError('') } catch (cause) { if (cause instanceof ApiError && cause.code === 'RECORDING_ACTIVE_DEVICE_CHANGE_BLOCKED') setBlockedDevice(deviceId); else setError(cause instanceof Error ? cause.message : 'Could not change device.') } }
  const requestDeviceChange = (deviceId: string) => {
    if (!deviceId || !runtime?.selectedDeviceId || deviceId === runtime.selectedDeviceId) { if (deviceId) void changeDevice(deviceId); return }
    setConfirmDevice(deviceId)
  }
  const stream = async (action: 'play' | 'pause' | 'stop') => { try { setRuntime(await api.stream(action)); setError('') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Stream command failed.') } }
  const streaming = runtime?.streamState === 'PLAYING'
  return (
    <header className="topbar">
      <label className="device-select" title={error || 'Selected Android device'}><Smartphone size={18} /><select aria-label="Active device" value={runtime?.selectedDeviceId ?? ''} onChange={(event) => requestDeviceChange(event.target.value)}><option value="">Select device</option>{runtime?.selectedDeviceId && !devices.some((device) => device.id === runtime.selectedDeviceId) && <option value={runtime.selectedDeviceId} disabled>{runtime.selectedDeviceId} (disconnected)</option>}{devices.map((device) => <option key={device.id} value={device.id}>{device.name ?? device.model ?? device.id}</option>)}</select><ChevronDown size={17} /></label>
      {active !== 'live' && (
        <>
          <IconButton label={streaming ? 'Pause stream' : 'Play stream'} onClick={() => void stream(streaming ? 'pause' : 'play')}>
            {streaming ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </IconButton>
          <IconButton label="Stop stream" onClick={() => void stream('stop')} disabled={runtime?.streamState === 'STOPPED'}><Square size={17} fill="currentColor" /></IconButton>
        </>
      )}
      <div className="topbar-spacer" />
      {active !== 'live' && <div className={`topbar-status ${streaming ? 'live' : 'inactive'}`} role="status"><span className={`dot ${streaming ? 'success' : ''}`} />{streaming ? 'Live' : 'Inactive'}</div>}
      {toast && <div className="app-toast" role="status">{toast}</div>}
      {confirmDevice && <Modal title="Change selected device?" onClose={() => setConfirmDevice(null)} actions={<><Button onClick={() => setConfirmDevice(null)}>Cancel</Button><Button variant="primary" onClick={() => { const next = confirmDevice; setConfirmDevice(null); void changeDevice(next) }}>Change Device</Button></>}><p>Changing the device will lose all Live Stream logs for <strong>{devices.find((device) => device.id === runtime?.selectedDeviceId)?.name ?? devices.find((device) => device.id === runtime?.selectedDeviceId)?.model ?? runtime?.selectedDeviceId}</strong>. The event list will be cleared for the newly selected device.</p></Modal>}
      {blockedDevice && <Modal title="Recording is active" onClose={() => { setBlockedDevice(null); setSessionName('') }} actions={<><Button onClick={() => { setBlockedDevice(null); setSessionName('') }}>Cancel</Button><Button variant="danger" disabled={!sessionName.trim()} onClick={() => void api.stopRecording(sessionName).then(() => changeDevice(blockedDevice)).then(() => { setBlockedDevice(null); setSessionName(''); setToast('Recording saved. Device changed and Live Stream was cleared.') }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not switch device.'))}>Stop &amp; Save Session</Button></>}><p>The recording belongs to the current device. Name and save it before switching devices.</p><label className="field-label">Session name<Input autoFocus value={sessionName} onChange={(event) => setSessionName(event.target.value)} placeholder="Enter a session name…" /></label></Modal>}
    </header>
  )
}

export function AppShell({ active, onNavigate, children }: PropsWithChildren<{
  active: TabId
  onNavigate: (tab: TabId) => void
}>) {
  return (
    <div className="app-shell">
      <Sidebar active={active} onNavigate={onNavigate} />
      <StickyHeader active={active} />
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

export function Modal({ title, children, actions, onClose, className = '' }: { title: string; children: ReactNode; actions: ReactNode; onClose: () => void; className?: string }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => {
    const root = document.getElementById('root')
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    root?.setAttribute('inert', '')
    root?.setAttribute('aria-hidden', 'true')
    document.body.classList.add('modal-open')
    const focusTimer = window.setTimeout(() => {
      const target = dialogRef.current?.querySelector<HTMLElement>('[autofocus], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
      target?.focus()
    })
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); return }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) { event.preventDefault(); return }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      root?.removeAttribute('inert')
      root?.removeAttribute('aria-hidden')
      document.body.classList.remove('modal-open')
      previouslyFocused?.focus()
    }
  }, [])
  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div ref={dialogRef} className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head"><h2 id={titleId}>{title}</h2><IconButton label="Close" bare onClick={onClose}>×</IconButton></div>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">{actions}</div>
      </div>
    </div>,
    document.body,
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
