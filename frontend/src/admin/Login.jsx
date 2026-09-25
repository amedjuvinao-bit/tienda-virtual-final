// frontend/src/admin/Login.jsx

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import galleryImmersiveDefault from "../assets/login/gallery-immersive-default.webp";
import galleryImmersiveLightBlue from "../assets/login/gallery-immersive-light-blue.webp";
import galleryImmersiveRoseGold from "../assets/login/gallery-immersive-rose-gold.webp";
import liquidGlassDefault from "../assets/login/liquid-glass-default.webp";
import {
  Lock,
  User,
  ShieldCheck,
  Sparkles,
  Crown,
  Fingerprint,
  ArrowRight,
  Store,
  Loader2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchSiteSettings } from "../lib/siteSettingsApi";
import { loginAdmin, logoutAdminSession } from "./api/adminAuthApi";
import RequiredPasswordChangeModal from "./login/RequiredPasswordChangeModal";
import TwoFactorChallengeModal from "./login/TwoFactorChallengeModal";
import RosaCoutureMark from "./login/RosaCoutureMark";
import "./login/LoginFlagship.css";
import "./login/LoginCuratedThemes.css";
import AdminLoadingScreen from './loading/AdminLoadingScreen';
import {
  LOGIN_THEMES,
  LOGIN_LAYOUTS,
  DEFAULT_LOGIN_THEME_ID,
  DEFAULT_LOGIN_LAYOUT_ID,
  getLoginGalleryImageTone,
} from "./login/loginThemes";
import {
  DEFAULT_LOGIN_SETTINGS,
  normalizeLoginSettings,
} from "./login/loginSettings";

const LOGIN_FAILED_ATTEMPTS_KEY = "admin_login_failed_attempts";
const LOGIN_LOCK_UNTIL_KEY = "admin_login_lock_until";
const LOGIN_REMEMBER_KEY = "admin_login_remember";
const LOGIN_REMEMBER_USERNAME_KEY = "admin_login_remember_username";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 2 * 60 * 1000;

const GALLERY_IMAGE_ASSETS = Object.freeze({
  black: galleryImmersiveDefault,
  roseGold: galleryImmersiveRoseGold,
  lightBlue: galleryImmersiveLightBlue,
});

function getFailedAttempts() {
  try {
    return Number(localStorage.getItem(LOGIN_FAILED_ATTEMPTS_KEY) || 0);
  } catch {
    return 0;
  }
}

function setFailedAttempts(value) {
  try {
    localStorage.setItem(LOGIN_FAILED_ATTEMPTS_KEY, String(value));
  } catch {}
}

function clearLoginSecurityState() {
  try {
    localStorage.removeItem(LOGIN_FAILED_ATTEMPTS_KEY);
    localStorage.removeItem(LOGIN_LOCK_UNTIL_KEY);
  } catch {}
}

function clearTemporaryAdminSession() {
  try {
    localStorage.removeItem("admin_token");
  } catch {}
  void logoutAdminSession().catch(() => {});
}

function getLockUntil() {
  try {
    return Number(localStorage.getItem(LOGIN_LOCK_UNTIL_KEY) || 0);
  } catch {
    return 0;
  }
}

function setLockUntil(value) {
  try {
    localStorage.setItem(LOGIN_LOCK_UNTIL_KEY, String(value));
  } catch {}
}

function getRememberedLogin() {
  try {
    const remember = localStorage.getItem(LOGIN_REMEMBER_KEY) === "true";
    const rememberedUsername =
      localStorage.getItem(LOGIN_REMEMBER_USERNAME_KEY) || "";

    return {
      remember,
      username: remember ? rememberedUsername : "",
    };
  } catch {
    return {
      remember: false,
      username: "",
    };
  }
}

function saveRememberedLogin(username, remember) {
  try {
    if (remember && username) {
      localStorage.setItem(LOGIN_REMEMBER_KEY, "true");
      localStorage.setItem(LOGIN_REMEMBER_USERNAME_KEY, username);
      return;
    }

    localStorage.removeItem(LOGIN_REMEMBER_KEY);
    localStorage.removeItem(LOGIN_REMEMBER_USERNAME_KEY);
  } catch {}
}

function isDarkTheme(theme) {
  return ["electricNeon", "darkCyber"].includes(theme?.id);
}

function isGoldTheme(theme) {
  return theme?.id === "goldBoutiqueLight" || theme?.id === "goldLuxury";
}

function StoreIdentity({ theme, storeName, storeLogo, compact = false }) {
  return (
    <div
      className={`flex items-center ${compact ? "gap-2.5 px-3 py-2" : "gap-3 px-4 py-3"}`}
      style={{
        border: `1px solid ${theme.brandPanelBorder || theme.cardBorder}`,
        borderRadius: compact ? 18 : 22,
        background: theme.brandPanelBg || theme.cardBg,
        boxShadow: `0 16px 45px ${theme.glowSoft}`,
        backdropFilter: "blur(18px)",
      }}
    >
      <span
        className={`grid shrink-0 place-items-center overflow-hidden ${compact ? "h-9 w-9 rounded-xl" : "h-11 w-11 rounded-2xl"}`}
        style={{
          background: theme.brandBadgeBg,
          color: theme.brandBadgeColor,
          border: `1px solid ${theme.cardInnerBorder || theme.cardBorder}`,
        }}
      >
        {storeLogo ? (
          <img className="h-full w-full object-contain p-1" src={storeLogo} alt="" />
        ) : (
          <Store size={compact ? 18 : 21} />
        )}
      </span>
      <span className="grid min-w-0 gap-0.5">
        <small
          className="truncate text-[9px] font-black uppercase tracking-[0.2em]"
          style={{ color: theme.brandBadgeColor }}
        >
          {theme.premiumLabel || "ACCESO PRIVADO"}
        </small>
        <strong
          className={`${compact ? "max-w-[180px] text-sm" : "max-w-[260px] text-base"} truncate`}
          style={{ color: theme.titleColor, fontFamily: theme.displayFont }}
        >
          {storeName}
        </strong>
      </span>
    </div>
  );
}

function CuratedStoreBrand({ storeName, storeLogo, className = "" }) {
  const initial = String(storeName || "T").trim().charAt(0).toUpperCase() || "T";
  return (
    <div className={`rb-curated-brand ${storeLogo ? "has-image" : "has-initial"} ${className}`.trim()} aria-label={storeName}>
      <span className="rb-curated-brand__logo">
        {storeLogo ? (
          <img src={storeLogo} alt={`Logo de ${storeName}`} />
        ) : (
          <b aria-label={`Inicial de ${storeName}`}>{initial}</b>
        )}
      </span>
    </div>
  );
}

