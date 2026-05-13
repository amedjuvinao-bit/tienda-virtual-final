import React from 'react';

export default function InfoCard({
  title,
  description,
  children,
  variant = 'default',
}) {
  const isHero = variant === 'hero';
  const isFlat = variant === 'flat';

  return (
    <div
      className={`border backdrop-blur-xl ${
        isHero ? 'admin-info-card-hero' : ''
      } ${isFlat ? 'admin-info-card-flat' : ''}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: isHero
          ? 'linear-gradient(135deg, var(--admin-glass-strong-bg), var(--admin-glass-soft-bg))'
          : isFlat
            ? 'var(--admin-glass-soft-bg)'
            : 'var(--admin-card-bg)',
        borderColor: isHero
          ? 'var(--admin-glass-border)'
          : 'var(--admin-card-border)',
        borderRadius: isHero
          ? 'calc(var(--admin-radius) * 1.35)'
          : 'var(--admin-radius)',
        padding: isHero
          ? 'calc(var(--admin-padding) * 1.55)'
          : 'calc(var(--admin-padding) * 1.25)',
        boxShadow: isHero
          ? 'var(--admin-glass-shadow-hover, 0 26px 70px rgba(15, 23, 42, 0.14))'
          : isFlat
            ? 'none'
            : 'var(--admin-shadow-content, 0 16px 45px rgba(15, 23, 42, 0.06))',
      }}
    >
      {isHero && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background:
                'radial-gradient(circle at 12% 8%, var(--admin-glass-highlight), transparent 34%), radial-gradient(circle at 90% 12%, color-mix(in srgb, var(--admin-primary) 22%, transparent), transparent 32%)',
              opacity: 0.9,
            }}
          />

          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '8%',
              right: '8%',
              height: '1px',
              background:
                'linear-gradient(90deg, transparent, var(--admin-glass-highlight), transparent)',
              opacity: 0.9,
            }}
          />
        </>
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>
        <h3
          className="text-base font-semibold md:text-lg"
          style={{
            color: 'var(--admin-card-text)',
            letterSpacing: isHero ? '-0.025em' : undefined,
          }}
        >
          {title}
        </h3>

        {description && (
          <p
            style={{
              marginTop: 'calc(var(--admin-gap) * 0.25)',
              color: 'var(--admin-card-muted-text)',
              fontSize: isHero ? '15px' : '14px',
              lineHeight: '1.65',
              maxWidth: isHero ? '780px' : undefined,
            }}
          >
            {description}
          </p>
        )}

        <div style={{ marginTop: 'var(--admin-gap)' }}>{children}</div>
      </div>
    </div>
  );
}