import { Input } from "./ProductDetailEditorFields";
import EditorSection from "./EditorSection";
import CollectionCatalogArtworkControls from "./CollectionCatalogArtworkControls";
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
        <CollectionCatalogArtworkControls
          value={value}
          onChange={onChange}
          disabled={saving}
          onUploadingChange={onUploadingChange}
        />
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
