export const GRACIAS_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Mulish:wght@300;400;500;600;700&display=swap');
  .gp-page * { box-sizing: border-box; }
  .gp-page { font-family: 'Mulish', sans-serif; -webkit-font-smoothing: antialiased; }
  @keyframes gp-pop {
    0% { opacity:0; transform: scale(0.6) rotate(-8deg); }
    70% { transform: scale(1.12) rotate(2deg); }
    100% { opacity:1; transform: scale(1) rotate(0deg); }
  }
  @keyframes gp-slide-up {
    from { opacity:0; transform: translateY(28px); }
    to { opacity:1; transform: translateY(0); }
  }
  @keyframes gp-fade-in { from { opacity:0; } to { opacity:1; } }
  @keyframes gp-confetti-fall {
    0% { transform: translateY(-20px) rotate(0deg); opacity:1; }
    100% { transform: translateY(60px) rotate(360deg); opacity:0; }
  }
  @keyframes gp-pulse-ring {
    0% { transform: scale(1); opacity: 0.6; }
    100% { transform: scale(1.55); opacity: 0; }
  }
  @keyframes gp-slider-fade { from { opacity:0; } to { opacity:1; } }
  .gp-check-icon { animation: gp-pop 0.55s cubic-bezier(.34,1.56,.64,1) both; }
  .gp-panel { animation: gp-slide-up 0.5s 0.15s ease both; }
  .gp-visual { animation: gp-fade-in 0.6s 0.05s ease both; }
  .gp-slide-img { animation: gp-slider-fade 0.4s ease both; }
  .gp-confetti-wrap { position:absolute; inset:0; pointer-events:none; overflow:hidden; border-radius:inherit; }
  .gp-confetti-dot { position:absolute; width:6px; height:6px; border-radius:50%; animation:gp-confetti-fall 1.8s ease-out both; opacity:0; }
  .gp-pulse-ring { position:absolute; inset:-8px; border-radius:50%; border:2px solid; animation:gp-pulse-ring 1.4s ease-out 0.4s infinite; }
  .gp-layout { display:grid; grid-template-columns:1fr; gap:32px; align-items:center; }
  @media (min-width:768px) { .gp-layout { grid-template-columns:1fr 1fr; gap:48px; } }
  @media (min-width:1024px) { .gp-layout { gap:64px; } }
  .gp-visual-wrap { position:relative; overflow:hidden; width:100%; max-width:100%; }
  .gp-visual-inner { position:relative; width:100%; padding-bottom:120%; overflow:hidden; }
  @media (min-width:768px) { .gp-visual-inner { padding-bottom:0; height:var(--gp-visual-h); } }
  .gp-visual-inner img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block; transition:opacity .4s ease; }
  .gp-dots { position:absolute; bottom:14px; left:0; right:0; display:flex; justify-content:center; gap:8px; z-index:4; }
  .gp-dot { width:8px; height:8px; border-radius:50%; border:none; cursor:pointer; transition:transform .2s,background .2s; padding:0; }
  .gp-dot.active { transform:scale(1.3); }
  .gp-panel-inner { width:100%; }
  .gp-check-wrap { position:relative; display:inline-flex; align-items:center; justify-content:center; margin-bottom:20px; }
  .gp-title { font-family:'Playfair Display',serif; font-weight:700; line-height:1.15; letter-spacing:-.02em; margin:0 0 12px; }
  .gp-message { font-size:14px; line-height:1.7; margin:0 0 24px; }
  .gp-summary-title { font-family:'Playfair Display',serif; font-size:17px; font-weight:600; margin:0 0 16px; letter-spacing:-.01em; }
  .gp-summary-rows { display:flex; flex-direction:column; gap:0; margin-bottom:24px; border-radius:10px; overflow:hidden; border:1px solid; }
  .gp-summary-row { display:flex; justify-content:space-between; align-items:center; padding:10px 14px; font-size:13px; border-bottom:1px solid; gap:12px; }
  .gp-summary-row:last-child { border-bottom:none; }
  .gp-summary-row-label { font-weight:500; opacity:.75; }
  .gp-summary-row-value { font-weight:600; text-align:right; }
  .gp-summary-row.total { font-size:14px; font-weight:700; }
  .gp-summary-row.total .gp-summary-row-value { font-size:16px; }
  .gp-cta-btn { display:flex; align-items:center; justify-content:center; gap:8px; width:100%; padding:14px 24px; font-family:'Mulish',sans-serif; font-size:14px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; border:none; cursor:pointer; transition:transform .2s,box-shadow .2s,opacity .2s; }
  .gp-cta-btn:hover { transform:translateY(-2px); }
  .gp-cta-btn:active { transform:scale(.97); opacity:.9; }
  .gp-help { margin-top:16px; font-size:11px; text-align:center; line-height:1.6; opacity:.75; }
  .gp-badge { position:absolute; top:14px; left:14px; padding:4px 12px; border-radius:50px; font-size:11px; font-weight:700; letter-spacing:.04em; z-index:3; pointer-events:none; }
  .gp-caption { position:absolute; bottom:44px; left:14px; right:14px; padding:10px 14px; border-radius:12px; font-size:13px; line-height:1.5; z-index:3; pointer-events:none; backdrop-filter:blur(4px); }
  .gp-fallback-msg { font-size:14px; line-height:1.7; padding:16px; border-radius:12px; border:1px dashed; margin-bottom:20px; text-align:center; }
  .gp-status-badge { display:inline-flex; align-items:center; justify-content:center; padding:6px 12px; border-radius:999px; font-size:12px; font-weight:800; letter-spacing:.04em; margin-bottom:12px; }
  .gp-verifying { display:flex; align-items:center; gap:8px; font-size:13px; margin:0 0 16px; }
  .gp-verifying::before { content:''; width:12px; height:12px; border-radius:50%; border:2px solid currentColor; border-right-color:transparent; animation:gp-spin .8s linear infinite; }
  @keyframes gp-spin { to { transform:rotate(360deg); } }
  .gp-page ::-webkit-scrollbar { width:4px; }
  .gp-page ::-webkit-scrollbar-thumb { background:#e5e7eb; border-radius:4px; }
`;
