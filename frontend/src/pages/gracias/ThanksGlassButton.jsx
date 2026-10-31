import ThanksGlassRim from "./ThanksGlassRim";
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
      <ThanksGlassRim config={config} radius={radius} />
    </button>
  );
}
