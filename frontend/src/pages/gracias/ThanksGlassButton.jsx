import PolishedGlassRim from "../../components/PolishedGlassRim";
export default function ThanksGlassButton({
  config,
  children,
  secondary = false,
  ...props
}) {
  const s = config.style;
  const radius =
    s.buttonStyle === "pill"
      ? 999
      : s.buttonStyle === "square"
        ? 8
        : s.buttonRadiusPx;
  return (
    <button
      type="button"
      className="gp-cta-btn"
      data-secondary={secondary}
      {...props}
    >
      {children}
      <PolishedGlassRim
        radius={radius}
        width={config.presentation.borderWidth}
        reflection={config.presentation.reflection}
      />
    </button>
  );
}
