import { useId } from "react";
import { CheckoutCard } from "./CheckoutMaterial";
export default function CheckoutContactSection({ state }) {
  const { checkoutConfig: c } = state,
    id = useId();
  const field = (key, label, autoComplete, type = "text") => (
    <div key={key}>
      <label className="co-field-label" htmlFor={`${id}-${key}`}>
        {label}
      </label>
      <input
        id={`${id}-${key}`}
        name={key}
        className="co-input"
        type={type}
        autoComplete={autoComplete}
        value={state[key]}
        onChange={(event) =>
          state[`set${key[0].toUpperCase() + key.slice(1)}`](event.target.value)
        }
      />
    </div>
  );
  return (
    <CheckoutCard>
      <h2 className={c.showContactSection ? "co-card-title" : "sr-only"}>
        {c.contactSectionTitle}
      </h2>
      <div className="co-grid-2">
        {field("customerName", c.nameLabelText, "given-name")}
        {field("customerLastname", c.lastnameLabelText, "family-name")}
        {field("customerEmailOrPhone", c.emailLabelText, "email")}
        {field("customerPhone", c.phoneLabelText, "tel", "tel")}
        {field("customerId", c.documentLabelText, "off")}
      </div>
      {c.showNewsletterCheckbox && (
        <label className="co-newsletter">
          <input
            type="checkbox"
            checked={state.wantsNewsletter}
            onChange={(event) => state.setWantsNewsletter(event.target.checked)}
          />
          {c.newsletterText}
        </label>
      )}
    </CheckoutCard>
  );
}
