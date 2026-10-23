// src/components/GlobalPageLoader.jsx
import React from "react";
import {
  Sparkles,
  Star,
  Heart,
  Crown,
  Flower2,
  ShoppingBag,
  Gem,
} from "lucide-react";

function isValidHex(value) {
  return typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

function isValidCssColor(value) {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v) return false;
  if (isValidHex(v)) return true;
  return /^rgba?\(.+\)$/i.test(v) || /^hsla?\(.+\)$/i.test(v);
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function getSpeedMs(speed, durationMs) {
  const safeDuration = clampNumber(durationMs, 200, 5000, 1200);
  if (speed === "slow") return Math.round(safeDuration * 1.25);
  if (speed === "fast") return Math.round(safeDuration * 0.78);
  return safeDuration;
}

function getAnimationName(animation, fallback = "rbLoaderSpin") {
  const allowed = [
    "spin",
    "pulse",
    "float",
    "bounce",
    "breath",
    "wave",
    "orbit",
    "shimmer",
  ];
  return allowed.includes(animation) ? animation : fallback;
}

function getAnimationCssName(animation, fallback = "rbLoaderSpin") {
  const map = {
    spin: "rbLoaderSpin",
    pulse: "rbLoaderPulse",
    float: "rbLoaderFloat",
    bounce: "rbLoaderBounce",
    breath: "rbLoaderBreath",
    wave: "rbLoaderWave",
    orbit: "rbLoaderOrbit",
    shimmer: "rbLoaderShimmer",
  };
  return map[getAnimationName(animation)] || fallback;
}

function getIconComponent(icon) {
  switch (icon) {
    case "sparkles":
      return Sparkles;
    case "star":
      return Star;
    case "heart":
      return Heart;
    case "diamond":
      return Gem;
    case "crown":
      return Crown;
    case "flower":
      return Flower2;
    case "bag":
      return ShoppingBag;
    default:
      return null;
  }
}

function CenterIcon({ icon, color, size, animationCssName, durationMs }) {
  const IconComp = getIconComponent(icon);
  if (!IconComp) return null;

  return (
    <div
      className="storefront-loader-icon"
      style={{
        position: "absolute",
        width: Math.max(26, Math.round(size * 0.55)),
        height: Math.max(26, Math.round(size * 0.55)),
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <IconComp
        size={Math.max(14, Math.round(size * 0.34))}
        strokeWidth={1.8}
        style={{
          color,
          filter: `drop-shadow(0 2px 4px ${color}66)`,
          animation: `${animationCssName} ${durationMs}ms ease-in-out infinite`,
        }}
      />
    </div>
  );
}

function SpinnerLoader({
  color,
  secondaryColor,
  size,
  strokeWidth,
  animationCssName,
  durationMs,
  icon,
}) {
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: "999px",
          border: `${strokeWidth}px solid ${secondaryColor}`,
          borderTopColor: color,
          animation: `${animationCssName} ${durationMs}ms linear infinite`,
          boxSizing: "border-box",
        }}
      />
      <CenterIcon
        icon={icon}
        color={color}
        size={size}
        animationCssName="rbLoaderPulse"
        durationMs={durationMs}
      />
    </div>
  );
}

function RingLoader({
  color,
  secondaryColor,
  size,
  strokeWidth,
  animationCssName,
  durationMs,
  icon,
}) {
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "999px",
          border: `${strokeWidth}px solid ${secondaryColor}`,
          boxSizing: "border-box",
          opacity: 0.45,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "999px",
          border: `${strokeWidth}px solid transparent`,
          borderTopColor: color,
          borderRightColor: color,
          boxSizing: "border-box",
          animation: `${animationCssName} ${durationMs}ms linear infinite`,
        }}
      />
      <CenterIcon
        icon={icon}
        color={color}
        size={size}
        animationCssName="rbLoaderBreath"
        durationMs={durationMs}
      />
    </div>
  );
}

