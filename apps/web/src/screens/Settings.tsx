import { useEventTagsStore } from '../state/event-tags-store'
import { Button, Input, Modal } from '../components/ui'
import { memo, useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Info, Plug, Tags, Plus, Trash2, X } from 'lucide-react'
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

const ConnectorRow = memo(function ConnectorRow({ id, label, configurable, checked, pending, onToggle }: {
  id: string
  label: string
  configurable: boolean
  checked: boolean
  pending: boolean
  onToggle(id: keyof ConnectorSettings): void
}) {
  return <li className="settings-row">
    <span className="settings-row-label" id={`connector-${id}`}>{label}</span>
    <div className="settings-row-actions">
      <SettingInfo label={label} message={connectorHelp[id] ?? 'Collect analytics events from this connector.'} />
      {configurable ? <button type="button" className="settings-switch" role="switch" aria-checked={checked} aria-labelledby={`connector-${id}`} aria-busy={pending} onClick={() => onToggle(id as keyof ConnectorSettings)}><span /></button> : <span className="settings-always-on">Always on</span>}
    </div>
  </li>
})

function SettingsOption({ title, description, icon, information, busy, children }: {
  title: string
  description: string
  icon: ReactNode
  information: string
  busy?: boolean
  children: ReactNode
}) {
  const titleId = useId()
  return <section className="settings-option" aria-labelledby={titleId} aria-busy={busy}>
    <header className="settings-option-heading">
      <span className="settings-option-icon">{icon}</span>
      <div><h2 id={titleId}>{title}</h2><p>{description}</p></div>
      <SettingInfo label={title} message={information} />
    </header>
    <div className="settings-section">{children}</div>
  </section>
}

function ConnectorsOption() {
  const [configuration, setConfiguration] = useState<ConnectorConfiguration | null>(null)
  const [pendingConnector, setPendingConnector] = useState<keyof ConnectorSettings | null>(null)
  const busy = pendingConnector !== null
  const [error, setError] = useState('')
  const configurationRef = useRef(configuration)
  configurationRef.current = configuration
  const saving = useRef(false)
  const load = () => { setError(''); void api.connectorSettings().then(setConfiguration).catch(e => setError(e.message)) }
  useEffect(load, [])
  const toggle = useCallback(async (id: keyof ConnectorSettings) => {
    const current = configurationRef.current
    if (!current || saving.current) return
    saving.current = true
    setPendingConnector(id); setError('')
    try {
      const updated = await api.updateConnectorSettings({ ...current.settings, [id]: !current.settings[id] })
      configurationRef.current = updated
      setConfiguration(updated)
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to update connectors.') }
    finally { saving.current = false; setPendingConnector(null) }
  }, [])
  return <SettingsOption title="Connectors" description="Choose the analytics sources to collect."
    icon={<Plug size={18} />} busy={busy}
    information="Changes apply immediately and keep your active recording running. Preferences last for this server session and reset when the server restarts.">
      {error && <div className="settings-error" role="alert">{error} <button type="button" onClick={load}>Retry</button></div>}
      {!configuration && !error && <div className="settings-loading" role="status">Loading connectors…</div>}
      <fieldset className="settings-connector-controls" aria-label="Connector switches" disabled={busy}>
        <ul className="settings-list">
          {configuration?.connectors.map(connector => <ConnectorRow
            key={connector.id} id={connector.id} label={connector.label} configurable={connector.configurable}
            checked={configuration.settings[connector.id as keyof ConnectorSettings] ?? true}
            pending={pendingConnector === connector.id} onToggle={toggle}
          />)}
        </ul>
      </fieldset>
  </SettingsOption>
}

function EventTagsOption() {
  const definitions = useEventTagsStore(state => state.definitions)
  const addTag = useEventTagsStore(state => state.addTag)
  const deleteTag = useEventTagsStore(state => state.deleteTag)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const submit = () => {
    try { addTag(name, value); setAdding(false); setName(''); setValue(''); setFormError('') }
    catch (cause) { setFormError(cause instanceof Error ? cause.message : 'Could not save tag.') }
  }
  const remove = (id: string) => {
    try { deleteTag(id); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not delete tag.') }
  }
  return <SettingsOption title="Event Tags" description="Manage the filters available in Live Stream." icon={<Tags size={18} />}
    information="Tag Name is the display label. Tag Value matches an event’s eventTag exactly, including case and spaces. Tags are saved in this browser. Deleting a custom tag removes only its filter; events and connectors stay unchanged.">
    {error && <div className="settings-error" role="alert">{error}</div>}
    <ul className="settings-list">
      {definitions.filter(tag => tag.type === 'predefined').map(tag => <li className="settings-row event-tag-row" key={tag.id}><span>{tag.name}</span><code>{tag.value}</code><span className="settings-always-on">Predefined</span></li>)}
    </ul>
    <div className="settings-tags-heading">Custom Tags</div>
    <ul className="settings-list">
      {definitions.filter(tag => tag.type === 'custom').map(tag => <li className="settings-row event-tag-row" key={tag.id}><span>{tag.name}</span><code>{tag.value}</code><button className="settings-tag-delete" aria-label={`Delete ${tag.name}`} onClick={() => remove(tag.id)}><Trash2 size={14} /></button></li>)}
    </ul>
    {!definitions.some(tag => tag.type === 'custom') && <p className="settings-tags-empty">No custom tags yet.</p>}
    <div className="settings-tags-footer"><Button onClick={() => { setFormError(''); setAdding(true) }}><Plus size={14} />Add Custom Tag</Button></div>
    {adding && <Modal title="Add Custom Tag" onClose={() => setAdding(false)} actions={<><Button onClick={() => setAdding(false)}>Cancel</Button><Button variant="primary" disabled={!name.trim() || !value.trim()} onClick={submit}>Add</Button></>}>
      <form id="add-event-tag" onSubmit={event => { event.preventDefault(); submit() }}>
        <label className="field-label">Tag Name<Input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="Property Events" /></label>
        <label className="field-label">Tag Value<Input value={value} onChange={event => setValue(event.target.value)} placeholder="property" /></label>
        {formError && <p className="settings-error" role="alert">{formError}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>}
  </SettingsOption>
}

export function Settings() {
  return <section className="screen settings-screen">
    <header className="page-header"><h1>Settings</h1></header>
    <div className="settings-options">
      <ConnectorsOption />
      <EventTagsOption />
    </div>
  </section>
}
