import { FileText, ShoppingBag, CreditCard } from "lucide-react";
import { formatMoneyCop } from "./thanksPageViewModel";
export default function ThanksOrderFacts({ config, model }) {
  const facts = [
    config.showOrderNumber && {
      key: "order",
      Icon: FileText,
      label: config.orderNumberLabel,
      value: `#${model.orderNumber || model.orderId || "—"}`,
    },
    config.showItemCount &&
      model.hasOrderDetails && {
        key: "items",
        Icon: ShoppingBag,
        label: config.itemCountLabel,
        value: `${model.itemCount} ${model.itemCount === 1 ? config.itemSingularText : config.itemPluralText}`,
      },
    config.showTotal && {
      key: "total",
      Icon: CreditCard,
      label: model.totalLabel,
      value: formatMoneyCop(model.total),
    },
  ].filter(Boolean);
  if (!facts.length) return null;
  return (
    <dl className="gp-order-facts" aria-label={config.summaryTitle}>
      {facts.map(({ key, Icon, label, value }) => (
        <div className="gp-order-fact" key={key}>
          <Icon size={29} strokeWidth={1.3} aria-hidden="true" />
          <div>
            <dt>{label.replace(/:\s*$/, "")}</dt>
            <dd>{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
