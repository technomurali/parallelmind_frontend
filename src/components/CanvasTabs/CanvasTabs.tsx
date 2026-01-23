import { uiText } from "../../constants/uiText";
import { useMindMapStore } from "../../store/mindMapStore";

const formatTabTitle = (title: string): string => {
  if (title.length <= 10) return title;
  return `${title.slice(0, 10)}...`;
};

const formatTabTooltip = (
  title: string,
  moduleType: "parallelmind" | "cognitiveNotes" | null
): string => {
  if (moduleType === "parallelmind") return `${title} Parallelmind`;
  if (moduleType === "cognitiveNotes") return `${title} Cognitive Notes`;
  return title;
};

export function CanvasTabs() {
  const tabs = useMindMapStore((s) => s.tabs);
  const activeTabId = useMindMapStore((s) => s.activeTabId);
  const setActiveTab = useMindMapStore((s) => s.setActiveTab);
  const closeTab = useMindMapStore((s) => s.closeTab);
  const activeTabColors = useMindMapStore(
    (s) => s.settings.appearance.activeTabColors
  );

  const fallbackTitle = uiText.tabs.untitled;

  return (
    <div className="pm-tabs" role="tablist" aria-label={uiText.ariaLabels.canvasTabs}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const fullTitle = tab.title?.trim() || fallbackTitle;
        const displayTitle = formatTabTitle(fullTitle);
        const tooltip = formatTabTooltip(fullTitle, tab.moduleType ?? null);
        const activeColor = isActive
          ? tab.moduleType === "cognitiveNotes"
            ? activeTabColors.cognitiveNotes
            : tab.moduleType === "parallelmind"
            ? activeTabColors.parallelmind
            : null
          : null;

        return (
          <div
            key={tab.id}
            className={`pm-tab ${isActive ? "is-active" : ""}`}
            role="tab"
            aria-selected={isActive}
            tabIndex={0}
            title={tooltip}
            style={activeColor ? { background: activeColor } : undefined}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setActiveTab(tab.id);
              }
            }}
          >
            <span className="pm-tab__title">{displayTitle}</span>
            <button
              type="button"
              className="pm-tab__close"
              aria-label={`${uiText.tabs.closeTab} ${fullTitle}`}
              onClick={(event) => {
                event.stopPropagation();
                closeTab(tab.id);
              }}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
