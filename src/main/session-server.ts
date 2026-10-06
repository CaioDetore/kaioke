import { createServer, type Server } from 'node:http'
import { networkInterfaces } from 'node:os'
import { randomBytes, randomUUID } from 'node:crypto'
import QRCode from 'qrcode'
import { WebSocket, WebSocketServer } from 'ws'
import type { Participant, PlaybackState, QueueItem, SkipVote } from '../shared/domain'
import { websocketEnvelopeSchema } from '../shared/protocol'
import { canAddQueueItem, canRemoveQueueItem, canReorderQueue, normalizeYouTubeInput, reorderQueuedItem } from '../shared/queue-rules'
import type { QueueRepository } from './queue-repository'

export type HostSessionPhase = 'ready' | 'starting' | 'accepting' | 'stopping' | 'error'

export interface HostSessionState {
  phase: HostSessionPhase
  url?: string
  qrCodeDataUrl?: string
  ip?: string
  port?: number
  participantCount: number
  error?: string
}

type SessionSnapshot = { revision: number; participants: Participant[]; queue: QueueItem[]; playback: PlaybackState; skipVote?: SkipVote }
type VideoMetadata = { title: string; channelName?: string }
type SessionServerOptions = { repository?: QueueRepository; selectIp?: () => string | undefined; resolveVideoMetadata?: (sourceUrl: string) => Promise<VideoMetadata | undefined> }
type PlaybackCommand = { action: 'loading' | 'play' | 'pause' | 'seek' | 'ended' | 'error' | 'skip'; positionSeconds?: number }

const participantPage = `<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Entrar no Kaioke</title><style>body{font:16px system-ui;background:#0b0b12;color:#f4f1ff;margin:0;display:grid;min-height:100vh;place-items:center}main{width:min(100% - 32px,420px);padding:28px;border:1px solid #302d45;border-radius:20px;background:#151521}input,button{box-sizing:border-box;width:100%;padding:13px;margin-top:12px;border-radius:10px;font:inherit}input{border:1px solid #302d45;background:#0b0b12;color:#fff}button{border:0;background:#9566ff;color:#fff;font-weight:700}p{color:#aaa6bc}#status{min-height:24px}</style><main><h1>Kaioke</h1><p>Entre na sessão do host.</p><form><label for="name">Seu nome</label><input id="name" maxlength="48" required autocomplete="name" placeholder="Como quer aparecer?"><button>Entrar</button></form><p id="status" role="status"></p></main><script>const status=document.querySelector('#status'),form=document.querySelector('form'),name=document.querySelector('#name'),token=new URLSearchParams(location.search).get('token'),deviceId=localStorage.kaiokeDeviceId||(localStorage.kaiokeDeviceId=crypto.randomUUID());let socket,attempt=0,ended=false;form.onsubmit=e=>{e.preventDefault();ended=false;attempt=0;connect()};function connect(){if(ended)return;status.textContent=attempt?'Reconectando…':'Conectando…';socket=new WebSocket((location.protocol==='https:'?'wss':'ws')+'://'+location.host);socket.onopen=()=>socket.send(JSON.stringify({version:1,type:'session:join',payload:{token,deviceId,displayName:name.value.trim()}}));socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='session:snapshot'){attempt=0;status.textContent='Conectado. Aguarde a próxima música.'}else if(m.type==='session:ended'){ended=true;status.textContent='A sessão do host foi encerrada.';socket.close()}else if(m.type==='error'){ended=true;status.textContent=m.payload.message;socket.close()}};socket.onclose=()=>{if(!ended){attempt=Math.min(attempt+1,6);const delay=Math.min(1000*2**attempt,15000);status.textContent='Conexão perdida. Tentando novamente…';setTimeout(connect,delay)}};socket.onerror=()=>socket.close()}}</script></html>`