function DualRingLoader({
  color,
  secondaryColor,
  size,
  strokeWidth,
  durationMs,
  icon,
}) {
  const innerSize = Math.round(size * 0.66);

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "999px",
          border: `${strokeWidth}px solid transparent`,
          borderTopColor: color,
          borderRightColor: color,
          boxSizing: "border-box",
          animation: `rbLoaderSpin ${durationMs}ms linear infinite`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: innerSize,
          height: innerSize,
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          borderRadius: "999px",
          border: `${Math.max(2, strokeWidth - 1)}px solid transparent`,
          borderBottomColor: secondaryColor,
          borderLeftColor: secondaryColor,
          boxSizing: "border-box",
          animation: `rbLoaderSpinReverse ${Math.max(500, durationMs - 180)}ms linear infinite`,
        }}
      />
      <CenterIcon
        icon={icon}
        color={color}
        size={size}
        animationCssName="rbLoaderPulse"
        durationMs={durationMs}
      />
    </div>
  );
}

function InlineIcon({ icon, color, size }) {
  const IconComp = getIconComponent(icon);
  if (!IconComp) return null;
  return (
    <span className="storefront-loader-icon" style={{ display: "grid", placeItems: "center", width: Math.max(28, size * 0.55), height: Math.max(28, size * 0.55) }}>
      <IconComp size={Math.max(16, size * 0.32)} strokeWidth={1.8} color={color} />
    </span>
  );
}

function DotsLoader({ color, secondaryColor, size, durationMs, icon }) {
  const dot = Math.max(8, Math.round(size * 0.16));
  const gap = Math.max(8, Math.round(size * 0.08));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: `${gap}px`,
        minHeight: `${dot}px`,
      }}
      >
      <InlineIcon icon={icon} color={color} size={size} />
      <div style={{ display: "flex", gap: `${gap}px` }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: `${dot}px`,
              height: `${dot}px`,
              borderRadius: "999px",
              background: i === 1 ? secondaryColor : color,
              animation: `rbLoaderDotBounce ${durationMs}ms ease-in-out ${i * 120}ms infinite`,
              display: "inline-block",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function BarsLoader({ color, secondaryColor, size, durationMs, icon }) {
  const width = Math.max(42, Math.round(size * 0.82));
  const barWidth = Math.max(5, Math.round(size * 0.1));
  const barHeight = Math.max(20, Math.round(size * 0.58));
  const gap = Math.max(4, Math.round(size * 0.06));

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: `${gap}px` }}>
      <InlineIcon icon={icon} color={color} size={size} />
      <div
        style={{
          width: `${width}px`,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: `${gap}px`,
          height: `${barHeight}px`,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            style={{
              width: `${barWidth}px`,
              height: `${barHeight}px`,
              borderRadius: "999px",
              background: i % 2 === 0 ? color : secondaryColor,
              transformOrigin: "bottom center",
              animation: `rbLoaderBarScale ${Math.max(650, durationMs)}ms ease-in-out ${i * 120}ms infinite`,
              display: "inline-block",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PulseLoader({ color, secondaryColor, size, durationMs, icon }) {
  const inner = Math.round(size * 0.42);

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "999px",
          background: `${secondaryColor}`,
          opacity: 0.32,
          animation: `rbLoaderPulseRing ${durationMs}ms ease-out infinite`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: `${inner}px`,
          height: `${inner}px`,
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          borderRadius: "999px",
          background: color,
          boxShadow: `0 0 24px ${color}33`,
        }}
      />
      <CenterIcon
        icon={icon}
        color="#ffffff"
        size={size}
        animationCssName="rbLoaderPulse"
        durationMs={durationMs}
      />
    </div>
  );
}

function DiamondLoader({ color, secondaryColor, size, durationMs, icon }) {
  const core = Math.round(size * 0.52);

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <div
        style={{
          position: "absolute",
          width: `${size}px`,
          height: `${size}px`,
          left: 0,
          top: 0,
          borderRadius: `${Math.max(10, Math.round(size * 0.16))}px`,
          border: `2px solid ${secondaryColor}`,
          transform: "rotate(45deg)",
          animation: `rbLoaderFloat ${durationMs}ms ease-in-out infinite`,
          boxSizing: "border-box",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: `${core}px`,
          height: `${core}px`,
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%) rotate(45deg)",
          borderRadius: `${Math.max(8, Math.round(core * 0.16))}px`,
          background: color,
          boxShadow: `0 8px 24px ${color}30`,
        }}
      />
      <CenterIcon
        icon={icon}
        color="#ffffff"
        size={size}
        animationCssName="rbLoaderBreath"
        durationMs={durationMs}
      />
    </div>
  );
}

