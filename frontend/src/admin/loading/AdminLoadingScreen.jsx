import React from 'react';
import { normalizeAdminLoader } from './adminLoaderConfig';
import './AdminLoadingScreen.css';

export default function AdminLoadingScreen({ model, message = 'Preparando tu panel…', compact = false, context = 'admin', preview = false }) {
  const selected = normalizeAdminLoader(model);

  return (
    <div className={`admin-loading admin-loading--${selected} admin-loading--${context}${compact ? ' admin-loading--compact' : ''}`} role={preview ? undefined : 'status'} aria-hidden={preview ? 'true' : undefined} aria-live={preview ? undefined : 'polite'} aria-label={preview ? undefined : message}>
      {!compact && <div className={`admin-loading__skeleton admin-loading__skeleton--${context}`} aria-hidden="true">
        <span className="admin-loading__skeleton-header" />
        <span className="admin-loading__skeleton-sidebar" />
        <span className="admin-loading__skeleton-title" />
        <span className="admin-loading__skeleton-card" />
      </div>}
      <div className="admin-loading__content">
        <div className="admin-loading__visual" aria-hidden="true">
          {selected === 'halo' && <i className="admin-loading__halo" />}
          {selected === 'pulse' && <span className="admin-loading__pulse">{[0, 1, 2].map((index) => <i key={index} />)}</span>}
          {selected === 'orbit' && <span className="admin-loading__orbit"><i /><i /><i /></span>}
          {selected === 'wave' && <span className="admin-loading__wave">{[0, 1, 2, 3, 4].map((index) => <i key={index} />)}</span>}
          {selected === 'linear' && <span className="admin-loading__linear"><i /></span>}
        </div>
        <span className="admin-loading__message">{message}</span>
      </div>
    </div>
  );
}