// HTTP on a private LAN is not a secure context in every mobile browser, so
// this fallback deliberately does not depend on crypto.randomUUID().
const participantRecoveryScript = `<script>(()=>{const status=document.querySelector('#status'),form=document.querySelector('form'),name=document.querySelector('#name'),token=new URLSearchParams(location.search).get('token'),deviceId=localStorage.kaiokeDeviceId||(localStorage.kaiokeDeviceId='device-'+Date.now()+'-'+Math.random().toString(36).slice(2));let socket,attempt=0,ended=false;form.onsubmit=e=>{e.preventDefault();if(!token){status.textContent='Link de entrada inválido.';return}ended=false;attempt=0;connect()};function connect(){if(ended)return;status.textContent=attempt?'Reconectando…':'Conectando…';socket=new WebSocket((location.protocol==='https:'?'wss':'ws')+'://'+location.host);socket.onopen=()=>socket.send(JSON.stringify({version:1,type:'session:join',payload:{token,deviceId,displayName:name.value.trim()}}));socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='session:snapshot'){attempt=0;status.textContent='Conectado. Aguarde a próxima música.'}else if(m.type==='session:ended'){ended=true;status.textContent='A sessão do host foi encerrada.';socket.close()}else if(m.type==='error'){ended=true;status.textContent=m.payload.message;socket.close()}};socket.onclose=()=>{if(!ended){attempt=Math.min(attempt+1,6);status.textContent='Conexão perdida. Tentando novamente…';setTimeout(connect,Math.min(1000*2**attempt,15000))}};socket.onerror=()=>socket.close()}})()</script>`
const participantDuplicateGuard = `<script>(()=>{const form=document.querySelector('form'),submit=form.querySelector('button'),existing=form.onsubmit;form.onsubmit=e=>{if(form.dataset.joining==='true'){e.preventDefault();return}form.dataset.joining='true';submit.disabled=true;return existing.call(form,e)}})()</script>`
const participantQueueScript = `<script>(()=>{const name=document.querySelector('#name'),saved=localStorage.kaiokeProfile;try{const profile=JSON.parse(saved);if(profile&&typeof profile.displayName==='string')name.value=profile.displayName}catch{}const id=localStorage.kaiokeDeviceId||(localStorage.kaiokeDeviceId='device-'+Date.now()+'-'+Math.random().toString(36).slice(2));let socketRef,queue=[];const requestId=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);const send=(type,payload)=>socketRef&&socketRef.readyState===1&&socketRef.send(JSON.stringify({version:1,type,payload,requestId:requestId()}));const app=document.createElement('section');app.id='queue';app.hidden=true;app.innerHTML='<h2>Fila</h2><button type="button" id="edit-profile">Editar nome</button><form id="add-song"><label for="video">Link ou ID do YouTube</label><input id="video" required placeholder="https://youtu.be/... ou ID"><button>Adicionar música</button></form><p id="feedback" role="alert"></p><ol id="queue-list"></ol>';document.querySelector('main').append(app);function render(){document.querySelector('#queue-list').innerHTML=queue.map((item,index)=>'<li><strong>'+String(index+1)+'. '+item.videoId+'</strong><br><small>Pedido por '+item.requestedBy+'</small>'+(item.requestedBy===id&&item.status==='queued'?'<button type="button" data-remove="'+item.id+'">Remover</button>':'')+'</li>').join('')}document.querySelector('#add-song').onsubmit=e=>{e.preventDefault();const input=document.querySelector('#video');send('queue.add',{input:input.value});input.value=''};document.querySelector('#queue-list').onclick=e=>{const target=e.target;if(target instanceof HTMLButtonElement)send('queue.remove',{queueItemId:target.dataset.remove})};document.querySelector('#edit-profile').onclick=()=>{const value=prompt('Como quer aparecer?',name.value);if(value===null)return;const displayName=value.trim();if(!displayName||displayName.length>32){document.querySelector('#feedback').textContent='Use um nome entre 1 e 32 caracteres.';return}name.value=displayName;localStorage.kaiokeProfile=JSON.stringify({deviceId:id,displayName});send('profile:update',{displayName})};const dispatch=WebSocket.prototype.dispatchEvent;WebSocket.prototype.dispatchEvent=function(event){if(event.type==='message')try{const message=JSON.parse(event.data);if(message.type==='session:snapshot'){socketRef=this;queue=message.payload.queue||[];localStorage.kaiokeProfile=JSON.stringify({deviceId:id,displayName:name.value.trim()});app.hidden=false;render()}if(message.type==='queue:changed'){queue=message.payload.queue||[];render()}if(message.type==='error')document.querySelector('#feedback').textContent=message.payload.message}catch{}return dispatch.call(this,event)}})()</script>`
const participantSocketBridge = `<script>(()=>{const Native=WebSocket;let socket,queue=[];const id=localStorage.kaiokeDeviceId;const app=document.querySelector('#queue'),join=document.querySelector('main>form'),feedback=document.querySelector('#feedback'),list=document.querySelector('#queue-list'),input=document.querySelector('#video');const requestId=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);const send=(type,payload)=>socket&&socket.readyState===Native.OPEN&&socket.send(JSON.stringify({version:1,type,payload,requestId:requestId()}));function render(){list.textContent='';queue.forEach((item,index)=>{const li=document.createElement('li'),title=document.createElement('strong'),by=document.createElement('small');title.textContent=(index+1)+'. '+item.videoId;by.textContent='Pedido por '+item.requestedBy;li.append(title,document.createElement('br'),by);if(item.requestedBy===id&&item.status==='queued'){const button=document.createElement('button');button.type='button';button.textContent='Remover';button.onclick=()=>send('queue.remove',{queueItemId:item.id});li.append(button)}list.append(li)})}class KaiokeSocket extends Native{constructor(...args){super(...args);socket=this;this.addEventListener('message',event=>{try{const message=JSON.parse(event.data);if(message.type==='session:snapshot'||message.type==='queue:changed'){queue=message.payload.queue||[];app.hidden=false;join.hidden=true;localStorage.kaiokeProfile=JSON.stringify({deviceId:id,displayName:document.querySelector('#name').value.trim()});render()}if(message.type==='error')feedback.textContent=message.payload.message}catch{}})}}window.WebSocket=KaiokeSocket;document.querySelector('#add-song').onsubmit=event=>{event.preventDefault();send('queue.add',{input:input.value});input.value=''};document.querySelector('#edit-profile').onclick=()=>{const value=prompt('Como quer aparecer?',document.querySelector('#name').value);if(value===null)return;const displayName=value.trim();if(!displayName||displayName.length>32){feedback.textContent='Use um nome entre 1 e 32 caracteres.';return}document.querySelector('#name').value=displayName;localStorage.kaiokeProfile=JSON.stringify({deviceId:id,displayName});send('profile:update',{displayName})}})()</script>`
const participantVisibilityRecovery = `<script>(()=>{const Current=window.WebSocket;window.WebSocket=class extends Current{constructor(...args){super(...args);window.__kaiokeSocket=this}};window.addEventListener('visibilitychange',()=>{if(!document.hidden&&window.__kaiokeSocket){try{window.__kaiokeSocket.close()}catch{}}})})()</script>`
const participantProfileCard = `<style>#queue{margin-top:24px}#profile-card{display:flex;align-items:center;gap:12px;padding:12px 14px;margin:16px 0 20px;border:1px solid #302d45;border-radius:14px;background:#1b1a2b}.profile-icon{display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:#30205e;color:#dcd0ff}.profile-name{flex:1;font-weight:700}#edit-profile{width:36px;height:36px;padding:0;margin:0;border:1px solid #4c4770;border-radius:9px;background:transparent;color:#f4f1ff;font-size:18px}#add-song{padding-top:4px;border-top:1px solid #302d45}#add-song button{margin-top:16px}</style><script>(()=>{const queue=document.querySelector('#queue'),button=document.querySelector('#edit-profile'),name=document.querySelector('#name');const card=document.createElement('div'),label=document.createElement('span');card.id='profile-card';card.innerHTML='<span class="profile-icon" aria-hidden="true"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 3.7-6 8-6s7 2 8 6"/></svg></span>';label.className='profile-name';label.textContent=name.value||'Seu perfil';button.textContent='✎';button.setAttribute('aria-label','Editar nome');card.append(label,button);queue.insertBefore(card,document.querySelector('#add-song'));button.addEventListener('click',()=>setTimeout(()=>{label.textContent=name.value||'Seu perfil'},0))})()</script>`
const participantPageWithRecovery = `${participantPage}${participantRecoveryScript}${participantDuplicateGuard}${participantQueueScript}${participantSocketBridge}${participantVisibilityRecovery}${participantProfileCard}`
const participantAppPage = `<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kaioke</title><style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-width:320px;background:#0b0b12;color:#f4f1ff;font:16px system-ui}main{width:min(100% - 32px,520px);margin:24px auto;padding:28px;border:1px solid #302d45;border-radius:22px;background:#151521}h1{margin:0;font-size:2.5rem}h2{margin:24px 0 16px}p{color:#c2bdd3}label{display:block;margin-top:18px;font-weight:700}input,button{width:100%;margin-top:8px;padding:14px;border-radius:12px;font:inherit}input{border:1px solid #302d45;background:#0b0b12;color:#fff}button{border:0;background:#9566ff;color:#fff;font-weight:800;cursor:pointer}button:focus-visible,input:focus-visible{outline:3px solid #56e6ff;outline-offset:2px}#connection{min-height:24px}.profile{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid #302d45;border-radius:14px;background:#1b1a2b}.profile-icon{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:#3b2874}.profile-name{flex:1;font-weight:800}.icon-button{width:40px;height:40px;margin:0;padding:0;background:transparent;border:1px solid #4c4770}.song-form{margin-top:24px;padding-top:4px;border-top:1px solid #302d45}.feedback{min-height:24px;color:#ffb9c7}.queue{margin:20px 0 0;padding:0;list-style:none}.queue li{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 0;border-bottom:1px solid #302d45}.queue strong,.queue small{display:block}.queue small{margin-top:4px;color:#c2bdd3}.remove{width:auto;margin:0;padding:9px 12px;background:#31213a}.empty{color:#c2bdd3}@media(max-width:380px){main{width:calc(100% - 16px);margin:8px auto;padding:20px}}</style><main><section id="join"><h1>Kaioke</h1><p>Entre na sessão do host.</p><form id="join-form"><label for="name">Seu nome</label><input id="name" maxlength="32" required autocomplete="name" placeholder="Como quer aparecer?"><button>Entrar</button></form><p id="connection" role="status"></p></section><section id="app" hidden><p id="app-connection" role="status">Conectando…</p><h2>Fila</h2><div class="profile"><span class="profile-icon" aria-hidden="true">♙</span><span class="profile-name" id="profile-name"></span><button class="icon-button" id="edit-profile" type="button" aria-label="Editar nome">✎</button></div><form class="song-form" id="song-form"><label for="video">Link ou ID do YouTube</label><input id="video" required placeholder="https://youtu.be/... ou ID"><button>Adicionar música</button></form><p class="feedback" id="feedback" role="alert"></p><ol class="queue" id="queue-list"></ol></section></main><script>(()=>{const join=document.querySelector('#join'),app=document.querySelector('#app'),name=document.querySelector('#name'),connection=document.querySelector('#connection'),appConnection=document.querySelector('#app-connection'),feedback=document.querySelector('#feedback'),list=document.querySelector('#queue-list'),profileName=document.querySelector('#profile-name'),profileKey='kaiokeProfile',idKey='kaiokeDeviceId';let profile;try{profile=JSON.parse(localStorage.getItem(profileKey)||'null')}catch{}const deviceId=localStorage.getItem(idKey)||('device-'+Date.now()+'-'+Math.random().toString(36).slice(2));localStorage.setItem(idKey,deviceId);if(profile&&profile.displayName)name.value=profile.displayName;let socket,queue=[],participants=[],attempt=0,ended=false;const requestId=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);const saveProfile=()=>{localStorage.setItem(profileKey,JSON.stringify({deviceId,displayName:name.value.trim()}));profileName.textContent=name.value.trim()};const send=(type,payload)=>{if(socket&&socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({version:1,type,payload,requestId:requestId()}))};function render(){const names=new Map(participants.map(person=>[person.deviceId,person.displayName]));list.textContent='';if(!queue.length){const empty=document.createElement('li');empty.className='empty';empty.textContent='Nenhuma música na fila ainda.';list.append(empty);return}queue.forEach((item,index)=>{const row=document.createElement('li'),info=document.createElement('div'),title=document.createElement('strong'),author=document.createElement('small');title.textContent=(index+1)+'. '+item.videoId;author.textContent='Pedido por '+(item.requestedByName||names.get(item.requestedBy)||'Participante');info.append(title,author);row.append(info);if(item.requestedBy===deviceId&&item.status==='queued'){const remove=document.createElement('button');remove.type='button';remove.className='remove';remove.textContent='Remover';remove.onclick=()=>send('queue.remove',{queueItemId:item.id});row.append(remove)}list.append(row)})}function connect(){if(ended)return;connection.textContent=attempt?'Reconectando…':'Conectando…';appConnection.textContent=connection.textContent;socket=new WebSocket((location.protocol==='https:'?'wss':'ws')+'://'+location.host);socket.onopen=()=>send('session:join',{token:new URLSearchParams(location.search).get('token'),deviceId,displayName:name.value.trim()});socket.onmessage=event=>{let message;try{message=JSON.parse(event.data)}catch{return}if(message.type==='session:snapshot'){attempt=0;queue=message.payload.queue||[];participants=message.payload.participants||[];saveProfile();join.hidden=true;app.hidden=false;connection.textContent='Conectado';appConnection.textContent='Conectado';render()}else if(message.type==='participant:changed'){participants=message.payload.participants||participants;render()}else if(message.type==='queue:changed'){queue=message.payload.queue||[];render()}else if(message.type==='error'){feedback.textContent=message.payload.message||'Não foi possível concluir a ação.'}else if(message.type==='session:ended'){ended=true;appConnection.textContent='A sessão do host foi encerrada.';socket.close()}};socket.onclose=()=>{if(!ended){attempt=Math.min(attempt+1,6);appConnection.textContent='Conexão perdida. Tentando novamente…';setTimeout(connect,Math.min(1000*2**attempt,15000))}};socket.onerror=()=>socket.close()}document.querySelector('#join-form').onsubmit=event=>{event.preventDefault();const value=name.value.trim();if(!value||value.length>32){connection.textContent='Use um nome entre 1 e 32 caracteres.';return}ended=false;attempt=0;connect()};document.querySelector('#song-form').onsubmit=event=>{event.preventDefault();const video=document.querySelector('#video');send('queue.add',{input:video.value});video.value=''};document.querySelector('#edit-profile').onclick=()=>{const value=prompt('Como quer aparecer?',name.value);if(value===null)return;name.value=value.trim();if(!name.value||name.value.length>32){feedback.textContent='Use um nome entre 1 e 32 caracteres.';return}saveProfile();send('profile:update',{displayName:name.value})};document.addEventListener('visibilitychange',()=>{if(!document.hidden&&socket&&socket.readyState===WebSocket.OPEN)socket.close()})})()</script></html>`
const participantPlaybackScript = `<script>(()=>{let socket,wrapped=false,playback={status:'idle',positionSeconds:0},vote;const app=document.querySelector('#app'),card=document.createElement('section');card.id='playback';card.hidden=true;card.innerHTML='<h2>Tocando agora</h2><strong id="now-playing">Aguardando música</strong><p id="playback-status"></p><button type="button" id="toggle-playback" hidden>Reproduzir</button><button type="button" id="skip-vote" hidden>Votar para pular</button><p id="vote-status"></p>';app.insertBefore(card,app.querySelector('h2'));const send=(type,payload)=>socket&&socket.readyState===1&&socket.send(JSON.stringify({version:1,type,payload,requestId:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)}));const render=message=>{const payload=message.payload||{};if(message.type==='session:snapshot'){playback=payload.playback||playback;vote=payload.skipVote;render({type:'playback:changed',payload})}if(message.type==='playback:changed'){playback=payload.playback||playback;const item=(payload.queue||[]).find(x=>x.id===playback.queueItemId);card.hidden=false;document.querySelector('#now-playing').textContent=item?(item.title||item.videoId):'Aguardando música';document.querySelector('#playback-status').textContent=playback.status==='playing'?'Em reprodução':playback.status==='paused'?'Pausada':'Preparando…'}if(message.type==='skip:changed'){vote=payload.skipVote;document.querySelector('#vote-status').textContent=vote?'Votos para pular: '+vote.voterDeviceIds.length+'/'+vote.threshold:''}};const nativeSend=WebSocket.prototype.send;WebSocket.prototype.send=function(...args){socket=this;return nativeSend.apply(this,args)};setInterval(()=>{if(!socket||wrapped||!socket.onmessage)return;wrapped=true;const original=socket.onmessage;socket.onmessage=function(event){original.call(this,event);try{render(JSON.parse(event.data))}catch{}};document.querySelector('#skip-vote').hidden=false;document.querySelector('#skip-vote').onclick=()=>send('skip:vote',{});document.querySelector('#toggle-playback').onclick=()=>send('playback:command',{action:playback.status==='playing'?'pause':'play'});},200);})()</script>`
const participantAppPageWithTitles = participantAppPage
  .replace("title.textContent=(index+1)+'. '+item.videoId", "title.textContent=(index+1)+'. '+(item.title||item.videoId)")
  .replace("queue.forEach((item,index)=>{", "queue.filter(item=>item.status==='queued'||item.status==='playing').forEach((item,index)=>{")
  .replace("socket.onmessage=event=>{", "socket.onmessage=event=>{document.dispatchEvent(new CustomEvent('kaioke:message',{detail:event.data}));")
  .replace("socket=new WebSocket((location.protocol", "socket=window.__kaiokeParticipantSocket=new WebSocket((location.protocol")
  // Returning to a browser tab used to deliberately close the socket, which
  // made the host's collaborator list flicker or drop a participant.
  .replace("document.addEventListener('visibilitychange',()=>{if(!document.hidden&&socket&&socket.readyState===WebSocket.OPEN)socket.close()})", '') + participantPlaybackScript
