import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Check, ChevronDown, MapPin, Instagram, ShieldCheck, X } from 'lucide-react';
import usePrivacyPreferences from './usePrivacyPreferences';
import { savePrivacyPreference, PRIVACY_PREFERENCES_POLICY as policy } from '../../lib/privacyPreferences';
import './privacyPreferences.css';

const rejected = { social: false, maps: false };
const accepted = { social: true, maps: true };

function PreferencesDialog({ choices, onSave, onClose }) {
  const [draft, setDraft] = useState({ ...choices });
  const dialog = useRef(null);
  const heading = useId();
  const description = useId();
  useLayoutEffect(() => {
    const previousFocus = document.activeElement;
    const root = document.getElementById('root');
    const previousInert = root?.inert;
    const previousOverflow = document.body.style.overflow;
    if (root) root.inert = true;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector('h2')?.focus();
    return () => {
      if (root) root.inert = previousInert;
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  const keys = event => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href], summary')]
      .filter(element => !element.closest('details:not([open])') || element.tagName === 'SUMMARY');
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !focusable.includes(document.activeElement))) {
      event.preventDefault(); first?.focus();
    }
  };
  return createPortal(
    <div className="privacy-preferences-overlay">
      <section className="privacy-preferences-dialog" role="dialog" aria-modal="true" aria-labelledby={heading} aria-describedby={description} onKeyDown={keys} ref={dialog}>
        <header className="privacy-dialog-heading">
          <button type="button" className="privacy-close" onClick={onClose} aria-label="Cerrar preferencias"><X size={19} /></button>
          <p className="privacy-preferences-eyebrow"><ShieldCheck size={15} aria-hidden="true" /> Cookies y preferencias</p>
          <h2 id={heading} tabIndex={-1}>Tú eliges qué conectar</h2>
          <p id={description}>Activa solo lo que quieras. Puedes comprar con ambas opciones desactivadas.</p>
        </header>
        <div className="privacy-dialog-body">
          <div className="privacy-necessary"><Check size={15} aria-hidden="true" /><span>Carrito, favoritos, compra y seguridad</span><small>Siempre disponibles</small></div>
          {Object.entries(policy.categories).map(([key, category]) => (
            <label key={key} className="privacy-category">
              <span className="privacy-category-icon" aria-hidden="true">{key === 'social' ? <Instagram size={20} /> : <MapPin size={20} />}</span>
              <span><strong>{category.label}</strong><small>{category.providers}</small><span>{key === 'social' ? 'Permite cargar sus imágenes, videos y reproductores externos.' : 'Permite explorar el mapa dentro de la página.'}</span></span>
              <input type="checkbox" role="switch" aria-label={category.label} checked={draft[key]} onChange={event => setDraft(value => ({ ...value, [key]: event.target.checked }))} />
              <span className="privacy-toggle" aria-hidden="true" />
            </label>
          ))}
          <p className="privacy-connection-note">Al activarlos, sus proveedores reciben tu IP y datos de conexión; pueden usar cookies o almacenamiento propios.</p>
          <details className="privacy-details">
            <summary>Cómo se usan y recuerdan tus preferencias<ChevronDown size={15} aria-hidden="true" /></summary>
            <div><p>{policy.notice}</p>{Object.values(policy.categories).map(category => <p key={category.label}><strong>{category.label}. </strong>{category.description}</p>)}
              <p>{policy.storageNotice}</p><p>{policy.withdrawalNotice}</p></div>
          </details>
          <a className="privacy-policy-link" href="/privacidad#privacy-cookies" onClick={onClose}>Leer la política de privacidad</a>
        </div>
        <footer className="privacy-dialog-footer"><div className="privacy-preferences-actions">
          <button type="button" aria-label="Rechazar opcionales" onClick={() => onSave(rejected, 'reject_optional')}>Rechazar</button>
          <button type="button" aria-label="Aceptar opcionales" onClick={() => onSave(accepted, 'accept_all')}>Aceptar</button>
          <button type="button" onClick={() => onSave(draft, 'custom')}>Guardar mi elección</button>
        </div></footer>
      </section>
    </div>, document.body,
  );
}

export default function PrivacyPreferences() {
  const { pathname } = useLocation();
  const decision = usePrivacyPreferences();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [bannerHeight, setBannerHeight] = useState(0);
  const banner = useRef(null);
  const admin = pathname === '/admin' || pathname.startsWith('/admin/');
  const visible = !admin && !decision;
  useEffect(() => {
    const show = () => { if (!admin) setOpen(true); };
    window.addEventListener('rb_open_privacy_preferences', show);
    return () => window.removeEventListener('rb_open_privacy_preferences', show);
  }, [admin]);
  useEffect(() => { setOpen(false); }, [pathname]);
  useLayoutEffect(() => {
    if (!visible || !banner.current) { setBannerHeight(0); return undefined; }
    const measure = () => setBannerHeight(Math.ceil(banner.current?.getBoundingClientRect().height || 0) + 24);
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(banner.current);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [visible]);
  function save(choices, method) {
    const result = savePrivacyPreference(choices, method);
    setFeedback(result.persisted ? 'Tus preferencias se han guardado. Puedes cambiarlas desde Cookies y preferencias.'
      : 'Tu decisión se aplicará durante esta visita. El navegador no permite guardarla.');
    setOpen(false);
  }
  if (admin) return null;
  return (
    <>
      {visible ? <><div aria-hidden="true" style={{ height: bannerHeight }} /><section className="privacy-preferences-banner" ref={banner} aria-label="Cookies y contenidos externos">
        <div className="privacy-banner-copy"><ShieldCheck className="privacy-banner-mark" size={22} aria-hidden="true" /><div><h2>Tu privacidad</h2><p>Usamos lo necesario para que compres. Tú eliges si conectas reproductores externos y el mapa. <a className="privacy-policy-link" href="/privacidad#privacy-cookies">Más información</a></p></div>
        </div>
        <div className="privacy-preferences-actions">
          <button type="button" aria-label="Rechazar opcionales" onClick={() => save(rejected, 'reject_optional')}>Rechazar</button>
          <button type="button" aria-label="Aceptar opcionales" onClick={() => save(accepted, 'accept_all')}>Aceptar</button>
          <button type="button" aria-label="Elegir preferencias" onClick={() => setOpen(true)}>Personalizar</button>
        </div>
      </section></> : null}
      <span className="privacy-preferences-feedback" role="status">{feedback}</span>
      {open ? <PreferencesDialog choices={decision?.choices || rejected} onSave={save} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
