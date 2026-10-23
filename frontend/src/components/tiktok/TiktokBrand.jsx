import React from 'react';
import './tiktokBrand.css';
export default function TiktokBrand({ wordmark = true }) {
  return <span className="tk-brand"><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#25f4ee" transform="translate(-2 1)" d="M28 4h7c.5 6 3.5 9 9 10v7a20 20 0 0 1-9-3v15a13 13 0 1 1-11-13v7a6 6 0 1 0 4 6z"/><path fill="#fe2c55" transform="translate(1 -1)" d="M28 4h7c.5 6 3.5 9 9 10v7a20 20 0 0 1-9-3v15a13 13 0 1 1-11-13v7a6 6 0 1 0 4 6z"/><path fill="#141015" d="M28 4h7c.5 6 3.5 9 9 10v7a20 20 0 0 1-9-3v15a13 13 0 1 1-11-13v7a6 6 0 1 0 4 6z"/></svg>{wordmark && <strong>TikTok</strong>}</span>;
}
