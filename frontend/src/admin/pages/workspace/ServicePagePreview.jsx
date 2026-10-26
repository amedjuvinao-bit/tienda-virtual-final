import { useState } from "react";
import OrderReturnsView from "../../../pages/returns/OrderReturnsView";
import SearchResultsView from "../../../pages/SearchResultsView";
import { buildServicePageConfig } from "../../../components/service-pages/servicePageConfig";
const pagination = {
  page: 1,
  totalProducts: 2,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};
export default function ServicePagePreview({ draft }) {
  const returns = draft.pageType === "returns-page";
  const config = buildServicePageConfig(
    draft[returns ? "returnsPageConfig" : "searchPageConfig"],
    draft.pageType,
  );
  const [scenario, setScenario] = useState("content"),
    [term, setTerm] = useState("Producto"),
    [message, setMessage] = useState("");
  const [items, setItems] = useState({}),
    [resolution, setResolution] = useState("exchange"),
    [reasonSummary, setReasonSummary] = useState("");
  const eligibleItems =
    scenario === "content"
      ? [
          {
            orderItemId: "preview-line",
            title: "Producto de ejemplo",
            availableQuantity: 1,
            eligible: true,
            eligibleUntil: "2027-01-01T12:00:00Z",
            requireReasonText: true,
          },
        ]
      : [];
  const demo = () =>
    setMessage(
      "Vista previa: no se crean solicitudes ni se consultan órdenes reales.",
    );
  return (
    <>
      <label
        style={{
          display: "block",
          padding: 10,
          font: "13px system-ui",
          background: "Canvas",
          color: "CanvasText",
        }}
      >
        Escenario de vista previa{" "}
        <select
          aria-label="Escenario de vista previa"
          value={scenario}
          onChange={(event) => setScenario(event.target.value)}
        >
          <option value="content">Con contenido</option>
          <option value="empty">Vacío</option>
          {!returns && <option value="error">Error de búsqueda</option>}
        </select>
      </label>
      {returns ? (
        <OrderReturnsView
          page={draft}
          config={config}
          preview
          data={{
            order: { orderNumber: "000123" },
            policy: {
              policyText:
                "Los requisitos y plazos se obtienen de la política de devoluciones de la tienda.",
              windowDays: 30,
            },
            eligibility: eligibleItems,
            returns:
              scenario === "content"
                ? [
                    {
                      _id: "preview-case",
                      returnNumber: "RMA-000123-1",
                      status: "authorized",
                      requestSource: "customer",
                      requestedResolution: "exchange",
                      requestedAt: "2026-10-01T12:00:00Z",
                      items: [
                        {
                          orderItemId: "demo",
                          title: "Producto de ejemplo",
                          requestedQuantity: 1,
                          reasonCode: "other",
                        },
                      ],
                    },
                  ]
                : [],
          }}
          items={items}
          setItem={(id, patch) =>
            setItems((current) => ({
              ...current,
              [id]: { ...current[id], ...patch },
            }))
          }
          resolution={resolution}
          setResolution={setResolution}
          reasonSummary={reasonSummary}
          setReasonSummary={setReasonSummary}
          eligibleItems={eligibleItems}
          selectedItems={
            items["preview-line"]?.quantity ? [items["preview-line"]] : []
          }
          selectedResolutions={["exchange", "store_credit"]}
          submit={demo}
          load={demo}
          setError={demo}
          success={message}
        />
      ) : (
        <SearchResultsView
          page={draft}
          config={config}
          preview
          q={term}
          draft={term}
          setDraft={setTerm}
          submit={(event) => event.preventDefault()}
          retrySearch={() => setScenario("content")}
          goToPage={() => {}}
          state={{
            products:
              scenario === "content"
                ? [
                    {
                      _id: "preview-one",
                      title: "Producto de ejemplo",
                      image: "/atelier/menu-blush.webp",
                      price: 85000,
                      inventoryTracked: false,
                    },
                    {
                      _id: "preview-two",
                      title: "Otra presentación",
                      image: "/looks-editorial-background.webp",
                      price: 65000,
                      inventoryTracked: false,
                    },
                  ]
                : [],
            pagination: {
              ...pagination,
              totalProducts: scenario === "empty" ? 0 : 2,
            },
            error: scenario === "error" ? "demo" : "",
            loading: false,
          }}
        />
      )}
    </>
  );
}