function AnimatedBorderBox({
  children,
  theme,
  className = "",
  innerClassName = "",
  style = {},
  innerStyle = {},
  rounded = "38px",
  padding = 3,
}) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        borderRadius: rounded,
        padding,
        background:
          theme.animatedBorder ||
          `linear-gradient(120deg, ${theme.glowColor}, transparent, ${theme.glowColor})`,
        backgroundSize: "300% 300%",
        animation: "rbLoginBorderFlow 7s ease infinite",
        boxShadow: `0 0 30px ${theme.glowSoft || "rgba(0,0,0,0.12)"}`,
        ...style,
      }}
    >
      <div
        className={`relative h-full w-full overflow-hidden ${innerClassName}`}
        style={{
          borderRadius: `calc(${rounded} - ${padding}px)`,
          ...innerStyle,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: theme.cardSheen || "transparent",
            boxShadow: `inset 0 0 0 1px ${theme.cardInnerBorder || "transparent"}`,
          }}
        />
        {children}
      </div>
    </div>
  );
}

function InputField({
  label,
  type = "text",
  name,
  value,
  onChange,
  placeholder,
  icon,
  theme,
  autoComplete,
  disabled,
  variant = "default",
}) {
  const Icon = icon;
  const isLine = variant === "line";
  const isGlass = variant === "glass";

  return (
    <div className="mb-4">
      <label
        className="mb-2 block text-xs font-bold uppercase tracking-[0.18em]"
        style={{ color: theme.mutedColor }}
      >
        {label}
      </label>

      <div className="relative">
        <span
          className={`absolute left-3 top-1/2 flex -translate-y-1/2 items-center justify-center ${
            isLine ? "h-9 w-9 rounded-full" : "h-11 w-11 rounded-2xl"
          }`}
          style={{
            background: theme.inputIconBg,
            color: theme.inputIconColor,
            boxShadow: isGlass ? `0 10px 28px ${theme.glowSoft}` : "none",
          }}
        >
          <Icon size={18} />
        </span>

        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          required
          disabled={disabled}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={`w-full outline-none transition-all duration-300 placeholder:opacity-60 disabled:cursor-not-allowed disabled:opacity-60 ${
            isLine
              ? "border-0 border-b bg-transparent py-3 pl-14 pr-4 text-sm"
              : "rounded-2xl border py-3.5 pl-16 pr-4 text-sm focus:-translate-y-[1px]"
          }`}
          style={{
            background: isLine ? "transparent" : theme.inputBg,
            borderColor: theme.inputBorder,
            color: theme.inputText,
            boxShadow: isLine
              ? "none"
              : theme.inputShadow || `0 10px 30px ${theme.glowSoft || "rgba(0,0,0,0.06)"}`,
          }}
        />
      </div>
    </div>
  );
}

function CircleInputField({
  type = "text",
  name,
  value,
  onChange,
  placeholder,
  icon,
  theme,
  autoComplete,
  disabled,
}) {
  const Icon = icon;

  return (
    <div className="relative mb-3 flex h-12 w-full overflow-hidden rounded-xl shadow-sm">
      <div
        className="flex h-full w-12 shrink-0 items-center justify-center"
        style={{
          background: theme.buttonBg,
          color: theme.buttonText,
        }}
      >
        <Icon size={18} />
      </div>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required
        disabled={disabled}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 border-0 px-4 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          background: "rgba(255,255,255,0.88)",
          color: theme.inputText,
        }}
      />
    </div>
  );
}

function LoginForm({
  theme,
  username,
  password,
  error,
  isLocked,
  isSubmitting,
  lockSeconds,
  setUsername,
  setPassword,
  rememberMe,
  setRememberMe,
  handleSubmit,
  onForgotPassword,
  compact = false,
  variant = "default",
  showBadge = true,
  title = "Iniciar sesión",
  subtitle = "Accede al panel de administración de forma segura",
  storeLogo = "",
}) {
  const dark = isDarkTheme(theme);
  const inputVariant = variant === "luxury" ? "line" : variant;
  const ThemeIcon = theme.icon || Lock;

  return (
    <>
      <div className={`text-center ${compact ? "mb-4" : "mb-8"}`}>
        {showBadge && (
          <div
            className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-[24px]"
            style={{
              background: theme.brandBadgeBg,
              color: theme.brandBadgeColor,
              boxShadow: `0 0 30px ${theme.glowSoft || "rgba(0,0,0,0.12)"}`,
            }}
          >
            {storeLogo ? (
              <img className="h-full w-full object-contain p-2" src={storeLogo} alt="" />
            ) : (
              <ThemeIcon size={26} />
            )}
          </div>
        )}

        <span
          className="mb-2 inline-block text-[9px] font-black uppercase tracking-[0.24em]"
          style={{ color: theme.brandBadgeColor }}
        >
          {theme.premiumLabel || "ACCESO ADMINISTRATIVO"}
        </span>

        <h2
          className={`${compact ? "text-xl" : "text-3xl sm:text-4xl"} font-black tracking-tight`}
          style={{
            color: theme.titleColor,
            fontFamily: theme.displayFont,
            textShadow: dark ? `0 0 18px ${theme.glowSoft}` : "none",
          }}
        >
          {title}
        </h2>

        <p
          className="mx-auto mt-2 max-w-sm text-xs sm:text-sm"
          style={{ color: theme.mutedColor }}
        >
          {subtitle}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div
            className="mb-4 rounded-2xl border px-4 py-3 text-sm font-medium"
            style={{
              background: dark ? "rgba(127,29,29,0.24)" : "#fff1f2",
              borderColor: dark ? "rgba(248,113,113,0.35)" : "#fecdd3",
              color: dark ? "#fecaca" : "#be123c",
            }}
          >
            {error}
            {isLocked && (
              <span className="block pt-1 text-xs">
                Intenta nuevamente en {lockSeconds} segundos.
              </span>
            )}
          </div>
        )}

        <InputField
          label="Usuario"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Nombre de usuario"
          icon={User}
          theme={theme}
          autoComplete="username"
          disabled={isSubmitting || isLocked}
          variant={inputVariant}
        />

        <InputField
          label="Contraseña"
          type="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          icon={Lock}
          theme={theme}
          autoComplete="current-password"
          disabled={isSubmitting || isLocked}
          variant={inputVariant}
        />

        <button
          type="submit"
          disabled={isSubmitting || isLocked}
          className={`mt-2 inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-bold tracking-wide transition-all duration-300 hover:-translate-y-[2px] disabled:cursor-not-allowed disabled:opacity-60 ${
            variant === "luxury" ? "rounded-none" : "rounded-2xl"
          }`}
          style={{
            background: theme.buttonBg,
            color: theme.buttonText,
            boxShadow: theme.buttonShadow,
          }}
        >
          {isSubmitting
            ? "Validando acceso..."
            : isLocked
              ? `Bloqueado ${lockSeconds}s`
              : "Ingresar"}
          {!isSubmitting && !isLocked && <ArrowRight size={16} />}
        </button>
      </form>

      <div
        className="mt-4 flex w-full items-center justify-between gap-4 text-xs"
        style={{ color: theme.mutedColor }}
      >
        <button
          type="button"
          onClick={() => setRememberMe(!rememberMe)}
          className="inline-flex items-center gap-2 whitespace-nowrap"
        >
          <span
            className="flex h-4 w-4 items-center justify-center rounded border"
            style={{
              borderColor: theme.cardBorder,
              background: rememberMe ? theme.buttonBg : "transparent",
            }}
          >
            {rememberMe && (
              <span style={{ color: theme.buttonText, fontSize: 10 }}>✓</span>
            )}
          </span>
          <span>Recordar</span>
        </button>

        <button
          type="button"
          onClick={onForgotPassword}
          className="whitespace-nowrap hover:underline"
          style={{ color: theme.mutedColor }}
        >
          Olvidé mi contraseña
        </button>
      </div>

      <div
        className={`mt-4 flex w-full items-center justify-center gap-2 border px-4 py-3 text-center text-xs ${
          variant === "luxury" ? "rounded-none" : "rounded-2xl"
        }`}
        style={{
          background: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.62)",
          borderColor: theme.cardBorder,
          color: theme.mutedColor,
        }}
      >
        <ShieldCheck size={15} />
        <span>Acceso protegido</span>
      </div>
    </>
  );
}

