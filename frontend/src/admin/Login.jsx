// src/admin/Login.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Lock,
  User,
  ShieldCheck,
  Sparkles,
  Crown,
  Fingerprint,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api, { setAdminToken } from "../lib/api";
import {
  LOGIN_THEMES,
  LOGIN_LAYOUTS,
  DEFAULT_LOGIN_THEME_ID,
  DEFAULT_LOGIN_LAYOUT_ID,
} from "./login/loginThemes";

const LOGIN_THEME_STORAGE_KEY = "admin_login_theme_id";
const LOGIN_LAYOUT_STORAGE_KEY = "admin_login_layout_id";

const LOGIN_BG_MODE_KEY = "admin_login_bg_mode";
const LOGIN_BG_COLOR_KEY = "admin_login_bg_color";
const LOGIN_BG_IMAGE_KEY = "admin_login_bg_image";
const LOGIN_BG_IMAGE_OPACITY_KEY = "admin_login_bg_image_opacity";
const LOGIN_BG_OVERLAY_KEY = "admin_login_bg_overlay";

const LOGIN_FAILED_ATTEMPTS_KEY = "admin_login_failed_attempts";
const LOGIN_LOCK_UNTIL_KEY = "admin_login_lock_until";

const ADMIN_LOGIN_ENDPOINT = "/api/admin/auth/login";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 2 * 60 * 1000;

function getSavedLoginThemeId() {
  try {
    const saved = localStorage.getItem(LOGIN_THEME_STORAGE_KEY);
    if (saved && LOGIN_THEMES[saved]) return saved;
  } catch {}
  return DEFAULT_LOGIN_THEME_ID;
}

function getSavedLoginLayoutId() {
  try {
    const saved = localStorage.getItem(LOGIN_LAYOUT_STORAGE_KEY);
    if (saved && LOGIN_LAYOUTS[saved]) return saved;
  } catch {}
  return DEFAULT_LOGIN_LAYOUT_ID;
}

function getStoredLoginBg() {
  try {
    return {
      mode: localStorage.getItem(LOGIN_BG_MODE_KEY) || "theme",
      color: localStorage.getItem(LOGIN_BG_COLOR_KEY) || "#fff7fb",
      image: localStorage.getItem(LOGIN_BG_IMAGE_KEY) || "",
      imageOpacity: Number(
        localStorage.getItem(LOGIN_BG_IMAGE_OPACITY_KEY) || 0.35
      ),
      overlay: Number(localStorage.getItem(LOGIN_BG_OVERLAY_KEY) || 0.35),
    };
  } catch {
    return {
      mode: "theme",
      color: "#fff7fb",
      image: "",
      imageOpacity: 0.35,
      overlay: 0.35,
    };
  }
}

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

function isDarkTheme(theme) {
  return ["electricNeon", "darkCyber"].includes(theme?.id);
}

