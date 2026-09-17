import React, { useId } from "react";

/**
 * Emblema exclusivo del acceso administrativo de Rosa Boutique.
 * No depende de una librería de iconos: la rosa, el diamante y el monograma
 * forman una sola firma visual que puede reutilizarse en el login y su preview.
 */
export default function RosaCoutureMark({
  size = 96,
  className = "",
  title = "Emblema Rosa Boutique",
}) {
  const rawId = useId();
  const gradientId = `rosa-couture-${rawId.replace(/:/g, "")}`;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id={gradientId} x1="18" y1="14" x2="102" y2="108" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--rb-mark-champagne, #f4d59a)" />
          <stop offset="0.42" stopColor="var(--rb-mark-rose, #e46b91)" />
          <stop offset="1" stopColor="var(--rb-mark-wine, #721b3d)" />
        </linearGradient>
      </defs>

      <path
        d="M60 8C68 20 70 31 60 42C50 31 52 20 60 8Z"
        fill={`url(#${gradientId})`}
      />
      <path
        d="M94.8 23.4C93.8 37.8 88.4 47.6 74 50.1C73.3 35.5 81.4 27.3 94.8 23.4Z"
        fill={`url(#${gradientId})`}
        opacity="0.88"
      />
      <path
        d="M110.7 58.5C99.4 67.5 88.5 69.9 78.1 59.6C88.9 49.7 100.4 51 110.7 58.5Z"
        fill={`url(#${gradientId})`}
        opacity="0.78"
      />
      <path
        d="M94.8 96.5C81.3 92.5 73.2 84.4 74 69.8C88.4 72.4 93.8 82.2 94.8 96.5Z"
        fill={`url(#${gradientId})`}
        opacity="0.68"
      />
      <path
        d="M60 112C52 100 50 89 60 78C70 89 68 100 60 112Z"
        fill={`url(#${gradientId})`}
        opacity="0.58"
      />
      <path
        d="M25.2 96.5C26.2 82.2 31.6 72.4 46 69.8C46.8 84.4 38.7 92.5 25.2 96.5Z"
        fill={`url(#${gradientId})`}
        opacity="0.68"
      />
      <path
        d="M9.3 58.5C19.6 51 31.1 49.7 41.9 59.6C31.5 69.9 20.6 67.5 9.3 58.5Z"
        fill={`url(#${gradientId})`}
        opacity="0.78"
      />
      <path
        d="M25.2 23.4C38.6 27.3 46.7 35.5 46 50.1C31.6 47.6 26.2 37.8 25.2 23.4Z"
        fill={`url(#${gradientId})`}
        opacity="0.88"
      />

      <circle cx="60" cy="60" r="25.5" fill="rgba(255, 248, 243, .78)" />
      <circle cx="60" cy="60" r="23.5" stroke={`url(#${gradientId})`} strokeWidth="1.25" />
      <path d="M60 42L78 60L60 78L42 60L60 42Z" fill={`url(#${gradientId})`} opacity="0.13" />
      <path d="M60 47L73 60L60 73L47 60L60 47Z" stroke={`url(#${gradientId})`} strokeWidth="1" />
      <text
        x="60"
        y="66"
        textAnchor="middle"
        fill={`url(#${gradientId})`}
        fontFamily="Cormorant Garamond, Georgia, serif"
        fontSize="17"
        fontWeight="700"
        letterSpacing="-1"
      >
        RB
      </text>
    </svg>
  );
}
