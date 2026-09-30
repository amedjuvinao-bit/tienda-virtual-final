const LOGIN_REASONS = {
  db_login_success: 'Acceso correcto con contraseña',
  legacy_login_success: 'Acceso correcto',
  password_verified_2fa_required: 'Contraseña correcta; falta confirmar el código 2FA',
  two_factor_totp_login_success: 'Acceso correcto con código 2FA',
  two_factor_recovery_login_success: 'Acceso con código de recuperación',
  invalid_password: 'Contraseña incorrecta',
  invalid_credentials: 'Usuario o contraseña incorrectos',
  invalid_legacy_credentials: 'Usuario o contraseña incorrectos',
  account_locked: 'Cuenta temporalmente bloqueada',
  user_inactive: 'Usuario inactivo',
  user_deleted: 'Usuario eliminado',
  too_many_failed_attempts: 'Demasiados intentos fallidos',
  max_attempts_reached: 'Máximo de intentos alcanzado',
  missing_credentials: 'Faltan datos de acceso',
  two_factor_invalid_code: 'Código 2FA incorrecto',
  two_factor_invalid_password: 'Contraseña incorrecta al verificar 2FA',
  two_factor_management_locked: 'Verificación 2FA temporalmente bloqueada',
  two_factor_recovery_code_used: 'Código de recuperación ya utilizado',
  forgot_password_email_sent: 'Correo de recuperación enviado',
  forgot_password_user_not_available: 'Cuenta no disponible para recuperación',
  reset_password_invalid_or_expired_token: 'Enlace de recuperación inválido o vencido',
  reset_password_success: 'Contraseña restablecida',
  reset_password_success_2fa_login_required: 'Contraseña restablecida; se requiere 2FA',
  required_password_change_success: 'Contraseña obligatoria actualizada',
  required_password_change_invalid_current_password: 'Contraseña actual incorrecta',
  internal_server_error: 'Error interno al iniciar sesión',
};

export function describeLog(log) {
  const reason = String(log?.reason || '').trim();
  if (!reason) return 'Sin detalle';
  if (log?.type !== 'login') return reason;
  if (LOGIN_REASONS[reason]) return LOGIN_REASONS[reason];
  const readable = reason.replace(/[_-]+/g, ' ').trim();
  return readable.charAt(0).toUpperCase() + readable.slice(1);
}
