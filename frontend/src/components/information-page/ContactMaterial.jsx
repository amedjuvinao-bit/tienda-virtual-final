import ContactGlassRim from "./ContactGlassRim";
export function ContactGlass({ config, className = "", children, ...props }) {
  return (
    <section {...props} className={`cart-glass ${className}`}>
      {children}
      <ContactGlassRim config={config} radius={config.style.cardRadiusPx} />
    </section>
  );
}
export function ContactButton({
  as: Element = "button",
  config,
  children,
  className = "",
  ...props
}) {
  return (
    <Element
      type={Element === "button" ? "button" : undefined}
      {...props}
      className={`service-button ${className}`}
    >
      {children}
      <ContactGlassRim config={config} radius={config.style.buttonRadiusPx} />
    </Element>
  );
}
