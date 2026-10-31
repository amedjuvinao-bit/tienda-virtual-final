import { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config/apiBaseUrl";
import { StorefrontSettingsContext } from "../../context/StorefrontSettingsContext";
import { rememberPageLoadingAppearance } from "../../theme/storefrontLoadingAppearance";
import { storeOrderReturnAccess } from "../../utils/orderReturnAccess";
import { selectPaymentResponse } from "./paymentResponseModel";
import { buildSafeThanksPageConfig } from "./thanksPageConfig";
import {
  buildThanksPageSlides,
  buildThanksPageViewModel,
  getThanksPagePresentationStyle,
} from "./thanksPageViewModel";
import useThanksVerification from "./useThanksVerification";
export function useGraciasPageController() {
  const location = useLocation(),
    navigate = useNavigate();
  const settings = useContext(StorefrontSettingsContext);
  const paymentResponse = useMemo(
    () => selectPaymentResponse(location.search),
    [location.search],
  );
  const query = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const backendOrderId = String(
    location.state?.orderId ||
      paymentResponse.orderId ||
      query.get("orderId") ||
      "",
  );
  const transactionId = String(
    query.get("id") ||
      query.get("tx") ||
      location.state?.transactionId ||
      paymentResponse.transactionId ||
      "",
  );
  const verification = useThanksVerification({
    orderId: backendOrderId,
    transactionId,
    hasResponse: paymentResponse.exists,
  });
  const [page, setPage] = useState(null),
    [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [paused, setPaused] = useState(false),
    [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setConfigError("");
    fetch(`${API_BASE_URL}/api/pages/gracias`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("CMS_UNAVAILABLE");
        return response.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) setPage(data);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setConfigError(
            "No pudimos cargar la apariencia de esta página. Puedes reintentar.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);
  const thanksConfig = useMemo(
    () =>
      buildSafeThanksPageConfig(
        page?.enabled === false ? {} : page?.thanksPageConfig,
      ),
    [page],
  );
  useEffect(() => {
    if (page)
      rememberPageLoadingAppearance(
        "/gracias",
        settings?.theme,
        thanksConfig.presentation,
        thanksConfig.style.pageBg,
      );
  }, [page, settings?.theme, thanksConfig]);
  const viewModel = useMemo(
    () =>
      buildThanksPageViewModel({
        paymentResponse,
        thanksConfig,
        ...verification,
      }),
    [
      paymentResponse,
      thanksConfig,
      verification.thanksOrderData,
      verification.wompiTxData,
      verification.thanksAccessError,
      verification.verificationLoading,
    ],
  );
  const slides = useMemo(
    () => buildThanksPageSlides(thanksConfig),
    [thanksConfig],
  );
  const presentationStyle = useMemo(
    () => getThanksPagePresentationStyle(thanksConfig.style),
    [thanksConfig.style],
  );
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(Boolean(query?.matches));
    update();
    query?.addEventListener?.("change", update);
    return () => query?.removeEventListener?.("change", update);
  }, []);
  useEffect(() => {
    if (
      paused ||
      reducedMotion ||
      !thanksConfig.showVisualPanel ||
      !thanksConfig.slider.autoplay ||
      !thanksConfig.slider.enabled ||
      slides.length < 2
    )
      return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden")
        setCurrentSlide((previous) => (previous + 1) % slides.length);
    }, thanksConfig.slider.intervalMs);
    return () => window.clearInterval(timer);
  }, [thanksConfig, slides.length, paused, reducedMotion]);
  useEffect(() => {
    if (currentSlide >= slides.length) setCurrentSlide(0);
  }, [currentSlide, slides.length]);
  const openReturnsPortal = () => {
    const access = verification.thanksOrderData?.returnAccess;
    if (!access?.enabled || !access?.token || !access?.orderId) return;
    storeOrderReturnAccess(access);
    navigate(`/devoluciones/${encodeURIComponent(access.orderId)}`, {
      state: { returnAccess: access },
    });
  };
  return {
    thanksConfig,
    page: page || { useHeader: false, useFooter: false },
    loading,
    configError,
    retryConfig: () => setAttempt((value) => value + 1),
    currentSlide,
    setCurrentSlide,
    slides,
    viewModel,
    presentationStyle,
    ...verification,
    paused,
    setPaused,
    openReturnsPortal,
    continueShopping: () => navigate(thanksConfig.continueButtonLink),
  };
}
