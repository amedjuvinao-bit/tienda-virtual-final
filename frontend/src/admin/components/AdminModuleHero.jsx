import React from 'react';

export default function AdminModuleHero({
  icon: Icon,
  eyebrow,
  title,
  description,
  actions = null,
  children = null,
  className = '',
}) {
  return (
    <header className={`admin-module-hero ${className}`.trim()}>
      {Icon ? <Icon className="admin-module-hero__watermark" aria-hidden="true" /> : null}

      <div className="admin-module-hero__top">
        <div className="admin-module-hero__copy">
          {eyebrow ? <p className="admin-module-hero__eyebrow">{eyebrow}</p> : null}
          <h1>{title}</h1>
          {description ? <p className="admin-module-hero__description">{description}</p> : null}
        </div>

        {actions ? <div className="admin-module-hero__actions">{actions}</div> : null}
      </div>

      {children ? <div className="admin-module-hero__content">{children}</div> : null}
    </header>
  );
}
