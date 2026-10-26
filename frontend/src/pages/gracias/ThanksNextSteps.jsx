import { Check, Clock3, Package, Truck, CircleAlert } from "lucide-react";
import PolishedGlassRim from "../../components/PolishedGlassRim";
export default function ThanksNextSteps({ config, model }) {
  // These are explanatory stages. Payment approval does not prove preparation or dispatch.
  if (
    !config.showNextSteps ||
    !model.verified ||
    model.verificationLoading ||
    !model.hasOrderInfo
  )
    return null;
  const approved = model.paymentStatus === "approved";
  const attention = ["rejected", "expired", "error"].includes(
    model.paymentStatus,
  );
  const steps = [
    {
      title: config.paymentStepTitle,
      message: approved
        ? config.approvedStepText
        : attention
          ? config.attentionStepText
          : config.pendingStepText,
      Icon: approved ? Check : attention ? CircleAlert : Clock3,
      current: true,
    },
    {
      title: config.preparationStepTitle,
      message: config.preparationStepText,
      Icon: Package,
    },
    {
      title: config.deliveryStepTitle,
      message: config.deliveryStepText,
      Icon: Truck,
    },
  ];
  return (
    <section className="gp-next-steps" aria-label={config.nextStepsTitle}>
      <h2>{config.nextStepsTitle}</h2>
      <ol>
        {steps.map(({ title, message, Icon, current }, index) => (
          <li
            key={index}
            data-stage={
              current
                ? approved
                  ? "confirmed"
                  : attention
                    ? "attention"
                    : "waiting"
                : "future"
            }
          >
            <div className="gp-step-symbol">
              <Icon size={26} strokeWidth={1.4} aria-hidden="true" />
              <PolishedGlassRim
                radius={999}
                width={config.presentation.borderWidth}
                reflection={config.presentation.reflection}
              />
            </div>
            <h3>{title}</h3>
            <p>{message}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
