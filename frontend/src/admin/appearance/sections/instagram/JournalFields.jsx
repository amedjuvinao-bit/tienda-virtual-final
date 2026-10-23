import React from 'react';
import { Field, Input } from '../ui/UiComponents';
import SectionColorPicker from '../ui/SectionColorPicker';
import { bounded } from './instagramEditorialHelpers';

export function JournalText({ label, value = '', onChange, multiline = false, ...props }) {
  return <Field label={label}>{multiline
    ? <textarea aria-label={label} className="w-full border rounded-lg p-2" rows={3} value={value} onChange={e => onChange(e.target.value)} {...props} />
    : <Input aria-label={label} value={value} onChange={e => onChange(e.target.value)} {...props} />}</Field>;
}
export function JournalNumber({ label, value, min, max, step = 1, onChange }) {
  return <JournalText {...{ label, value, min, max, step }} type="number" onChange={v => onChange(bounded(v, min, max, value))} />;
}
export function JournalSelect({ label, value, onChange, options }) {
  return <label className="block text-sm font-semibold">{label}<select className="w-full mt-1 rounded-lg border p-2" value={value} onChange={e => onChange(e.target.value)}>{options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select></label>;
}
export function JournalCheck({ label, value, onChange }) {
  return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} />{label}</label>;
}
export function JournalColor({ label, value, onChange }) {
  return <Field label={label}><SectionColorPicker {...{ label, value, onChange }} /></Field>;
}