function CircleLoginForm({
  theme,
  username,
  password,
  error,
  isLocked,
  isSubmitting,
  lockSeconds,
  setUsername,
  setPassword,
  rememberMe,
  setRememberMe,
  handleSubmit,
  onForgotPassword,
  subtitle = "Panel administrativo privado",
  storeLogo = "",
}) {
  const dark = isDarkTheme(theme);
  const ThemeIcon = theme.icon || Lock;

  return (
    <div className="w-full max-w-[300px]">
      <div className="mb-7 text-center">
        <div
          className="mx-auto mb-3 grid h-12 w-12 place-items-center overflow-hidden rounded-2xl"
          style={{
            background: theme.brandBadgeBg,
            color: theme.brandBadgeColor,
            border: `1px solid ${theme.cardInnerBorder || theme.cardBorder}`,
            boxShadow: `0 0 24px ${theme.glowSoft}`,
          }}
        >
          {storeLogo ? (
            <img className="h-full w-full object-contain p-1.5" src={storeLogo} alt="" />
          ) : (
            <ThemeIcon size={21} />
          )}
        </div>
        <span
          className="mb-2 inline-block text-[8px] font-black uppercase tracking-[0.22em]"
          style={{ color: theme.brandBadgeColor }}
        >
          {theme.premiumLabel || "ACCESO PRIVADO"}
        </span>
        <h2
          className="text-2xl font-semibold uppercase tracking-wide"
          style={{
            color: theme.titleColor,
            fontFamily: theme.displayFont,
            textShadow: dark ? `0 0 18px ${theme.glowSoft}` : "none",
          }}
        >
          Acceso seguro
        </h2>

        <p className="mt-2 text-xs" style={{ color: theme.mutedColor }}>
          {subtitle}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div
            className="mb-3 rounded-xl border px-3 py-2 text-xs font-medium"
            style={{
              background: dark ? "rgba(127,29,29,0.24)" : "#fff1f2",
              borderColor: dark ? "rgba(248,113,113,0.35)" : "#fecdd3",
              color: dark ? "#fecaca" : "#be123c",
            }}
          >
            {error}
            {isLocked && (
              <span className="block pt-1">
                Intenta nuevamente en {lockSeconds} segundos.
              </span>
            )}
          </div>
        )}

        <CircleInputField
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Usuario"
          icon={User}
          theme={theme}
          autoComplete="username"
          disabled={isSubmitting || isLocked}
        />

        <CircleInputField
          type="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          icon={Lock}
          theme={theme}
          autoComplete="current-password"
          disabled={isSubmitting || isLocked}
        />

        <div className="mb-5 mt-1 flex items-center justify-between gap-3 text-[11px]">
          <button
            type="button"
            onClick={() => setRememberMe(!rememberMe)}
            className="inline-flex items-center gap-1.5"
            style={{ color: theme.mutedColor }}
          >
            <span
              className="inline-flex h-4 w-4 items-center justify-center rounded border"
              style={{
                borderColor: theme.cardBorder,
                background: rememberMe ? theme.buttonBg : "transparent",
                boxShadow: rememberMe ? `0 0 12px ${theme.glowSoft}` : "none",
              }}
            >
              {rememberMe && (
                <span style={{ color: theme.buttonText, fontSize: 10 }}>✓</span>
              )}
            </span>
            Recordar
          </button>

          <button
            type="button"
            onClick={onForgotPassword}
            className="hover:underline"
            style={{ color: theme.mutedColor }}
          >
            Olvidé mi contraseña
          </button>
        </div>

        <div className="flex justify-center">
          <button
            type="submit"
            disabled={isSubmitting || isLocked}
            className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold uppercase tracking-wide transition-all duration-300 hover:-translate-y-[2px] disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: theme.buttonBg,
              color: theme.buttonText,
              boxShadow: theme.buttonShadow,
            }}
          >
            {isSubmitting
              ? "Validando..."
              : isLocked
                ? `${lockSeconds}s`
                : "Ingresar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function RosaCoutureLoginForm({
  username,
  password,
  error,
  isLocked,
  isSubmitting,
  lockSeconds,
  setUsername,
  setPassword,
  rememberMe,
  setRememberMe,
  handleSubmit,
  onForgotPassword,
  storeName,
  customization,
}) {
  return (
    <div className="rb-couture-form">
      <div className="rb-couture-form-head">
        <div className="rb-couture-mini-mark">
          <RosaCoutureMark size={44} />
        </div>
        <h2>{customization.welcomeTitle}</h2>
        <p>{customization.welcomeSubtitle.replace("la tienda", storeName)}</p>
      </div>

      <form onSubmit={handleSubmit}>
        {error ? (
          <div className="rb-couture-error">
            {error}
            {isLocked ? <span>Intenta nuevamente en {lockSeconds} segundos.</span> : null}
          </div>
        ) : null}

        <div className="rb-couture-field">
          <div className="rb-couture-field-head">
            <label htmlFor="rb-couture-username">Usuario</label>
            <small>Identidad</small>
          </div>
          <div className="rb-couture-input">
            <input
              id="rb-couture-username"
              name="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Nombre de usuario"
              autoComplete="username"
              required
              disabled={isSubmitting || isLocked}
            />
            <span className="rb-field-glyph" aria-hidden="true" />
          </div>
        </div>

        <div className="rb-couture-field">
          <div className="rb-couture-field-head">
            <label htmlFor="rb-couture-password">Contraseña</label>
            <small>Clave privada</small>
          </div>
          <div className="rb-couture-input">
            <input
              id="rb-couture-password"
              type="password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Escribe tu contraseña"
              autoComplete="current-password"
              required
              disabled={isSubmitting || isLocked}
            />
            <span className="rb-field-glyph" aria-hidden="true" />
          </div>
        </div>

        <button
          type="submit"
          className="rb-couture-submit"
          disabled={isSubmitting || isLocked}
        >
          <span>
            {isSubmitting
              ? "Validando acceso"
              : isLocked
                ? `Acceso pausado · ${lockSeconds}s`
                : customization.buttonText}
          </span>
          <span className="rb-couture-submit-mark" aria-hidden="true">→</span>
        </button>
      </form>

      <div className="rb-couture-options">
        <button
          type="button"
          className="rb-couture-remember"
          onClick={() => setRememberMe(!rememberMe)}
        >
          <span className={`rb-couture-check ${rememberMe ? "active" : ""}`} aria-hidden="true" />
          Recordar mi usuario
        </button>
        <button type="button" onClick={onForgotPassword}>Recuperar acceso</button>
      </div>

      <div className="rb-couture-security">
        <span className="rb-couture-security-mark" aria-hidden="true" />
        Sesión cifrada · acceso exclusivo
      </div>
    </div>
  );
}

