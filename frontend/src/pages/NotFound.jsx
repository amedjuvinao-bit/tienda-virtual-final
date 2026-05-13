// src/pages/NotFound.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const DEFAULT_CONFIG = {
  titleText: "Página no encontrada",
  messageText: "La ruta a la que intentaste acceder no existe.",
  buttonText: "Volver al inicio",
  buttonLink: "/",
  showTitle: true,
  showMessage: true,
  showButton: true,
};

export default function NotFound() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNotFound = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/pages/not-found`);
        const data = await res.json().catch(() => ({}));

        if (res.ok && data?.notFoundPageConfig) {
          setConfig({
            ...DEFAULT_CONFIG,
            ...data.notFoundPageConfig,
          });
        }
      } catch (error) {
        console.error("Error cargando NotFound:", error);
      } finally {
        setLoading(false);
      }
    };

    loadNotFound();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-neutral-500 text-sm tracking-wide">
        Cargando...
      </div>
    );
  }

  return (
    <div
      className="min-h-screen relative overflow-hidden flex items-center justify-center px-5 sm:px-8"
      style={{
        background: config.pageBg || "#f8f8f7",
      }}
    >
      {/* fondo minimalista */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[85vw] h-px bg-neutral-200" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[85vw] h-px bg-neutral-200" />
        <div className="absolute top-12 left-12 w-24 h-24 rounded-full border border-neutral-200 opacity-40" />
        <div className="absolute bottom-12 right-12 w-32 h-32 rounded-full border border-neutral-200 opacity-40" />
      </div>

      <div className="relative w-full max-w-3xl mx-auto text-center">
        {/* 404 grande */}
        <div className="mb-6 sm:mb-8">
          <p
            className="font-light leading-none tracking-[-0.08em] select-none"
            style={{
              color: config.titleTextColor || "#111111",
              fontSize: "clamp(72px, 20vw, 180px)",
              opacity: 0.09,
            }}
          >
            404
          </p>
        </div>

        {/* contenido principal */}
        <div className="max-w-xl mx-auto">
          {config.showTitle && (
            <h1
              className="font-semibold leading-[1.05] tracking-[-0.04em] mb-4"
              style={{
                fontSize: config.titleFontSizePx
                  ? `${config.titleFontSizePx}px`
                  : "clamp(28px, 5vw, 54px)",
                color: config.titleTextColor || "#111111",
              }}
            >
              {config.titleText}
            </h1>
          )}

          {config.showMessage && (
            <p
              className="mx-auto mb-8 sm:mb-10 max-w-lg leading-7 font-normal"
              style={{
                color: config.textSecondaryColor || "#5f5f5f",
                fontSize: config.messageFontSizePx
                  ? `${config.messageFontSizePx}px`
                  : "clamp(14px, 2vw, 17px)",
              }}
            >
              {config.messageText}
            </p>
          )}

          {config.showButton && (
            <Link
              to={config.buttonLink || "/"}
              className="inline-flex items-center justify-center min-w-[200px] px-7 sm:px-9 py-3.5 sm:py-4 border transition-all duration-300 hover:-translate-y-[1px] hover:shadow-md"
              style={{
                background: config.buttonBg || "#111111",
                color: config.buttonTextColor || "#ffffff",
                borderColor: config.buttonBg || "#111111",
                borderRadius: "999px",
                letterSpacing: "0.04em",
                fontWeight: 500,
                fontSize: "14px",
              }}
            >
              {config.buttonText}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}