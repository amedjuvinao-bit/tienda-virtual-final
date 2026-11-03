import React from 'react';
import PolishedGlassRim from '../PolishedGlassRim';
import NewsletterForm from '../newsletter/NewsletterForm';

export default function FooterNewsletter({ config, footer, preview, polishedGlass = false }) {
  const label = (typeof footer.buttonText === 'string' ? footer.buttonText : 'Suscribirme').replace(/\s*[➔→]\s*$/u, '') || 'Suscribirme';
  return <div className="footer-ed__newsletter footer-ed__glass">
    {polishedGlass && <PolishedGlassRim radius={config.radius} width={Math.min(6, config.depth / 4)}/>}
    {!polishedGlass && config.material === 'texture' && <img className="footer-ed__material" src="/footer/editorial-glass.webp" alt="" aria-hidden="true" onError={event => { event.currentTarget.style.display = 'none'; }}/>}
    <NewsletterForm preview={preview} successMessage={config.successMessage} errorMessage={config.errorMessage} label={label} placeholder={footer.inputPlaceholder || 'Tu correo electrónico'}/>
  </div>;
}
