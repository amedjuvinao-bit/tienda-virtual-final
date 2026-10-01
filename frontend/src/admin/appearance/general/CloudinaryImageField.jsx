import React, { useEffect, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export default function CloudinaryImageField({ label, value, onChange, onUpload, uploading, setUploading, savedRevision }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  useEffect(() => setSuccess(false), [savedRevision]);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setSuccess(false);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Elige una imagen PNG, JPG o WebP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("La imagen debe pesar máximo 8 MB.");
      return;
    }
    if (!onUpload) {
      setError("La carga de imágenes no está disponible. Recarga la página.");
      return;
    }

    setBusy(true);
    setUploading?.(true);
    try {
      const uploadedUrl = await onUpload(file, "image");
      if (!uploadedUrl) throw new Error("Cloudinary no devolvió la imagen.");
      setPreviewFailed(false);
      onChange(uploadedUrl);
      setSuccess(true);
    } catch (uploadError) {
      setError(uploadError?.message || "No se pudo subir la imagen. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
      setUploading?.(false);
    }
  };

  return (
    <div className="appearance-general__upload-field xl:col-span-2">
      <div className="appearance-general__upload-preview">
        {value && !previewFailed ? (
          <img src={value} alt={`Imagen de ${label}`} onError={() => setPreviewFailed(true)} />
        ) : (
          <ImagePlus size={29} aria-hidden="true" />
        )}
      </div>
      <div className="appearance-general__upload-controls">
        <strong>{label}</strong>
        <p>Elige un archivo de tu equipo. Se subirá directamente a Cloudinary.</p>
        <div className="appearance-general__upload-actions">
          <label className="appearance-general__upload-pick">
            <ImagePlus size={16} aria-hidden="true" />
            {busy ? "Subiendo imagen…" : value ? "Cambiar imagen" : "Seleccionar imagen"}
            <input type="file" accept="image/png,image/jpeg,image/webp"
              aria-label={`Seleccionar imagen para ${label}`}
              disabled={uploading || busy} onChange={handleFile} />
          </label>
          {value && <button type="button" className="appearance-general__upload-remove"
            disabled={uploading || busy} onClick={() => { onChange(""); setSuccess(false); setError(""); setPreviewFailed(false); }}>
            <Trash2 size={15} aria-hidden="true" /> Quitar
          </button>}
        </div>
        {error && <p className="appearance-general__upload-error" role="alert">{error}</p>}
        {success && !error && <p className="appearance-general__upload-success" role="status">Imagen subida. Pulsa “Guardar cambios” para publicarla.</p>}
        {previewFailed && <p className="appearance-general__upload-error" role="alert">La imagen actual no se puede mostrar. Selecciona otra.</p>}
        <small>PNG, JPG o WebP · máximo 8 MB</small>
      </div>
    </div>
  );
}
