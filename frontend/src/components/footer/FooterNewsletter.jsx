import React, { useId, useState } from 'react';
import { ArrowRight, Mail } from 'lucide-react';
import api from '../../lib/api';

export default function FooterNewsletter({ config, footer, preview }) {
  const id=useId(), [email,setEmail]=useState(''), [state,setState]=useState('idle'), [message,setMessage]=useState('');
  const buttonLabel=(typeof footer.buttonText==='string'?footer.buttonText:'Suscribirme').replace(/\s*[➔→]\s*$/u,'');
  async function submit(event) {
    event.preventDefault();
    if(state==='sending')return;
    if(preview) {setMessage('Vista previa: el formulario no guarda correos.');setState('preview');return;}
    const normalized=email.trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {setState('error');setMessage('Escribe un correo electrónico válido.');return;}
    setState('sending');setMessage('');
    try {
      const result=await api.post('/api/newsletter/subscribe',{email:normalized,consent:true});
      if(result.data?.ok!==true)throw new Error('Subscription failed');
      setState('success');setMessage(config.successMessage);setEmail('');
    } catch {setState('error');setMessage(config.errorMessage);}
  }
  return <form className="footer-ed__newsletter footer-ed__glass" onSubmit={submit} aria-label="Suscripción a novedades">
    {config.material==='texture' && <img className="footer-ed__material" src="/footer/editorial-glass.webp" alt="" aria-hidden="true" onError={e=>{e.currentTarget.style.display='none';}}/>}
    <div className="footer-ed__newsletter-fields">
      <label className="footer-ed__email" htmlFor={id}><Mail size={25} aria-hidden="true"/><input id={id} type="email" name="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>{setEmail(e.target.value);if(state!=='sending'){setState('idle');setMessage('');}}} placeholder={typeof footer.inputPlaceholder==='string'?footer.inputPlaceholder:'Tu correo electrónico'} aria-label="Correo electrónico" aria-describedby={message?id+'-status':undefined} disabled={state==='sending'}/></label>
      <button className="footer-ed__subscribe" type="submit" aria-label={buttonLabel || 'Suscribirse a novedades'} disabled={state==='sending'}><span>{state==='sending'?'Guardando…':buttonLabel}</span><ArrowRight size={23} aria-hidden="true"/></button>
    </div>
    {message && <p id={id+'-status'} className="footer-ed__form-message" role={state==='error'?'alert':'status'}>{message}</p>}
  </form>;
}
