import { useMemo, useState } from "react";
import { uiText } from "../../constants/uiText";
import { useMindMapStore } from "../../store/mindMapStore";

type SettingsSection = "appearance";

export default function Settings() {
  const settings = useMindMapStore((s) => s.settings);
  const updateSettings = useMindMapStore((s) => s.updateSettings);
  const nodeFillEnabled = !!settings.appearance.enableNodeFillColors;

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
                  <div className="pm-settings__rowTitle">Node header size</div>
                  <div className="pm-settings__rowDesc">
                    Size for node labels like Name and Purpose.
                  </div>
                </div>
                <input
                  className="pm-settings__control"
                  type="number"
                  min={2}
                  max={28}
                  value={settings.appearance.nodeHeaderFontSize}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    updateSettings({
                      appearance: {
                        ...settings.appearance,
                        nodeHeaderFontSize: Number.isFinite(n)
                          ? n
                          : settings.appearance.nodeHeaderFontSize,
                      },
                    });
                  }}
                  aria-label="Node header size"
                />
              </div>

              <div className="pm-settings__divider" />

              <div className="pm-settings__row">
                <div className="pm-settings__rowText">
                  <div className="pm-settings__rowTitle">Node body size</div>
                  <div className="pm-settings__rowDesc">
                    Size for node content like Name and Purpose values.
                  </div>
                </div>
                <input
                  className="pm-settings__control"
                  type="number"
                  min={2}
                  max={32}
                  value={settings.appearance.nodeBodyFontSize}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    updateSettings({
                      appearance: {
                        ...settings.appearance,
                        nodeBodyFontSize: Number.isFinite(n)
                          ? n
                          : settings.appearance.nodeBodyFontSize,
                      },
                    });
                  }}
                  aria-label="Node body size"
                />
              </div>

              <div className="pm-settings__divider" />

              <div className="pm-settings__row">
                <div className="pm-settings__rowText">
                  <div className="pm-settings__rowTitle">
                    {uiText.settings.appearance.edgeTypeLabel}
                  </div>
                  <div className="pm-settings__rowDesc">
                    {uiText.settings.appearance.edgeTypeDesc}
                  </div>
                </div>
                <select
                  className="pm-settings__control"
                  value={settings.appearance.edgeStyle ?? "step"}
                  onChange={(e) =>
                    updateSettings({
                      appearance: {
                        ...settings.appearance,
                        edgeStyle: e.target.value,
                      },
                    })
                  }
                  aria-label={uiText.settings.appearance.edgeTypeLabel}
                >
                  <option value="default">
                    {uiText.settings.appearance.edgeTypeOptions.bezier}
                  </option>
                  <option value="straight">
                    {uiText.settings.appearance.edgeTypeOptions.straight}
                  </option>
                  <option value="simpleBezier">
                    {uiText.settings.appearance.edgeTypeOptions.simpleBezier}
                  </option>
                  <option value="step">
                    {uiText.settings.appearance.edgeTypeOptions.step}
                  </option>
                  <option value="smoothstep">
                    {uiText.settings.appearance.edgeTypeOptions.smoothstep}
                  </option>
                </select>
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

              <div className="pm-settings__divider" />

              <div className="pm-settings__row">
                <div className="pm-settings__rowText">
                  <div className="pm-settings__rowTitle">Node fill colors</div>
                  <div className="pm-settings__rowDesc">
                    Apply colors by node level using the data.level field.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={nodeFillEnabled}
                  onChange={(e) =>
                    updateSettings({
                      appearance: {
                        ...settings.appearance,
                        enableNodeFillColors: e.target.checked,
                      },
                    })
                  }
                  aria-label="Enable node fill colors"
                />
              </div>

              <div className="pm-settings__divider" />

              <div className="pm-settings__row">
                <div className="pm-settings__rowText">
                  <div className="pm-settings__rowTitle">Root color</div>
                  <div className="pm-settings__rowDesc">
                    Used when level is 0 or missing.
                  </div>
                </div>
                <input
                  className="pm-settings__control"
                  type="color"
                  value={settings.appearance.nodeFillColors.root}
                  onChange={(e) =>
                    updateSettings({
                      appearance: {
                        ...settings.appearance,
                        nodeFillColors: {
                          ...settings.appearance.nodeFillColors,
                          root: e.target.value,
                        },
                      },
                    })
                  }
                  aria-label="Root node color"
                  disabled={!nodeFillEnabled}
                />
              </div>

              <div className="pm-settings__divider" />

              <div className="pm-settings__row">
                <div className="pm-settings__rowText">
                  <div className="pm-settings__rowTitle">Level 1 color</div>
                  <div className="pm-settings__rowDesc">
                    Applied to nodes with level 1.
                  </div>
                </div>
                <input
                  className="pm-settings__control"
                  type="color"
                  value={settings.appearance.nodeFillColors.level1}
                  onChange={(e) =>
                    updateSettings({
                      appearance: {
                        ...settings.appearance,
                        nodeFillColors: {
                          ...settings.appearance.nodeFillColors,
                          level1: e.target.value,
                        },
                      },
                    })
                  }
                  aria-label="Level 1 node color"
                  disabled={!nodeFillEnabled}
                />
              </div>

              <div className="pm-settings__divider" />

              <div className="pm-settings__row">
                <div className="pm-settings__rowText">
                  <div className="pm-settings__rowTitle">Level 2 color</div>
                  <div className="pm-settings__rowDesc">
                    Applied to nodes with level 2.
                  </div>
                </div>
                <input
                  className="pm-settings__control"
                  type="color"
                  value={settings.appearance.nodeFillColors.level2}
                  onChange={(e) =>
                    updateSettings({
                      appearance: {
                        ...settings.appearance,
                        nodeFillColors: {
                          ...settings.appearance.nodeFillColors,
                          level2: e.target.value,
                        },
                      },
                    })
                  }
                  aria-label="Level 2 node color"
                  disabled={!nodeFillEnabled}
                />
              </div>

              <div className="pm-settings__divider" />

              <div className="pm-settings__row">
                <div className="pm-settings__rowText">
                  <div className="pm-settings__rowTitle">Level 3 color</div>
                  <div className="pm-settings__rowDesc">
                    Applied to nodes with level 3.
                  </div>
                </div>
                <input
                  className="pm-settings__control"
                  type="color"
                  value={settings.appearance.nodeFillColors.level3}
                  onChange={(e) =>
                    updateSettings({
                      appearance: {
                        ...settings.appearance,
                        nodeFillColors: {
                          ...settings.appearance.nodeFillColors,
                          level3: e.target.value,
                        },
                      },
                    })
                  }
                  aria-label="Level 3 node color"
                  disabled={!nodeFillEnabled}
                />
              </div>

              <div className="pm-settings__divider" />

              <div className="pm-settings__row">
                <div className="pm-settings__rowText">
                  <div className="pm-settings__rowTitle">Level 4 color</div>
                  <div className="pm-settings__rowDesc">
                    Applied to nodes with level 4 and deeper.
                  </div>
                </div>
                <input
                  className="pm-settings__control"
                  type="color"
                  value={settings.appearance.nodeFillColors.level4}
                  onChange={(e) =>
                    updateSettings({
                      appearance: {
                        ...settings.appearance,
                        nodeFillColors: {
                          ...settings.appearance.nodeFillColors,
                          level4: e.target.value,
                        },
                      },
                    })
                  }
                  aria-label="Level 4 node color"
                  disabled={!nodeFillEnabled}
                />
              </div>

              <div className="pm-settings__divider" />

              <div className="pm-settings__row">
                <div className="pm-settings__rowText">
                  <div
                    className="pm-settings__rowTitle"
                    id="pm-lock-node-positions-label"
                  >
                    Lock node positions
                  </div>
                  <div
                    className="pm-settings__rowDesc"
                    id="pm-lock-node-positions-desc"
                  >
                    Prevent dragging nodes on the canvas.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={!!settings.interaction.lockNodePositions}
                  onChange={(e) =>
                    updateSettings({
                      interaction: {
                        ...settings.interaction,
                        lockNodePositions: e.target.checked,
                      },
                    })
                  }
                  aria-labelledby="pm-lock-node-positions-label"
                  aria-describedby="pm-lock-node-positions-desc"
                />
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}