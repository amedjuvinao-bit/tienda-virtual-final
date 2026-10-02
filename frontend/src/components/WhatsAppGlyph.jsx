import React from "react";

export default function WhatsAppGlyph({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M32 7C18.2 7 7 18 7 31.5c0 4.9 1.5 9.5 4.2 13.3L8 57l12.7-3.4A25.5 25.5 0 0 0 32 56c13.8 0 25-11 25-24.5S45.8 7 32 7Z" stroke="currentColor" strokeWidth="4.2" strokeLinejoin="round" />
      <path d="M23.6 19.5c-1.2 0-2.2.6-2.9 1.8-1.1 1.8-1.6 4.1-1 6.7 1.3 6.2 8.3 13.8 14.5 16.2 2.5 1 5.6 1 7.7-.1 1.7-.9 2.9-2.8 3.1-4.3.1-.6-.2-1-.7-1.3l-6-2.8c-.6-.3-1.1-.2-1.5.3l-2.8 3.4a20.7 20.7 0 0 1-9.1-8.9l3.2-2.9c.4-.4.6-1 .3-1.5l-2.8-6.3c-.3-.6-.8-.9-1.4-.9Z" fill="currentColor" />
    </svg>
  );
}
