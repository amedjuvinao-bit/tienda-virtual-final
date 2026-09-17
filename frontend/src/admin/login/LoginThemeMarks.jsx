import React from "react";

function Svg({ children, size, className, title, viewBox = "0 0 120 120" }) {
  return <svg className={className} width={size} height={size} viewBox={viewBox} fill="none" role="img" aria-label={title}>{children}</svg>;
}

export function OrbitCommerceMark({ size = 96, className = "", title = "Emblema Órbita 3D" }) {
  return <Svg size={size} className={className} title={title}>
    <circle cx="60" cy="60" r="13" fill="currentColor" />
    <ellipse cx="60" cy="60" rx="49" ry="21" stroke="currentColor" strokeWidth="2" />
    <ellipse cx="60" cy="60" rx="49" ry="21" stroke="currentColor" strokeWidth="1.5" transform="rotate(61 60 60)" opacity=".68" />
    <ellipse cx="60" cy="60" rx="49" ry="21" stroke="currentColor" strokeWidth="1" transform="rotate(122 60 60)" opacity=".38" />
    <circle cx="105" cy="52" r="5" fill="var(--login-secondary)" stroke="currentColor" />
    <circle cx="26" cy="31" r="3" fill="currentColor" opacity=".7" />
  </Svg>;
}

export function LiquidGlassMark({ size = 96, className = "", title = "Emblema Cristal Líquido" }) {
  return <Svg size={size} className={className} title={title}>
    <defs><linearGradient id="liquid" x1="20" y1="15" x2="100" y2="105"><stop stopColor="currentColor"/><stop offset="1" stopColor="var(--login-secondary)"/></linearGradient></defs>
    <path d="M76 13c19 7 33 27 28 48-5 22-24 44-47 45-22 1-43-18-43-40 0-21 15-36 31-47 10-7 20-10 31-6Z" fill="url(#liquid)" opacity=".8" />
    <path d="M74 31c12 6 19 19 14 31-6 15-19 26-34 23-13-3-21-17-17-30 5-17 23-31 37-24Z" fill="var(--login-surface)" opacity=".42" />
    <circle cx="42" cy="35" r="8" fill="white" opacity=".58" />
  </Svg>;
}

export function NeonPortalMark({ size = 96, className = "", title = "Emblema Portal Neón" }) {
  return <Svg size={size} className={className} title={title}>
    <path d="M27 103V55c0-27 15-43 33-43s33 16 33 43v48" stroke="currentColor" strokeWidth="4" />
    <path d="M38 103V57c0-19 9-31 22-31s22 12 22 31v46" stroke="var(--login-secondary)" strokeWidth="3" opacity=".9" />
    <path d="M49 103V61c0-12 4-20 11-20s11 8 11 20v42" stroke="var(--login-surface)" strokeWidth="2" opacity=".72" />
    <path d="M17 103h86" stroke="currentColor" strokeWidth="2" />
  </Svg>;
}

export function EditorialMotionMark({ size = 96, className = "", title = "Emblema Editorial Motion" }) {
  return <Svg size={size} className={className} title={title}>
    <rect x="12" y="12" width="62" height="62" fill="currentColor" />
    <circle cx="83" cy="39" r="26" fill="var(--login-secondary)" />
    <path d="M17 105 60 49l43 56H17Z" fill="var(--login-accent)" stroke="var(--login-primary)" strokeWidth="2" />
    <rect x="45" y="45" width="29" height="29" fill="var(--login-surface)" stroke="var(--login-primary)" strokeWidth="2" />
  </Svg>;
}

export function ArchitectMark({ size = 96, className = "", title = "Emblema Arquitectura Mono" }) {
  return <Svg size={size} className={className} title={title}>
    <path d="M15 100V45h28V20h30v35h32v45H15Z" stroke="currentColor" strokeWidth="3" />
    <path d="M43 45h30M43 71h62M73 55v45" stroke="currentColor" strokeWidth="2" opacity=".56" />
    <rect x="24" y="55" width="10" height="10" fill="var(--login-accent)" />
    <rect x="82" y="81" width="13" height="19" fill="var(--login-secondary)" />
  </Svg>;
}
