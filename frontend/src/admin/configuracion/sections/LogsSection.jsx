// src/admin/configuracion/sections/LogsSection.jsx
import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import api from '../../../lib/api';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-CO');
}

function getStatusStyle(status) {
  if (status === 'success') return 'bg-green-100 text-green-700';
  if (status === 'pending') return 'bg-blue-100 text-blue-700';
  if (status === 'failed') return 'bg-red-100 text-red-700';
  if (status === 'blocked') return 'bg-yellow-100 text-yellow-700';
  return 'bg-gray-100 text-gray-700';
}

export default function LogsSection() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scope, setScope] = useState('login');

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/api/admin/audit-logs', {
        params: { scope, page: 1, limit: 100 },
      });
      setLogs(res.data.data || []);
    } catch (e) {
      console.error('Error cargando logs', e);
      setError(e?.userMessage || 'No se pudieron cargar los logs de acceso.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [scope]);

  return (
    <div className="rounded-3xl border bg-white p-6 shadow-sm">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold">Auditoría administrativa</h3>
          <p className="mt-1 text-sm text-gray-500">
            Revisa accesos al panel y operaciones administrativas protegidas.
          </p>
        </div>

        <button
          onClick={loadLogs}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-black text-white rounded-xl"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Tipo de log">
        <button
          type="button"
          role="tab"
          aria-selected={scope === 'login'}
          onClick={() => setScope('login')}
          className={`rounded-xl px-3 py-2 text-sm font-semibold ${
            scope === 'login' ? 'bg-pink-100 text-pink-800' : 'bg-gray-100 text-gray-600'
          }`}
        >
          Accesos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={scope === 'operations'}
          onClick={() => setScope('operations')}
          className={`rounded-xl px-3 py-2 text-sm font-semibold ${
            scope === 'operations' ? 'bg-pink-100 text-pink-800' : 'bg-gray-100 text-gray-600'
          }`}
        >
          Operaciones
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Fecha</th>
              <th className="p-2 text-left">Usuario</th>
              <th className="p-2 text-left">IP</th>
              <th className="p-2 text-left">Estado</th>
              <th className="p-2 text-left">Motivo</th>
            </tr>
          </thead>

          <tbody>
            {!loading && !error && logs.length === 0 ? (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={5}>
                  Todavía no hay registros en esta categoría.
                </td>
              </tr>
            ) : null}
            {logs.map((log) => (
              <tr key={log._id} className="border-t">
                <td className="p-2">{formatDate(log.createdAt)}</td>
                <td className="p-2">{log.username}</td>
                <td className="p-2">{log.ip}</td>
                <td className="p-2">
                  <span className={`px-2 py-1 rounded ${getStatusStyle(log.status)}`}>
                    {log.status}
                  </span>
                </td>
                <td className="p-2">{log.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
