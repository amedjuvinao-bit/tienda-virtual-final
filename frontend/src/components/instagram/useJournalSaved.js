import { useEffect, useState } from 'react';

function read(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter(id => typeof id === 'string').slice(-100) : [];
  } catch { return []; }
}
export default function useJournalSaved(account) {
  const key = `rosa-instagram-saved:${account}`;
  const [stored, setStored] = useState(() => ({ key, ids: read(key) }));
  const ids = stored.key === key ? stored.ids : read(key);
  useEffect(() => {
    const refresh = event => { if (event.key === key || event.key === null) setStored({ key, ids: read(key) }); };
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [key]);
  function toggle(id) {
    const saved = ids.includes(id);
    const next = saved ? ids.filter(item => item !== id) : [...ids, id].slice(-100);
    setStored({ key, ids: next });
    try {
      localStorage.setItem(key, JSON.stringify(next));
      return saved ? 'Publicación retirada de tus guardadas.' : 'Publicación guardada en este navegador.';
    } catch {
      return saved ? 'Publicación retirada de tus guardadas.' : 'Publicación guardada durante esta visita.';
    }
  }
  return { ids, toggle };
}
