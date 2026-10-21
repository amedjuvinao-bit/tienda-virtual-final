import React, { useId, useState } from 'react';
import { Facebook, Instagram } from 'lucide-react';
import WhatsAppGlyph from '../WhatsAppGlyph';
import { FOOTER_SOCIALS, safeFooterImage, safeFooterLink } from './footerEditorialConfig';
import { resolveWhatsAppHref } from '../whatsappLink';

function Glyph({name}) {
  if(name==='instagram')return <Instagram strokeWidth={1.8}/>;
  if(name==='facebook')return <Facebook strokeWidth={1.8}/>;
  if(name==='whatsapp')return <WhatsAppGlyph/>;
  return <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="currentColor" d="M28 4h7c.5 6 3.5 9 9 10v7a20 20 0 0 1-9-3v15a13 13 0 1 1-11-13v7a6 6 0 1 0 4 6z"/></svg>;
}
function Social({item}) {
  const [failed,setFailed]=useState(''), metalId='footer-metal-'+useId().replace(/:/g,'');
  return <a href={item.href} className="footer-ed__social" aria-label={item.label} target="_blank" rel="noopener noreferrer">
    {item.image && failed!==item.image?<img src={item.image} alt="" onError={()=>setFailed(item.image)}/>:<span className="footer-ed__metal" aria-hidden="true" style={{'--fe-metal-paint':`url(#${metalId})`}}>
      <svg className="footer-ed__metal-palette" width="0" height="0"><defs><linearGradient id={metalId} x1="0" y1="0" x2=".8" y2="1" gradientUnits="objectBoundingBox"><stop offset="0" stopColor="#fff4ce"/><stop offset=".25" stopColor="var(--fe-accent)"/><stop offset=".46" stopColor="#713214"/><stop offset=".57" stopColor="#ffe4a6"/><stop offset=".8" stopColor="var(--fe-accent)"/><stop offset="1" stopColor="#67321c"/></linearGradient></defs></svg>
      <span className="footer-ed__metal-back"><Glyph name={item.key}/></span>
      <span className="footer-ed__metal-face"><Glyph name={item.key}/></span>
    </span>}
  </a>;
}
export default function FooterSocials({footer,theme,config}) {
  const socials=FOOTER_SOCIALS.map(item=>({...item,href:safeFooterLink(typeof footer[item.key]==='string'?footer[item.key]:item.key==='whatsapp'?resolveWhatsAppHref(theme?.global?.whatsapp):''),image:config.socialIconStyle==='custom'?safeFooterImage(footer[item.key+'Icon']):''})).filter(item=>/^https?:\/\//i.test(item.href));
  if(!config.socialsEnabled || !socials.length)return null;
  return <div className="footer-ed__social-dock footer-ed__glass" aria-label="Redes sociales">
    {config.material==='texture' && <img className="footer-ed__material" src="/footer/editorial-glass.webp" alt="" aria-hidden="true" onError={e=>{e.currentTarget.style.display='none';}}/>}
    <div className="footer-ed__social-list">{socials.map(item=><Social key={item.key} item={item}/>)}</div>
  </div>;
}
