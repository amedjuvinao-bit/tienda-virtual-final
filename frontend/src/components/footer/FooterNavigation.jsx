import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

function Column({ column }) {
  const id=useId(), [open,setOpen]=useState(false);
  return <section className="footer-ed__column" data-open={open}>
    <h3><span className="footer-ed__column-title">{column.title}</span><button className="footer-ed__accordion" type="button" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}>{column.title || 'Enlaces'}<ChevronDown size={20} aria-hidden="true"/></button></h3>
    <div id={id} className="footer-ed__links"><ul>{column.links.map((link,i)=><li key={i}><a href={link.href} target={link.newTab?'_blank':undefined} rel={link.newTab?'noopener noreferrer':undefined}>{link.label}</a></li>)}</ul></div>
  </section>;
}
export default function FooterNavigation({ columns }) {
  return <nav className="footer-ed__navigation" aria-label="Enlaces del pie de página">{columns.map(column=><Column key={column.id} column={column}/>)}</nav>;
}
