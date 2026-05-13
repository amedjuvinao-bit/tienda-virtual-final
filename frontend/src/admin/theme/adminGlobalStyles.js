// src/admin/theme/adminGlobalStyles.js

export function applyAdminGlobalStyles() {
  const STYLE_ID = 'admin-global-glass-styles';
  const old = document.getElementById(STYLE_ID);
  if (old) old.remove();

  const style = document.createElement('style');
  style.id = STYLE_ID;

  style.innerHTML = `

    /* ============================================================
       LAYER 0 — SHELL & PAGE BACKGROUND
       ============================================================ */

    .admin-layout-shell {
      position: relative;
      z-index: 1;
    }

    .admin-area {
      background: var(--admin-page-glass-overlay) !important;
      color: var(--admin-page-text) !important;
    }

    /* Fixed frosted-glass wash behind all content */
    .admin-area::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 0;
      background:
        var(--admin-glass-overlay),
        linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02));
      opacity: 0.88;
      backdrop-filter: blur(var(--admin-page-glass-blur)) saturate(1.18);
      -webkit-backdrop-filter: blur(var(--admin-page-glass-blur)) saturate(1.18);
    }

    html.admin-theme-dark .admin-area::before {
      background:
        var(--admin-glass-overlay),
        linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01));
      opacity: 0.84;
    }

    /* Ambient radial glows */
    .admin-area::after {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 0;
      background:
        radial-gradient(circle at 12% 18%, color-mix(in srgb, var(--admin-primary) 16%, transparent), transparent 24%),
        radial-gradient(circle at 88% 12%, color-mix(in srgb, var(--admin-card-bg) 22%, transparent), transparent 30%),
        radial-gradient(circle at 80% 88%, color-mix(in srgb, var(--admin-primary) 12%, transparent), transparent 32%);
      opacity: 0.50;
      filter: blur(12px);
    }

    html.admin-theme-dark .admin-area::after {
      opacity: 0.42;
      filter: blur(16px);
    }


    /* ============================================================
       LAYER 1 — BASE GLASS MIXIN
       Applied to sidebar, header, cards and the 3 new containers.
       ============================================================ */

    .admin-sidebar-glass,
    .admin-header-glass,
    .admin-card-glass,
    .admin-glass-card,
    .admin-hero-glass,
    .admin-section-bar,
    .admin-form-glass {
      background: var(--admin-glass-bg) !important;
      border-color: var(--admin-glass-border) !important;
      color: var(--admin-card-text) !important;
      box-shadow: var(--admin-glass-shadow) !important;
      backdrop-filter: blur(var(--admin-glass-blur)) saturate(var(--admin-glass-saturation)) !important;
      -webkit-backdrop-filter: blur(var(--admin-glass-blur)) saturate(var(--admin-glass-saturation)) !important;
      position: relative;
      overflow: hidden;
      transition:
        transform 180ms ease,
        box-shadow 220ms ease,
        border-color 220ms ease,
        background 220ms ease,
        color 180ms ease !important;
    }

    /* Top-edge reflection line on every glass surface */
    .admin-sidebar-glass::before,
    .admin-header-glass::before,
    .admin-card-glass::before,
    .admin-glass-card::before,
    .admin-hero-glass::before,
    .admin-section-bar::before,
    .admin-form-glass::before {
      content: "";
      position: absolute;
      inset: 0 0 auto 0;
      height: 1px;
      pointer-events: none;
      background: linear-gradient(
        90deg,
        transparent,
        var(--admin-glass-highlight),
        transparent
      );
      opacity: 0.78;
    }

    /* Hover lift — only on interactive cards */
    .admin-card-glass:hover,
    .admin-glass-card:hover {
      transform: translateY(-1px);
      border-color: color-mix(in srgb, var(--admin-primary) 46%, var(--admin-card-border)) !important;
      box-shadow: var(--admin-glass-shadow-hover) !important;
    }

    html.admin-theme-dark .admin-sidebar-glass,
    html.admin-theme-dark .admin-header-glass,
    html.admin-theme-dark .admin-card-glass,
    html.admin-theme-dark .admin-glass-card,
    html.admin-theme-dark .admin-hero-glass,
    html.admin-theme-dark .admin-section-bar,
    html.admin-theme-dark .admin-form-glass {
      background: var(--admin-glass-bg) !important;
      border-color: var(--admin-glass-border) !important;
      color: var(--admin-card-text) !important;
      box-shadow: var(--admin-glass-shadow) !important;
    }

    html.admin-theme-dark .admin-card-glass:hover,
    html.admin-theme-dark .admin-glass-card:hover {
      box-shadow: var(--admin-glass-shadow-hover) !important;
    }


    /* ============================================================
       LAYER 2 — THE 3 NEW GLASSMORPHISM CONTAINERS
       Each one overrides only the properties that differ from the
       base mixin above. All colors still come from theme variables.
       ============================================================ */

    /* ── Container 1: Hero ──────────────────────────────────────
       Full-width banner: breadcrumb + title/description on the
       left, active-section badge on the right.
       Usage: <div class="admin-hero-glass"> */

    .admin-hero-glass {
      border-radius: 20px;
      display: flex;
      align-items: stretch;
      background: color-mix(in srgb, var(--admin-glass-bg) 90%, transparent) !important;
      backdrop-filter: blur(30px) saturate(var(--admin-glass-saturation)) !important;
      -webkit-backdrop-filter: blur(30px) saturate(var(--admin-glass-saturation)) !important;
      box-shadow:
        0 8px 32px color-mix(in srgb, var(--admin-primary) 10%, transparent),
        inset 0 1px 0 var(--admin-glass-highlight) !important;
    }

    .admin-hero-glass .admin-hero-body {
      flex: 1;
      padding: 20px 24px;
      border-right: 1px solid var(--admin-glass-border);
    }

    .admin-hero-glass .admin-hero-breadcrumb {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
      font-size: 11px;
      color: var(--admin-card-muted-text);
    }

    .admin-hero-glass .admin-hero-breadcrumb .admin-crumb-active {
      background: color-mix(in srgb, var(--admin-primary) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--admin-primary) 28%, transparent);
      border-radius: 20px;
      padding: 2px 9px;
      font-weight: 600;
      color: var(--admin-primary);
    }

    .admin-hero-glass .admin-hero-body h2 {
      font-size: 17px;
      font-weight: 700;
      color: var(--admin-card-text) !important;
      margin-bottom: 5px;
      line-height: 1.25;
    }

    .admin-hero-glass .admin-hero-body p {
      font-size: 12px;
      color: var(--admin-card-muted-text);
      line-height: 1.5;
    }

    .admin-hero-glass .admin-hero-badge {
      width: 148px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 20px 14px;
      background: color-mix(in srgb, var(--admin-glass-bg) 60%, transparent);
    }

    .admin-hero-glass .admin-hero-badge-icon {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--admin-primary) 80%, white 20%),
        var(--admin-primary)
      );
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow:
        0 4px 16px color-mix(in srgb, var(--admin-primary) 40%, transparent),
        inset 0 1px 0 rgba(255,255,255,0.28);
    }

    .admin-hero-glass .admin-hero-badge-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--admin-card-muted-text);
    }

    .admin-hero-glass .admin-hero-badge-value {
      font-size: 13px;
      font-weight: 600;
      color: var(--admin-primary);
      text-align: center;
    }


    /* ── Container 2: Section Bar ───────────────────────────────
       Slim grouping header between hero and form.
       Usage: <div class="admin-section-bar"> */

    .admin-section-bar {
      border-radius: 14px;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 18px;
      background: color-mix(in srgb, var(--admin-glass-bg) 55%, transparent) !important;
      backdrop-filter: blur(20px) saturate(var(--admin-glass-saturation)) !important;
      -webkit-backdrop-filter: blur(20px) saturate(var(--admin-glass-saturation)) !important;
      box-shadow:
        inset 0 1px 0 var(--admin-glass-highlight),
        0 4px 14px color-mix(in srgb, var(--admin-primary) 6%, transparent) !important;
    }

    .admin-section-bar .admin-section-pill {
      width: 4px;
      height: 36px;
      border-radius: 4px;
      flex-shrink: 0;
      background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--admin-primary) 70%, white 30%),
        var(--admin-primary)
      );
      box-shadow: 0 2px 8px color-mix(in srgb, var(--admin-primary) 45%, transparent);
    }

    .admin-section-bar .admin-section-text h3 {
      font-size: 14px;
      font-weight: 600;
      color: var(--admin-card-text) !important;
    }

    .admin-section-bar .admin-section-text p {
      font-size: 11px;
      color: var(--admin-card-muted-text);
      margin-top: 2px;
    }

    .admin-section-bar .admin-section-chip {
      margin-left: auto;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 600;
      white-space: nowrap;
      background: color-mix(in srgb, var(--admin-primary) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--admin-primary) 28%, transparent);
      color: var(--admin-primary);
      backdrop-filter: blur(8px);
    }


    /* ── Container 3: Form Glass ────────────────────────────────
       Main settings form with header, body, and footer zones.
       Usage: <div class="admin-form-glass"> */

    .admin-form-glass {
      border-radius: 20px;
      background: color-mix(in srgb, var(--admin-glass-bg) 75%, transparent) !important;
      backdrop-filter: blur(28px) saturate(var(--admin-glass-saturation)) !important;
      -webkit-backdrop-filter: blur(28px) saturate(var(--admin-glass-saturation)) !important;
      box-shadow:
        0 12px 40px color-mix(in srgb, var(--admin-primary) 8%, transparent),
        inset 0 1px 0 var(--admin-glass-highlight) !important;
    }

    .admin-form-glass .admin-form-header {
      padding: 18px 22px 16px;
      border-bottom: 1px solid var(--admin-glass-border);
    }

    .admin-form-glass .admin-form-header h3 {
      font-size: 14px;
      font-weight: 600;
      color: var(--admin-card-text) !important;
      margin-bottom: 3px;
    }

    .admin-form-glass .admin-form-header p {
      font-size: 11px;
      color: var(--admin-card-muted-text);
      line-height: 1.5;
    }

    .admin-form-glass .admin-form-body {
      padding: 18px 22px;
    }

    .admin-form-glass .admin-form-info {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      background: color-mix(in srgb, var(--admin-primary) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--admin-primary) 18%, transparent);
      border-radius: 12px;
      padding: 11px 14px;
      margin-bottom: 16px;
    }

    .admin-form-glass .admin-form-info p {
      font-size: 11px;
      color: var(--admin-card-muted-text);
      line-height: 1.55;
    }

    .admin-form-glass .admin-form-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 14px 22px;
      background: color-mix(in srgb, var(--admin-glass-bg) 40%, transparent);
      border-top: 1px solid var(--admin-glass-border);
    }

    html.admin-theme-dark .admin-form-glass .admin-form-header,
    html.admin-theme-dark .admin-form-glass .admin-form-footer {
      border-color: color-mix(in srgb, var(--admin-primary) 22%, rgba(255,255,255,0.06));
    }


    /* ============================================================
       LAYER 3 — TYPOGRAPHY INHERITING THEME COLORS
       ============================================================ */

    .admin-area h1,
    .admin-area h2,
    .admin-area h3,
    .admin-area h4,
    .admin-area h5,
    .admin-area h6 {
      color: var(--admin-card-text) !important;
    }

    .admin-area p,
    .admin-area label,
    .admin-area small {
      color: inherit;
    }

    .admin-area span:not([class*="bg-"]):not([class*="text-"]) {
      color: inherit;
    }

    /* Muted text classes → theme muted token */
    .admin-area .text-gray-400,  .admin-area .text-gray-500,  .admin-area .text-gray-600,
    .admin-area .text-slate-400, .admin-area .text-slate-500, .admin-area .text-slate-600,
    .admin-area .text-zinc-400,  .admin-area .text-zinc-500,  .admin-area .text-zinc-600,
    .admin-area .text-neutral-400,.admin-area .text-neutral-500,.admin-area .text-neutral-600,
    .admin-area .text-stone-400, .admin-area .text-stone-500, .admin-area .text-stone-600,
    .admin-area td .text-gray-400,.admin-area td .text-gray-500,.admin-area td .text-gray-600,
    .admin-area td .text-slate-400,.admin-area td .text-slate-500,.admin-area td .text-slate-600 {
      color: var(--admin-card-muted-text) !important;
    }

    /* Dark-mode: dark text classes → card text token */
    html.admin-theme-dark .admin-area .text-gray-700,   html.admin-theme-dark .admin-area .text-gray-800,
    html.admin-theme-dark .admin-area .text-gray-900,   html.admin-theme-dark .admin-area .text-slate-700,
    html.admin-theme-dark .admin-area .text-slate-800,  html.admin-theme-dark .admin-area .text-slate-900,
    html.admin-theme-dark .admin-area .text-zinc-700,   html.admin-theme-dark .admin-area .text-zinc-800,
    html.admin-theme-dark .admin-area .text-zinc-900,   html.admin-theme-dark .admin-area .text-neutral-700,
    html.admin-theme-dark .admin-area .text-neutral-800,html.admin-theme-dark .admin-area .text-neutral-900,
    html.admin-theme-dark .admin-area .text-stone-700,  html.admin-theme-dark .admin-area .text-stone-800,
    html.admin-theme-dark .admin-area .text-stone-900,  html.admin-theme-dark .admin-area .text-black,
    html.admin-theme-dark .admin-area .text-pink-900,   html.admin-theme-dark .admin-area .text-rose-900,
    html.admin-theme-dark .admin-area .text-fuchsia-900,html.admin-theme-dark .admin-area .text-purple-900,
    html.admin-theme-dark .admin-area .text-blue-900,   html.admin-theme-dark .admin-area .text-cyan-900,
    html.admin-theme-dark .admin-area .text-amber-900,  html.admin-theme-dark .admin-area .text-yellow-900,
    html.admin-theme-dark .admin-area .text-orange-900, html.admin-theme-dark .admin-area .text-green-900,
    html.admin-theme-dark .admin-area .text-emerald-900,html.admin-theme-dark .admin-area .text-red-900 {
      color: var(--admin-card-text) !important;
    }

    /* Dark-mode: mid-range colored text → primary token */
    html.admin-theme-dark .admin-area .text-pink-700,   html.admin-theme-dark .admin-area .text-rose-700,
    html.admin-theme-dark .admin-area .text-fuchsia-700,html.admin-theme-dark .admin-area .text-purple-700,
    html.admin-theme-dark .admin-area .text-blue-700,   html.admin-theme-dark .admin-area .text-cyan-700,
    html.admin-theme-dark .admin-area .text-amber-700,  html.admin-theme-dark .admin-area .text-yellow-700,
    html.admin-theme-dark .admin-area .text-orange-700, html.admin-theme-dark .admin-area .text-green-700,
    html.admin-theme-dark .admin-area .text-emerald-700,html.admin-theme-dark .admin-area .text-red-700 {
      color: var(--admin-primary) !important;
    }

    html.admin-theme-dark .admin-area .text-white { color: #ffffff !important; }

    .admin-area .admin-icon-wrap { color: var(--admin-primary); }


    /* ============================================================
       LAYER 4 — BUTTONS
       ============================================================ */

    .admin-area button {
      transition:
        transform 160ms ease,
        box-shadow 180ms ease,
        border-color 180ms ease,
        background 180ms ease,
        color 160ms ease,
        filter 160ms ease !important;
      will-change: transform;
    }

    /* Primary colored buttons */
    .admin-area .admin-btn-primary,
    .admin-area button.bg-pink-500,   .admin-area button.bg-pink-600,
    .admin-area button.bg-rose-500,   .admin-area button.bg-rose-600,
    .admin-area button.bg-blue-500,   .admin-area button.bg-blue-600,
    .admin-area button.bg-amber-500,  .admin-area button.bg-amber-600,
    .admin-area button.bg-green-500,  .admin-area button.bg-green-600,
    .admin-area button.bg-emerald-500,.admin-area button.bg-emerald-600,
    .admin-area button.bg-cyan-500,   .admin-area button.bg-cyan-600,
    .admin-area button.bg-indigo-500, .admin-area button.bg-indigo-600,
    .admin-area button.bg-purple-500, .admin-area button.bg-purple-600 {
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--admin-primary) 94%, white 6%),
        color-mix(in srgb, var(--admin-primary-hover) 84%, var(--admin-primary) 16%)
      ) !important;
      color: var(--admin-button-text) !important;
      border-color: color-mix(in srgb, var(--admin-primary) 72%, rgba(255,255,255,0.34)) !important;
      box-shadow:
        0 10px 24px color-mix(in srgb, var(--admin-primary) 22%, transparent),
        inset 0 1px 0 rgba(255,255,255,0.30) !important;
      backdrop-filter: blur(16px) saturate(1.35);
      -webkit-backdrop-filter: blur(16px) saturate(1.35);
    }

    /* Danger buttons */
    .admin-area button.bg-red-500,
    .admin-area button.bg-red-600,
    .admin-area button[class*="bg-red-5"],
    .admin-area button[class*="bg-red-6"] {
      background: var(--admin-danger) !important;
      color: var(--admin-danger-text-on-bg) !important;
      border-color: var(--admin-danger) !important;
    }

    /* Soft gray/neutral buttons */
    .admin-area button[class*="bg-gray-"],    .admin-area button[class*="bg-slate-"],
    .admin-area button[class*="bg-zinc-"],    .admin-area button[class*="bg-neutral-"],
    .admin-area button[class*="bg-stone-"] {
      background: var(--admin-button-soft-bg) !important;
      color: var(--admin-button-soft-text) !important;
      border: 1px solid var(--admin-button-soft-border) !important;
      box-shadow:
        0 8px 20px color-mix(in srgb, var(--admin-primary) 8%, transparent),
        inset 0 1px 0 rgba(255,255,255,0.28) !important;
      backdrop-filter: blur(14px) saturate(1.22);
      -webkit-backdrop-filter: blur(14px) saturate(1.22);
    }

    html.admin-theme-dark .admin-area button[class*="bg-gray-"],
    html.admin-theme-dark .admin-area button[class*="bg-slate-"],
    html.admin-theme-dark .admin-area button[class*="bg-zinc-"],
    html.admin-theme-dark .admin-area button[class*="bg-neutral-"],
    html.admin-theme-dark .admin-area button[class*="bg-stone-"] {
      background: color-mix(in srgb, var(--admin-card-bg) 82%, var(--admin-primary) 18%) !important;
      color: var(--admin-card-text) !important;
      border: 1px solid color-mix(in srgb, var(--admin-primary) 44%, rgba(255,255,255,0.16)) !important;
    }

    /* Ghost glass buttons (no bg class) */
    .admin-area button:not(.no-glass):not([class*="bg-"]):not([style*="background"]):not([style*="background-color"]) {
      color: var(--admin-button-glass-text) !important;
      border-color: var(--admin-button-glass-border) !important;
      background: var(--admin-button-glass-bg) !important;
      box-shadow:
        inset 0 1px 0 var(--admin-glass-highlight),
        0 10px 24px color-mix(in srgb, var(--admin-primary) 14%, transparent) !important;
      backdrop-filter: blur(18px) saturate(1.5);
      -webkit-backdrop-filter: blur(18px) saturate(1.5);
    }

    /* Inline-styled buttons (preserve their custom color) */
    .admin-area button[style*="backgroundColor"],
    .admin-area button[style*="background-color"],
    .admin-area button[style*="background:"] {
      color: var(--admin-button-text) !important;
    }

    /* Disabled state */
    .admin-area button:disabled,
    .admin-area button[disabled],
    .admin-area button.disabled,
    .admin-area button[aria-disabled="true"] {
      opacity: 1 !important;
      cursor: not-allowed !important;
      color: var(--admin-disabled-text) !important;
      background: var(--admin-disabled-bg) !important;
      border: 1px solid var(--admin-disabled-border) !important;
      box-shadow: none !important;
      filter: saturate(0.88) !important;
      transform: none !important;
    }

    /* Hover / active / focus — shared across all enabled buttons */
    .admin-area button:not(:disabled):not([disabled]):not([aria-disabled="true"]):hover {
      transform: translateY(-1px);
      filter: saturate(1.04) brightness(1.02);
    }

    .admin-area button:not(:disabled):not([disabled]):not([aria-disabled="true"]):active {
      transform: translateY(0) scale(0.985);
      filter: saturate(0.98) brightness(0.98);
    }

    .admin-area button:not(:disabled):not([disabled]):not([aria-disabled="true"]):focus-visible {
      outline: none !important;
      box-shadow:
        0 0 0 3px color-mix(in srgb, var(--admin-primary) 24%, transparent),
        0 10px 24px color-mix(in srgb, var(--admin-primary) 16%, transparent) !important;
    }

    .admin-area button:not(.no-glass):not([class*="bg-"]):not([style*="background"]):not([style*="background-color"]):not(:disabled):hover {
      border-color: color-mix(in srgb, var(--admin-primary) 52%, rgba(255,255,255,0.55)) !important;
      box-shadow:
        inset 0 1px 0 var(--admin-glass-highlight),
        0 14px 30px color-mix(in srgb, var(--admin-primary) 20%, transparent) !important;
    }

    .admin-area button[class*="bg-gray-"]:not(:disabled):hover,
    .admin-area button[class*="bg-slate-"]:not(:disabled):hover,
    .admin-area button[class*="bg-zinc-"]:not(:disabled):hover,
    .admin-area button[class*="bg-neutral-"]:not(:disabled):hover,
    .admin-area button[class*="bg-stone-"]:not(:disabled):hover {
      border-color: color-mix(in srgb, var(--admin-primary) 42%, var(--admin-button-soft-border)) !important;
      box-shadow:
        0 12px 26px color-mix(in srgb, var(--admin-primary) 14%, transparent),
        inset 0 1px 0 rgba(255,255,255,0.38) !important;
    }

    .admin-area button[style*="backgroundColor"]:not(:disabled):hover,
    .admin-area button[style*="background-color"]:not(:disabled):hover,
    .admin-area button[style*="background:"]:not(:disabled):hover,
    .admin-area button.bg-red-500:not(:disabled):hover,
    .admin-area button.bg-red-600:not(:disabled):hover {
      box-shadow:
        0 12px 28px color-mix(in srgb, var(--admin-primary) 22%, transparent),
        inset 0 1px 0 rgba(255,255,255,0.24) !important;
    }


    /* ============================================================
       LAYER 5 — INPUTS / SELECTS / TEXTAREAS
       ============================================================ */

    .admin-area input,
    .admin-area select,
    .admin-area textarea {
      color: var(--admin-input-text) !important;
      background: var(--admin-input-bg) !important;
      border-color: var(--admin-input-border) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.12),
        0 8px 22px color-mix(in srgb, var(--admin-primary) 5%, transparent);
      backdrop-filter: blur(12px) saturate(1.16);
      -webkit-backdrop-filter: blur(12px) saturate(1.16);
      transition:
        border-color 180ms ease,
        box-shadow 180ms ease,
        background 180ms ease,
        color 160ms ease,
        transform 160ms ease !important;
    }

    html.admin-theme-dark .admin-area input,
    html.admin-theme-dark .admin-area select,
    html.admin-theme-dark .admin-area textarea {
      color: var(--admin-input-text) !important;
      background: color-mix(in srgb, var(--admin-card-bg) 92%, rgba(255,255,255,0.08)) !important;
      border-color: color-mix(in srgb, var(--admin-primary) 42%, rgba(255,255,255,0.14)) !important;
      caret-color: var(--admin-primary) !important;
    }

    .admin-area input::placeholder,
    .admin-area textarea::placeholder {
      color: var(--admin-input-placeholder) !important;
      opacity: 0.86;
    }

    .admin-area input:hover,
    .admin-area select:hover,
    .admin-area textarea:hover {
      border-color: color-mix(in srgb, var(--admin-primary) 34%, var(--admin-input-border)) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.16),
        0 10px 24px color-mix(in srgb, var(--admin-primary) 8%, transparent);
    }

    .admin-area input:focus,
    .admin-area select:focus,
    .admin-area textarea:focus {
      outline: none;
      border-color: var(--admin-input-focus) !important;
      transform: translateY(-1px);
      box-shadow:
        0 0 0 3px color-mix(in srgb, var(--admin-primary) 20%, transparent),
        0 12px 26px color-mix(in srgb, var(--admin-primary) 12%, transparent),
        inset 0 1px 0 rgba(255,255,255,0.16);
    }

    /* Select option fallback (no styling inside browser native picker) */
    .admin-area select option,
    .admin-area select optgroup,
    html.admin-theme-dark .admin-area select option,
    html.admin-theme-dark .admin-area select optgroup {
      background-color: #ffffff !important;
      color: #111827 !important;
    }

    .admin-area select option:checked,
    html.admin-theme-dark .admin-area select option:checked {
      background-color: var(--admin-primary) !important;
      color: var(--admin-primary-text) !important;
    }

    .admin-area input[type="checkbox"] {
      width: 14px;
      height: 14px;
      border-radius: 4px;
      accent-color: var(--admin-primary);
    }

    html.admin-theme-dark .admin-area input[type="checkbox"],
    html.admin-theme-dark .admin-area input[type="radio"] {
      accent-color: var(--admin-primary);
    }


    /* ============================================================
       LAYER 6 — TABLE
       ============================================================ */

    .admin-area table,
    .admin-area .overflow-x-auto,
    .admin-area .overflow-auto {
      color: var(--admin-table-text) !important;
      border-color: var(--admin-table-border) !important;
      background: var(--admin-widget-glass-bg) !important;
      border-color: var(--admin-widget-glass-border) !important;
      backdrop-filter: blur(20px) saturate(1.28);
      -webkit-backdrop-filter: blur(20px) saturate(1.28);
      border-collapse: separate;
      border-spacing: 0;
      overflow: hidden;
    }

    .admin-area thead,
    .admin-area th {
      background: linear-gradient(
        145deg,
        color-mix(in srgb, var(--admin-card-header-bg) 72%, transparent),
        color-mix(in srgb, var(--admin-primary) 12%, transparent)
      ) !important;
      color: var(--admin-table-head-text) !important;
      border-color: var(--admin-table-border) !important;
    }

    .admin-area tbody tr {
      background: color-mix(in srgb, var(--admin-card-bg) 42%, transparent) !important;
      color: var(--admin-table-text) !important;
      border-color: var(--admin-table-border) !important;
      transition:
        background 160ms ease,
        color 160ms ease,
        border-color 160ms ease,
        box-shadow 160ms ease !important;
    }

    .admin-area tbody tr:nth-child(even) {
      background: color-mix(in srgb, var(--admin-card-bg) 34%, var(--admin-primary) 4%) !important;
    }

    .admin-area tbody tr:hover {
      background: var(--admin-table-row-hover) !important;
      box-shadow:
        inset 3px 0 0 color-mix(in srgb, var(--admin-primary) 48%, transparent),
        0 8px 18px color-mix(in srgb, var(--admin-primary) 7%, transparent);
    }

    html.admin-theme-dark .admin-area table,
    html.admin-theme-dark .admin-area thead,
    html.admin-theme-dark .admin-area tbody,
    html.admin-theme-dark .admin-area tr,
    html.admin-theme-dark .admin-area td,
    html.admin-theme-dark .admin-area th {
      color: var(--admin-table-text) !important;
      border-color: color-mix(in srgb, var(--admin-primary) 36%, rgba(255,255,255,0.12)) !important;
    }

    html.admin-theme-dark .admin-area thead,
    html.admin-theme-dark .admin-area th {
      background: linear-gradient(
        145deg,
        color-mix(in srgb, var(--admin-card-bg) 92%, var(--admin-primary) 8%),
        color-mix(in srgb, var(--admin-card-bg) 86%, var(--admin-primary) 14%)
      ) !important;
      color: var(--admin-card-text) !important;
    }

    html.admin-theme-dark .admin-area tbody tr:hover {
      background: color-mix(in srgb, var(--admin-card-bg) 84%, var(--admin-primary) 16%) !important;
    }


    /* ============================================================
       LAYER 7 — TAILWIND BG CLASS OVERRIDES
       ============================================================ */

    .admin-area .bg-white,
    .admin-area [class*="bg-white"],
    .admin-area .bg-gray-50,   .admin-area .bg-gray-100,
    .admin-area .bg-slate-50,  .admin-area .bg-slate-100,
    .admin-area .bg-zinc-50,   .admin-area .bg-zinc-100,
    .admin-area .bg-neutral-50,.admin-area .bg-neutral-100,
    .admin-area .bg-stone-50,  .admin-area .bg-stone-100,
    .admin-area .bg-pink-50,   .admin-area .bg-rose-50,
    .admin-area .bg-fuchsia-50,.admin-area .bg-purple-50,
    .admin-area .bg-blue-50,   .admin-area .bg-cyan-50,
    .admin-area .bg-amber-50,  .admin-area .bg-yellow-50,
    .admin-area .bg-orange-50, .admin-area .bg-green-50,
    .admin-area .bg-emerald-50,.admin-area .bg-red-50 {
      background: var(--admin-glass-soft-bg) !important;
      color: var(--admin-card-text) !important;
      border-color: var(--admin-glass-border) !important;
      backdrop-filter: blur(14px) saturate(1.24);
      -webkit-backdrop-filter: blur(14px) saturate(1.24);
      box-shadow:
        0 16px 42px rgba(15,23,42,0.08),
        0 8px 20px color-mix(in srgb, var(--admin-primary) 6%, transparent),
        inset 0 1px 0 var(--admin-glass-highlight);
    }

    html.admin-theme-dark .admin-area .bg-white,
    html.admin-theme-dark .admin-area [class*="bg-white"],
    html.admin-theme-dark .admin-area .bg-gray-50,   html.admin-theme-dark .admin-area .bg-gray-100,
    html.admin-theme-dark .admin-area .bg-gray-200,  html.admin-theme-dark .admin-area .bg-slate-50,
    html.admin-theme-dark .admin-area .bg-slate-100, html.admin-theme-dark .admin-area .bg-slate-200,
    html.admin-theme-dark .admin-area .bg-zinc-50,   html.admin-theme-dark .admin-area .bg-zinc-100,
    html.admin-theme-dark .admin-area .bg-zinc-200,  html.admin-theme-dark .admin-area .bg-neutral-50,
    html.admin-theme-dark .admin-area .bg-neutral-100,html.admin-theme-dark .admin-area .bg-neutral-200,
    html.admin-theme-dark .admin-area .bg-stone-50,  html.admin-theme-dark .admin-area .bg-stone-100,
    html.admin-theme-dark .admin-area .bg-stone-200,
    html.admin-theme-dark .admin-area .bg-pink-50,   html.admin-theme-dark .admin-area .bg-rose-50,
    html.admin-theme-dark .admin-area .bg-fuchsia-50,html.admin-theme-dark .admin-area .bg-purple-50,
    html.admin-theme-dark .admin-area .bg-blue-50,   html.admin-theme-dark .admin-area .bg-cyan-50,
    html.admin-theme-dark .admin-area .bg-amber-50,  html.admin-theme-dark .admin-area .bg-yellow-50,
    html.admin-theme-dark .admin-area .bg-orange-50, html.admin-theme-dark .admin-area .bg-green-50,
    html.admin-theme-dark .admin-area .bg-emerald-50,html.admin-theme-dark .admin-area .bg-red-50,
    html.admin-theme-dark .admin-area [class*="bg-pink-100"],
    html.admin-theme-dark .admin-area [class*="bg-rose-100"],
    html.admin-theme-dark .admin-area [class*="bg-fuchsia-100"],
    html.admin-theme-dark .admin-area [class*="bg-purple-100"],
    html.admin-theme-dark .admin-area [class*="bg-blue-100"],
    html.admin-theme-dark .admin-area [class*="bg-cyan-100"],
    html.admin-theme-dark .admin-area [class*="bg-amber-100"],
    html.admin-theme-dark .admin-area [class*="bg-yellow-100"],
    html.admin-theme-dark .admin-area [class*="bg-orange-100"],
    html.admin-theme-dark .admin-area [class*="bg-green-100"],
    html.admin-theme-dark .admin-area [class*="bg-emerald-100"],
    html.admin-theme-dark .admin-area [class*="bg-red-100"] {
      background: var(--admin-glass-soft-bg) !important;
      color: var(--admin-card-text) !important;
      border-color: color-mix(in srgb, var(--admin-primary) 52%, rgba(255,255,255,0.14)) !important;
      box-shadow:
        0 18px 46px rgba(0,0,0,0.34),
        0 8px 22px color-mix(in srgb, var(--admin-primary) 10%, transparent),
        inset 0 1px 0 rgba(255,255,255,0.08);
    }

    /* Inline white backgrounds in dark mode */
    html.admin-theme-dark .admin-area [style*="background-color: rgb(255"],
    html.admin-theme-dark .admin-area [style*="background-color:#fff"],
    html.admin-theme-dark .admin-area [style*="background-color: #fff"],
    html.admin-theme-dark .admin-area [style*="background: rgb(255"],
    html.admin-theme-dark .admin-area [style*="background:#fff"],
    html.admin-theme-dark .admin-area [style*="background: #fff"] {
      color: #111827 !important;
    }

    html.admin-theme-dark .admin-area [style*="background-color: rgb(255"] .text-white,
    html.admin-theme-dark .admin-area [style*="background-color:#fff"] .text-white,
    html.admin-theme-dark .admin-area [style*="background-color: #fff"] .text-white,
    html.admin-theme-dark .admin-area [style*="background: rgb(255"] .text-white,
    html.admin-theme-dark .admin-area [style*="background:#fff"] .text-white,
    html.admin-theme-dark .admin-area [style*="background: #fff"] .text-white {
      color: #111827 !important;
    }


    /* ============================================================
       LAYER 8 — UTILITY OVERRIDES (shadows, borders, rounded)
       ============================================================ */

    .admin-area .shadow,
    .admin-area .shadow-sm,
    .admin-area .shadow-md,
    .admin-area .shadow-lg,
    .admin-area .shadow-xl,
    .admin-area .shadow-2xl {
      box-shadow: var(--admin-widget-glass-shadow) !important;
    }

    .admin-area .border {
      border-color: var(--admin-glass-border) !important;
    }

    .admin-area .rounded-lg,
    .admin-area .rounded-xl,
    .admin-area .rounded-2xl {
      backdrop-filter: blur(18px) saturate(1.28);
      -webkit-backdrop-filter: blur(18px) saturate(1.28);
    }

    /* Preserve color swatches / color pickers */
    .admin-area [style*="background-color"],
    .admin-area [style*="background:"],
    .admin-area [class*="swatch"],
    .admin-area [class*="color"],
    .admin-area .color-dot,
    .admin-area .color-circle {
      box-shadow: none;
    }


    /* ============================================================
       LAYER 9 — SCROLLBAR
       ============================================================ */

    .admin-area ::-webkit-scrollbar        { width: 10px; height: 10px; }
    .admin-area ::-webkit-scrollbar-track  { background: color-mix(in srgb, var(--admin-card-bg) 55%, transparent); border-radius: 999px; }
    .admin-area ::-webkit-scrollbar-thumb  { background: color-mix(in srgb, var(--admin-primary) 58%, var(--admin-card-bg)); border-radius: 999px; border: 2px solid color-mix(in srgb, var(--admin-card-bg) 70%, transparent); }
    .admin-area ::-webkit-scrollbar-thumb:hover { background: color-mix(in srgb, var(--admin-primary) 78%, var(--admin-card-bg)); }


    /* ============================================================
       LAYER 10 — REDUCED MOTION
       ============================================================ */

    @media (prefers-reduced-motion: reduce) {
      .admin-area,
      .admin-area *,
      .admin-sidebar-glass,
      .admin-header-glass,
      .admin-card-glass,
      .admin-glass-card,
      .admin-hero-glass,
      .admin-section-bar,
      .admin-form-glass {
        transition: none !important;
        animation: none !important;
        transform: none !important;
      }
    }
  `;

  document.head.appendChild(style);
}