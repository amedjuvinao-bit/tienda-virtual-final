import { useMemo, useState } from "react";
import GraciasPageView from "../../../pages/gracias/GraciasPageView";
import { buildSafeThanksPageConfig } from "../../../pages/gracias/thanksPageConfig";
import {
  buildThanksPageViewModel,
  buildThanksPageSlides,
  getThanksPagePresentationStyle,
} from "../../../pages/gracias/thanksPageViewModel";
const noop = () => {};
export default function ThanksPreview({ draft }) {
  const [status, setStatus] = useState("pending"),
    [currentSlide, setCurrentSlide] = useState(0),
    [paused, setPaused] = useState(true);
  const config = useMemo(
    () => buildSafeThanksPageConfig(draft.thanksPageConfig),
    [draft.thanksPageConfig],
  );
  const order =
    status === "none" || status === "unverified"
      ? null
      : {
          ok: true,
          orderNumber: "EJEMPLO-001",
          orderId: "preview",
          customerName: "Cliente de ejemplo",
          itemCount: 2,
          subtotal: 90000,
          shipping: 10000,
          total: 100000,
          paymentProvider: "wompi",
          paymentStatus: status,
          returnAccess: { enabled: true },
        };
  const model = buildThanksPageViewModel({
    thanksConfig: config,
    thanksOrderData: order,
    paymentResponse: { exists: status === "unverified" },
    thanksAccessError:
      status === "unverified" ? "Ejemplo de pago sin verificar." : "",
  });
  return (
    <>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: 12,
          background: "#fff",
          color: "#222",
          font: "13px system-ui",
        }}
      >
        Escenario de vista previa
        <select
          aria-label="Escenario de agradecimiento"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="paid">Pago aprobado</option>
          <option value="pending">Pago pendiente</option>
          <option value="rejected">Pago rechazado</option>
          <option value="unverified">Sin verificar</option>
          <option value="none">Sin pedido</option>
        </select>
      </label>
      <GraciasPageView
        page={draft}
        thanksConfig={config}
        viewModel={model}
        thanksOrderData={order}
        slides={buildThanksPageSlides(config)}
        currentSlide={currentSlide}
        setCurrentSlide={setCurrentSlide}
        paused={paused}
        setPaused={setPaused}
        presentationStyle={getThanksPagePresentationStyle(config.style)}
        thanksAccessError={
          status === "unverified" ? "Ejemplo de pago sin verificar." : ""
        }
        retryVerification={noop}
        continueShopping={noop}
        openReturnsPortal={noop}
        preview
      />
    </>
  );
}
