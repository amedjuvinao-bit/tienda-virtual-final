import { Input, Toggle } from "./ProductDetailEditorFields";
import AdminImageUploadField from "../../media/AdminImageUploadField";

export default function CollectionCatalogArtworkControls({
  value,
  onChange,
  disabled = false,
  onUploadingChange,
}) {
  return (
    <fieldset disabled={disabled} className="grid min-w-0 gap-4 sm:grid-cols-2">
      <Toggle
        label="Mostrar ilustración"
        checked={value.showArtwork}
        onChange={(showArtwork) => onChange({ showArtwork })}
      />
      <div className="sm:col-span-2">
        <AdminImageUploadField
          label="Ilustración del catálogo"
          value={value.heroArtwork}
          disabled={disabled}
          onChange={(heroArtwork) => onChange({ heroArtwork })}
          onBusyChange={onUploadingChange}
        />
      </div>
      <Input
        label="Descripción de la ilustración (vacío si es decorativa)"
        value={value.heroArtworkAlt}
        onChange={(event) => onChange({ heroArtworkAlt: event.target.value })}
      />
      <Input
        label="Ancho de la ilustración (px)"
        type="number"
        min={120}
        max={460}
        value={value.artworkWidthPx}
        onChange={(event) => onChange({ artworkWidthPx: event.target.value })}
      />
    </fieldset>
  );
}
