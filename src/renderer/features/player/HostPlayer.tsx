import { SlidersHorizontal } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlaybackState, QueueItem } from '../../../shared/domain'

type Player = { loadVideoById: (videoId: string, startSeconds?: number) => void; playVideo: () => void; pauseVideo: () => void; seekTo: (seconds: number, allowSeekAhead: boolean) => void; getCurrentTime: () => number; getVideoData: () => { title?: string; author?: string }; destroy: () => void }
type Command = { action: 'loading' | 'play' | 'pause' | 'seek' | 'ended' | 'error' | 'skip'; positionSeconds?: number }
type Props = { item?: QueueItem; playback: PlaybackState; voteTransitionEndsAt?: string; hideControls?: boolean; presentationControls?: boolean; onTogglePresentationControls?: () => void; onCommand: (command: Command) => void }

declare global { interface Window { YT?: { Player: new (element: HTMLElement, options: Record<string, unknown>) => Player; PlayerState: { PLAYING: number; PAUSED: number; ENDED: number } } } }

export function HostPlayer({ item, playback, voteTransitionEndsAt, hideControls = false, presentationControls = false, onTogglePresentationControls, onCommand }: Props) {
  const mount = useRef<HTMLDivElement>(null); const player = useRef<Player | undefined>(undefined); const loaded = useRef<string | undefined>(undefined); const itemRef = useRef<QueueItem | undefined>(undefined); const reportedMetadata = useRef<string | undefined>(undefined); const transitionTimer = useRef<number | undefined>(undefined); const onCommandRef = useRef(onCommand); const [ready, setReady] = useState(false); const [transition, setTransition] = useState<{ action: 'ended' | 'skip'; seconds: number }>()
  itemRef.current = item
  onCommandRef.current = onCommand
  const beginTransition = useCallback((action: 'ended' | 'skip') => {
    if (transitionTimer.current !== undefined) return
    if (action === 'skip') player.current?.pauseVideo()
    let seconds = 5
    setTransition({ action, seconds })
    const tick = () => {
      seconds -= 1
      if (seconds === 0) {
        transitionTimer.current = undefined
        setTransition(undefined)
        onCommandRef.current({ action })
        return
      }
      setTransition({ action, seconds })
      transitionTimer.current = window.setTimeout(tick, 1000)
    }
    transitionTimer.current = window.setTimeout(tick, 1000)
  }, [])
  const reportMetadata = () => {
    const activeItem = itemRef.current
    const metadata = player.current?.getVideoData()
    const title = metadata?.title?.trim()
    if (!activeItem || !title || reportedMetadata.current === activeItem.id) return
    reportedMetadata.current = activeItem.id
    void window.kaioke.session.updateQueueItemMetadata(activeItem.id, title, metadata?.author)
  }
  useEffect(() => {
    const create = () => {
      if (!mount.current || player.current || !window.YT) return
      player.current = new window.YT.Player(mount.current, { width: '100%', height: '390', playerVars: { autoplay: 1, rel: 0 }, events: { onReady: () => setReady(true), onStateChange: (event: { data: number }) => {
        if (event.data === 1) { reportMetadata(); onCommandRef.current({ action: 'play', positionSeconds: player.current?.getCurrentTime() ?? 0 }) }
        if (event.data === 2) onCommandRef.current({ action: 'pause', positionSeconds: player.current?.getCurrentTime() ?? 0 })
        if (event.data === 0) beginTransition('ended')
      }, onError: (event: { data: number }) => { const activeItem = itemRef.current; if ((event.data === 101 || event.data === 150) && activeItem) void window.kaioke.app.openExternal(activeItem.sourceUrl) } } })
    }
    if (window.YT?.Player) create()
    else { const script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api'; script.async = true; document.head.append(script); const timer = window.setInterval(() => { if (window.YT?.Player) { window.clearInterval(timer); create() } }, 100) }
    return () => { if (transitionTimer.current !== undefined) window.clearTimeout(transitionTimer.current); player.current?.destroy(); player.current = undefined }
  }, [beginTransition])
  useEffect(() => {
    if (!voteTransitionEndsAt) {
      setTransition(current => current?.action === 'skip' ? undefined : current)
      return
    }
    const endsAt = new Date(voteTransitionEndsAt).getTime()
    if (Number.isNaN(endsAt)) return
    player.current?.pauseVideo()
    let timer: number | undefined
    const tick = () => {
      const remaining = endsAt - Date.now()
      setTransition({ action: 'skip', seconds: Math.max(1, Math.ceil(remaining / 1000)) })
      if (remaining > 0) timer = window.setTimeout(tick, Math.min(1000, remaining))
    }
    tick()
    return () => { if (timer !== undefined) window.clearTimeout(timer) }
  }, [voteTransitionEndsAt])
  useEffect(() => { if (ready && item && loaded.current !== item.id) { loaded.current = item.id; onCommand({ action: 'loading' }); player.current?.loadVideoById(item.videoId, playback.positionSeconds) } }, [item, playback.positionSeconds, ready, onCommand])
  useEffect(() => { if (playback.status !== 'playing') return; const interval = window.setInterval(() => onCommand({ action: 'seek', positionSeconds: player.current?.getCurrentTime() ?? 0 }), 2000); return () => window.clearInterval(interval) }, [playback.status, onCommand])
  const actions = <><button type="button" disabled={!!transition} onClick={() => { player.current?.playVideo(); onCommand({ action: 'play', positionSeconds: player.current?.getCurrentTime() ?? 0 }) }}>Tocar</button><button type="button" disabled={!!transition} onClick={() => { player.current?.pauseVideo(); onCommand({ action: 'pause', positionSeconds: player.current?.getCurrentTime() ?? 0 }) }}>Pausar</button><button type="button" disabled={!!transition} onClick={() => { const target = Math.max(0, (player.current?.getCurrentTime() ?? playback.positionSeconds) - 10); player.current?.seekTo(target, true); onCommand({ action: 'seek', positionSeconds: target }) }}>−10s</button><button type="button" disabled={!!transition} onClick={() => beginTransition('skip')}>Pular</button></>
  return <section className="host-player" aria-label="Player de karaokê"><div ref={mount} className="host-player__frame" />{transition && <div className="song-transition" role="status" aria-live="assertive"><div className="song-transition__halo" aria-hidden="true" /><div className="song-transition__disc" aria-hidden="true"><span>{transition.seconds}</span></div><div className="song-transition__copy"><strong>{transition.action === 'skip' ? 'Pulando para a próxima' : 'Próxima música'}</strong><span>A fila continua em {transition.seconds} segundo{transition.seconds === 1 ? '' : 's'}</span></div><div className="song-transition__bars" aria-hidden="true"><i /><i /><i /><i /><i /></div></div>}{(presentationControls || onTogglePresentationControls) ? <div className="host-player__controls host-player__controls--floating"><button type="button" className="host-player__control-trigger" aria-label={presentationControls ? "Ocultar controles de reprodução" : "Exibir controles de reprodução"} title="Gerenciar reprodução" onClick={onTogglePresentationControls}><SlidersHorizontal aria-hidden="true" size={20} /></button><div className="host-player__control-actions">{presentationControls && actions}</div></div> : !hideControls && <div className="host-player__controls">{actions}</div>}</section>
}
