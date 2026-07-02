// frontend/src/admin/ForgotPasswordPage.jsx

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mail,
  ShieldCheck,
} from 'lucide-react';

import api from '../lib/api';
import { requestAdminPasswordReset } from './api/adminPasswordRecoveryApi';
import { applyAdminTheme } from './theme/adminTheme';
import { applyAdminLayoutStyles } from './theme/adminLayoutStyles';
import { applyAdminGlobalStyles } from './theme/adminGlobalStyles';

function getApiMessage(error, fallback) {
  return error?.userMessage || error?.response?.data?.message || error?.message || fallback;
}

export default function ForgotPasswordPage() {
  const [login, setLogin] = useState('');
  const [loading, setLoading] = useState(false);
  const [themeLoading, setThemeLoading] = useState(true);
  const [statusType, setStatusType] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [inputFocused, setInputFocused] = useState(false);

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

    const cleanLogin = String(login || '').trim();

    if (!cleanLogin) {
      setStatusType('error');
      setStatusMessage('Debes escribir tu usuario o correo electrónico.');
      return;
    }

    try {
      setLoading(true);
      setStatusType('');
      setStatusMessage('');

      const response = await requestAdminPasswordReset({
        login: cleanLogin,
      });

      setStatusType('success');
      setStatusMessage(
        response?.message ||
          'Si existe un usuario administrativo activo con ese correo, enviaremos un enlace de recuperación.'
      );
    } catch (error) {
      setStatusType('error');
      setStatusMessage(
        getApiMessage(error, 'No se pudo solicitar la recuperación de contraseña.')
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
              Recuperar contraseña
            </h1>

            <p
              className="mt-2 text-sm leading-6"
              style={{
                color: 'var(--admin-card-muted-text)',
              }}
            >
              Escribe tu correo o usuario administrador. Si existe una cuenta activa,
              enviaremos un enlace para crear una nueva contraseña.
            </p>
          </div>

          <div
            className="admin-public-auth-card rounded-[28px] p-6"
            style={{
              boxShadow:
                '0 24px 70px color-mix(in srgb, var(--admin-primary) 18%, transparent)',
            }}
          >
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
                  Usuario o correo
                </label>

                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
                    style={{
                      color: 'var(--admin-primary)',
                      opacity: 0.86,
                    }}
                  />

                  <input
                    type="text"
                    value={login}
                    onChange={(event) => setLogin(event.target.value)}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    placeholder="admin@correo.com"
                    autoComplete="username"
                    className="admin-public-auth-input w-full rounded-2xl px-4 py-3 pl-12 text-sm outline-none transition"
                    style={{
                      boxShadow: inputFocused
                        ? '0 0 0 4px var(--admin-primary-soft-bg)'
                        : 'none',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="admin-public-auth-button flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                Enviar enlace de recuperación
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