import { ShieldCheck } from "lucide-react";
import { ServiceHeading } from "../service-pages/ServicePageFrame";
import {
  ContactGlass,
  ContactButton,
} from "../information-page/ContactMaterial";
import ConsumerCaseForm from "./ConsumerCaseForm";
import useConsumerInformation from "./useConsumerInformation";
import { downloadText } from "./ConsumerReceipt";
import "./consumer.css";
const sectionIds = {
  "consumer-shipping": ["envios"],
  "consumer-privacy": ["privacidad"],
  "consumer-terms": [
    "terminos",
    "envios",
    "retracto",
    "garantia",
    "reversion",
    "privacidad",
  ],
  "consumer-returns": ["retracto", "garantia", "reversion"],
};
export default function ConsumerPageContent({ page, config, preview }) {
  const { data, error, retry } = useConsumerInformation();
  const sections =
    data?.sections?.filter((s) =>
      (sectionIds[page.systemRole] || []).includes(s.id),
    ) || [];
  return (
    <>
      <ServiceHeading
        config={config}
        title={config.titleText || page.name}
        icon={ShieldCheck}
      />
      {error ? (
        <div role="alert">
          {error}{" "}
          <button type="button" onClick={retry}>
            Reintentar
          </button>
        </div>
      ) : !data ? (
        <p role="status">Cargando condiciones…</p>
      ) : (
        <>
          <ContactGlass config={config} className="consumer-seller">
            <h2>Identificación del vendedor</h2>
            <p>
              {data.seller.legalName || "Identificación pendiente de completar"}{" "}
              {data.seller.nit && `· NIT ${data.seller.nit}`}
            </p>
            <p>{data.seller.notificationAddress}</p>
            <p>
              {data.seller.email}{" "}
              {data.seller.phone && `· ${data.seller.phone}`}
            </p>
            <a href="/contacto">Canales de contacto</a>
          </ContactGlass>
          <div className="consumer-policy-sections">
            {sections.map((s) => (
              <ContactGlass
                key={s.id}
                config={config}
                className="consumer-policy-section"
              >
                <h2>{s.title}</h2>
                <p>{s.body}</p>
              </ContactGlass>
            ))}
          </div>
          {sections.length > 0 && (
            <div className="information-actions">
              <ContactButton
                config={config}
                disabled={preview}
                onClick={() =>
                  downloadText(
                    `${page.slug}.txt`,
                    [
                      page.name,
                      `Versión ${data.version}`,
                      Object.values(data.seller).join("\n"),
                      ...sections.flatMap((s) => [s.title, s.body]),
                    ].join("\n\n"),
                  )
                }
              >
                Descargar esta información
              </ContactButton>
              <ContactButton as="a" config={config} href="/pqr">
                Peticiones y reclamos
              </ContactButton>
            </div>
          )}
          {page.systemRole === "consumer-claims" && (
            <ConsumerCaseForm
              config={config}
              document={data}
              preview={preview}
            />
          )}
          <p className="consumer-source">
            Versión {data.version}.{" "}
            <a
              href={data.authorityUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Superintendencia de Industria y Comercio · Protección al
              consumidor
            </a>
          </p>
        </>
      )}
    </>
  );
}
