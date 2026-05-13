import React from 'react';

export default function EmptyHint({ title, text }) {
  return (
    <div
      className="border backdrop-blur-xl"
      style={{
        backgroundColor: 'var(--admin-primary-soft-bg)',
        borderColor: 'var(--admin-primary-soft-border)',
        borderRadius: 'var(--admin-radius)',
        padding: 'calc(var(--admin-padding) * 1.1)',
      }}
    >
      <h4
        style={{
          color: 'var(--admin-primary)',
          fontWeight: 600,
          fontSize: '14px',
        }}
      >
        {title}
      </h4>

      <p
        style={{
          marginTop: 'calc(var(--admin-gap) * 0.25)',
          color: 'var(--admin-card-muted-text)',
          fontSize: '14px',
          lineHeight: '1.6',
        }}
      >
        {text}
      </p>
    </div>
  );
}