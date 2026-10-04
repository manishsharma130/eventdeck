import { useEffect, useId, useRef, useState } from 'react'
import { Info, Plug, X } from 'lucide-react'
import { api, type ConnectorConfiguration, type ConnectorSettings } from '../services/api'

const connectorHelp: Record<string, string> = {
  analytics_event: 'The core EventDeck connector is always enabled. Events keep the eventTag supplied by your app.',
  google_analytics: 'Reads Firebase and Google Analytics events. Verbose logging is configured automatically on the selected Android device.',
  branch: 'Reads Branch events. Enable verbose Branch logging in your Android app before streaming.',
  moengage: 'Reads MoEngage events. Enable debug logging in your Android app before streaming.',
}

function SettingInfo({ label, message }: { label: string; message: string }) {
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const open = hovered || pinned
  const close = () => { setHovered(false); setPinned(false) }
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) close() }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  return <div className="setting-info" ref={ref} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close() }}>
    <button type="button" className="setting-info-button" aria-label={`About ${label}`} aria-expanded={open} aria-controls={id} onClick={() => { if (pinned) close(); else setPinned(true) }} onFocus={() => setHovered(true)}>
      <Info size={15} />
    </button>
    {open && <div id={id} className="setting-info-message" role="note">
      <Info size={16} /><p>{message}</p>
      <button type="button" aria-label="Dismiss information" onClick={close}><X size={14} /></button>
    </div>}
  </div>
}

export function Settings() {
  const [configuration, setConfiguration] = useState<ConnectorConfiguration | null>(null)
  const [pendingConnector, setPendingConnector] = useState<keyof ConnectorSettings | null>(null)
  const busy = pendingConnector !== null
  const [error, setError] = useState('')
  const load = () => { setError(''); void api.connectorSettings().then(setConfiguration).catch(e => setError(e.message)) }
  useEffect(load, [])
  async function toggle(id: keyof ConnectorSettings) {
    if (!configuration || busy) return
    setPendingConnector(id); setError('')
    try { setConfiguration(await api.updateConnectorSettings({ ...configuration.settings, [id]: !configuration.settings[id] })) }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to update connectors.') }
    finally { setPendingConnector(null) }
  }
  return <section className="screen settings-screen">
    <header className="page-header"><h1>Settings</h1><p>Manage your EventDeck preferences.</p></header>
    <section className="settings-section" aria-labelledby="connectors-title" aria-busy={busy}>
      <div className="settings-section-heading">
        <Plug size={17} /><h2 id="connectors-title">Analytics connectors</h2>
        <SettingInfo label="analytics connectors" message="Choose which SDK events EventDeck collects. Changes apply immediately and keep your active recording running. Preferences last for this server session and reset when the server restarts." />
      </div>
      {error && <div className="settings-error" role="alert">{error} <button type="button" onClick={load}>Retry</button></div>}
      {!configuration && !error && <div className="settings-loading" role="status">Loading connectors…</div>}
      <ul className="settings-list">
        {configuration?.connectors.map(connector => {
          const id = connector.id as keyof ConnectorSettings
          return <li className="settings-row" key={id}>
            <span className="settings-row-label" id={`connector-${id}`}>{connector.label}</span>
            <div className="settings-row-actions">
              <SettingInfo label={connector.label} message={connectorHelp[id] ?? 'Collect analytics events from this connector.'} />
              {connector.configurable ? <button type="button" className="settings-switch" role="switch" aria-checked={configuration.settings[id]} aria-labelledby={`connector-${id}`} disabled={busy} aria-busy={pendingConnector === id} onClick={() => void toggle(id)}><span /></button> : <span className="settings-always-on">Always on</span>}
            </div>
          </li>
        })}
      </ul>
    </section>
  </section>
}
