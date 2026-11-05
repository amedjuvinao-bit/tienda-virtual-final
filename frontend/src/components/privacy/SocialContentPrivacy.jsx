import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Play, ShieldCheck, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { isSocialMediaFile, storeSocialMedia } from '../../lib/socialMediaDelivery';
import { API_BASE_URL } from '../../config/apiBaseUrl';
import usePrivacyPreferences from './usePrivacyPreferences';
import { savePrivacyPreference } from '../../lib/privacyPreferences';
import './privacyPreferences.css';

const cover = '/consumer/social-crystal.svg';
const unrestricted = { managed: false, allowed: true, canLoad: () => true, image: value => value, video: value => value };
const SocialPrivacy = createContext(unrestricted);

// Public uploads currently use Cloudinary. Social/CDN URLs and unknown hosts
// remain optional; checking the parsed hostname avoids substring lookalikes.
export function isStoreMedia(value, origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin) {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (/^data:image\//i.test(value)) return true;
  try {
    const url = new URL(value, origin);
    if (url.protocol === 'blob:') return url.origin === origin;
    return ['https:', 'http:'].includes(url.protocol)
      && !url.username && !url.password
      && (url.origin === origin || url.origin === new URL(API_BASE_URL).origin || (url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' && !url.port));
  } catch { return false; }
}

export function useSocialContentPrivacy() { return useContext(SocialPrivacy); }

export default function SocialContentPrivacy({ children }) {
  const decision = usePrivacyPreferences();
  const allowed = decision?.choices.social === true;
  const canLoad = value => allowed || isStoreMedia(value) || isSocialMediaFile(value);
  const media = (value, kind) => !value || canLoad(value) ? storeSocialMedia(value, kind) : cover;
  return <SocialPrivacy.Provider value={{ managed: true, allowed, canLoad, image: value => media(value, 'image'), video: value => media(value, 'video') }}>
    {children}
  </SocialPrivacy.Provider>;
}

export function SocialImage({ src, alt = '', ...props }) {
  const privacy = useSocialContentPrivacy();
  const blocked = Boolean(src) && !privacy.canLoad(src);
  return <img {...props} src={privacy.image(src)} referrerPolicy="no-referrer" alt={blocked && alt ? 'Contenido externo pendiente de autorización' : alt}
    data-privacy-placeholder={blocked ? 'true' : undefined} />;
}

// Keep the section and its own cover visible. Only mount an external player
// after an informed choice; this boundary also unmounts it on withdrawal.
export function SocialPlayback({ src, poster, title, provider, requestPlay = false, preserveControls = false, children }) {
  const privacy = useSocialContentPrivacy();
  const decision = usePrivacyPreferences();
  const allowed = !src || privacy.canLoad(src);
  const [requested, setRequested] = useState(requestPlay);
  const wasAllowed = useRef(allowed);
  useEffect(() => {
    if (wasAllowed.current && !allowed) setRequested(false);
    wasAllowed.current = allowed;
  }, [allowed]);
  if (preserveControls) return <>{children(requested, { allowed, request: () => setRequested(true) })}
    {requested && !allowed && <PlaybackConsent title={title} provider={provider} onClose={() => setRequested(false)} onAllow={() => {
      savePrivacyPreference({ social: true, maps: decision?.choices.maps === true }, 'custom');
    }} />}</>;
  if (allowed) return children(requested);
  return <div className="privacy-video-surface">
    {poster && <SocialImage className="privacy-video-cover" src={poster} alt={title} />}
    {!requested ? <button type="button" className="privacy-video-open" onClick={() => setRequested(true)} aria-label={`Ver video: ${title}`}><Play size={25} aria-hidden="true" /><span>Ver video</span></button>
      : <div className="privacy-video-choice">
        <button type="button" className="privacy-video-close" aria-label="Cerrar aviso del video" onClick={() => setRequested(false)}><X size={17} /></button>
        <ShieldCheck size={19} aria-hidden="true" />
        <strong>Ver contenido de {provider}</strong>
        <p>Al permitir redes, Instagram y TikTok podrán recibir tu IP y datos de conexión y usar sus cookies. Tu elección se recuerda hasta 180 días y puedes cambiarla desde Cookies y preferencias.</p>
        <button type="button" className="privacy-choice-button" onClick={() => {
          savePrivacyPreference({ social: true, maps: decision?.choices.maps === true }, 'custom');
        }}>Permitir redes</button>
        <a href="/privacidad#privacy-cookies">Más información</a>
      </div>}
  </div>;
}

function PlaybackConsent({ title, provider, onClose, onAllow }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement, element = dialog.current;
    element.showModal?.();
    if (!element.open) element.setAttribute('open', '');
    element.querySelector('button')?.focus();
    return () => { element.close?.(); previous?.focus?.({ preventScroll: true }); };
  }, []);
  return createPortal(<dialog ref={dialog} className="privacy-playback-dialog" aria-labelledby="privacy-playback-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="privacy-video-choice">
      <button type="button" className="privacy-video-close" aria-label="Cerrar aviso del video" onClick={onClose}><X size={17} /></button>
      <ShieldCheck size={19} aria-hidden="true" />
      <strong id="privacy-playback-title">Reproducir con {provider}</strong>
      <p>Para ver «{title}», se conectará tu navegador con {provider}. Podrá recibir tu IP y usar cookies. Permitir redes activa Instagram y TikTok; puedes cambiarlo en Cookies y preferencias.</p>
      <div className="privacy-preferences-actions"><button type="button" onClick={onClose}>Ahora no</button><button type="button" onClick={onAllow}>Permitir redes</button></div>
      <a href="/privacidad#privacy-cookies">Más información</a>
    </div>
  </dialog>, document.body);
}
