import PolishedGlassRim from "../../components/PolishedGlassRim";

// Keep the measured lens geometry, but light this page's rim independently.
// Width, reflection and palette still come from its appearance editor.
export default function ThanksGlassRim({ config, radius }) {
  if (config.presentation.borderWidth <= 0) return null;
  return (
    <PolishedGlassRim
      className="gp-liquid-rim"
      radius={radius ?? config.style.panelRadiusPx}
      // The full convex lip includes both faces of the configured ridge.
      width={config.presentation.borderWidth * 2}
      reflection={config.presentation.reflection}
    />
  );
}
