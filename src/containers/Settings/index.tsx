import { useMemo, useState } from "react";
import { uiText } from "../../constants/uiText";
import { useMindMapStore } from "../../store/mindMapStore";

type SettingsSection = "appearance";

export default function Settings() {
  const settings = useMindMapStore((s) => s.settings);
  const updateSettings = useMindMapStore((s) => s.updateSettings);

  const [section, setSection] = useState<SettingsSection>("appearance");

  const navItems = useMemo(
    () =>
      [
        {
          id: "appearance" as const,
          label: "Appearance",
        },
      ] as const,
    []
  );

  return (
    <div className="pm-settings" aria-label={uiText.ariaLabels.settingsPanel}>
      <aside className="pm-settings__nav" aria-label="Settings navigation">
        <div className="pm-settings__navHeader">Settings</div>
        <nav className="pm-settings__navList">
          {navItems.map((item) => {
            const active = item.id === section;
            return (
              <button
                key={item.id}
                type="button"
                className={[
                  "pm-settings__navItem",
                  active ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={active ? "page" : undefined}
                onClick={() => setSection(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="pm-settings__content">
        {section === "appearance" && (
          <div className="pm-settings__page">
            <div className="pm-settings__pageTitle">Appearance</div>

            <div className="pm-settings__card">
              <div className="pm-settings__row">
                <div className="pm-settings__rowText">
                  <div className="pm-settings__rowTitle">Theme</div>
                  <div className="pm-settings__rowDesc">
                    Choose light or dark mode.
                  </div>
                </div>
                <select
                  className="pm-settings__control"
                  value={settings.theme}
                  onChange={(e) =>
                    updateSettings({
                      theme: e.target.value === "light" ? "light" : "dark",
                    })
                  }
                  aria-label="Theme"
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>

              <div className="pm-settings__divider" />

              <div className="pm-settings__row">
                <div className="pm-settings__rowText">
                  <div className="pm-settings__rowTitle">Font size</div>
                  <div className="pm-settings__rowDesc">
                    Adjust the UI font size.
                  </div>
                </div>
                <input
                  className="pm-settings__control"
                  type="number"
                  min={10}
                  max={22}
                  value={settings.fontSize}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    updateSettings({
                      fontSize: Number.isFinite(n) ? n : settings.fontSize,
                    });
                  }}
                  aria-label="Font size"
                />
              </div>

              <div className="pm-settings__divider" />

              <div className="pm-settings__row">
                <div className="pm-settings__rowText">
                  <div className="pm-settings__rowTitle">Show minimap</div>
                  <div className="pm-settings__rowDesc">
                    Toggle the minimap on the canvas.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={!!settings.appearance.showMinimap}
                  onChange={(e) =>
                    updateSettings({
                      appearance: {
                        ...settings.appearance,
                        showMinimap: e.target.checked,
                      },
                    })
                  }
                  aria-label="Show minimap"
                />
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}