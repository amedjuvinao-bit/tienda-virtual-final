import React from 'react';
import './tiktokBrand.css';

export default function TiktokBrand({ compact = false }) {
  return <span className={compact ? 'tk-brand tk-brand--compact' : 'tk-brand'}>TikTok</span>;
}
