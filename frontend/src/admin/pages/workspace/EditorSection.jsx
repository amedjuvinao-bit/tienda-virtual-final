import React, {
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
} from "react";
import { ChevronDown } from "lucide-react";
const SectionsContext = createContext(null);
export function EditorSections({ children }) {
  const [open, setOpen] = useState(undefined);
  return (
    <SectionsContext.Provider value={{ open, setOpen }}>
      {children}
    </SectionsContext.Provider>
  );
}
export default function EditorSection({
  title,
  text,
  children,
  className = "",
}) {
  const id = useId(),
    context = useContext(SectionsContext);
  useEffect(() => {
    context?.setOpen((current) => (current === undefined ? id : current));
  }, [id, context?.setOpen]);
  const expanded = !context || context.open === id;
  return (
    <section className={`page-editor-section ${className}`}>
      <h2>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={`page-editor-section-${id}`}
          onClick={() => context?.setOpen(expanded ? null : id)}
        >
          <span>{title}</span>
          <ChevronDown size={18} />
        </button>
      </h2>
      <div
        id={`page-editor-section-${id}`}
        hidden={!expanded}
        className="page-editor-section__body"
      >
        {text && <p className="page-editor-section__help">{text}</p>}
        {children}
      </div>
    </section>
  );
}