function OrbitLoader({ color, secondaryColor, size, durationMs, icon }) {
  const dot = Math.max(10, Math.round(size * 0.16));
  const core = Math.max(18, Math.round(size * 0.28));

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "999px",
          border: `1px solid ${secondaryColor}`,
          opacity: 0.6,
          boxSizing: "border-box",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: `${core}px`,
          height: `${core}px`,
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          borderRadius: "999px",
          background: color,
          boxShadow: `0 0 24px ${color}40`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          animation: `rbLoaderOrbit ${durationMs}ms linear infinite`,
        }}
      >
        <div
          style={{
            position: "absolute",
            width: `${dot}px`,
            height: `${dot}px`,
            right: `-${Math.round(dot * 0.15)}px`,
            top: "50%",
            transform: "translateY(-50%)",
            borderRadius: "999px",
            background: secondaryColor,
            boxShadow: `0 0 14px ${secondaryColor}66`,
          }}
        />
      </div>
      <CenterIcon
        icon={icon}
        color="#ffffff"
        size={size}
        animationCssName="rbLoaderPulse"
        durationMs={durationMs}
      />
    </div>
  );
}

function LoaderVisual({
  type,
  color,
  secondaryColor,
  sizePx,
  strokeWidth,
  animation,
  durationMs,
  icon,
}) {
  const animationCssName = getAnimationCssName(animation, "rbLoaderSpin");

  if (type === "ring") {
    return (
      <RingLoader
        color={color}
        secondaryColor={secondaryColor}
        size={sizePx}
        strokeWidth={strokeWidth}
        animationCssName={animationCssName}
        durationMs={durationMs}
        icon={icon}
      />
    );
  }

  if (type === "dual-ring") {
    return (
      <DualRingLoader
        color={color}
        secondaryColor={secondaryColor}
        size={sizePx}
        strokeWidth={strokeWidth}
        durationMs={durationMs}
        icon={icon}
      />
    );
  }

  if (type === "dots") {
    return (
      <DotsLoader
        color={color}
        secondaryColor={secondaryColor}
        size={sizePx}
        durationMs={durationMs}
        icon={icon}
      />
    );
  }

  if (type === "bars") {
    return (
      <BarsLoader
        color={color}
        secondaryColor={secondaryColor}
        size={sizePx}
        durationMs={durationMs}
        icon={icon}
      />
    );
  }

  if (type === "pulse") {
    return (
      <PulseLoader
        color={color}
        secondaryColor={secondaryColor}
        size={sizePx}
        durationMs={durationMs}
        icon={icon}
      />
    );
  }

  if (type === "diamond") {
    return (
      <DiamondLoader
        color={color}
        secondaryColor={secondaryColor}
        size={sizePx}
        durationMs={durationMs}
        icon={icon}
      />
    );
  }

  if (type === "orbit") {
    return (
      <OrbitLoader
        color={color}
        secondaryColor={secondaryColor}
        size={sizePx}
        durationMs={durationMs}
        icon={icon}
      />
    );
  }

  return (
    <SpinnerLoader
      color={color}
      secondaryColor={secondaryColor}
      size={sizePx}
      strokeWidth={strokeWidth}
      animationCssName={animationCssName}
      durationMs={durationMs}
      icon={icon}
    />
  );
}

