import {
  ArrowRight,
  FileText,
  Headphones,
  Mail,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  ContactGlass,
  ContactButton,
} from "../information-page/ContactMaterial";
import ContactGlassRim from "../information-page/ContactGlassRim";
export default function ConsumerCaseGuide({ config, c, preview }) {
  const icons = [FileText, Mail, Search];
  return (
    <ContactGlass config={config} className="claims-guide">
      {c.guideTitle && <h2>{c.guideTitle}</h2>}
      {c.showSteps && c.steps.length > 0 && (
        <ol>
          {c.steps.map((step, index) => {
            const Icon = icons[index % icons.length];
            return (
              <li key={index}>
                <span className="claims-guide__number" aria-hidden="true">
                  {index + 1}
                  <ContactGlassRim config={config} radius={999} />
                </span>
                <Icon aria-hidden="true" size={25} strokeWidth={1.5} />
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {c.guideText && <p className="claims-guide__note">{c.guideText}</p>}
      <div className="claims-guide__security">
        <ShieldCheck size={29} aria-hidden="true" strokeWidth={1.5} />
        <div>
          {c.securityTitle && <h3>{c.securityTitle}</h3>}
          {c.securityText && <p>{c.securityText}</p>}
        </div>
      </div>
      {c.contactText && c.contactHref && (
        <ContactButton
          config={config}
          as="a"
          href={c.contactHref}
          onClick={preview ? (event) => event.preventDefault() : undefined}
        >
          <Headphones size={22} aria-hidden="true" />
          {c.contactText}
          <ArrowRight size={16} aria-hidden="true" />
        </ContactButton>
      )}
    </ContactGlass>
  );
}
