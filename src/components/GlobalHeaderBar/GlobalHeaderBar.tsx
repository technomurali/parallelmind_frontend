import { uiText } from "../../constants/uiText";
import { useMindMapStore } from "../../store/mindMapStore";
import { FiSettings } from "react-icons/fi";

type GlobalHeaderBarProps = {
  /**
   * Placeholder until you decide the final content.
   * If omitted, we show a minimal app title.
   */
  title?: string;
};

export function GlobalHeaderBar({ title }: GlobalHeaderBarProps) {
  const toggleSettings = useMindMapStore((s) => s.toggleSettings);

  return (
    <header className="pm-global-header" aria-label={uiText.ariaLabels.workspace}>
      <div className="pm-global-header__left">
        <div className="pm-global-header__title">{title ?? "ParallelMind"}</div>
      </div>

      <div className="pm-global-header__center" />

      <div className="pm-global-header__right">
        <button
          type="button"
          onClick={toggleSettings}
          aria-label={uiText.tooltips.toggleSettings}
          title={uiText.tooltips.toggleSettings}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: "var(--control-size-sm)",
            width: "var(--control-size-sm)",
            borderRadius: "var(--radius-md)",
            border: "none",
            background: "transparent",
            color: "var(--text)",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "var(--surface-1)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "transparent";
          }}
        >
          <FiSettings
            style={{ fontSize: "var(--icon-size-md)" }}
            aria-hidden="true"
          />
        </button>
      </div>
    </header>
  );
}