function CuratedCredentialsForm({
  username,
  password,
  error,
  isLocked,
  isSubmitting,
  lockSeconds,
  setUsername,
  setPassword,
  rememberMe,
  setRememberMe,
  handleSubmit,
  onForgotPassword,
  customization,
  inputId,
}) {
  return (
    <div className="rb-curated-auth">
      <div className="rb-curated-auth__head">
        <h2>{customization.welcomeTitle}</h2>
        <p>{customization.welcomeSubtitle}</p>
      </div>

      <form onSubmit={handleSubmit}>
        {error ? (
          <div className="rb-curated-auth__error">
            {error}
            {isLocked ? <span> Intenta nuevamente en {lockSeconds} segundos.</span> : null}
          </div>
        ) : null}

        <div className="rb-curated-auth__field">
          <label htmlFor={`${inputId}-username`}>Usuario</label>
          <div className="rb-curated-auth__input-shell">
            <span className="rb-curated-auth__input-icon" aria-hidden="true"><User size={17} /></span>
            <input
              id={`${inputId}-username`}
              name="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Nombre de usuario"
              autoComplete="username"
              required
              disabled={isSubmitting || isLocked}
            />
            <span className="rb-curated-auth__input-beam" aria-hidden="true" />
          </div>
        </div>

        <div className="rb-curated-auth__field">
          <label htmlFor={`${inputId}-password`}>Contraseña</label>
          <div className="rb-curated-auth__input-shell">
            <span className="rb-curated-auth__input-icon" aria-hidden="true"><Lock size={17} /></span>
            <input
              id={`${inputId}-password`}
              type="password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Escribe tu contraseña"
              autoComplete="current-password"
              required
              disabled={isSubmitting || isLocked}
            />
            <span className="rb-curated-auth__input-beam" aria-hidden="true" />
          </div>
        </div>

        <button
          type="submit"
          className="rb-curated-auth__submit"
          disabled={isSubmitting || isLocked}
        >
          <span>
            {isSubmitting
              ? "Validando acceso"
              : isLocked
                ? `Acceso pausado · ${lockSeconds}s`
                : customization.buttonText}
          </span>
          <b aria-hidden="true">→</b>
        </button>
      </form>

      <div className="rb-curated-auth__options">
        <button
          type="button"
          className="rb-curated-auth__remember"
          aria-pressed={rememberMe}
          onClick={() => setRememberMe(!rememberMe)}
        >
          <span className={`rb-curated-auth__check ${rememberMe ? "active" : ""}`} aria-hidden="true" />
          Recordar usuario
        </button>
        <button type="button" onClick={onForgotPassword}>Recuperar acceso</button>
      </div>
    </div>
  );
}

