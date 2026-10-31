import { Minus, Plus, ArrowRight } from "lucide-react";
import { ContactButton as GlassButton } from "./ContactMaterial";
export default function HelpQuestions({
  questions,
  openId,
  onToggle,
  config,
  prefix,
  searching,
}) {
  return (
    <div className="help-questions">
      {questions.map((question) => {
        const open = openId === question.id,
          id = `${prefix}-${question.id}`;
        return (
          <article key={question.id} className="help-question" data-open={open}>
            {searching && (
              <p className="help-question__topic">{question.categoryTitle}</p>
            )}
            <h3>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={id}
                id={`${id}-toggle`}
                onClick={() => onToggle(question.id)}
              >
                <span>{question.question}</span>
                {open ? (
                  <Minus size={20} aria-hidden="true" />
                ) : (
                  <Plus size={20} aria-hidden="true" />
                )}
              </button>
            </h3>
            <div
              id={id}
              className="help-answer"
              role="region"
              aria-labelledby={`${id}-toggle`}
              hidden={!open}
            >
              <p>{question.answer}</p>
              {question.actionText.trim() && question.actionHref && (
                <GlassButton as="a" config={config} href={question.actionHref}>
                  {question.actionText}
                  <ArrowRight size={17} aria-hidden="true" />
                </GlassButton>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
