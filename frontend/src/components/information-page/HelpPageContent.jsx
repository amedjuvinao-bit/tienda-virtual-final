import { useId, useRef, useState } from "react";
import { ArrowRight, ChevronRight, Headphones, Search, X } from "lucide-react";
import {
  ContactGlass as Glass,
  ContactButton as GlassButton,
} from "./ContactMaterial";
import ContactGlassRim from "./ContactGlassRim";
import { visibleHelpTopics, searchHelpTopics } from "./helpPageConfig";
import { helpIcon } from "./HelpIcons";
import HelpQuestions from "./HelpQuestions";
import useHelpNavigation from "./useHelpNavigation";
import "./helpPage.css";

function HelpTitle({ config, name }) {
  const [failedImage, setFailedImage] = useState("");
  return (
    <header className="help-intro">
      {config.showEyebrow && config.eyebrowText && (
        <p className="help-eyebrow">{config.eyebrowText}</p>
      )}
      <h1 className={config.showTitle ? "" : "sr-only"}>
        {config.titleMode === "image" &&
        config.titleImage &&
        failedImage !== config.titleImage ? (
          <img
            src={config.titleImage}
            alt={config.titleImageAlt || config.titleText || name}
            style={{ maxHeight: config.titleImageHeightPx }}
            onError={() => setFailedImage(config.titleImage)}
          />
        ) : (
          config.titleText || name || "Centro de ayuda"
        )}
      </h1>
      {config.showSubtitle && config.subtitleText && (
        <p>{config.subtitleText}</p>
      )}
    </header>
  );
}
export default function HelpPageContent({ config, name, preview = false }) {
  const h = config.help,
    topics = visibleHelpTopics(h),
    navigation = useHelpNavigation(h.showSearch),
    { params, query } = navigation;
  const searchRef = useRef(null),
    prefix = "help-" + useId().replace(/:/g, "");
  const searching = !!query.trim();
  const linkedQuestion = topics.find((c) =>
    c.questions.some((q) => q.id === params.get("pregunta")),
  );
  const selected =
    topics.find((c) => c.id === params.get("tema")) ||
    linkedQuestion ||
    topics[0];
  const questions = searching
    ? searchHelpTopics(topics, query)
    : selected?.questions || [];
  const openId = params.has("pregunta")
    ? questions.find((q) => q.id === params.get("pregunta"))?.id || ""
    : !searching && h.openFirst
      ? questions[0]?.id
      : "";
  const Icon = searching ? Search : helpIcon(selected?.icon);
  const clear = () => {
    navigation.clearSearch();
    searchRef.current?.focus({ preventScroll: true });
  };
  return (
    <div
      className="help-content"
      data-motion={h.motion}
      data-editorial={h.editorialHeading}
      style={{
        "--help-body-size": `${config.style.bodyFontSizePx}px`,
        "--help-section-size": `${config.style.sectionTitleSizePx}px`,
        "--help-nav-width": `${config.style.navigationWidthPx}px`,
      }}
      onClickCapture={(event) => {
        if (preview && event.target.closest("a")) event.preventDefault();
      }}
    >
      <HelpTitle config={config} name={name} />
      {h.showSearch && topics.length > 0 && (
        <form
          className="help-search"
          role="search"
          onSubmit={(event) => event.preventDefault()}
        >
          <Search size={23} strokeWidth={1.4} aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            maxLength={160}
            value={query}
            aria-label={h.searchLabel || "Buscar en el centro de ayuda"}
            placeholder={h.searchPlaceholder}
            onChange={(event) => navigation.setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query) {
                event.preventDefault();
                clear();
              }
            }}
          />
          {query && (
            <button
              type="button"
              onClick={clear}
              aria-label={h.clearSearchText || "Limpiar búsqueda"}
            >
              <X size={19} aria-hidden="true" />
            </button>
          )}
          <ContactGlassRim
            config={config}
            radius={config.style.buttonRadiusPx}
          />
        </form>
      )}
      {topics.length > 0 ? (
        <div className="help-layout">
          <Glass config={config} className="help-topics">
            <h2>{h.topicsTitle}</h2>
            <nav aria-label={h.topicsTitle || "Temas de ayuda"}>
              {topics.map((topic) => {
                const TopicIcon = helpIcon(topic.icon),
                  active = !searching && selected?.id === topic.id;
                return (
                  <button
                    type="button"
                    key={topic.id}
                    aria-pressed={active}
                    onClick={() => navigation.selectTopic(topic.id)}
                  >
                    <TopicIcon size={24} strokeWidth={1.3} aria-hidden="true" />
                    <span>{topic.title}</span>
                    <ChevronRight size={17} aria-hidden="true" />
                    {active && (
                      <ContactGlassRim
                        config={config}
                        radius={config.style.buttonRadiusPx}
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          </Glass>
          <Glass config={config} className="help-panel">
            <header className="help-panel__heading">
              <div>
                <h2>
                  {searching
                    ? h.resultsTitle
                    : selected.heading || selected.title}
                </h2>
                {searching && (
                  <p role="status">
                    {questions.length}{" "}
                    {questions.length === 1 ? h.resultSingular : h.resultPlural}
                  </p>
                )}
              </div>
              <Icon size={30} strokeWidth={1.25} aria-hidden="true" />
            </header>
            {questions.length ? (
              <HelpQuestions
                config={config}
                questions={questions}
                prefix={prefix}
                searching={searching}
                openId={openId}
                onToggle={(id) =>
                  navigation.selectQuestion(openId === id ? "" : id)
                }
              />
            ) : (
              <div className="help-empty">
                <h3>{h.emptyTitle}</h3>
                <p>{h.emptyText}</p>
                <GlassButton config={config} onClick={clear}>
                  {h.clearSearchText || "Limpiar búsqueda"}
                </GlassButton>
              </div>
            )}
          </Glass>
        </div>
      ) : (
        <p className="help-empty">{h.noContentText}</p>
      )}
      {h.showSupport && (
        <Glass config={config} className="help-support">
          <Headphones size={35} strokeWidth={1.2} aria-hidden="true" />
          <div>
            <h2>{h.supportTitle}</h2>
            <p>{h.supportText}</p>
          </div>
          {h.supportHref && h.supportAction.trim() && (
            <GlassButton as="a" config={config} href={h.supportHref}>
              {h.supportAction}
              <ArrowRight size={18} aria-hidden="true" />
            </GlassButton>
          )}
        </Glass>
      )}
    </div>
  );
}
