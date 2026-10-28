export function documentReferenceText(version) {
  return version
    ? `Referencia del documento: ${version}\nEste código identifica la versión exacta de esta información. No es un número de pedido ni una clave de acceso.`
    : "";
}

export default function ConsumerDocumentReference({
  version,
  purchase = false,
}) {
  if (!version) return null;
  return (
    <div className="consumer-document-reference">
      {purchase && (
        <p>
          Al confirmar tu compra, guardamos las condiciones que aceptaste con tu
          pedido. Puedes consultarlas en la constancia del pedido, aunque
          después se actualice esta página.
        </p>
      )}
      <details>
        <summary>Ver referencia del documento</summary>
        <p>
          Este código identifica la versión exacta de esta información y permite
          ubicarla si necesitas una aclaración. No es un número de pedido ni una
          clave de acceso; no necesitas ingresarlo para comprar o pedir
          atención.
        </p>
        <p>
          <strong>Referencia del documento:</strong> <code>{version}</code>
        </p>
      </details>
    </div>
  );
}
