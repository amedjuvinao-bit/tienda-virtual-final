import { Input, Toggle } from "./ProductDetailEditorFields";
import EditorSection from "./EditorSection";
import AdminImageUploadField from "../../media/AdminImageUploadField";
export default function CollectionCatalogControls({
  value,
  onChange,
  saving,
  onUploadingChange,
}) {
  return (
    <>
      <EditorSection
        title="Ilustración de la selección"
        text="Esta ilustración es decorativa; las fotos de las tarjetas siempre proceden de los productos reales."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Toggle
            label="Mostrar ilustración"
            checked={value.showArtwork}
            onChange={(showArtwork) => onChange({ showArtwork })}
          />
          <div className="sm:col-span-2">
            <AdminImageUploadField
              label="Ilustración del catálogo"
              value={value.heroArtwork}
              disabled={saving}
              onChange={(heroArtwork) => onChange({ heroArtwork })}
              onBusyChange={onUploadingChange}
            />
          </div>
          <Input
            label="Descripción de la ilustración (vacío si es decorativa)"
            value={value.heroArtworkAlt}
            onChange={(event) =>
              onChange({ heroArtworkAlt: event.target.value })
            }
          />
          <Input
            label="Ancho de la ilustración (px)"
            type="number"
            min={120}
            max={460}
            value={value.artworkWidthPx}
            onChange={(event) =>
              onChange({ artworkWidthPx: event.target.value })
            }
          />
        </div>
      </EditorSection>
      <EditorSection title="Buscador y categorías">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Ayuda del buscador"
            value={value.searchPlaceholder}
            onChange={(event) =>
              onChange({ searchPlaceholder: event.target.value })
            }
          />
          <Input
            label="Título del filtro de categorías"
            value={value.categoriesTitle}
            onChange={(event) =>
              onChange({ categoriesTitle: event.target.value })
            }
          />
        </div>
      </EditorSection>
      <EditorSection
        title="Sin coincidencias"
        text="Este mensaje se usa cuando una búsqueda o filtro no encuentra productos. El estado inicial sin productos se configura en Sin resultados."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Texto si falta una foto"
            value={value.missingImageText}
            onChange={(event) =>
              onChange({ missingImageText: event.target.value })
            }
          />
          <Input
            label="Título sin coincidencias"
            value={value.filteredEmptyTitle}
            onChange={(event) =>
              onChange({ filteredEmptyTitle: event.target.value })
            }
          />
          <Input
            label="Explicación sin coincidencias"
            value={value.filteredEmptyText}
            onChange={(event) =>
              onChange({ filteredEmptyText: event.target.value })
            }
          />
        </div>
      </EditorSection>
    </>
  );
}
