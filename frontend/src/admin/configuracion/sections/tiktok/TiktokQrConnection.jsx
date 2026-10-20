import React, { useEffect, useRef, useState } from 'react';
import { QrCode, RefreshCw, CheckCircle2, ScanLine } from 'lucide-react';
import api from '../../../../lib/api';
const BASE = '/api/admin/tiktok-settings';
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-40';
const statusText = {
  new: 'Abre el escáner de TikTok en tu teléfono y escanea este código.',
  scanned: 'QR escaneado. Confirma los permisos en tu teléfono.',
  expired: 'Este QR caducó. Genera uno nuevo para continuar.',
  confirmed: 'Cuenta conectada. Ya puedes elegir sus videos en Apariencia → TikTok.',
};

export default function TiktokQrConnection({ revision, disabled, connected, onWaiting, onConnected }) {
  const [view, setView] = useState({ phase: 'idle', image: '', error: '' });
  const alive = useRef(false), generation = useRef(0), timer = useRef(null), controller = useRef(null), flow = useRef(null);
  const callbacks = useRef({ onWaiting, onConnected }); callbacks.current = { onWaiting, onConnected };
  const cancelRemote = qrToken => api.post(`${BASE}/qr/cancel`, { qrToken }, { timeout: 15000 }).catch(() => null);
  function stop() { clearTimeout(timer.current); controller.current?.abort(); generation.current += 1; }
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; stop(); const current = flow.current; flow.current = null; if (current) cancelRemote(current.qrToken); callbacks.current.onWaiting(false); };
  }, []);
  function finish(phase, error = '') {
    flow.current = null; callbacks.current.onWaiting(false);
    setView({ phase, image: '', error });
  }
  async function check(id) {
    if (!alive.current || generation.current !== id || !flow.current) return;
    const current = flow.current;
    if (+new Date(current.expiresAt) <= Date.now()) { await cancelRemote(current.qrToken); if (alive.current && generation.current === id) finish('expired'); return; }
    const request = new AbortController(); controller.current = request;
    try {
      const { data } = await api.post(`${BASE}/qr/check`, { qrToken: current.qrToken }, { timeout: 45000, signal: request.signal });
      if (!alive.current || generation.current !== id) return;
      if (data.status === 'confirmed' && data.settings?.connected) {
        finish('confirmed'); callbacks.current.onConnected(data.settings); return;
      }
      if (data.status === 'expired') { finish('expired'); return; }
      if (!['new', 'scanned'].includes(data.status)) throw new Error('INVALID_RESPONSE');
      setView(v => ({ ...v, phase: data.status, error: '' }));
      timer.current = setTimeout(() => check(id), 3000);
    } catch (error) {
      if (!alive.current || generation.current !== id) return;
      // Never keep an invisible authorization running after a terminal error.
      await cancelRemote(current.qrToken);
      if (alive.current && generation.current === id) { finish('error', error.response?.data?.message || 'No se pudo comprobar el QR. Revisa la conexión y genera otro código.'); callbacks.current.onConnected(); }
    }
  }
  async function start() {
    stop(); const id = generation.current;
    setView({ phase: 'creating', image: '', error: '' }); callbacks.current.onWaiting(true);
    const request = new AbortController(); controller.current = request;
    try {
      const { data } = await api.post(`${BASE}/qr`, { revision }, { timeout: 45000, signal: request.signal });
      if (!alive.current || generation.current !== id) { if (data.qrToken) cancelRemote(data.qrToken); return; }
      if (!/^[a-f0-9]{64}$/.test(data.qrToken || '') || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data.qrImage || '') || !Number.isFinite(+new Date(data.expiresAt))) throw new Error('INVALID_RESPONSE');
      flow.current = { qrToken: data.qrToken, expiresAt: data.expiresAt };
      setView({ phase: 'new', image: data.qrImage, error: '' });
      timer.current = setTimeout(() => check(id), 3000);
    } catch (error) {
      if (alive.current && generation.current === id) finish('error', error.response?.data?.message || 'No se pudo generar el QR. Comprueba las credenciales y Login Kit en tu app de TikTok.');
    }
  }
  async function cancel() {
    stop(); const id = generation.current, current = flow.current, previous = view.phase;
    setView(v => ({ ...v, phase: 'cancelling', error: '' }));
    try {
      if (current) await api.post(`${BASE}/qr/cancel`, { qrToken: current.qrToken }, { timeout: 15000 });
      if (!alive.current || generation.current !== id) return;
      finish('idle'); callbacks.current.onConnected();
    } catch (error) {
      if (!alive.current || generation.current !== id) return;
      if (error.response?.status === 409) { finish('error', 'La autorización ya cambió. Se está comprobando el estado de la cuenta.'); callbacks.current.onConnected(); return; }
      setView(v => ({ ...v, phase: previous, error: 'No se pudo cancelar la conexión. Vuelve a intentar.' }));
      timer.current = setTimeout(() => check(id), 3000);
    }
  }
  const active = ['creating', 'new', 'scanned', 'cancelling'].includes(view.phase);
  return <div className="rounded-2xl border p-4 space-y-3" style={{ background: 'var(--admin-glass-bg,rgba(255,255,255,.28))' }}>
    <div className="flex flex-wrap items-center gap-2"><QrCode size={21} /><h3 className="font-semibold">Conectar por QR</h3><span className="ml-auto rounded-full border px-2 py-1 text-xs">Desde tu PC</span></div>
    <p className="text-sm opacity-75">Escanea con la app de TikTok y autoriza el perfil y los videos públicos. No necesitas una URL de retorno para iniciar este método.</p>
    {view.image && <div className="flex flex-wrap items-center justify-center gap-5">
      <img src={view.image} alt="Código QR para conectar la cuenta de TikTok" width="280" height="280" className="max-w-full rounded-xl" style={{ width: 280, height: 'auto' }} />
      <div className="max-w-xs space-y-3 text-sm"><ScanLine size={28} /><p role="status">{statusText[view.phase] || 'Deteniendo la conexión…'}</p><p className="text-xs opacity-70">Mantén este panel abierto. Si TikTok indica que el código venció, genera otro.</p></div>
    </div>}
    {!view.image && statusText[view.phase] && <p role="status" className="flex gap-2 items-center text-sm">{view.phase === 'confirmed' && <CheckCircle2 size={18} />}{statusText[view.phase]}</p>}
    {view.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{view.error}</p>}
    <div className="flex flex-wrap gap-2">
      {!active && <button className={button} disabled={disabled} onClick={start}><QrCode size={17} />{['expired', 'error'].includes(view.phase) ? 'Generar nuevo QR' : connected ? 'Volver a conectar por QR' : 'Generar QR de TikTok'}</button>}
      {active && <button className={button} disabled={['creating', 'cancelling'].includes(view.phase)} onClick={cancel}>{view.phase === 'creating' ? <><RefreshCw size={17} className="animate-spin" />Generando QR…</> : view.phase === 'cancelling' ? 'Cancelando…' : 'Cancelar conexión QR'}</button>}
    </div>
  </div>;
}
