// frontend/src/admin/ResetPasswordPage.jsx

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';

import { resetAdminPassword } from './api/adminPasswordRecoveryApi';
import { useAuth } from '../context/AuthContext';
import api, { setAdminToken } from '../lib/api';
import { applyAdminTheme } from './theme/adminTheme';
import { applyAdminLayoutStyles } from './theme/adminLayoutStyles';
import { applyAdminGlobalStyles } from './theme/adminGlobalStyles';

function getApiMessage(error, fallback) {
  return error?.userMessage || error?.response?.data?.message || error?.message || fallback;
}

function validatePassword(password) {
  const value = String(password || '');

  if (value.length < 10) {
    return 'La contraseña debe tener mínimo 10 caracteres.';
  }

  if (!/[A-ZÁÉÍÓÚÑ]/.test(value)) {
    return 'La contraseña debe incluir al menos una mayúscula.';
  }

  if (!/[a-záéíóúñ]/.test(value)) {
    return 'La contraseña debe incluir al menos una minúscula.';
  }

  if (!/\d/.test(value)) {
    return 'La contraseña debe incluir al menos un número.';
  }

  if (!/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/.test(value)) {
    return 'La contraseña debe incluir al menos un símbolo.';
  }

  return '';
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();

  const token = useMemo(() => {
    return String(searchParams.get('token') || '').trim();
  }, [searchParams]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [themeLoading, setThemeLoading] = useState(true);
  const [statusType, setStatusType] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [focusedInput, setFocusedInput] = useState('');

  useEffect(() => {
    let alive = true;

    async function loadAdminAppearanceFromApi() {
      try {
        const res = await api.get('/api/site-settings');
        const theme = res?.data?.admin?.theme || {};

        if (!alive) return;

        applyAdminTheme(theme);
        applyAdminLayoutStyles(theme);
        applyAdminGlobalStyles();
      } catch (error) {
        console.error('❌ Error al cargar apariencia del panel admin:', error);

        if (!alive) return;

        applyAdminTheme({});
        applyAdminLayoutStyles({});
        applyAdminGlobalStyles();
      } finally {
        if (alive) {
          setThemeLoading(false);
        }
      }
    }

    loadAdminAppearanceFromApi();

    return () => {
      alive = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!token) {
      setStatusType('error');
      setStatusMessage('El enlace de recuperación no contiene token.');
      return;
    }

    const validationError = validatePassword(newPassword);

    if (validationError) {
      setStatusType('error');
      setStatusMessage(validationError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatusType('error');
      setStatusMessage('La confirmación de contraseña no coincide.');
      return;
    }

    try {
      setLoading(true);
      setStatusType('');
      setStatusMessage('');

      const response = await resetAdminPassword({
        token,
        newPassword,
        confirmPassword,
      });

      setStatusType('success');
      setStatusMessage(response?.message || 'Contraseña actualizada correctamente.');

      if (response?.token) {
        setAdminToken(response.token);

        if (typeof login === 'function') {
          login(response.token, response.user);
        }

        setTimeout(() => {
          navigate('/admin/dashboard', { replace: true });
        }, 900);

        return;
      }

      setTimeout(() => {
        navigate('/admin/login', { replace: true });
      }, 1200);
    } catch (error) {
      setStatusType('error');
      setStatusMessage(
        getApiMessage(error, 'No se pudo restablecer la contraseña.')
      );
    } finally {
      setLoading(false);
    }
  }

  const isSuccess = statusType === 'success';

  return (
    <>
      <style>{`
        .admin-public-auth {
          font-family: 'DM Sans', 'Outfit', system-ui, sans-serif;
        }

        .admin-public-auth-input::placeholder {
          color: var(--admin-card-muted-text, #94a3b8);
          opacity: 0.78;
        }

        .admin-public-auth-card {
          background: var(--admin-card-bg);
          border: 1px solid var(--admin-card-border);
          color: var(--admin-card-text);
          backdrop-filter: blur(16px) saturate(1.4);
          -webkit-backdrop-filter: blur(16px) saturate(1.4);
        }

        .admin-public-auth-icon {
          background: var(--admin-primary-soft-bg);
          color: var(--admin-primary);
          border: 1px solid var(--admin-primary-soft-border);
        }

        .admin-public-auth-input {
          background: var(--admin-input-bg);
          color: var(--admin-card-text);
          border: 1px solid var(--admin-card-border);
        }

        .admin-public-auth-input:focus {
          border-color: var(--admin-primary);
          box-shadow: 0 0 0 4px var(--admin-primary-soft-bg);
        }

        .admin-public-auth-button {
          background: var(--admin-primary);
          color: #ffffff;
          box-shadow: var(--admin-shadow-sm, 0 8px 24px rgba(0,0,0,0.15));
        }

        .admin-public-auth-button:hover {
          background: var(--admin-primary-hover);
          transform: translateY(-1px);
          box-shadow: var(--admin-shadow-md, 0 12px 34px rgba(0,0,0,0.18));
        }

        .admin-public-auth-link {
          color: var(--admin-primary);
        }

        .admin-public-auth-link:hover {
          color: var(--admin-primary-hover);
        }

        .admin-public-auth-help {
          background: color-mix(in srgb, var(--admin-primary) 9%, var(--admin-card-bg));
          border: 1px solid var(--admin-card-border);
          color: var(--admin-card-muted-text);
        }

        .admin-public-auth-eye {
          color: var(--admin-card-muted-text);
        }

        .admin-public-auth-eye:hover {
          color: var(--admin-primary);
        }
      `}</style>

      <div
        className="admin-public-auth relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8"
        style={{
          background: `
            radial-gradient(
              circle at 15% 18%,
              color-mix(in srgb, var(--admin-primary) 18%, transparent),
              transparent 42%
            ),
            radial-gradient(
              circle at 88% 8%,
              rgba(255, 255, 255, 0.12),
              transparent 38%
            ),
            radial-gradient(
              circle at 75% 88%,
              color-mix(in srgb, var(--admin-primary) 10%, transparent),
              transparent 44%
            ),
            linear-gradient(
              135deg,
              var(--admin-page-bg),
              color-mix(in srgb, var(--admin-page-bg) 88%, var(--admin-primary) 12%) 42%,
              var(--admin-page-bg) 100%
            )
          `,
          color: 'var(--admin-card-text)',
          opacity: themeLoading ? 0.98 : 1,
          transition: 'background 220ms ease, color 220ms ease, opacity 220ms ease',
        }}
      >
        <div
          className="pointer-events-none absolute rounded-full blur-[80px]"
          style={{
            width: 520,
            height: 520,
            top: -140,
            left: -140,
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--admin-primary) 42%, transparent), transparent 70%)',
            opacity: 0.35,
          }}
        />

        <div
          className="pointer-events-none absolute rounded-full blur-[80px]"
          style={{
            width: 460,
            height: 460,
            top: '18%',
            right: '-110px',
            background:
              'radial-gradient(circle, rgba(255,255,255,0.32), transparent 70%)',
            opacity: 0.2,
          }}
        />

        <div
          className="pointer-events-none absolute rounded-full blur-[80px]"
          style={{
            width: 500,
            height: 500,
            bottom: '-120px',
            left: '38%',
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--admin-primary) 32%, transparent), transparent 70%)',
            opacity: 0.25,
          }}
        />

        <div className="relative z-10 w-full max-w-md">
          <div className="mb-5 text-center">
            <div className="admin-public-auth-icon mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl shadow-sm">
              <ShieldCheck className="h-7 w-7" />
            </div>

            <h1
              className="text-2xl font-bold"
              style={{
                color: 'var(--admin-card-text)',
              }}
            >
              Crear nueva contraseña
            </h1>

            <p
              className="mt-2 text-sm leading-6"
              style={{
                color: 'var(--admin-card-muted-text)',
              }}
            >
              Escribe una contraseña segura para recuperar el acceso al panel
              administrativo.
            </p>
          </div>

          <div
            className="admin-public-auth-card rounded-[28px] p-6"
            style={{
              boxShadow:
                '0 24px 70px color-mix(in srgb, var(--admin-primary) 18%, transparent)',
            }}
          >
            {!token ? (
              <div
                className="mb-5 flex gap-3 rounded-2xl border p-4 text-sm leading-6"
                style={{
                  background: 'rgba(254, 242, 242, 0.94)',
                  borderColor: 'rgba(239, 68, 68, 0.32)',
                  color: '#b91c1c',
                }}
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <span>El enlace no contiene token de recuperación.</span>
              </div>
            ) : null}

            {statusMessage ? (
              <div
                className="mb-5 flex gap-3 rounded-2xl border p-4 text-sm leading-6"
                style={{
                  background: isSuccess
                    ? 'rgba(220, 252, 231, 0.94)'
                    : 'rgba(254, 242, 242, 0.94)',
                  borderColor: isSuccess
                    ? 'rgba(34, 197, 94, 0.32)'
                    : 'rgba(239, 68, 68, 0.32)',
                  color: isSuccess ? '#15803d' : '#b91c1c',
                }}
              >
                {isSuccess ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                )}
                <span>{statusMessage}</span>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  className="mb-2 block text-xs font-bold uppercase tracking-wide"
                  style={{
                    color: 'var(--admin-card-muted-text)',
                  }}
                >
                  Nueva contraseña
                </label>

                <div className="relative">
                  <LockKeyhole
                    className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
                    style={{
                      color: 'var(--admin-primary)',
                      opacity: 0.86,
                    }}
                  />

                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    onFocus={() => setFocusedInput('newPassword')}
                    onBlur={() => setFocusedInput('')}
                    placeholder="Nueva contraseña"
                    autoComplete="new-password"
                    className="admin-public-auth-input w-full rounded-2xl px-4 py-3 pl-12 pr-12 text-sm outline-none transition"
                    style={{
                      boxShadow:
                        focusedInput === 'newPassword'
                          ? '0 0 0 4px var(--admin-primary-soft-bg)'
                          : 'none',
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="admin-public-auth-eye absolute right-4 top-1/2 -translate-y-1/2 transition"
                    aria-label={showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  className="mb-2 block text-xs font-bold uppercase tracking-wide"
                  style={{
                    color: 'var(--admin-card-muted-text)',
                  }}
                >
                  Confirmar contraseña
                </label>

                <div className="relative">
                  <KeyRound
                    className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
                    style={{
                      color: 'var(--admin-primary)',
                      opacity: 0.86,
                    }}
                  />

                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    onFocus={() => setFocusedInput('confirmPassword')}
                    onBlur={() => setFocusedInput('')}
                    placeholder="Confirmar contraseña"
                    autoComplete="new-password"
                    className="admin-public-auth-input w-full rounded-2xl px-4 py-3 pl-12 pr-12 text-sm outline-none transition"
                    style={{
                      boxShadow:
                        focusedInput === 'confirmPassword'
                          ? '0 0 0 4px var(--admin-primary-soft-bg)'
                          : 'none',
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="admin-public-auth-eye absolute right-4 top-1/2 -translate-y-1/2 transition"
                    aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="admin-public-auth-help rounded-2xl p-4 text-xs leading-5">
                La contraseña debe tener mínimo 10 caracteres, una mayúscula, una
                minúscula, un número y un símbolo.
              </div>

              <button
                type="submit"
                disabled={loading || !token}
                className="admin-public-auth-button flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                Guardar nueva contraseña
              </button>
            </form>

            <div className="mt-5 text-center">
              <Link
                to="/admin/login"
                className="admin-public-auth-link inline-flex items-center justify-center gap-2 text-sm font-semibold transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver al inicio de sesión
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}