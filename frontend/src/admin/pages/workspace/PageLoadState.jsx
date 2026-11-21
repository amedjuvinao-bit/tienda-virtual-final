import React from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import "./pagesWorkspace.css";
export default function PageLoadState({ loading, error, onRetry, onBack }) {
  if (loading)
    return (
      <div className="pages-empty" role="status">
        Cargando tu página…
      </div>
    );
  return (
    <section className="pages-list pages-empty" role="alert">
      <h1>{error ? "No pudimos abrir la página" : "Página no encontrada"}</h1>
      <p>
        {error
          ? "Comprueba tu conexión y vuelve a intentarlo. Tus páginas se conservan."
          : "Esta página no está disponible. Puedes volver al listado para elegir otra."}
      </p>
      <div className="page-load-actions">
        <button className="pages-button" onClick={onBack}>
          <ArrowLeft size={16} /> Volver a Páginas
        </button>
        {error && (
          <button
            className="pages-button pages-button--primary"
            onClick={onRetry}
          >
            <RefreshCw size={16} /> Reintentar
          </button>
        )}
      </div>
    </section>
  );
}
