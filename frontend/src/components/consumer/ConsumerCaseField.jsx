import ContactGlassRim from "../information-page/ContactGlassRim";
import { buildClaimsPage } from "./claimsPageConfig";
export default function ConsumerCaseField({
  config,
  label,
  icon: Icon,
  children,
  wide = false,
}) {
  const c = config.claimsPage || buildClaimsPage();
  const rimConfig = {
    ...config,
    presentation: { ...config.presentation, borderWidth: c.fieldBorderWidth },
  };
  return (
    <label
      className={`claims-field${wide ? " consumer-wide" : ""}${children.props.required ? " claims-field--required" : ""}`}
    >
      <span className="claims-field__label">{label}</span>
      <span
        className="claims-field__surface"
        data-multiline={children.type === "textarea"}
      >
        {Icon && <Icon aria-hidden="true" size={19} strokeWidth={1.5} />}
        {children}
        <ContactGlassRim config={rimConfig} radius={c.fieldRadiusPx} />
      </span>
    </label>
  );
}
