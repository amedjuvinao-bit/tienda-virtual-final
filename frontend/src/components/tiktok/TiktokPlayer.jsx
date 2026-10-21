import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, ArrowUpRight } from 'lucide-react';
const ORIGIN = 'https://www.tiktok.com';
const clock = seconds => `${Math.floor((Number(seconds)||0)/60)}:${String(Math.floor((Number(seconds)||0)%60)).padStart(2,'0')}`;
export default function TiktokPlayer({ post, settings:s, requestPlay = false }) {
  const host = useRef(null), iframe = useRef(null), video = useRef(null);
  const [started,setStarted] = useState(requestPlay), [ready,setReady] = useState(false), [playing,setPlaying] = useState(false);
  const [muted,setMuted] = useState(s.stageMuted), [time,setTime] = useState(0), [duration,setDuration] = useState(Number(post.duration)||0), [error,setError] = useState('');
  const mutedRef=useRef(muted);mutedRef.current=muted;
  const isDirect = Boolean(post.videoUrl), playable = isDirect || Boolean(post.tiktokId);
  const message = (type,value) => iframe.current?.contentWindow?.postMessage({ 'x-tiktok-player':true,type,value },ORIGIN);
  const chapterVisible=()=>host.current?.closest('[data-story-chapter]')?.dataset.storyVisible!=='false' || document.fullscreenElement?.contains(host.current);
  const fail = () => { setPlaying(false); setError('No se pudo reproducir este video aquí.'); };
  const play = () => {
    if (!playable) return;
    if (!started) { setStarted(true); return; }
    if (isDirect) { if (playing) video.current?.pause(); else video.current?.play()?.catch(fail); }
    else message(playing ? 'pause' : 'play');
  };
  useEffect(() => {
    const receive = event => {
      if (event.origin !== ORIGIN || event.source !== iframe.current?.contentWindow || event.data?.['x-tiktok-player'] !== true) return;
      const {type,value} = event.data;
      if (type === 'onPlayerReady') { setReady(true); message(mutedRef.current ? 'mute' : 'unMute'); message(chapterVisible()?'play':'pause'); }
      if (type === 'onStateChange') { if(value===1 && !chapterVisible()){message('pause');setPlaying(false);return;}setPlaying(value === 1); if(value === 1)setReady(true); }
      if (type === 'onCurrentTime' && Number.isFinite(value?.currentTime) && Number.isFinite(value?.duration)) { setTime(value.currentTime); setDuration(value.duration); }
      if (type === 'onMute' && typeof value === 'boolean') setMuted(value);
      if (type === 'onPlayerError' || type === 'onError') fail();
    };
    window.addEventListener('message',receive);
    return () => window.removeEventListener('message',receive);
  },[s.stageMuted]);
  useEffect(()=>{setMuted(s.stageMuted);},[s.stageMuted]);
  useEffect(() => { if(!started || ready || isDirect)return; const timer=setTimeout(()=>setError('TikTok tarda en responder. Puedes abrir el video en TikTok.'),18000);return()=>clearTimeout(timer); },[started,ready,isDirect]);
  useEffect(() => {
    const pause = () => { video.current?.pause(); message('pause'); };
    const visibility = () => { if(document.hidden)pause(); };
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries=>{if(!entries[0]?.isIntersecting)pause();},{threshold:0.05}) : null;
    if(host.current)observer?.observe(host.current);
    document.addEventListener('visibilitychange',visibility);
    return()=>{observer?.disconnect();document.removeEventListener('visibilitychange',visibility);};
  },[]);
  const toggleMute = () => { if(isDirect && video.current)video.current.muted=!muted; else message(muted ? 'unMute':'mute');setMuted(!muted); };
  const seek = value => { setTime(value); if(isDirect && video.current)video.current.currentTime=value;else message('seekTo',value); };
  const fullscreen = () => {
    if(!host.current?.requestFullscreen){if(video.current?.webkitEnterFullscreen)video.current.webkitEnterFullscreen();else setError('Tu navegador no permite pantalla completa aquí.');return;}
    const promise=host.current.requestFullscreen(); if(promise?.catch)promise.catch(()=>setError('Tu navegador no permite pantalla completa.'));
  };
  const frame = post.tiktokId ? `${ORIGIN}/player/v1/${post.tiktokId}?controls=0&autoplay=1&loop=${s.stageLoop?1:0}&description=0&music_info=0&rel=0` : '';
  return <div className="tk-player" ref={host} style={{'--tk-fit':s.stageFit,'--tk-position':`${post.positionX}% ${post.positionY}%`}}>
    {post.image && <img className="tk-player__poster" src={post.image} alt={post.title} draggable="false" style={{opacity:ready?0:1}} />}
    {started && isDirect && <video ref={video} src={post.videoUrl} poster={post.image || undefined} autoPlay playsInline muted={muted} loop={s.stageLoop} preload="metadata" onLoadedMetadata={e=>setDuration(e.currentTarget.duration)} onPlaying={()=>{if(!chapterVisible()){video.current?.pause();setPlaying(false);return;}setReady(true);setPlaying(true);}} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} onTimeUpdate={e=>setTime(e.currentTarget.currentTime)} onError={fail} />}
    {started && !isDirect && frame && <iframe ref={iframe} title={`Video de TikTok: ${post.title}`} src={frame} allow="autoplay; fullscreen; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
    {!post.image && !started && <div className="tk-player__empty"><span>♪</span><p>{post.title}</p></div>}
    {playable && !playing && !error && <button type="button" className="tk-player__play" aria-label={`Reproducir: ${post.title}`} onClick={play}><Play fill="currentColor" size={36} /></button>}
    {post.link && <a className="tk-player__external" href={post.link} target="_blank" rel="noopener noreferrer" aria-label={`${s.stageVideoText}: ${post.title}`}><ArrowUpRight size={25}/></a>}
    {error && <div className="tk-player__error" role="status"><p>{error}</p>{post.link && <a href={post.link} target="_blank" rel="noopener noreferrer">{s.stageVideoText} ↗</a>}<button type="button" onClick={()=>{setStarted(false);setReady(false);setError('');}}>Reintentar</button></div>}
    {s.stageShowControls && playable && <div className="tk-player__dock">
      <button type="button" aria-label={playing?'Pausar video':'Reproducir video'} onClick={play}>{playing?<Pause size={21}/>:<Play size={21}/>}</button>
      <input type="range" min="0" max={duration || 1} step="0.1" value={Math.min(time,duration || 1)} disabled={!started || !ready || !duration} aria-label="Avance del video" onChange={e=>seek(Number(e.target.value))}/>
      {s.stageShowDuration && duration>0 && <span>{clock(time)} / {clock(duration)}</span>}
      <button type="button" aria-label={muted?'Activar sonido':'Silenciar video'} onClick={toggleMute}><span>{muted?<VolumeX size={21}/>:<Volume2 size={21}/>}</span></button>
      <button type="button" aria-label="Pantalla completa" onClick={fullscreen}><Maximize size={21}/></button>
    </div>}
  </div>;
}
