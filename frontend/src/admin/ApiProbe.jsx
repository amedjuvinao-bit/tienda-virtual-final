import React, { useState } from 'react';
import { API_BASE_URL } from '../config/apiBaseUrl';

export default function ApiProbe() {
  const [status, setStatus] = useState('idle');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const endpoints = [`${API_BASE_URL}/api/site-settings`];

  const probe = async () => {
    setStatus('loading'); setError(''); setData(null);
    for (const url of endpoints) {
      try {
        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        const json = await res.json();
        setStatus('ok');
        setData(json);
        return;
      } catch (e) {
        // intenta el siguiente endpoint
        setError(`${e.message} en ${url}`);
      }
    }
    setStatus('fail');
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-pink-700 mb-4">Probe: /api/site-settings</h1>

      <button
        onClick={probe}
        className="px-4 py-2 rounded-xl bg-pink-600 text-white hover:bg-pink-700"
      >
        Probar GET
      </button>

      <div className="mt-4 text-sm">
        <div className="mb-2">
          Estado:{" "}
          <span className={
            status === 'ok' ? 'text-green-600' :
            status === 'loading' ? 'text-yellow-600' :
            status === 'fail' ? 'text-red-600' : 'text-gray-600'
          }>
            {status}
          </span>
        </div>

        {!!error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 mb-3">
            Error: {error}
          </div>
        )}

        <label className="block">
          <span className="block text-gray-600 mb-1">Respuesta JSON</span>
          <textarea
            className="w-full h-72 border rounded-lg p-3 font-mono text-xs"
            readOnly
            value={data ? JSON.stringify(data, null, 2) : ''}
            placeholder="(aquí verás el JSON si funciona)"
          />
        </label>
      </div>
    </div>
  );
}
