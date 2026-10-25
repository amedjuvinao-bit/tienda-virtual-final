import { useContext, useEffect, useState } from "react";
import { StorefrontSettingsContext } from "../../context/StorefrontSettingsContext";
import { catalogContinuityBackdrop } from "../catalog/catalogBackdrop";
import { catalogImageUrl } from "../catalog/catalogPresentation";

export default function useProductDetailBackdrop(presentation, pageBg) {
  const settings = useContext(StorefrontSettingsContext);
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );
  useEffect(() => {
    const query = window.matchMedia?.("(max-width: 767px)");
    if (!query) return;
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  const backdrop =
    presentation.backgroundMode === "continuity"
      ? catalogContinuityBackdrop(settings?.theme, mobile)
      : null;
  const custom =
    mobile && presentation.mobileBackgroundImage
      ? presentation.mobileBackgroundImage
      : presentation.backgroundImage;
  return {
    image:
      backdrop?.image ||
      (presentation.backgroundMode === "custom" ? catalogImageUrl(custom) : ""),
    color: backdrop?.color || pageBg,
    settings,
  };
}