const participantAuthorControlScript = `<script>(()=>{let socket,wrapped=false,playback={status:'idle'};const button=document.querySelector('#toggle-playback');const nativeSend=WebSocket.prototype.send;WebSocket.prototype.send=function(...args){socket=this;return nativeSend.apply(this,args)};setInterval(()=>{if(!socket||wrapped||!socket.onmessage)return;wrapped=true;const original=socket.onmessage;socket.onmessage=function(event){try{const message=JSON.parse(event.data),payload=message.payload||{};if(message.type==='session:snapshot'){playback=payload.playback||playback;const current=(payload.queue||[]).find(item=>item.id===playback.queueItemId);button.hidden=!(current&&current.requestedBy===localStorage.kaiokeDeviceId)}if(message.type==='playback:changed')playback=payload.playback||playback}catch{}original.call(this,event)};button.onclick=()=>socket.send(JSON.stringify({version:1,type:'playback:command',payload:{action:playback.status==='playing'?'pause':'play'},requestId:Date.now().toString(36)}))},100)})()</script>`
const participantConnectingScript = `<script>(()=>{const app=document.querySelector('#app'),form=document.querySelector('#song-form'),button=form.querySelector('button');const update=()=>{const connected=!app.hidden;button.disabled=!connected;button.setAttribute('aria-disabled',String(!connected));button.title=connected?'':'Aguarde a conexão com a sessão'};new MutationObserver(update).observe(app,{attributes:true,attributeFilter:['hidden']});update()})()</script>`
const participantExperienceScript = `<style>body{min-height:100vh;background:radial-gradient(circle at 8% 0,#38276a 0,transparent 28%),radial-gradient(circle at 95% 16%,#073f4c 0,transparent 27%),#0b0b12}main{box-shadow:0 20px 60px #0008}.participant-brand{display:flex;align-items:center;gap:10px;margin-bottom:22px;color:#fff;font-weight:900;font-size:1.18rem;letter-spacing:.02em}.participant-brand i{width:13px;height:13px;border:3px solid #59e8ff;border-radius:50%;box-shadow:0 0 14px #59e8ff}.participant-brand small{margin-left:auto;color:#8ef0ba;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase}.connection-pill{display:inline-flex;align-items:center;gap:7px;margin:0 0 18px;color:#8ef0ba;font-size:.78rem;font-weight:800}.connection-pill::before{width:7px;height:7px;border-radius:50%;content:'';background:currentColor;box-shadow:0 0 8px currentColor}#playback{position:relative;overflow:hidden;margin:0 0 22px;padding:17px;border:1px solid #53457b;border-radius:18px;background:linear-gradient(135deg,#2c1e50,#161627 62%,#0d2930)}#playback::after{position:absolute;right:-28px;bottom:-42px;width:130px;height:130px;border:1px solid #62eaff66;border-radius:50%;content:'';box-shadow:0 0 0 14px #62eaff12,0 0 0 28px #62eaff0a}.playback-kicker{position:relative;z-index:1;display:block;margin-bottom:8px;color:#9cf0ff;font-size:.7rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.now-playing{position:relative;z-index:1;display:block;overflow:hidden;font-size:1.18rem;line-height:1.25;text-overflow:ellipsis;white-space:nowrap}.playback-status{position:relative;z-index:1;margin:7px 0 13px;color:#d0c9e7;font-size:.88rem}.playback-actions{position:relative;z-index:1;display:flex;gap:8px}.playback-actions button{width:auto;margin:0;padding:9px 12px;background:#ffffff16;border:1px solid #ffffff2e}.playback-actions #skip-vote{background:#ff67d733;border-color:#ff9ae633}.song-form{margin-top:20px}.queue{margin-top:14px}.queue li:first-child{border-top:1px solid #302d45}.queue li strong{font-size:.96rem}.feedback:not(:empty){padding:10px 12px;border-radius:10px;background:#5d1d36}</style><script>(()=>{const app=document.querySelector('#app'),connection=document.querySelector('#app-connection'),card=document.querySelector('#playback');let queue=[],playback={status:'idle'},vote;const send=(type,payload)=>{const socket=window.__kaiokeParticipantSocket;if(socket&&socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({version:1,type,payload,requestId:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)}))};const render=()=>{if(!card)return;const item=queue.find(entry=>entry.id===playback.queueItemId),status={playing:'Em reprodução',paused:'Pausada',loading:'Preparando a faixa…',idle:'Aguardando a próxima música'}[playback.status]||'Aguardando';card.hidden=false;card.innerHTML='<span class="playback-kicker">Tocando agora</span><strong class="now-playing">'+(item?(item.title||item.videoId):'Aguardando a próxima música')+'</strong><p class="playback-status">'+status+'</p><div class="playback-actions"><button type="button" id="toggle-playback" hidden>Reproduzir</button><button type="button" id="skip-vote">'+(vote?'Votos para pular: '+vote.voterDeviceIds.length+'/'+vote.threshold:'Votar para pular')+'</button></div>'};const brand=document.createElement('div');brand.className='participant-brand';brand.innerHTML='<i></i> Kaioke <small>Sua sessão</small>';app.insertBefore(brand,connection);connection.className='connection-pill';document.addEventListener('click',event=>{const target=event.target;if(!(target instanceof HTMLButtonElement)||(target.id!=='skip-vote'&&target.id!=='toggle-playback'))return;event.stopImmediatePropagation();if(target.id==='skip-vote')send('skip:vote',{});else send('playback:command',{action:playback.status==='playing'?'pause':'play'})},true);document.addEventListener('kaioke:message',event=>{try{const message=JSON.parse(event.detail),payload=message.payload||{};if(message.type==='session:snapshot'){queue=payload.queue||queue;playback=payload.playback||playback;vote=payload.skipVote}else if(message.type==='queue:changed'){queue=payload.queue||queue}else if(message.type==='playback:changed'){playback=payload.playback||playback}else if(message.type==='skip:changed'){vote=payload.skipVote}render()}catch{}})})()</script>`
const participantPageForSpec004 = participantAppPageWithTitles + participantAuthorControlScript + participantConnectingScript + participantExperienceScript

