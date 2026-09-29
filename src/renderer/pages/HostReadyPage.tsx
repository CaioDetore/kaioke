import { useEffect, useState } from "react";
import { MonitorPlay, Radio, Square, Users } from "lucide-react";
import { Button } from "../components/Button";
import type { HostSessionState } from "../../main/session-server";

export function HostReadyPage() {
  const [session, setSession] = useState<HostSessionState>({
    phase: "ready",
    participantCount: 0,
  });

  useEffect(() => {
    void window.kaioke.session.getState().then(setSession);
    return window.kaioke.session.onStateChanged(setSession);
  }, []);

  const active = session.phase === "accepting";
  const busy = session.phase === "starting" || session.phase === "stopping";
  const statusText = active
    ? `Sessão aberta · ${session.participantCount} participante${session.participantCount === 1 ? "" : "s"}`
    : session.phase === "starting"
      ? "Preparando a rede local…"
      : session.phase === "error"
        ? (session.error ?? "Não foi possível abrir a sessão.")
        : "Pronto para iniciar uma sessão";

  return (
    <main className="host-ready" aria-labelledby="page-title">
      <section className="host-ready__panel">
        <div className="eyebrow">
          <Radio aria-hidden="true" size={16} /> HOST LOCAL
        </div>
        <h1 id="page-title">Kaiokê</h1>
        <p className="subtitle">Seu palco está pronto.</p>
        <div
          className={`status ${session.phase === "error" ? "status--error" : ""}`}
          role="status"
          aria-label={`Status da sessão: ${statusText}`}
        >
          <span className="status__dot" aria-hidden="true" />
          <span>{statusText}</span>
        </div>
        <div className="host-ready__actions">
          {active ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void window.kaioke.session.stop()}
              disabled={busy}
            >
              <Square aria-hidden="true" size={18} /> Encerrar sessão
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void window.kaioke.session.start()}
              disabled={busy}
            >
              <MonitorPlay aria-hidden="true" size={18} /> Criar sessão
            </Button>
          )}
        </div>
        {active && session.url && (
          <section className="session-details" aria-label="Detalhes de entrada">
            {session.qrCodeDataUrl && (
              <img
                src={session.qrCodeDataUrl}
                alt="QR code para entrar na sessão"
              />
            )}
            <div>
              <span className="session-details__label">
                <Users aria-hidden="true" size={16} /> Entrada pela rede local
              </span>
              <a href={session.url}>{session.url}</a>
              <p>
                IP: {session.ip} · Porta: {session.port}
              </p>
            </div>
          </section>
        )}
        {!active && (
          <p className="hint">
            A sessão cria um link temporário para dispositivos na mesma Wi‑Fi.
          </p>
        )}
      </section>
    </main>
  );
}
