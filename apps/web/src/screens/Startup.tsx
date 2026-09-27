import { Bell, Copy, Moon, RefreshCw } from 'lucide-react'
import { CopyButton, Logo } from '../components/ui'

export function LoadingScreen() {
  return <main className="startup splash"><div className="splash-content"><Logo compact /><h1>EventDeck</h1><p>Analytics made visible</p><div className="loading-track"><i /></div><div className="preparing"><span className="spinner" />Preparing your workspace...</div></div></main>
}

export function DisconnectedScreen() {
  return <main className="startup disconnected-page">
    <header className="simple-header"><Logo /><div><Moon size={22} fill="currentColor" /><span className="bell"><Bell size={21} /><i /></span><span className="avatar">JD</span><span>⌄</span></div></header>
    <section className="disconnect-card">
      <span className="disconnected-badge"><i />Disconnected</span>
      <h1>Local server not connected</h1><p>EventDeck requires a local server to run event flows, process data,<br />and manage integrations. Start the local server to continue.</p>
      <div className="section-divider" /><h2>Get started</h2><p>Follow the steps below to set up and start EventDeck locally.</p>
      <div className="setup-steps">
        <div className="setup-step"><span className="step-number">1</span><div><h3>Install EventDeck</h3><p>Install the EventDeck CLI globally using npm.</p><code>npm install -g eventdeck <CopyButton text="npm install -g eventdeck" label="" /></code></div></div>
        <div className="setup-step"><span className="step-number">2</span><div><h3>Start the local server</h3><p>Run the following command to start EventDeck locally.</p><code>eventdeck start <CopyButton text="eventdeck start" label="" /></code></div></div>
      </div>
      <div className="auto-connect"><RefreshCw size={23} /><div><strong>Once the local server starts, this page will connect automatically.</strong><span>You can keep this page open while starting the server.</span></div></div>
    </section>
  </main>
}