export class SessionServer {
  private httpServer?: Server
  private webSocketServer?: WebSocketServer
  private readonly clients = new Map<WebSocket, Participant>()
  private readonly clientsByDevice = new Map<string, WebSocket>()
  private readonly listeners = new Set<(state: HostSessionState) => void>()
  private state: HostSessionState = { phase: 'ready', participantCount: 0 }
  private token = ''
  private revision = 0
  private queue: QueueItem[] = []
  private playback: PlaybackState = { status: 'idle', positionSeconds: 0, updatedAt: new Date().toISOString() }
  private skipVote?: SkipVote
  private readonly handledRequests = new Map<string, Set<string>>()

  constructor(private readonly options: SessionServerOptions = {}) {}

  getState(): HostSessionState { return this.state }
  getSnapshot(): SessionSnapshot { return this.snapshot() }
  async playbackCommandAsHost(command: PlaybackCommand): Promise<SessionSnapshot> {
    await this.applyPlaybackCommand(command, 'host', true)
    return this.snapshot()
  }
  async removeQueueItemAsHost(queueItemId: string): Promise<SessionSnapshot> {
    const reason = canRemoveQueueItem(this.queue, 'host', queueItemId, true)
    if (reason) throw new Error(queueErrorMessage(reason))
    this.queue = this.queue.filter(item => item.id !== queueItemId)
    await this.saveAndPublishQueue()
    return this.snapshot()
  }
  async reorderQueueAsHost(queueItemId: string, targetIndex: number): Promise<SessionSnapshot> {
    const item = this.queue.find(entry => entry.id === queueItemId)
    if (!item) throw new Error(queueErrorMessage('ITEM_NOT_FOUND'))
    if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= this.queue.length) throw new Error(queueErrorMessage('INVALID_REORDER'))
    const next = [...this.queue]; next.splice(next.indexOf(item), 1); next.splice(targetIndex, 0, item); this.queue = next
    await this.saveAndPublishQueue()
    return this.snapshot()
  }
  onState(listener: (state: HostSessionState) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener) }

  async start(): Promise<HostSessionState> {
    if (this.state.phase === 'accepting' || this.state.phase === 'starting') return this.state
    this.setState({ phase: 'starting', participantCount: 0 })
    try {
      const ip = (this.options.selectIp ?? selectPrivateIpv4)()
      if (!ip) throw new Error('Nenhum IPv4 privado foi encontrado. Conecte-se à rede Wi‑Fi e tente novamente.')
      this.queue = await this.options.repository?.loadQueue() ?? []
      this.playback = { status: 'idle', positionSeconds: 0, updatedAt: new Date().toISOString() }
      this.skipVote = undefined
      this.token = randomBytes(24).toString('base64url')
      this.httpServer = createServer((request, response) => {
        if (request.url?.startsWith('/join')) { response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); response.end(participantPageForSpec004); return }
        response.writeHead(302, { location: '/join' }); response.end()
      })
      this.webSocketServer = new WebSocketServer({ noServer: true })
      this.httpServer.on('upgrade', (request, socket, head) => this.webSocketServer?.handleUpgrade(request, socket, head, client => this.attachClient(client)))
      const port = await listen(this.httpServer)
      const url = `http://${ip}:${port}/join?token=${this.token}`
      this.setState({ phase: 'accepting', ip, port, url, qrCodeDataUrl: await QRCode.toDataURL(url, { margin: 1, width: 280 }), participantCount: 0 })
      await this.startNextIfIdle()
    } catch (cause) {
      await this.closeServers()
      this.setState({ phase: 'error', participantCount: 0, error: networkErrorMessage(cause) })
    }
    return this.state
  }

  async stop(): Promise<HostSessionState> {
    if (this.state.phase === 'ready') return this.state
    this.setState({ ...this.state, phase: 'stopping' })
    this.broadcast('session:ended', { message: 'A sessão do host foi encerrada.' })
    await this.options.repository?.saveQueue(this.queue)
    await this.closeServers()
    this.clients.clear(); this.token = ''
    this.setState({ phase: 'ready', participantCount: 0 })
    return this.state
  }

  private attachClient(client: WebSocket): void {
    client.once('message', raw => {
      const parsed = websocketEnvelopeSchema.safeParse(parseJson(raw.toString()))
      const payload = parsed.success && parsed.data.type === 'session:join' ? parsed.data.payload : undefined
      if (!payload || !isJoinPayload(payload) || payload.token !== this.token || this.state.phase !== 'accepting') { this.send(client, 'error', { message: 'Entrada não autorizada.' }); client.close(1008, 'Unauthorized'); return }
      const participant: Participant = { deviceId: payload.deviceId, displayName: payload.displayName.trim(), connectedAt: new Date().toISOString(), isHost: false }
      const previousClient = this.clientsByDevice.get(participant.deviceId)
      if (previousClient && previousClient !== client) {
        this.clients.delete(previousClient)
        previousClient.close(4001, 'Reconnected from another connection')
      }
      this.clients.set(client, participant); this.clientsByDevice.set(participant.deviceId, client); this.send(client, 'session:snapshot', this.snapshot())
      this.participantsChanged()
      client.on('message', raw => this.handleClientMessage(client, raw.toString()))
      client.on('close', () => this.detachClient(client))
    })
  }

  private detachClient(client: WebSocket): void {
    const participant = this.clients.get(client)
    if (!this.clients.delete(client)) return
    if (participant && this.clientsByDevice.get(participant.deviceId) === client) this.clientsByDevice.delete(participant.deviceId)
    this.participantsChanged()
  }
  private handleClientMessage(client: WebSocket, raw: string): void {
    const participant = this.clients.get(client)
    const parsed = websocketEnvelopeSchema.safeParse(parseJson(raw))
    if (!participant || !parsed.success) return
    const { type, payload, requestId } = parsed.data
    if (!['profile:update', 'queue.add', 'queue.remove', 'queue.reorder', 'playback:command', 'skip:vote'].includes(type)) return
    if (!requestId) { this.send(client, 'error', { code: 'INVALID_REQUEST', message: 'Pedido sem identificador.' }); return }
    const handled = this.handledRequests.get(participant.deviceId) ?? new Set<string>()
    if (handled.has(requestId)) return
    handled.add(requestId); this.handledRequests.set(participant.deviceId, handled)
    if (type === 'profile:update') {
      const displayName = objectString(payload, 'displayName')?.trim()
      if (!displayName || displayName.length > 32) { this.error(client, 'INVALID_PROFILE', 'Use um nome entre 1 e 32 caracteres.'); return }
      participant.displayName = displayName
      this.queue = this.queue.map(item => item.requestedBy === participant.deviceId ? { ...item, requestedByName: displayName } : item)
      void this.saveAndPublishQueue(); this.participantsChanged(); return
    }
    if (type === 'queue.add') {
      const normalized = normalizeYouTubeInput(objectString(payload, 'input') ?? '')
      if ('error' in normalized) { this.error(client, normalized.error, 'Informe um link ou ID do YouTube válido.'); return }
      const reason = canAddQueueItem(this.queue, participant.deviceId, normalized.videoId)
      if (reason) { this.error(client, reason, queueErrorMessage(reason)); return }
      const item = { id: randomUUID(), ...normalized, requestedBy: participant.deviceId, requestedByName: participant.displayName, createdAt: new Date().toISOString(), status: 'queued' as const }
      this.queue.push(item)
      void this.saveAndPublishQueue().then(() => this.startNextIfIdle())
      void this.enrichQueueItem(item.id, item.sourceUrl)
      return
    }
    if (type === 'playback:command') {
      const command = parsePlaybackCommand(payload)
      if (!command) { this.error(client, 'INVALID_COMMAND', 'Comando de reprodução inválido.'); return }
      void this.applyPlaybackCommand(command, participant.deviceId, false)
      return
    }
    if (type === 'skip:vote') { this.castSkipVote(participant.deviceId); return }
    if (type === 'queue.remove') {
      const itemId = objectString(payload, 'queueItemId') ?? ''
      const reason = canRemoveQueueItem(this.queue, participant.deviceId, itemId)
      if (reason) { this.error(client, reason, queueErrorMessage(reason)); return }
      this.queue = this.queue.filter(item => item.id !== itemId); void this.saveAndPublishQueue()
    }
    if (type === 'queue.reorder') this.error(client, 'NOT_AUTHORIZED', 'Somente o host pode reordenar a fila.')
  }
  private async saveAndPublishQueue(): Promise<void> { await this.options.repository?.saveQueue(this.queue); this.revision += 1; this.broadcast('queue:changed', { revision: this.revision, queue: this.queue }) }
  private async startNextIfIdle(): Promise<void> {
    if (this.playback.queueItemId || this.playback.status !== 'idle') return
    const next = this.queue.find(item => item.status === 'queued')
    if (!next) return
    next.status = 'playing'
    await this.saveAndPublishQueue()
    this.playback = { queueItemId: next.id, status: 'loading', positionSeconds: 0, updatedAt: new Date().toISOString() }
    this.skipVote = undefined
    this.publishPlayback()
  }
  private async applyPlaybackCommand(command: PlaybackCommand, actorDeviceId: string, isHost: boolean): Promise<void> {
    const active = this.queue.find(item => item.id === this.playback.queueItemId)
    const authorCanControl = !!active && active.requestedBy === actorDeviceId && (command.action === 'play' || command.action === 'pause')
    if (!isHost && !authorCanControl) {
      const client = this.clientsByDevice.get(actorDeviceId)
      if (client) this.error(client, 'NOT_AUTHORIZED', 'Você não pode controlar esta reprodução.')
      return
    }
    if (command.action === 'ended' || command.action === 'error' || command.action === 'skip') {
      if (active) active.status = command.action === 'ended' ? 'played' : command.action === 'error' ? 'failed' : 'skipped'
      this.playback = { status: 'idle', positionSeconds: 0, updatedAt: new Date().toISOString() }
      this.skipVote = undefined
      await this.saveAndPublishQueue(); this.publishPlayback(); await this.startNextIfIdle(); return
    }
    if (!active) return
    const positionSeconds = command.positionSeconds ?? this.playback.positionSeconds
    this.playback = { ...this.playback, status: command.action === 'play' ? 'playing' : command.action === 'pause' ? 'paused' : command.action === 'loading' ? 'loading' : this.playback.status, positionSeconds, updatedAt: new Date().toISOString() }
    this.publishPlayback()
  }
  private castSkipVote(deviceId: string): void {
    const activeId = this.playback.queueItemId
    if (!activeId) return
    const threshold = this.skipThreshold()
    const vote = this.skipVote?.queueItemId === activeId ? this.skipVote : { queueItemId: activeId, voterDeviceIds: [], threshold }
    if (!vote.voterDeviceIds.includes(deviceId)) vote.voterDeviceIds.push(deviceId)
    vote.threshold = threshold; this.skipVote = vote
    if (threshold > 0 && vote.voterDeviceIds.length >= threshold) { void this.applyPlaybackCommand({ action: 'skip' }, 'host', true); return }
    this.publishSkipVote()
  }
  private skipThreshold(): number { return Math.ceil(this.clients.size * 0.6) }
  private publishPlayback(): void { this.revision += 1; this.broadcast('playback:changed', { revision: this.revision, playback: this.playback }); this.publishSkipVote(false) }
  private publishSkipVote(increment = true): void { if (increment) this.revision += 1; if (this.skipVote) this.skipVote.threshold = this.skipThreshold(); this.broadcast('skip:changed', { revision: this.revision, skipVote: this.skipVote }) }
  private async enrichQueueItem(itemId: string, sourceUrl: string): Promise<void> {
    const metadata = await (this.options.resolveVideoMetadata ?? resolveYouTubeMetadata)(sourceUrl)
    if (!metadata) return
    const item = this.queue.find(entry => entry.id === itemId)
    if (!item) return
    item.title = metadata.title; item.channelName = metadata.channelName
    await this.saveAndPublishQueue()
  }
  private error(client: WebSocket, code: string, message: string): void { this.send(client, 'error', { code, message }) }
  private participantsChanged(): void { this.revision += 1; this.broadcast('participant:changed', { revision: this.revision, participants: [...this.clients.values()] }); if (this.skipVote) this.publishSkipVote(false); this.setState({ ...this.state, participantCount: this.clients.size }) }
  private snapshot(): SessionSnapshot { return { revision: this.revision, participants: [...this.clients.values()], queue: this.queue, playback: this.playback, skipVote: this.skipVote } }
  private broadcast(type: string, payload: unknown): void { for (const client of this.clients.keys()) this.send(client, type, payload) }
  private send(client: WebSocket, type: string, payload: unknown): void { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ version: 1, type, payload })) }
  private setState(state: HostSessionState): void { this.state = state; this.listeners.forEach(listener => listener(state)) }
  private async closeServers(): Promise<void> { for (const client of this.clients.keys()) client.close(); await Promise.all([close(this.webSocketServer), close(this.httpServer)]); this.clientsByDevice.clear(); this.webSocketServer = undefined; this.httpServer = undefined }
}

