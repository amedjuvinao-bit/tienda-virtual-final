import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

function Column({ column, index, open, onToggle }) {
  const id=useId(), toggleId=id+'-toggle';
  return <section className="footer-ed__column" data-open={open} data-long-title={column.title.length>22 || (!/\s/.test(column.title) && column.title.length>12)} style={{'--fe-column':index+1}}>
    <h3><span className="footer-ed__column-title">{column.title}</span><button id={toggleId} className="footer-ed__accordion" type="button" aria-expanded={open} aria-controls={id} onClick={onToggle}>{column.title || 'Enlaces'}<ChevronDown size={20} aria-hidden="true"/></button></h3>
    <div id={id} className="footer-ed__links" role="region" aria-labelledby={toggleId}><ul>{column.links.map((link,i)=><li key={i}><a href={link.href} target={link.newTab?'_blank':undefined} rel={link.newTab?'noopener noreferrer':undefined}>{link.label}</a></li>)}</ul></div>
  </section>;
}
export default function FooterNavigation({ columns, mobileNavigation='accordion' }) {
  const [openId,setOpenId]=useState(null);
  return <nav className="footer-ed__navigation" aria-label="Enlaces del pie de página" style={{'--fe-columns':Math.max(1,columns.length)}}>{columns.map((column,index)=><Column key={column.id} column={column} index={index} open={mobileNavigation==='open' || openId===column.id} onToggle={()=>setOpenId(current=>current===column.id?null:column.id)}/>)}</nav>;
}