export default function Login({ initialSettings, loaderModel }) {
  const rememberedLogin = useMemo(() => getRememberedLogin(), []);

  const [username, setUsername] = useState(rememberedLogin.username);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [activeThemeId, setActiveThemeId] = useState(DEFAULT_LOGIN_THEME_ID);
  const [activeLayoutId, setActiveLayoutId] = useState(DEFAULT_LOGIN_LAYOUT_ID);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockRemaining, setLockRemaining] = useState(0);
  const [rememberMe, setRememberMe] = useState(rememberedLogin.remember);
  const [loginBg, setLoginBg] = useState(DEFAULT_LOGIN_SETTINGS.background);
  const [loginCustomizations, setLoginCustomizations] = useState(
    DEFAULT_LOGIN_SETTINGS.customizations
  );
  const [storeName, setStoreName] = useState('tu tienda');
  const [storeLogo, setStoreLogo] = useState('');
  const [loginSettingsReady, setLoginSettingsReady] = useState(false);
  const [loginSettingsError, setLoginSettingsError] = useState(false);
  const [showRequiredPasswordChange, setShowRequiredPasswordChange] =
    useState(false);
  const [requiredPasswordUser, setRequiredPasswordUser] = useState(null);
  const [showTwoFactorChallenge, setShowTwoFactorChallenge] = useState(false);
  const [twoFactorUser, setTwoFactorUser] = useState(null);
  const [pendingLoginName, setPendingLoginName] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const activeTheme = useMemo(() => {
    return LOGIN_THEMES[activeThemeId] || LOGIN_THEMES[DEFAULT_LOGIN_THEME_ID];
  }, [activeThemeId]);

  const activeLayout = useMemo(() => {
    return LOGIN_LAYOUTS[activeLayoutId] || LOGIN_LAYOUTS[DEFAULT_LOGIN_LAYOUT_ID];
  }, [activeLayoutId]);

  useEffect(() => {
    let active = true;
    let retryTimer;

    const applySettings = (settings, identity = {}) => {
      const normalized = normalizeLoginSettings(settings);
      setActiveThemeId(normalized.theme);
      setActiveLayoutId(normalized.layout);
      setLoginBg(normalized.background);
      setLoginCustomizations(normalized.customizations);
      if (identity?.name) setStoreName(String(identity.name).trim());
      if (identity?.logo) setStoreLogo(String(identity.logo).trim());
    };

    const loadSettings = async () => {
      window.clearTimeout(retryTimer);
      try {
        const response = await fetchSiteSettings();
        if (active) {
          setLoginSettingsError(false);
          applySettings(response?.loginAdmin, {
            ...response?.store,
            logo:
              response?.theme?.header?.logoLight ||
              response?.theme?.logo?.light ||
              response?.theme?.header?.logoDark ||
              '',
          });
          setLoginSettingsReady(true);
        }
      } catch {
        if (active) {
          setLoginSettingsError(true);
          retryTimer = window.setTimeout(loadSettings, 2000);
        }
      }
    };

    const syncLoginConfig = (event) => {
      if (event?.detail) {
        applySettings(event.detail);
        setLoginSettingsReady(true);
      }
      else loadSettings();
    };

    if (initialSettings) {
      applySettings(initialSettings.loginAdmin, {
        ...initialSettings.store,
        logo: initialSettings.theme?.header?.logoLight || initialSettings.theme?.logo?.light || initialSettings.theme?.header?.logoDark || '',
      });
      setLoginSettingsReady(true);
    } else loadSettings();
    window.addEventListener("admin-login-settings-updated", syncLoginConfig);

    return () => {
      active = false;
      window.clearTimeout(retryTimer);
      window.removeEventListener("admin-login-settings-updated", syncLoginConfig);
    };
  }, []);

  useEffect(() => {
    const updateLockState = () => {
      const lockUntil = getLockUntil();
      const remaining = Math.max(0, lockUntil - Date.now());
      setLockRemaining(remaining);

      if (remaining <= 0 && lockUntil > 0) {
        clearLoginSecurityState();
      }
    };

    updateLockState();
    const timer = window.setInterval(updateLockState, 1000);

    return () => window.clearInterval(timer);
  }, []);

  if (!loginSettingsReady) {
    return <AdminLoadingScreen context="login" model={loaderModel} message={loginSettingsError ? 'Esperando configuración del servidor…' : 'Preparando acceso seguro…'} />;
  }

  const registerFailedAttempt = () => {
    const nextAttempts = getFailedAttempts() + 1;
    setFailedAttempts(nextAttempts);

    if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
      setLockUntil(Date.now() + LOCK_TIME_MS);
      setLockRemaining(LOCK_TIME_MS);
    }
  };

  const authenticateAdmin = async ({ cleanUsername, cleanPassword }) => {
    return loginAdmin({
      username: cleanUsername,
      password: cleanPassword,
    });
  };

  const completeAuthenticatedLogin = (response, loginName) => {
    if (!response?.user) {
      clearTemporaryAdminSession();
      setError(
        "No se recibió una sesión válida. Inicia sesión nuevamente."
      );
      return false;
    }

    saveRememberedLogin(loginName, rememberMe);
    login(response.user);
    clearLoginSecurityState();
    if (!rememberMe) setUsername("");
    setPassword("");
    setPendingLoginName('');
    navigate(
      response.user.twoFactorSetupRequired
        ? "/admin/configuracion/seguridad"
        : "/admin/dashboard"
    );
    return true;
  };

  const handleRequiredPasswordSuccess = (response) => {
    if (!completeAuthenticatedLogin(response, pendingLoginName || username.trim())) {
      setShowRequiredPasswordChange(false);
      setRequiredPasswordUser(null);
      return;
    }

    setShowRequiredPasswordChange(false);
    setRequiredPasswordUser(null);
  };

  const handleRequiredPasswordCancel = () => {
    clearTemporaryAdminSession();
    setShowRequiredPasswordChange(false);
    setRequiredPasswordUser(null);
    setPendingLoginName('');
    setPassword("");
    setError("Debes cambiar la contraseña temporal para ingresar al panel.");
  };

  const handleTwoFactorSuccess = (response) => {
    setShowTwoFactorChallenge(false);
    setTwoFactorUser(null);

    if (response?.user?.mustChangePassword === true) {
      setRequiredPasswordUser(response.user);
      setShowRequiredPasswordChange(true);
      return;
    }

    completeAuthenticatedLogin(response, pendingLoginName);
  };

  const handleTwoFactorCancel = (message) => {
    setShowTwoFactorChallenge(false);
    setTwoFactorUser(null);
    setPendingLoginName('');
    setPassword('');
    setError(message || 'Verificación de seguridad cancelada.');
  };

  const handleForgotPassword = () => {
    navigate("/admin/forgot-password");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    const lockUntil = getLockUntil();
    if (lockUntil > Date.now()) {
      setError("Por seguridad, espera unos segundos antes de intentar de nuevo.");
      return;
    }

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setError("Ingresa tus credenciales de acceso.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      const loginResult = await authenticateAdmin({
        cleanUsername,
        cleanPassword,
      });

      clearLoginSecurityState();

      if (loginResult?.requiresTwoFactor === true) {
        setPendingLoginName(cleanUsername);
        setTwoFactorUser(loginResult.user);
        setShowTwoFactorChallenge(true);
        setPassword('');
        return;
      }

      if (loginResult?.user?.mustChangePassword === true) {
        setPendingLoginName(cleanUsername);
        setRequiredPasswordUser(loginResult.user);
        setShowRequiredPasswordChange(true);
        setPassword("");
        return;
      }

      completeAuthenticatedLogin(loginResult, cleanUsername);
    } catch (err) {
      registerFailedAttempt();
      setError(
        err?.userMessage ||
          "No fue posible iniciar sesión. Verifica tus credenciales."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const lockSeconds = Math.ceil(lockRemaining / 1000);
  const isLocked = lockRemaining > 0;
  const dark = isDarkTheme(activeTheme);
  const gold = isGoldTheme(activeTheme);
  const isLiquidGlass = activeTheme.id === "liquidGlass";
  const isImmersiveGallery = activeTheme.id === "immersiveGallery";
  const isSmokeGlass = activeTheme.id === "smokeGlass";
  const isCuratedTheme = isLiquidGlass || isImmersiveGallery || isSmokeGlass;
  const activeCustomization = loginCustomizations[activeTheme.id]
    || DEFAULT_LOGIN_SETTINGS.customizations[activeTheme.id]
    || DEFAULT_LOGIN_SETTINGS.customizations.liquidGlass;
  const hasCustomImageBg = loginBg.mode === "image" && Boolean(loginBg.image);
  const liquidBackground = hasCustomImageBg ? loginBg.image : liquidGlassDefault;
  const galleryImageTone = getLoginGalleryImageTone(activeCustomization.imageTone);
  const galleryBackground = hasCustomImageBg
    ? loginBg.image
    : GALLERY_IMAGE_ASSETS[galleryImageTone.id];
  const smokeBackground = hasCustomImageBg ? loginBg.image : "";
  const smokeGlassOpacity = 1 - loginBg.glassTransparency;
  const smokeGlassBlur = `${Math.round(smokeGlassOpacity * 1800) / 100}px`;
  const liquidGlassOpacity = 1 - loginBg.glassTransparency;
  const liquidGlassBlur = `${Math.round(liquidGlassOpacity * 1800) / 100}px`;

  const loginPageBackground =
    loginBg.mode === "color" ? loginBg.color : activeTheme.pageBg;

  const formProps = {
    theme: activeTheme,
    username,
    password,
    error,
    isLocked,
    isSubmitting,
    lockSeconds,
    setUsername,
    setPassword,
    rememberMe,
    setRememberMe,
    handleSubmit,
    onForgotPassword: handleForgotPassword,
    subtitle: `Accede al panel de ${storeName}`,
    storeLogo,
  };

  const cardStyle = {
    background: activeTheme.cardBg,
    borderColor: activeTheme.cardBorder,
    boxShadow: activeTheme.cardShadow,
    backdropFilter: "blur(24px) saturate(1.12)",
  };

  const renderCenteredCard = () => (
    <div className="relative w-full max-w-[510px]">
      <div
        className="absolute -left-8 -top-8 h-28 w-28 rounded-[36px] blur-2xl"
        style={{ background: activeTheme.deco1 }}
      />
      <div
        className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full blur-3xl"
        style={{ background: activeTheme.deco2 }}
      />

      <AnimatedBorderBox
        theme={activeTheme}
        rounded="38px"
        padding={3}
        className="relative"
        innerClassName="p-6 sm:p-10"
        innerStyle={cardStyle}
      >
        <div
          className="pointer-events-none absolute inset-x-10 top-0 h-[3px]"
          style={{ background: activeTheme.accentLine || activeTheme.buttonBg }}
        />
        <LoginForm {...formProps} />
      </AnimatedBorderBox>
    </div>
  );

  const renderElectricCircle = () => (
    <div className="relative flex min-h-[700px] w-full items-center justify-center">
      <AnimatedBorderBox
        theme={activeTheme}
        rounded="9999px"
        padding={7}
        className="relative z-10 h-[520px] w-[520px] max-md:h-[390px] max-md:w-[390px]"
        style={{
          boxShadow: `0 0 45px ${activeTheme.glowStrong}, 0 0 120px ${activeTheme.glowSoft}`,
        }}
        innerClassName="flex h-full w-full items-center justify-center rounded-full"
        innerStyle={{
          background: dark
            ? "radial-gradient(circle, rgba(15,23,42,0.84), rgba(3,7,18,0.48), rgba(3,7,18,0.18))"
            : "radial-gradient(circle, rgba(255,255,255,0.94), rgba(255,255,255,0.72), rgba(255,255,255,0.36))",
          boxShadow: `inset 0 0 55px ${activeTheme.glowSoft}, 0 24px 65px rgba(0,0,0,0.12)`,
          backdropFilter: "blur(16px)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-[26px] rounded-full border"
          style={{
            borderColor: activeTheme.cardBorder,
            boxShadow: `inset 0 0 32px ${activeTheme.glowSoft}`,
          }}
        />

        <CircleLoginForm {...formProps} />
      </AnimatedBorderBox>
    </div>
  );

  const renderSplitPanel = () => (
    <AnimatedBorderBox
      theme={activeTheme}
      rounded="42px"
      padding={3}
      className="w-full max-w-6xl"
      innerClassName="grid overflow-hidden md:grid-cols-[1.15fr_0.85fr]"
      innerStyle={cardStyle}
    >
      <div className="relative hidden min-h-[640px] flex-col justify-between overflow-hidden p-12 md:flex">
        <div
          className="absolute -left-24 -top-24 h-80 w-80 rounded-full blur-3xl"
          style={{ background: activeTheme.deco1 }}
        />
        <div
          className="absolute -bottom-32 right-0 h-96 w-96 rounded-full blur-3xl"
          style={{ background: activeTheme.glowSoft }}
        />

        <div className="relative z-10">
          <div
            className="mb-7 inline-flex h-16 w-16 items-center justify-center rounded-[24px]"
            style={{
              background: activeTheme.brandBadgeBg,
              color: activeTheme.brandBadgeColor,
              boxShadow: `0 0 28px ${activeTheme.glowSoft}`,
            }}
          >
            <Sparkles />
          </div>

          <h2
            className="max-w-md text-5xl font-black leading-tight tracking-tight"
            style={{ color: activeTheme.titleColor, fontFamily: activeTheme.displayFont }}
          >
            Administra {storeName} con seguridad y estilo
          </h2>

          <p
            className="mt-5 max-w-md text-base leading-7"
            style={{ color: activeTheme.mutedColor }}
          >
            Controla productos, órdenes, apariencia, usuarios, logs y configuración desde un acceso privado.
          </p>
        </div>

        <div className="relative z-10 w-fit">
          <StoreIdentity
            theme={activeTheme}
            storeName={storeName}
            storeLogo={storeLogo}
            compact
          />
        </div>
      </div>

      <div className="relative p-6 sm:p-10 md:p-12">
        <LoginForm {...formProps} />
      </div>
    </AnimatedBorderBox>
  );

  const renderGlassFloating = () => (
    <div className="relative w-full max-w-[560px]">
      <div
        className="absolute -left-10 top-10 h-32 w-32 rounded-[34px] blur-xl"
        style={{ background: activeTheme.deco1 }}
      />
      <div
        className="absolute -right-12 bottom-12 h-40 w-40 rounded-full blur-2xl"
        style={{ background: activeTheme.deco2 }}
      />

      <AnimatedBorderBox
        theme={activeTheme}
        rounded="46px"
        padding={3}
        className="relative"
        innerClassName="p-6 sm:p-10"
        innerStyle={{
          ...cardStyle,
          boxShadow: `${activeTheme.cardShadow}, inset 0 1px 0 rgba(255,255,255,0.65)`,
        }}
      >
        <LoginForm {...formProps} variant="glass" />
      </AnimatedBorderBox>
    </div>
  );

  const renderCyberPortal = () => (
    <AnimatedBorderBox
      theme={activeTheme}
      rounded="34px"
      padding={3}
      className="relative w-full max-w-[570px]"
      innerClassName="p-6 sm:p-10"
      innerStyle={cardStyle}
    >
      <div
        className="pointer-events-none absolute -inset-5 rounded-[42px] opacity-50 blur-xl"
        style={{ background: activeTheme.glowSoft }}
      />
      <div
        className="pointer-events-none absolute inset-x-8 top-0 h-[2px]"
        style={{ background: activeTheme.glowColor }}
      />
      <div
        className="pointer-events-none absolute inset-x-8 bottom-0 h-[2px]"
        style={{ background: activeTheme.glowColor }}
      />
      <LoginForm {...formProps} variant="glass" />
    </AnimatedBorderBox>
  );

  const renderLuxuryBoutique = () => (
    <AnimatedBorderBox
      theme={activeTheme}
      rounded="8px"
      padding={3}
      className="relative w-full max-w-[610px]"
      innerClassName="px-7 py-10 sm:px-14 sm:py-12"
      innerStyle={{
        ...cardStyle,
        borderTop: `7px solid ${activeTheme.cardBorder}`,
        borderBottom: `7px solid ${activeTheme.cardBorder}`,
      }}
    >
      <div
        className="absolute left-6 top-6 h-12 w-12 border-l border-t"
        style={{ borderColor: activeTheme.cardBorder }}
      />
      <div
        className="absolute bottom-6 right-6 h-12 w-12 border-b border-r"
        style={{ borderColor: activeTheme.cardBorder }}
      />

      <div
        className="mx-auto mb-7 flex h-12 w-12 items-center justify-center rounded-full"
        style={{
          background: activeTheme.brandBadgeBg,
          color: activeTheme.brandBadgeColor,
          boxShadow: `0 0 24px ${activeTheme.glowSoft}`,
        }}
      >
        {gold ? <Crown size={22} /> : <Sparkles size={22} />}
      </div>

      <LoginForm {...formProps} compact variant="luxury" />
    </AnimatedBorderBox>
  );

  const renderRosaCouture = () => (
    <section className="rb-couture-stage" aria-label={`Acceso administrativo de ${storeName}`}>
      <div className="rb-couture-story">
        <div className="rb-couture-brand">
          <div className="rb-couture-brand-logo">
            {storeLogo ? (
              <img src={storeLogo} alt={`Logo de ${storeName}`} />
            ) : (
              <RosaCoutureMark size={54} />
            )}
          </div>
          <div className="rb-couture-brand-copy">
            <small>Private management house</small>
            <strong>{storeName}</strong>
          </div>
        </div>

        <div className="rb-couture-hero">
          <span className="rb-couture-kicker">{activeCustomization.eyebrow}</span>
          <h1>
            {activeCustomization.headline}
            <em>{activeCustomization.highlight}</em>
          </h1>
          <p>{activeCustomization.description}</p>
        </div>

        <div className="rb-couture-seal" aria-hidden="true">
          <RosaCoutureMark size={330} title="" />
        </div>

        <div className="rb-couture-foot">
          <span>Rosa Signature · Private Edition</span>
          <span><i /> Entorno protegido</span>
        </div>
      </div>

      <div className="rb-couture-access">
        <RosaCoutureLoginForm
          {...formProps}
          storeName={storeName}
          customization={activeCustomization}
        />
      </div>
    </section>
  );

  const curatedFormProps = {
    ...formProps,
    customization: activeCustomization,
  };

  const StoryCopy = ({ className }) => <div className={className}>
    <small>{activeCustomization.eyebrow}</small>
    <h1>{activeCustomization.headline}<em>{activeCustomization.highlight}</em></h1>
    <p>{activeCustomization.description}</p>
  </div>;

  const renderLiquidGlass = () => <section
    className="rb-liquid-stage"
    data-custom-image={hasCustomImageBg ? "true" : undefined}
    aria-label={`Acceso administrativo de ${storeName}`}
    style={{
      "--liquid-glass-opacity": liquidGlassOpacity,
      "--liquid-glass-blur": liquidGlassBlur,
    }}
  >
    <div className="rb-liquid-media" style={{ backgroundImage: `url("${liquidBackground}")`, opacity: hasCustomImageBg ? loginBg.imageOpacity : 1 }} />
    <div className="rb-liquid-overlay" style={{ "--liquid-user-overlay": hasCustomImageBg ? loginBg.overlay : 0.06 }} />
    <div className="rb-liquid-depth" aria-hidden="true">{hasCustomImageBg ? null : <><i /><i /><i /></>}</div>
    <div className="rb-liquid-story"><CuratedStoreBrand storeName={storeName} storeLogo={storeLogo} /><StoryCopy className="rb-theme-copy rb-liquid-copy" /></div>
    <div className="rb-liquid-access rb-editorial-access">
      <span className="rb-editorial-rail" aria-hidden="true"><i /><i /><i /></span>
      <span className="rb-editorial-kicker">ACCESO</span>
      <CuratedCredentialsForm {...curatedFormProps} inputId="rb-liquid" />
    </div>
  </section>;

  const renderImmersiveGallery = () => <section
    className="rb-gallery-stage"
    data-custom-image={hasCustomImageBg ? "true" : undefined}
    data-gallery-tone={galleryImageTone.id}
    aria-label={`Acceso administrativo de ${storeName}`}
  >
    <div className="rb-gallery-media" style={{ backgroundImage: `url("${galleryBackground}")`, opacity: hasCustomImageBg ? loginBg.imageOpacity : 1 }} />
    <div className="rb-gallery-overlay" style={{ "--gallery-user-overlay": hasCustomImageBg ? loginBg.overlay : 0.18 }} />
    <div className="rb-gallery-ambient" aria-hidden="true"><i /><i /></div>
    <div className="rb-gallery-story">
      <CuratedStoreBrand storeName={storeName} storeLogo={storeLogo} />
      <StoryCopy className="rb-theme-copy rb-gallery-copy" />
      <span className="rb-gallery-caption">IDENTIDAD · GESTIÓN · CRECIMIENTO</span>
    </div>
    <div className="rb-gallery-access rb-editorial-access">
      <span className="rb-editorial-rail" aria-hidden="true"><i /><i /><i /></span>
      <span className="rb-editorial-kicker">ACCESO</span>
      <CuratedCredentialsForm {...curatedFormProps} inputId="rb-gallery" />
    </div>
  </section>;

  const renderSmokeGlass = () => <section
    className="rb-smoke-stage"
    data-custom-image={hasCustomImageBg ? "true" : undefined}
    aria-label={`Acceso administrativo de ${storeName}`}
    style={{
      "--smoke-glass-opacity": smokeGlassOpacity,
      "--smoke-glass-blur": smokeGlassBlur,
    }}
  >
    <div className="rb-smoke-media" style={{ backgroundImage: smokeBackground ? `url("${smokeBackground}")` : "none", opacity: hasCustomImageBg ? loginBg.imageOpacity : 1 }} />
    <div className="rb-smoke-overlay" style={{ "--smoke-user-overlay": hasCustomImageBg ? loginBg.overlay : 0.08 }} />
    <div className="rb-smoke-depth" aria-hidden="true">{hasCustomImageBg ? null : <><i /><i /><i /></>}</div>
    <div className="rb-smoke-access rb-editorial-access">
      <CuratedStoreBrand className="rb-panel-brand" storeName={storeName} storeLogo={storeLogo} />
      <span className="rb-editorial-rail" aria-hidden="true"><i /><i /><i /></span>
      <span className="rb-editorial-kicker">ACCESO</span>
      <CuratedCredentialsForm {...curatedFormProps} inputId="rb-smoke" />
    </div>
  </section>;

  const renderLayout = () => {
    if (isLiquidGlass) return renderLiquidGlass();
    if (isImmersiveGallery) return renderImmersiveGallery();
    if (isSmokeGlass) return renderSmokeGlass();

    switch (activeLayout.id) {
      case "electricCircle":
        return renderElectricCircle();
      case "splitPanel":
        return renderSplitPanel();
      case "glassFloating":
        return renderGlassFloating();
      case "cyberPortal":
        return renderCyberPortal();
      case "luxuryBoutique":
        return renderLuxuryBoutique();
      case "centeredCard":
      default:
        return renderCenteredCard();
    }
  };

  return (
    <div
      data-login-theme={activeTheme.id}
      data-login-custom-image={hasCustomImageBg ? "true" : undefined}
      className={`rb-login-shell relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8 theme-${activeTheme.id}`}
      style={{
        background: loginPageBackground,
        "--login-primary": activeCustomization.primary,
        "--login-secondary": activeCustomization.secondary,
        "--login-accent": activeCustomization.accent,
        "--login-surface": activeCustomization.surface,
        "--login-page-background": loginPageBackground,
      }}
    >
      <style>
        {`
          @keyframes rbLoginBorderFlow {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          @keyframes rbLoginAuraFloat {
            0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
            50% { transform: translate3d(0, -12px, 0) scale(1.04); }
          }
        `}
      </style>

      {hasCustomImageBg && !isSmokeGlass && (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url("${loginBg.image}")`,
              opacity: loginBg.imageOpacity,
            }}
          />

          <div
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              background: `rgba(0,0,0,${loginBg.overlay})`,
            }}
          />
        </>
      )}

      {!isCuratedTheme ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-[1] opacity-70"
            style={{
              backgroundImage: activeTheme.pagePattern,
              backgroundSize: activeTheme.patternSize,
              maskImage: "linear-gradient(to bottom, rgba(0,0,0,.9), rgba(0,0,0,.28))",
            }}
          />

          <div
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{
              background: dark
                ? "radial-gradient(circle at center, transparent 28%, rgba(0,0,0,.44) 100%)"
                : "radial-gradient(circle at center, transparent 30%, rgba(255,255,255,.36) 100%)",
            }}
          />

          <div
            className="pointer-events-none absolute -left-20 top-8 z-[1] h-72 w-72 rounded-full blur-3xl"
            style={{ background: activeTheme.deco1, animation: "rbLoginAuraFloat 9s ease-in-out infinite" }}
          />
          <div
            className="pointer-events-none absolute -right-16 bottom-6 z-[1] h-80 w-80 rounded-full blur-3xl"
            style={{ background: activeTheme.deco2, animation: "rbLoginAuraFloat 11s ease-in-out infinite reverse" }}
          />
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 z-[1] h-[580px] w-[580px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
            style={{ background: activeTheme.glowSoft }}
          />

          {!hasCustomImageBg ? (
            <div className="pointer-events-none absolute inset-0 z-[1] opacity-[0.05]">
              <div
                className="h-full w-full"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
                  backgroundSize: "42px 42px",
                  color: activeTheme.glowColor,
                }}
              />
            </div>
          ) : null}

          <div className="absolute left-5 top-5 z-[4] hidden lg:block">
            <StoreIdentity
              theme={activeTheme}
              storeName={storeName}
              storeLogo={storeLogo}
              compact
            />
          </div>
        </>
      ) : null}

      <div className="relative z-[2] mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center justify-center">
        {renderLayout()}
      </div>

      {!isCuratedTheme ? (
        <div
          className="pointer-events-none fixed bottom-5 left-1/2 z-[3] hidden -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold md:flex"
          style={{
            color: activeTheme.mutedColor,
            borderColor: activeTheme.cardBorder,
            background: dark ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.50)",
            backdropFilter: "blur(12px)",
          }}
        >
          <Fingerprint size={14} />
          Sistema protegido con autenticación segura
        </div>
      ) : null}

      <RequiredPasswordChangeModal
        open={showRequiredPasswordChange}
        user={requiredPasswordUser}
        onSuccess={handleRequiredPasswordSuccess}
        onCancel={handleRequiredPasswordCancel}
      />
      <TwoFactorChallengeModal
        open={showTwoFactorChallenge}
        user={twoFactorUser}
        onSuccess={handleTwoFactorSuccess}
        onCancel={handleTwoFactorCancel}
      />
    </div>
  );
}
