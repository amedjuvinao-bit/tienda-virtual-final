import React, { useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, Clapperboard } from 'lucide-react';

const time = value => `${Math.floor((Number.isFinite(value) ? value : 0) / 60)}:${String(Math.floor((Number.isFinite(value) ? value : 0) % 60)).padStart(2, '0')}`;

export default function JournalReelPlayer({ post, src, onExpand }) {
  const video = useRef(null);
  const [playing, setPlaying] = useState(false), [muted, setMuted] = useState(false);
  const [position, setPosition] = useState(0), [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  async function toggle() {
    const player = video.current;
    if (!player) return;
    if (!player.paused) { player.pause(); return; }
    try { await player.play(); setError(''); }
    catch { setError('No se pudo reproducir el reel. Puedes abrirlo en Instagram.'); }
  }
  const mute = () => { if (video.current) { video.current.muted = !video.current.muted; setMuted(video.current.muted); } };
  return <div className="ig-reel" data-playing={playing}>
    <img className="ig-reel__ambience" src={post.image} alt="" aria-hidden="true" decoding="async" />
    <div className="ig-reel__shade" aria-hidden="true" />
    <video ref={video} src={src} poster={post.image} playsInline preload="metadata"
      aria-label={`Reel: ${post.alt || 'Publicación de Instagram'}`} onClick={toggle}
      onLoadedMetadata={event => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
      onDurationChange={event => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
      onTimeUpdate={event => setPosition(event.currentTarget.currentTime)}
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
      onVolumeChange={event => setMuted(event.currentTarget.muted)}
      onError={() => { setPlaying(false); setError('No se pudo cargar el reel. Puedes abrirlo en Instagram.'); }} />
    <span className="ig-reel__label"><Clapperboard size={15} /> Reel</span>
    {!playing && !error && <button type="button" className="ig-reel__start" onClick={toggle} aria-label="Reproducir reel"><Play fill="currentColor" size={29} /><span>Ver reel</span></button>}
    {error && <p className="ig-reel__error" role="status">{error}</p>}
    <div className="ig-reel__controls" role="group" aria-label="Controles del reel">
      <input className="ig-reel__progress" type="range" min="0" max={duration || 1} step="0.1" value={Math.min(position, duration || 1)} disabled={!duration}
        aria-label="Avanzar o retroceder el reel" aria-valuetext={`${time(position)} de ${time(duration)}`}
        style={{ '--reel-progress': `${duration ? position / duration * 100 : 0}%` }}
        onChange={event => { const next = Number(event.target.value); if (video.current) video.current.currentTime = next; setPosition(next); }} />
      <div className="ig-reel__toolbar">
        <button type="button" onClick={toggle} aria-label={playing ? 'Pausar reel' : 'Reproducir o continuar reel'}>{playing ? <Pause size={19} /> : <Play size={19} fill="currentColor" />}</button>
        <span className="ig-reel__time">{time(position)} <span>/ {time(duration)}</span></span>
        <button type="button" className="ig-reel__sound" onClick={mute} aria-label={muted ? 'Activar sonido del reel' : 'Silenciar reel'} aria-pressed={muted}>{muted ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>
        <button type="button" onClick={() => { video.current?.pause(); onExpand(post); }} aria-label="Ampliar reel"><Maximize2 size={19} /></button>
      </div>
    </div>
  </div>;
}
