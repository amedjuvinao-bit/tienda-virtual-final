import React from 'react';

export default function BillingField({
  label,
  children,
  className = '',
}) {
  return (
    <label className={`block ${className}`}>
      <span
        className="mb-1 block text-sm font-medium"
        style={{ color: 'var(--admin-card-muted-text)' }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
