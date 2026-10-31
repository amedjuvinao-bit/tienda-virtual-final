import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { buildInformationConfig } from "../information-page/informationPageConfig";
import ConsumerPageContent from "./ConsumerPageContent";
import ConsumerDocumentReference from "./ConsumerDocumentReference";
import useConsumerInformation from "./useConsumerInformation";
import { contractText, downloadText } from "./ConsumerReceipt";

vi.mock("./useConsumerInformation", () => ({ default: vi.fn() }));
vi.mock("./ConsumerReceipt", async (importOriginal) => ({
  ...(await importOriginal()),
  downloadText: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const version = "CO-2026-10-27.1:0:delivery-0:returns-9";
const data = {
  version,
  seller: { legalName: "Negocio de prueba", nit: "900123456-7" },
  sections: [
    {
      id: "terminos",
      title: "Compra y condiciones",
      body: "Condiciones reales.",
    },
    { id: "privacidad", title: "Datos personales", body: "Política real." },
  ],
  authorityUrl: "https://www.sic.gov.co/",
};
it("explica la referencia sin exponer el código de entrada ni convertirlo en una fecha", () => {
  render(<ConsumerDocumentReference version={version} purchase />);
  expect(
    screen.getByText(/guardamos las condiciones que aceptaste/),
  ).toBeVisible();
  expect(screen.getByText(version)).not.toBeVisible();
  fireEvent.click(screen.getByText("Ver referencia del documento"));
  expect(screen.getByText(version)).toBeVisible();
  expect(
    screen.getByText(/No es un número de pedido ni una clave/),
  ).toBeVisible();
  expect(screen.queryByText(/Última actualización/)).not.toBeInTheDocument();
});
it("conserva las condiciones, la referencia exacta en la descarga y el enlace a la SIC", () => {
  useConsumerInformation.mockReturnValue({ data, error: "", retry: vi.fn() });
  render(
    <ConsumerPageContent
      page={{
        name: "Condiciones de compra",
        slug: "terminos",
        systemRole: "consumer-terms",
      }}
      config={buildInformationConfig({})}
    />,
  );
  expect(screen.getByText("Condiciones reales.")).toBeVisible();
  expect(screen.getByText(version)).not.toBeVisible();
  expect(
    screen.getByRole("link", { name: /Superintendencia/ }),
  ).toHaveAttribute("href", data.authorityUrl);
  fireEvent.click(
    screen.getByRole("button", { name: "Descargar condiciones" }),
  );
  const [name, text] = downloadText.mock.calls[0];
  expect(name).toBe("terminos.txt");
  expect(text).toContain(`Referencia del documento: ${version}`);
  expect(text).toContain("Condiciones reales.");
  expect(text).toContain("Política real.");
});
it("en privacidad no afirma que la consulta equivalga a aceptar una compra", () => {
  useConsumerInformation.mockReturnValue({ data, error: "", retry: vi.fn() });
  render(
    <ConsumerPageContent
      page={{
        name: "Privacidad",
        slug: "privacidad",
        systemRole: "consumer-privacy",
      }}
      config={buildInformationConfig({})}
    />,
  );
  expect(
    screen.queryByText(/guardamos las condiciones que aceptaste/),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Política real.")).toBeVisible();
  expect(screen.queryByText("Condiciones reales.")).not.toBeInTheDocument();
});
it("la constancia mantiene la versión histórica sin sustituirla por condiciones actuales", () => {
  const accepted = {
    version: "referencia-historica",
    fingerprint: "integridad-original",
    policies: [{ title: "Condiciones aceptadas", body: "Contenido original." }],
  };
  const before = structuredClone(accepted);
  const text = contractText(accepted, "000123");
  expect(text).toContain(
    "Referencia de las condiciones aceptadas: referencia-historica",
  );
  expect(text).toContain("integridad-original");
  expect(text).toContain("Contenido original.");
  expect(text).not.toContain(version);
  expect(accepted).toEqual(before);
});
