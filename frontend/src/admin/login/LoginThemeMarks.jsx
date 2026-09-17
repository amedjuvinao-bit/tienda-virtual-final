import React from "react";

export function NoirGalleryMark({ size = 96, className = "", title = "Emblema Noir Gallery" }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 120 120" fill="none" role="img" aria-label={title}>
      <circle cx="60" cy="60" r="43" stroke="currentColor" strokeWidth="1" opacity=".55" />
      <path d="M35 91V47C35 28 48 16 60 16C72 16 85 28 85 47V91" stroke="currentColor" strokeWidth="2" />
      <path d="M44 91V52C44 39 51 31 60 31C69 31 76 39 76 52V91" stroke="currentColor" strokeWidth="1" opacity=".65" />
      <path d="M25 91H95M31 100H89" stroke="currentColor" strokeWidth="2" />
      <path d="M60 43L69 58L60 73L51 58L60 43Z" fill="currentColor" opacity=".17" />
      <circle cx="60" cy="58" r="4" fill="currentColor" />
    </svg>
  );
}

export function AuroraOrbitMark({ size = 96, className = "", title = "Emblema Aurora Motion" }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 120 120" fill="none" role="img" aria-label={title}>
      <circle cx="60" cy="60" r="15" fill="currentColor" opacity=".2" />
      <circle cx="60" cy="60" r="7" fill="currentColor" />
      <ellipse cx="60" cy="60" rx="47" ry="20" stroke="currentColor" strokeWidth="1.4" />
      <ellipse cx="60" cy="60" rx="47" ry="20" stroke="currentColor" strokeWidth="1.4" transform="rotate(60 60 60)" opacity=".72" />
      <ellipse cx="60" cy="60" rx="47" ry="20" stroke="currentColor" strokeWidth="1.4" transform="rotate(120 60 60)" opacity=".45" />
      <circle cx="105" cy="55" r="4" fill="currentColor" />
      <circle cx="34" cy="20" r="3" fill="currentColor" opacity=".75" />
      <circle cx="33" cy="98" r="2.5" fill="currentColor" opacity=".55" />
    </svg>
  );
}

export function PaperStudioMark({ size = 96, className = "", title = "Emblema Paper Studio" }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 120 120" fill="none" role="img" aria-label={title}>
      <rect x="13" y="13" width="59" height="59" fill="currentColor" />
      <circle cx="81" cy="39" r="26" fill="var(--login-secondary, #f04d2f)" />
      <path d="M19 101L60 48L101 101H19Z" fill="var(--login-accent, #f4dd52)" stroke="var(--login-ink, #151515)" strokeWidth="2" />
      <rect x="45" y="45" width="28" height="28" fill="var(--login-surface, #f7f0de)" stroke="var(--login-ink, #151515)" strokeWidth="2" />
    </svg>
  );
}