function selectPrivateIpv4(): string | undefined { for (const addresses of Object.values(networkInterfaces())) for (const address of addresses ?? []) { if (address.family !== 'IPv4' || address.internal) continue; const [first, second] = address.address.split('.').map(Number); if (first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168)) return address.address } }
function parseJson(raw: string): unknown { try { return JSON.parse(raw) } catch { return undefined } }
function objectString(value: unknown, key: string): string | undefined { return value && typeof value === 'object' && typeof (value as Record<string, unknown>)[key] === 'string' ? (value as Record<string, string>)[key] : undefined }
function parsePlaybackCommand(value: unknown): PlaybackCommand | undefined {
  if (!value || typeof value !== 'object') return undefined
  const item = value as Record<string, unknown>
  const action = item.action
  if (!['loading', 'play', 'pause', 'seek', 'ended', 'error', 'skip'].includes(String(action))) return undefined
  const positionSeconds = item.positionSeconds
  if (positionSeconds !== undefined && (typeof positionSeconds !== 'number' || !Number.isFinite(positionSeconds) || positionSeconds < 0)) return undefined
  return { action: action as PlaybackCommand['action'], positionSeconds: positionSeconds as number | undefined }
}
function queueErrorMessage(code: string): string { return ({ DUPLICATE_VIDEO: 'Esta música já está na fila.', QUEUE_LIMIT: 'Você pode ter no máximo três músicas na fila.', NOT_AUTHORIZED: 'Você não pode alterar este pedido.', ITEM_NOT_FOUND: 'Pedido não encontrado.', ITEM_NOT_QUEUED: 'Somente pedidos pendentes podem ser alterados.' } as Record<string, string>)[code] ?? 'Não foi possível alterar a fila.' }
function isJoinPayload(value: unknown): value is { token: string; deviceId: string; displayName: string } { if (!value || typeof value !== 'object') return false; const item = value as Record<string, unknown>; return typeof item.token === 'string' && typeof item.deviceId === 'string' && item.deviceId.length > 0 && typeof item.displayName === 'string' && item.displayName.trim().length > 0 && item.displayName.trim().length <= 32 }
function listen(server: Server): Promise<number> { return new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '0.0.0.0', () => { server.off('error', reject); resolve((server.address() as { port: number }).port) }) }) }
function close(server: { close(callback: (error?: Error) => void): void } | undefined): Promise<void> { return new Promise(resolve => server ? server.close(() => resolve()) : resolve()) }
function networkErrorMessage(cause: unknown): string { const code = typeof cause === 'object' && cause && 'code' in cause ? String(cause.code) : ''; if (code === 'EADDRINUSE') return 'A porta escolhida já está em uso. Tente iniciar a sessão novamente.'; if (code === 'EACCES') return 'O Windows bloqueou a abertura da porta. Verifique o firewall e tente novamente.'; return cause instanceof Error ? cause.message : 'Não foi possível iniciar o servidor local.' }
async function resolveYouTubeMetadata(sourceUrl: string): Promise<VideoMetadata | undefined> { try { const endpoint = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(sourceUrl)}`; const response = await fetch(endpoint, { signal: AbortSignal.timeout(5000) }); if (!response.ok) return undefined; const value: unknown = await response.json(); if (!value || typeof value !== 'object') return undefined; const data = value as Record<string, unknown>; return typeof data.title === 'string' && data.title.trim() ? { title: data.title.trim(), channelName: typeof data.author_name === 'string' ? data.author_name.trim() || undefined : undefined } : undefined } catch { return undefined } }