function isGoldTheme(theme) {
  return theme?.id === "goldBoutiqueLight" || theme?.id === "goldLuxury";
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
              : `0 10px 30px ${theme.glowSoft || "rgba(0,0,0,0.06)"}`,
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
  compact = false,
  variant = "default",
  showBadge = true,
  title = "Iniciar sesión",
  subtitle = "Accede al panel de administración de forma segura",
}) {
  const dark = isDarkTheme(theme);
  const inputVariant = variant === "luxury" ? "line" : variant;

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
            <Lock size={26} />
          </div>
        )}

        <h2
          className={`${compact ? "text-xl" : "text-3xl sm:text-4xl"} font-black tracking-tight`}
          style={{
            color: theme.titleColor,
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
}) {
  const dark = isDarkTheme(theme);

  return (
    <div className="w-full max-w-[300px]">
      <div className="mb-7 text-center">
        <h2
          className="text-2xl font-semibold uppercase tracking-wide"
          style={{
            color: theme.titleColor,
            textShadow: dark ? `0 0 18px ${theme.glowSoft}` : "none",
          }}
        >
          Acceso seguro
        </h2>

        <p className="mt-2 text-xs" style={{ color: theme.mutedColor }}>
          Panel administrativo privado
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

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [activeThemeId, setActiveThemeId] = useState(getSavedLoginThemeId);
  const [activeLayoutId, setActiveLayoutId] = useState(getSavedLoginLayoutId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockRemaining, setLockRemaining] = useState(0);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginBg, setLoginBg] = useState(getStoredLoginBg);

  const { login } = useAuth();
  const navigate = useNavigate();

  const activeTheme = useMemo(() => {
    return LOGIN_THEMES[activeThemeId] || LOGIN_THEMES[DEFAULT_LOGIN_THEME_ID];
  }, [activeThemeId]);

  const activeLayout = useMemo(() => {
    return LOGIN_LAYOUTS[activeLayoutId] || LOGIN_LAYOUTS[DEFAULT_LOGIN_LAYOUT_ID];
  }, [activeLayoutId]);

  useEffect(() => {
    const syncLoginConfig = () => {
      setActiveThemeId(getSavedLoginThemeId());
      setActiveLayoutId(getSavedLoginLayoutId());
      setLoginBg(getStoredLoginBg());
    };

    window.addEventListener("storage", syncLoginConfig);
    window.addEventListener("admin-login-theme-updated", syncLoginConfig);

    return () => {
      window.removeEventListener("storage", syncLoginConfig);
      window.removeEventListener("admin-login-theme-updated", syncLoginConfig);
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

  const registerFailedAttempt = () => {
    const nextAttempts = getFailedAttempts() + 1;
    setFailedAttempts(nextAttempts);

    if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
      setLockUntil(Date.now() + LOCK_TIME_MS);
      setLockRemaining(LOCK_TIME_MS);
    }
  };

  const authenticateAdmin = async ({ cleanUsername, cleanPassword }) => {
    const response = await api.post(ADMIN_LOGIN_ENDPOINT, {
      username: cleanUsername,
      password: cleanPassword,
    });

    const token =
      response?.data?.token ||
      response?.data?.adminToken ||
      response?.data?.accessToken;

    if (!token) throw new Error("LOGIN_TOKEN_MISSING");

    return token;
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

      const token = await authenticateAdmin({
        cleanUsername,
        cleanPassword,
      });

      setAdminToken(token);
      login(token);
      clearLoginSecurityState();

      setUsername("");
      setPassword("");

      navigate("/admin/dashboard");
    } catch {
      registerFailedAttempt();
      setError("No fue posible iniciar sesión. Verifica tus credenciales.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const lockSeconds = Math.ceil(lockRemaining / 1000);
  const isLocked = lockRemaining > 0;
  const dark = isDarkTheme(activeTheme);
  const gold = isGoldTheme(activeTheme);
  const hasCustomImageBg = loginBg.mode === "image" && Boolean(loginBg.image);

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
  };

  const cardStyle = {
    background: activeTheme.cardBg,
    borderColor: activeTheme.cardBorder,
    boxShadow: activeTheme.cardShadow,
    backdropFilter: "blur(18px)",
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
          style={{ background: activeTheme.buttonBg }}
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
            style={{ color: activeTheme.titleColor }}
          >
            Administra tu tienda con seguridad y estilo
          </h2>

          <p
            className="mt-5 max-w-md text-base leading-7"
            style={{ color: activeTheme.mutedColor }}
          >
            Controla productos, órdenes, apariencia, usuarios, logs y configuración desde un acceso privado.
          </p>
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

  const renderLayout = () => {
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
      className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8"
      style={{ background: loginPageBackground }}
    >
      <style>
        {`
          @keyframes rbLoginBorderFlow {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `}
      </style>

      {hasCustomImageBg && (
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

      <div
        className="pointer-events-none absolute -left-20 top-8 z-[1] h-72 w-72 rounded-full blur-3xl"
        style={{ background: activeTheme.deco1 }}
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-6 z-[1] h-80 w-80 rounded-full blur-3xl"
        style={{ background: activeTheme.deco2 }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-[1] h-[580px] w-[580px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: activeTheme.glowSoft }}
      />

      {!hasCustomImageBg && (
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
      )}

      <div className="relative z-[2] mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center justify-center">
        {renderLayout()}
      </div>

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
    </div>
  );
}