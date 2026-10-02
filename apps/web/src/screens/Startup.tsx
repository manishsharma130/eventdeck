import { RefreshCw } from 'lucide-react'
import { CopyButton, Logo } from '../components/ui'

export function LoadingScreen() {
  return <main className="startup splash" aria-label="EventDeck is loading">
    <div className="splash-identity">
      <div className="splash-logo-formation" aria-hidden="true">
        <span className="event-particle event-particle-1" />
        <span className="event-particle event-particle-2" />
        <span className="event-particle event-particle-3" />
        <span className="event-particle event-particle-4" />
        <span className="event-particle event-particle-5" />
        <span className="event-particle event-particle-6" />
        <span className="event-particle event-particle-7" />
        <span className="event-particle event-particle-8" />
        <Logo compact />
      </div>
      <h1 className="splash-name">EventDeck</h1>
    </div>
  </main>
}

export function DisconnectedScreen() {
  return <main className="startup disconnected-page">
    <section className="disconnect-card">
      <span className="disconnected-badge"><i />Disconnected</span>
      <h1>EventDeck service is not connected</h1><p>EventDeck requires its service to run event flows, process data,<br />and manage integrations. Start the EventDeck service to continue.</p>
      <div className="section-divider" /><h2>Get started</h2><p>Follow the steps below to install and start the EventDeck service.</p>
      <div className="setup-steps">
        <div className="setup-step"><span className="step-number">1</span><div><h3>Install EventDeck</h3><p>Install the EventDeck CLI globally using npm.</p><code>npm install -g eventdeck <CopyButton text="npm install -g eventdeck" label="" /></code></div></div>
        <div className="setup-step"><span className="step-number">2</span><div><h3>Start the EventDeck service</h3><p>Run the following command to start the service.</p><code>eventdeck start <CopyButton text="eventdeck start" label="" /></code></div></div>
      </div>
      <div className="auto-connect"><RefreshCw size={23} /><div><strong>Once the EventDeck service starts, this page will connect automatically.</strong><span>You can keep this page open while starting the service.</span></div></div>
    </section>
  </main>
}
