import { getAdminSectionLabel } from "../appearanceLabels";
import { Field, Input, Toggle } from "./ui/UiComponents";
import { buildSectionHref } from "./ui/sectionHelpers";
import { SectionBadge } from "./ui/SectionsPanelUI";

export default function BasicTab({ section, onChange }) {
  const href = buildSectionHref(section.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="text-xs text-neutral-500">
          <div>
            Editando: <b>{section.id}</b>
          </div>
          <div>Los cambios se guardan en theme.sections</div>
        </div>
        <SectionBadge enabled={section.enabled} supported />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Tipo de sección" hint="Fijo para mantener el contenido de esta sección" name="type">
          <Input value={getAdminSectionLabel(section)} readOnly />
        </Field>

        <Field label="Nombre interno" hint="Cómo lo ves en el panel" name="name">
          <Input
            value={section.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Ej: En tendencia"
          />
        </Field>

        <Field label="ID" hint="Fijo (no editable)" name="id">
          <Input value={section.id} readOnly />
        </Field>

        <Field label="Link de sección (ancla)" hint="Para botones del sitio" name="href">
          <div className="flex gap-2">
            <Input value={href} readOnly />
          </div>
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] items-center gap-4">
        <Field label="Título" hint="Visible (opcional)" name="config.title">
          <Input
            value={section.config?.title || ""}
            onChange={(e) => onChange({ config: { ...section.config, title: e.target.value } })}
            placeholder="EN TENDENCIA"
          />
        </Field>

        <Field label="Subtítulo / descripción" hint="Visible (opcional)" name="config.subtitle">
          <Input
            value={section.config?.subtitle || ""}
            onChange={(e) => onChange({ config: { ...section.config, subtitle: e.target.value } })}
            placeholder="Lo más vendido hoy"
          />
        </Field>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-neutral-200 mt-4">
        <div className="text-xs text-neutral-500">
          Nota: este panel solo edita <code>theme.sections</code>. El guardado real lo hace el botón de “Guardar cambios”.
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-600">Activa</span>
          <Toggle checked={!!section.enabled} onChange={(checked) => onChange({ enabled: !!checked })} />
        </div>
      </div>
    </div>
  );
}
