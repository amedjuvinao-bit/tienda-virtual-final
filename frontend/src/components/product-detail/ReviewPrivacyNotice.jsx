export default function ReviewPrivacyNotice({ state, preview = false, disabled = false }) {
  if (preview) return <p>La autorización para publicar la reseña se mostrará con la información de privacidad de la tienda. La vista previa no publica reseñas.</p>;
  if (state?.error) return <p role="alert">{state.error} <button type="button" onClick={state.retry} disabled={disabled}>Reintentar información de reseñas</button></p>;
  if (!state?.policy) return <p role="status">Cargando información de privacidad para reseñas…</p>;
  const { policy } = state;
  if (!policy.ready) return <p role="status">La tienda debe completar su información de privacidad antes de recibir reseñas. Puedes consultar las reseñas existentes.</p>;
  return <div className="pd-review-privacy" style={{ lineHeight: 1.5, overflowWrap: 'anywhere' }}>
    <label style={{ display: 'flex', alignItems: 'start', gap: 10 }}>
      <input type="checkbox" checked={state.authorized} disabled={disabled}
        onChange={event => state.setAuthorized(event.target.checked)}
        style={{ flex: 'none', marginTop: 4, accentColor: 'currentColor' }} />
      <span>{policy.text}</span>
    </label>
    <p style={{ marginTop: 10 }}>Responsable: {policy.seller.legalName}. {policy.seller.notificationAddress}. {policy.seller.email}. {policy.seller.phone}.</p>
    <p style={{ marginTop: 8 }}><a href="/privacidad" style={{ color: 'inherit', textDecoration: 'underline' }}>Datos personales y derechos</a>. Publica únicamente información que quieras compartir; evita documentos, teléfonos y datos sensibles.</p>
  </div>;
}
