import React from 'react';
import { NavLink } from 'react-router-dom';

export function MessageBox({ children, tone = 'error' }) {
  const isError = tone === 'error';

  return (
    <div
      className="rounded-[22px] border px-4 py-3 text-sm font-bold"
      style={{
        borderColor: isError ? 'rgba(244, 63, 94, 0.36)' : 'rgba(16, 185, 129, 0.36)',
        background: isError ? 'rgba(244, 63, 94, 0.1)' : 'rgba(16, 185, 129, 0.1)',
        color: isError ? '#be123c' : '#047857',
      }}
    >
      {children}
    </div>
  );
}

export function BillingMetricCard({
  label,
  value,
  helper,
  icon: Icon,
  featured = false,
  className = '',
}) {
  return (
    <article
      className={`relative min-w-0 overflow-hidden rounded-[26px] border p-5 shadow-sm ${className}`}
      style={{
        background: featured
          ? 'linear-gradient(135deg, var(--admin-active-nav-bg), var(--admin-card-bg) 72%)'
          : 'var(--admin-card-bg)',
        borderColor: featured ? 'var(--admin-accent, #ec4899)' : 'var(--admin-card-border)',
        color: 'var(--admin-card-text)',
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: featured ? 'var(--admin-accent, #ec4899)' : 'var(--admin-card-border)' }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-card-muted-text)' }}>
            {label}
          </p>
          <p className={`${featured ? 'text-3xl' : 'text-2xl'} mt-2 break-words font-black leading-tight [overflow-wrap:anywhere]`}>{value}</p>
          <p className="mt-2 break-words text-xs font-semibold leading-5" style={{ color: 'var(--admin-card-muted-text)' }}>
            {helper}
          </p>
        </div>
        <span
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border"
          style={{
            borderColor: featured ? 'var(--admin-accent, #ec4899)' : 'var(--admin-card-border)',
            background: featured ? 'var(--admin-card-bg)' : 'var(--admin-soft-bg)',
          }}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </article>
  );
}

export function EmptyWorkBlock({ title, text, icon: Icon }) {
  return (
    <section
      className="rounded-[28px] border p-6 text-center shadow-sm"
      style={{
        background: 'var(--admin-card-bg)',
        borderColor: 'var(--admin-card-border)',
        color: 'var(--admin-card-text)',
      }}
    >
      <span
        className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-3xl border"
        style={{
          borderColor: 'var(--admin-card-border)',
          background: 'var(--admin-soft-bg)',
        }}
      >
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="mt-4 text-xl font-black">{title}</h3>
      <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-6" style={{ color: 'var(--admin-card-muted-text)' }}>
        {text}
      </p>
    </section>
  );
}

export function ActionButton({
  children,
  icon: Icon,
  disabled,
  onClick,
  variant = 'soft',
  className = '',
}) {
  const isPrimary = variant === 'primary';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-55 ${className}`}
      style={{
        borderColor: isPrimary ? 'var(--admin-accent, #ec4899)' : 'var(--admin-card-border)',
        background: isPrimary ? 'var(--admin-accent, #ec4899)' : 'var(--admin-soft-bg)',
        color: isPrimary ? '#fff' : 'var(--admin-card-text)',
      }}
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export function DocumentActionButton({
  children,
  icon: Icon,
  disabled,
  onClick,
  variant = 'soft',
  className = '',
}) {
  const isPrimary = variant === 'primary';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 w-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border px-2 text-[11px] font-black transition hover:-translate-y-px hover:shadow-sm disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      style={{
        borderColor: isPrimary ? 'var(--admin-accent, #ec4899)' : 'var(--admin-card-border)',
        background: isPrimary ? 'var(--admin-accent, #ec4899)' : 'var(--admin-soft-bg)',
        color: isPrimary ? '#fff' : 'var(--admin-card-text)',
      }}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
      <span className="leading-none">{children}</span>
    </button>
  );
}

export function PanelHeader({ eyebrow, title, text, children }) {
  return (
    <div
      className="rounded-[28px] border p-4 shadow-sm"
      style={{
        background: 'var(--admin-card-bg)',
        borderColor: 'var(--admin-card-border)',
        color: 'var(--admin-card-text)',
      }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-accent, #ec4899)' }}>
            {eyebrow}
          </p>
          <h3 className="mt-1 text-2xl font-black">{title}</h3>
          <p className="mt-1 max-w-3xl break-words text-sm font-semibold leading-6" style={{ color: 'var(--admin-card-muted-text)' }}>
            {text}
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SummaryPanelCard({ title, eyebrow, children, footer }) {
  return (
    <section
      className="rounded-[28px] border p-4 shadow-sm"
      style={{
        background: 'var(--admin-card-bg)',
        borderColor: 'var(--admin-card-border)',
        color: 'var(--admin-card-text)',
      }}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>
        {eyebrow}
      </p>
      <h3 className="mt-1 text-lg font-black">{title}</h3>
      <div className="mt-4">{children}</div>
      {footer ? <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--admin-card-border)' }}>{footer}</div> : null}
    </section>
  );
}

export function SummaryQuickLink({ to, children, icon: Icon }) {
  return (
    <NavLink
      to={to}
      className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2 text-xs font-black transition"
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'var(--admin-soft-bg)',
        color: 'var(--admin-card-text)',
      }}
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </NavLink>
  );
}