export default function GlobalPageLoader({ config, visible = false }) {
  const safeConfig = config && typeof config === "object" ? config : {};
  const [logoFailed, setLogoFailed] = React.useState(false);

  const enabled = safeConfig.enabled !== false;

  const allowedTypes = [
    "spinner",
    "ring",
    "dual-ring",
    "dots",
    "bars",
    "pulse",
    "diamond",
    "orbit",
  ];
  const type = allowedTypes.includes(safeConfig.type) ? safeConfig.type : "spinner";

  const color = isValidCssColor(safeConfig.color) ? safeConfig.color : "#ec4899";
  const secondaryColor = isValidCssColor(safeConfig.secondaryColor)
    ? safeConfig.secondaryColor
    : "#f9a8d4";

  const textColor = isValidCssColor(safeConfig.textColor) ? safeConfig.textColor : "#111827";
  const sizePx = clampNumber(safeConfig.sizePx, 24, 220, 64);
  const strokeWidth = clampNumber(safeConfig.strokeWidth, 1, 20, 4);
  const durationMs = getSpeedMs(
    safeConfig.speed,
    safeConfig.durationMs
  );

  const logoUrl =
    typeof safeConfig.logoUrl === "string" ? safeConfig.logoUrl.trim() : "";
  React.useEffect(() => setLogoFailed(false), [logoUrl]);
  const logoSizePx = clampNumber(safeConfig.logoSizePx, 20, 400, 72);
  const gapPx = clampNumber(safeConfig.gapPx, 0, 80, 16);
  const showLogo = safeConfig.showLogo !== false;
  const showText = safeConfig.showText !== false;
  const text =
    typeof safeConfig.text === "string" && safeConfig.text.trim()
      ? safeConfig.text.trim()
      : "Cargando...";
  const animation = safeConfig.animation || "spin";
  const icon = safeConfig.icon || "none";

  if (!enabled || !visible) return null;

  return (
    <>
      <style>{`
        @keyframes rbLoaderSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes rbLoaderSpinReverse {
          from { transform: translate(-50%, -50%) rotate(360deg); }
          to { transform: translate(-50%, -50%) rotate(0deg); }
        }

        @keyframes rbLoaderFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes rbLoaderPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.86; }
        }

        @keyframes rbLoaderBreath {
          0%, 100% { transform: scale(1); opacity: 0.95; }
          50% { transform: scale(0.92); opacity: 0.72; }
        }

        @keyframes rbLoaderFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }

        @keyframes rbLoaderBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        @keyframes rbLoaderWave {
          0%, 100% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(4deg) scale(1.03); }
          50% { transform: rotate(0deg) scale(0.98); }
          75% { transform: rotate(-4deg) scale(1.03); }
        }

        @keyframes rbLoaderOrbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes rbLoaderShimmer {
          0% { filter: brightness(0.96); opacity: 0.88; }
          50% { filter: brightness(1.15); opacity: 1; }
          100% { filter: brightness(0.96); opacity: 0.88; }
        }

        @keyframes rbLoaderDotBounce {
          0%, 80%, 100% { transform: translateY(0) scale(0.9); opacity: 0.65; }
          40% { transform: translateY(-8px) scale(1); opacity: 1; }
        }

        @keyframes rbLoaderBarScale {
          0%, 100% { transform: scaleY(0.45); opacity: 0.7; }
          50% { transform: scaleY(1); opacity: 1; }
        }

        @keyframes rbLoaderPulseRing {
          0% { transform: scale(0.5); opacity: 0.4; }
          70% { transform: scale(1.08); opacity: 0; }
          100% { transform: scale(1.08); opacity: 0; }
        }
      `}</style>

      <div
        role="status"
        aria-label="Cargando tienda"
        aria-live="polite"
        aria-busy="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99999,
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "rbLoaderFadeIn 180ms ease-out",
          backdropFilter: "none",
          WebkitBackdropFilter: "none",
          padding: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: `${gapPx}px`,
            maxWidth: "92vw",
          }}
        >
          {showLogo && logoUrl && !logoFailed && <img
            src={logoUrl}
            alt=""
            onError={() => setLogoFailed(true)}
            style={{ width: `${logoSizePx}px`, height: `${logoSizePx}px`, maxWidth: "80vw", maxHeight: "80vh", objectFit: "contain", display: "block" }}
          />}
          <LoaderVisual
            type={type}
            color={color}
            secondaryColor={secondaryColor}
            sizePx={sizePx}
            strokeWidth={strokeWidth}
            animation={animation}
            durationMs={durationMs}
            icon={icon}
          />

          {showText ? (
            <div
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: textColor,
                letterSpacing: "0.02em",
                textAlign: "center",
                animation:
                  animation === "shimmer"
                    ? `rbLoaderShimmer ${durationMs}ms ease-in-out infinite`
                    : `rbLoaderFadeIn 220ms ease-out`,
              }}
            >
              {text}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
