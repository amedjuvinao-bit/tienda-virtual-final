import React, { useId, useState } from 'react';
import { Facebook, Instagram } from 'lucide-react';
import WhatsAppGlyph from '../WhatsAppGlyph';
import { FOOTER_SOCIALS, safeFooterImage, safeFooterLink } from './footerEditorialConfig';
import { resolveWhatsAppHref } from '../whatsappLink';

function Glyph({name,solid}) {
  if(name==='instagram')return <Instagram strokeWidth={solid?1.9:1.5}/>;
  if(name==='facebook')return <Facebook strokeWidth={solid?0:1.5} fill={solid?'currentColor':'none'}/>;
  if(name==='whatsapp')return <WhatsAppGlyph/>;
  return <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="currentColor" d="M28 4h7c.5 6 3.5 9 9 10v7a20 20 0 0 1-9-3v15a13 13 0 1 1-11-13v7a6 6 0 1 0 4 6z"/></svg>;
}
function Social({item,glass}) {
  const [failed,setFailed]=useState('');
  const metalId='footer-social-'+useId().replace(/:/g,'');
  return <a href={item.href} className="footer-ed__social" aria-label={item.label} title={item.label} target="_blank" rel="noopener noreferrer" style={glass?{'--fe-social-metal':`url(#${metalId})`}:undefined}>
    {glass && <svg className="footer-ed__metal-defs" aria-hidden="true" width="0" height="0"><defs><linearGradient id={metalId} x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stopColor="var(--fe-social-ink)"/><stop offset=".3" stopColor="color-mix(in srgb,var(--fe-social-ink) 60%,#ffdf9a)"/><stop offset=".5" stopColor="var(--fe-social-ink)"/><stop offset=".7" stopColor="color-mix(in srgb,var(--fe-social-ink) 65%,#48200c)"/><stop offset="1" stopColor="var(--fe-social-ink)"/></linearGradient></defs></svg>}
    <span className="footer-ed__social-emblem" aria-hidden="true">{item.image && failed!==item.image?<img src={item.image} alt="" onError={()=>setFailed(item.image)}/>:<Glyph name={item.key} solid={glass}/>}</span>
  </a>;
}
export default function FooterSocials({footer,theme,config}) {
  const glass=config.socialPresentation==='glass';
  const socials=FOOTER_SOCIALS.map(item=>({...item,href:safeFooterLink(typeof footer[item.key]==='string'?footer[item.key]:item.key==='whatsapp'?resolveWhatsAppHref(theme?.global?.whatsapp):''),image:config.socialPresentation==='custom'?(safeFooterImage(footer[item.key+'Icon']) || (item.key==='whatsapp' && theme?.global?.whatsapp?.useCustomImage===true?safeFooterImage(theme.global.whatsapp.imageUrl):'')):''})).filter(item=>/^https?:\/\//i.test(item.href));
  if(!config.socialsEnabled || !socials.length)return null;
  return <div className={'footer-ed__social-dock'+(glass?'':' footer-ed__glass')} data-presentation={config.socialPresentation} aria-label="Redes sociales">
    {!glass && config.material==='texture' && <img className="footer-ed__material" src="/footer/editorial-glass.webp" alt="" aria-hidden="true" onError={e=>{e.currentTarget.style.display='none';}}/>}
    <div className="footer-ed__social-list">{socials.map(item=><Social key={item.key} item={item} glass={glass}/>)}</div>
  </div>;
}
