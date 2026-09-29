import { MonitorPlay, Radio, ShieldCheck } from 'lucide-react'
import { Button } from '../components/Button'

export function HostReadyPage() {
  return (
    <main className="host-ready" aria-labelledby="page-title">
      <section className="host-ready__panel">
        <div className="eyebrow"><Radio aria-hidden="true" size={16} /> HOST LOCAL</div>
        <h1 id="page-title">Kaioke</h1>
        <p className="subtitle">Seu palco está pronto.</p>
        <div className="status" role="status" aria-label="Status da sessão: pronta">
          <span className="status__dot" aria-hidden="true" />
          <span>Pronto para iniciar uma sessão</span>
        </div>
        <div className="host-ready__actions">
          <Button type="button"><MonitorPlay aria-hidden="true" size={18} /> Criar sessão</Button>
          <Button type="button" variant="secondary"><ShieldCheck aria-hidden="true" size={18} /> Ambiente seguro</Button>
        </div>
        <p className="hint">A conexão LAN e o QR code chegam na próxima etapa.</p>
      </section>
    </main>
  )
}
