import React, { useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { footerColumns, normalizeEditorialOptions, safeFooterImage } from './footerEditorialConfig';
import FooterNewsletter from './FooterNewsletter';
import FooterNavigation from './FooterNavigation';
import FooterSocials from './FooterSocials';
import './footerEditorial.css';

export default function FooterEditorial({ theme, preview=false }) {
  const footer=theme?.footer || {}, c=normalizeEditorialOptions(footer), root=useRef(null);
  const [failedLogo,setFailedLogo]=useState('');
  if(footer.enabled===false && !preview)return null;
  const columns=footerColumns(footer).filter(col=>c[col.id+'Enabled']);
  const logo=safeFooterImage(footer.logoUrl), showLogo=c.brandMode!=='text' && logo && failedLogo!==logo;
  const image=c.backgroundMode==='satin'?'/footer/editorial-satin-v2.webp':c.backgroundMode==='image'?c.backgroundImage:'';
  const style={
    backgroundColor:c.backgroundMode==='inherit'?'transparent':c.backgroundColor,
    backgroundImage:image?'url('+JSON.stringify(image)+')':'none',
    backgroundPosition:c.backgroundX+'% '+c.backgroundY+'%',
    backgroundSize:c.backgroundZoom===100?'cover':c.backgroundZoom+'% auto',
    '--fe-ink':c.headingColor,'--fe-body':c.textColor,'--fe-accent':c.accentColor,
    '--fe-tint':c.glassTint,'--fe-edge':c.edgeColor,'--fe-button':c.buttonColor,'--fe-button-ink':c.buttonTextColor,
    '--fe-title-font':c.titleFont || 'Georgia, serif','--fe-body-font':c.bodyFont || 'system-ui',
    '--fe-art-alpha':c.materialOpacity/100,'--fe-glass-alpha':c.glassOpacity/100,'--fe-watermark-alpha':c.watermarkOpacity/100,
    '--fe-duration':c.animationDuration+'ms','--fe-logo-size':Math.min(260,Math.max(60,Number(footer.logoSizePx)||144))+'px',
  };
  for(const key of ['maxWidth','minHeight','paddingX','paddingTop','paddingBottom','contentGap','headlineSize','brandSize','columnTitleSize','bodySize','watermarkSize','blur','depth','radius','socialSize','socialGap','buttonWidth','buttonHeight','mobilePadding','mobileHeadlineSize','mobileBrandSize','mobileWatermarkSize'])style['--fe-'+key.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase())]=c[key]+'px';
  function backToTop() {
    if(preview)return;
    const view=root.current?.ownerDocument.defaultView;
    view?.scrollTo({top:0,behavior:view.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  return <div className="footer-ed-viewport"><footer ref={root} className="footer-ed" aria-label="Pie de página" style={style} data-motion={c.hoverMotion} data-mobile-nav={c.mobileNavigation} data-newsletter={c.newsletterEnabled}>
    <div className="footer-ed__inner">
      {c.newsletterEnabled && <div className="footer-ed__top">
        <header className="footer-ed__invitation">{c.headline && <h2>{c.headline}</h2>}{c.description && <p>{c.description}</p>}</header>
        <FooterNewsletter config={c} footer={footer} preview={preview}/>
      </div>}
      <div className="footer-ed__body">
        {c.brandEnabled && <div className="footer-ed__brand">
          {showLogo && <img src={logo} alt={c.brandName || 'Logo de la tienda'} className="footer-ed__logo" onError={()=>setFailedLogo(logo)}/>}
          {(c.brandMode!=='image' || !showLogo) && c.brandName && <p className="footer-ed__brand-name">{c.brandName}</p>}
          {c.brandTagline && <p className="footer-ed__tagline">{c.brandTagline}</p>}
        </div>}
        <FooterNavigation columns={columns}/>
      </div>
      <div className="footer-ed__utility">
        <FooterSocials footer={footer} theme={theme} config={c}/>
        {c.backToTopEnabled && <button type="button" className="footer-ed__top-button" aria-label={c.backToTopLabel || 'Volver arriba'} onClick={backToTop}><ArrowUp size={30} aria-hidden="true"/></button>}
      </div>
      {c.legalEnabled && <div className="footer-ed__legal">{typeof footer.copyright==='string' && footer.copyright.trim()?footer.copyright:'© '+c.brandName+' · Todos los derechos reservados.'}</div>}
      {c.watermarkEnabled && (c.watermarkText || c.brandName) && <div className="footer-ed__watermark" aria-hidden="true"><svg viewBox="0 0 1000 180" preserveAspectRatio="none">{['shadow','light','edge'].map(layer=><text key={layer} className={'footer-ed__engraving-'+layer} x="5" y="151" textLength="990" lengthAdjust="spacingAndGlyphs">{(c.watermarkText || c.brandName).toLocaleUpperCase()}</text>)}</svg></div>}
    </div>
  </footer></div>;
}
