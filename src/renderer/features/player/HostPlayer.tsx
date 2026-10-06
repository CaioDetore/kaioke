import { SlidersHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { PlaybackState, QueueItem } from '../../../shared/domain'

type Player = { loadVideoById: (videoId: string, startSeconds?: number) => void; playVideo: () => void; pauseVideo: () => void; seekTo: (seconds: number, allowSeekAhead: boolean) => void; getCurrentTime: () => number; destroy: () => void }
type Command = { action: 'loading' | 'play' | 'pause' | 'seek' | 'ended' | 'error' | 'skip'; positionSeconds?: number }
type Props = { item?: QueueItem; playback: PlaybackState; hideControls?: boolean; presentationControls?: boolean; onTogglePresentationControls?: () => void; onCommand: (command: Command) => void }

declare global { interface Window { YT?: { Player: new (element: HTMLElement, options: Record<string, unknown>) => Player; PlayerState: { PLAYING: number; PAUSED: number; ENDED: number } } } }

export function HostPlayer({ item, playback, hideControls = false, presentationControls = false, onTogglePresentationControls, onCommand }: Props) {
  const mount = useRef<HTMLDivElement>(null); const player = useRef<Player | undefined>(undefined); const loaded = useRef<string | undefined>(undefined); const [ready, setReady] = useState(false)
  useEffect(() => {
    const create = () => {
      if (!mount.current || player.current || !window.YT) return
      player.current = new window.YT.Player(mount.current, { width: '100%', height: '390', playerVars: { autoplay: 1, rel: 0 }, events: { onReady: () => setReady(true), onStateChange: (event: { data: number }) => {
        if (event.data === 1) onCommand({ action: 'play', positionSeconds: player.current?.getCurrentTime() ?? 0 })
        if (event.data === 2) onCommand({ action: 'pause', positionSeconds: player.current?.getCurrentTime() ?? 0 })
        if (event.data === 0) onCommand({ action: 'ended' })
      }, onError: () => onCommand({ action: 'error' }) } })
    }
    if (window.YT?.Player) create()
    else { const script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api'; script.async = true; document.head.append(script); const timer = window.setInterval(() => { if (window.YT?.Player) { window.clearInterval(timer); create() } }, 100) }
    return () => { player.current?.destroy(); player.current = undefined }
  }, [])
  useEffect(() => { if (ready && item && loaded.current !== item.id) { loaded.current = item.id; onCommand({ action: 'loading' }); player.current?.loadVideoById(item.videoId, playback.positionSeconds) } }, [item, playback.positionSeconds, ready, onCommand])
  useEffect(() => { if (playback.status !== 'playing') return; const interval = window.setInterval(() => onCommand({ action: 'seek', positionSeconds: player.current?.getCurrentTime() ?? 0 }), 2000); return () => window.clearInterval(interval) }, [playback.status, onCommand])
  const actions = <><button type="button" onClick={() => { player.current?.playVideo(); onCommand({ action: 'play', positionSeconds: player.current?.getCurrentTime() ?? 0 }) }}>Tocar</button><button type="button" onClick={() => { player.current?.pauseVideo(); onCommand({ action: 'pause', positionSeconds: player.current?.getCurrentTime() ?? 0 }) }}>Pausar</button><button type="button" onClick={() => { const target = Math.max(0, (player.current?.getCurrentTime() ?? playback.positionSeconds) - 10); player.current?.seekTo(target, true); onCommand({ action: 'seek', positionSeconds: target }) }}>−10s</button><button type="button" onClick={() => onCommand({ action: 'skip' })}>Pular</button></>
  return <section className="host-player" aria-label="Player de karaokê"><div ref={mount} className="host-player__frame" />{(presentationControls || onTogglePresentationControls) ? <div className="host-player__controls host-player__controls--floating"><button type="button" className="host-player__control-trigger" aria-label={presentationControls ? "Ocultar controles de reprodução" : "Exibir controles de reprodução"} title="Gerenciar reprodução" onClick={onTogglePresentationControls}><SlidersHorizontal aria-hidden="true" size={20} /></button><div className="host-player__control-actions">{presentationControls && actions}</div></div> : !hideControls && <div className="host-player__controls">{actions}</div>}</section>
}
