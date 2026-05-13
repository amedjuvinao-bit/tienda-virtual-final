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
  if (status === 'failed') return 'bg-red-100 text-red-700';
  if (status === 'blocked') return 'bg-yellow-100 text-yellow-700';
  return 'bg-gray-100 text-gray-700';
}

export default function LogsSection() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/admin/auth/logs');
      setLogs(res.data.data || []);
    } catch (e) {
      console.error('Error cargando logs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="rounded-3xl border bg-white p-6 shadow-sm">
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-lg font-bold">Logs de acceso</h3>

        <button
          onClick={loadLogs}
          className="flex items-center gap-2 px-3 py-2 bg-black text-white rounded-xl"
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

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