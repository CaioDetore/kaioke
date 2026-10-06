import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, MonitorPlay, Radio, Square, Trash2, Tv, Users } from "lucide-react";
import { Button } from "../components/Button";
import type { HostSessionState } from "../../main/session-server";
import type { Participant, QueueItem } from "../../shared/domain";
import { HostPlayer } from "../features/player/HostPlayer";

export function HostReadyPage() {
  const [session, setSession] = useState<HostSessionState>({
    phase: "ready",
    participantCount: 0,
  });
  const [snapshot, setSnapshot] = useState<{ participants: Participant[]; queue: QueueItem[]; playback: { queueItemId?: string; status: 'idle' | 'loading' | 'playing' | 'paused'; positionSeconds: number; updatedAt: string }; skipVote?: { queueItemId: string; voterDeviceIds: string[]; threshold: number } }>({ participants: [], queue: [], playback: { status: 'idle', positionSeconds: 0, updatedAt: new Date().toISOString() } });
  const [queueError, setQueueError] = useState<string>();
  const [presentationMode, setPresentationMode] = useState(false);
  const [projectionControls, setProjectionControls] = useState(true);

  useEffect(() => {
    void window.kaioke.session.getState().then(setSession);
    return window.kaioke.session.onStateChanged(setSession);
  }, []);

  useEffect(() => {
    if (session.phase !== "accepting") { setSnapshot({ participants: [], queue: [], playback: { status: 'idle', positionSeconds: 0, updatedAt: new Date().toISOString() } }); return; }
    const refresh = () => {
      const getSnapshot = window.kaioke.session.getSnapshot;
      if (typeof getSnapshot !== "function") return;
      void getSnapshot().then(setSnapshot).catch(() => undefined);
    };
    refresh();
    const interval = window.setInterval(refresh, 750);
    return () => window.clearInterval(interval);
  }, [session.phase]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key.toLowerCase() === "p") { event.preventDefault(); setPresentationMode(value => !value); }
      if (event.key.toLowerCase() === "c" && presentationMode) { event.preventDefault(); setProjectionControls(value => !value); }
      if (event.key.toLowerCase() === "f" || event.key === "F11") { event.preventDefault(); void window.kaioke.session.toggleFullscreen(); }
      if (event.key === "Escape" && presentationMode) setPresentationMode(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [presentationMode]);

  const active = session.phase === "accepting";
  const updateQueue = (operation: Promise<{ participants: Participant[]; queue: QueueItem[]; playback: { queueItemId?: string; status: 'idle' | 'loading' | 'playing' | 'paused'; positionSeconds: number; updatedAt: string }; skipVote?: { queueItemId: string; voterDeviceIds: string[]; threshold: number } }>) => {
    void operation.then(next => { setSnapshot(next); setQueueError(undefined); }).catch(() => setQueueError("Não foi possível alterar a fila."));
  };
  const busy = session.phase === "starting" || session.phase === "stopping";
  const activeItem = snapshot.queue.find(item => item.id === snapshot.playback.queueItemId);
  const upcomingItems = snapshot.queue.filter(item => item.status === "queued");
  const pendingItems = snapshot.queue.filter(item => item.status === "queued");
  const recentlyPlayed = snapshot.queue.filter(item => item.status === "played" || item.status === "skipped" || item.status === "failed").slice(-4).reverse();
  const participantNames = Array.from(new Map(snapshot.participants
    .map(person => person.displayName.trim())
    .filter(Boolean)
    .map(name => [name.toLocaleLowerCase(), name])).values());
  const shouldAnimateParticipants = participantNames.length > 3;
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
        <div className="brand-mark">
          <div className="brand-mark__disc" aria-hidden="true"><span /><i /></div>
          <span className="brand-mark__orbit brand-mark__orbit--one" aria-hidden="true" />
          <span className="brand-mark__orbit brand-mark__orbit--two" aria-hidden="true" />
          <h1 id="page-title">Kaioke</h1>
        </div>
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
          {active && <Button type="button" variant="secondary" onClick={() => setPresentationMode(value => !value)}><Tv aria-hidden="true" size={18} /> {presentationMode ? "Sair da apresentação" : "Modo apresentação"}</Button>}
          {active && <Button type="button" variant="secondary" onClick={() => setProjectionControls(value => !value)}>{projectionControls ? "Ocultar controles na projeção" : "Mostrar controles na projeção"}</Button>}
          {active && <Button type="button" variant="secondary" onClick={() => void window.kaioke.session.toggleFullscreen()}>Tela cheia</Button>}
        </div>
        {presentationMode && active && session.url && (
          <section className="presentation" aria-label="Modo apresentação">
            <div className="presentation__stage">
              <HostPlayer item={activeItem} playback={snapshot.playback} presentationControls={projectionControls} onTogglePresentationControls={() => setProjectionControls(value => !value)} onCommand={command => void window.kaioke.session.playbackCommand(command).then(setSnapshot)} />
            </div>
            <aside className="presentation__bottom">
              <section className="presentation__queue-panel" aria-label="Músicas da sessão">
                <section className="presentation__current" aria-label="Tocando agora">
                  <div className={`presentation__record ${snapshot.playback.status === "playing" ? "is-playing" : ""}`} aria-hidden="true">
                    <span className="presentation__record-label" />
                    <span className="presentation__record-hole" />
                  </div>
                  <div className="presentation__current-copy">
                    <span className="presentation__kicker"><i aria-hidden="true" /> Tocando agora</span>
                    <strong>{activeItem?.title ?? (activeItem ? activeItem.videoId : "Aguardando a próxima música")}</strong>
                    <p>{activeItem?.channelName ?? activeItem?.requestedByName ?? "A fila começa assim que alguém fizer um pedido"}</p>
                    {snapshot.skipVote && <small>Votos para pular: {snapshot.skipVote.voterDeviceIds.length}/{snapshot.skipVote.threshold}</small>}
                  </div>
                </section>
                <PresentationList title="Próxima" items={upcomingItems.slice(0, 1)} empty="Nenhum pedido na fila" />
                <PresentationList title="Última tocada" items={recentlyPlayed.slice(0, 1)} empty="Ainda não há músicas tocadas" />
              </section>
              <section className="presentation__join">
                {session.qrCodeDataUrl && <img src={session.qrCodeDataUrl} alt="QR code para entrar na sessão" />}
                <p><strong>Peça sua música</strong>Aponte a câmera para entrar na fila</p>
              </section>
            </aside>
          </section>
        )}
        {active && session.url && !presentationMode && (
          <>
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
              <span className="session-details__url" aria-label="Endereço de entrada da sessão">{session.url}</span>
              <p>
                IP: {session.ip} · Porta: {session.port}
              </p>
            </div>
          </section>
          <section className="host-dashboard" aria-label="Fila da sessão">
            <HostPlayer item={activeItem} playback={snapshot.playback} onCommand={command => void window.kaioke.session.playbackCommand(command).then(setSnapshot)} />
            <p className="host-dashboard__now-playing">{activeItem ? `Tocando: ${activeItem.title ?? activeItem.videoId} · ${snapshot.playback.status}` : "Aguardando uma música"}</p>
            {snapshot.skipVote && <p className="host-dashboard__votes">Votos para pular: {snapshot.skipVote.voterDeviceIds.length}/{snapshot.skipVote.threshold}</p>}
            <div className="host-dashboard__queue-heading"><h2>Fila de pedidos</h2><span aria-hidden="true">•</span><p>{pendingItems.length ? `${pendingItems.length} música${pendingItems.length === 1 ? "" : "s"} aguardando` : "Aguardando pedidos"}</p></div>
            <div className="host-dashboard__people" aria-label={`Participantes: ${participantNames.join(", ") || "nenhum participante conectado"}`}>
              <Users aria-hidden="true" size={16} />
              <div className="host-dashboard__people-viewport">
                <div aria-hidden="true" className={`host-dashboard__people-track ${shouldAnimateParticipants ? "is-moving" : ""}`}>
                  {participantNames.length ? <>
                    <div className="host-dashboard__people-group">{participantNames.map((name, index) => <span key={`${name}-${index}`}>{name}</span>)}</div>
                    {shouldAnimateParticipants && <div className="host-dashboard__people-group">{participantNames.map((name, index) => <span key={`${name}-${index}`}>{name}</span>)}</div>}
                  </> : <span>Nenhum participante conectado</span>}
                </div>
              </div>
            </div>
            <ol className="host-dashboard__queue">
              {pendingItems.map((item, index) => <li key={item.id}><div><strong>{index + 1}. {item.title ?? item.videoId}</strong><span>{item.channelName ? `${item.channelName} · ` : ""}Pedido por {item.requestedByName ?? snapshot.participants.find(person => person.deviceId === item.requestedBy)?.displayName ?? "Participante"}</span></div><div className="queue-actions"><button type="button" aria-label={`Mover ${item.title ?? item.videoId} para cima`} disabled={index === 0} onClick={() => updateQueue(window.kaioke.session.reorderQueueItem(item.id, index - 1))}><ChevronUp size={17} /></button><button type="button" aria-label={`Mover ${item.title ?? item.videoId} para baixo`} disabled={index === pendingItems.length - 1} onClick={() => updateQueue(window.kaioke.session.reorderQueueItem(item.id, index + 1))}><ChevronDown size={17} /></button><button type="button" aria-label={`Remover ${item.title ?? item.videoId}`} onClick={() => updateQueue(window.kaioke.session.removeQueueItem(item.id))}><Trash2 size={16} /></button></div></li>)}
            </ol>
            {queueError && <p className="host-dashboard__error" role="alert">{queueError}</p>}
          </section>
          </>
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

function PresentationList({ title, items, empty }: { title: string; items: QueueItem[]; empty: string }) {
  return <section className="presentation__list"><h2>{title}</h2>{items.length ? <ol>{items.map(item => <li key={item.id}>{item.title ?? item.videoId}<small>{item.requestedByName ?? "Participante"}</small></li>)}</ol> : <p>{empty}</p>}</section>;
}
