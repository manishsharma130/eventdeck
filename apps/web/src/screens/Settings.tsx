import { useEffect, useState } from 'react'
import { api, type ConnectorConfiguration, type ConnectorSettings } from '../services/api'

export function Settings() {
  const [configuration, setConfiguration] = useState<ConnectorConfiguration | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const load = () => { setError(''); void api.connectorSettings().then(setConfiguration).catch(e => setError(e.message)) }
  useEffect(load, [])
  async function toggle(id: keyof ConnectorSettings) {
    if (!configuration) return
    setBusy(true); setError('')
    try { setConfiguration(await api.updateConnectorSettings({ ...configuration.settings, [id]: !configuration.settings[id] })) }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to update connectors.') }
    finally { setBusy(false) }
  }
  return <section className="connector-settings">
    <h1>Settings</h1><h2>Analytics Connectors</h2>
    <p>Choose which SDK events appear in your stream. AnalyticsEvent is always enabled.</p>
    <p>Connector preferences apply for this server session.</p>
    {error && <div role="alert">{error} <button onClick={load}>Reload settings</button></div>}
    {!configuration && !error && <p>Loading connectors…</p>}
    {configuration?.connectors.filter(c => c.configurable).map(connector => {
      const id = connector.id as keyof ConnectorSettings
      return <label className="connector-setting" key={id}>
        <span>{connector.label}</span>
        <input type="checkbox" role="switch" checked={configuration.settings[id]} disabled={busy} onChange={() => void toggle(id)} />
      </label>
    })}
    <p>Branch and MoEngage logging must be enabled in your Android app. Google Analytics logging is configured automatically on the selected device.</p>
  </section>
}
