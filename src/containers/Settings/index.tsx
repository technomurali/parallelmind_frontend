import { useMemo, useState } from "react";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import { uiText } from "../../constants/uiText";
import { useMindMapStore } from "../../store/mindMapStore";

type SettingsSection = "appearance";

export default function Settings() {
  const settings = useMindMapStore((s) => s.settings);
  const updateSettings = useMindMapStore((s) => s.updateSettings);
  const nodeFillEnabled = !!settings.appearance.enableNodeFillColors;

  const [section, setSection] = useState<SettingsSection>("appearance");
  const [openSections, setOpenSections] = useState({
    themeDisplay: true,
    nodeTypography: false,
    connectionsLayout: false,
    canvasAids: false,
    nodeColoring: false,
  });

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
              {([
                {
                  id: "themeDisplay",
                  title: "Theme & Display",
                  desc: "Global visual preferences.",
                  content: (
                    <>
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
                    </>
                  ),
                },
                {
                  id: "nodeTypography",
                  title: "Node Typography",
                  desc: "Text appearance inside nodes.",
                  content: (
                    <>
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
                    </>
                  ),
                },
                {
                  id: "connectionsLayout",
                  title: "Connections & Layout",
                  desc: "How nodes are visually connected.",
                  content: (
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
                  ),
                },
                {
                  id: "canvasAids",
                  title: "Canvas Aids",
                  desc: "Visual helpers for navigation.",
                  content: (
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
                  ),
                },
                {
                  id: "nodeColoring",
                  title: "Node Coloring",
                  desc: "Color rules applied to nodes.",
                  content: (
                    <>
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
                    </>
                  ),
                },
              ] as const).map((sectionConfig, index) => {
                const expanded =
                  openSections[sectionConfig.id as keyof typeof openSections];
                const contentId = `appearance-${sectionConfig.id}`;
                const headerId = `${contentId}-header`;
                return (
                  <div
                    key={sectionConfig.id}
                    style={{
                      paddingTop: index === 0 ? 0 : "var(--space-2)",
                    }}
                  >
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={contentId}
                      id={headerId}
                      onClick={() =>
                        setOpenSections((prev) => ({
                          ...prev,
                          [sectionConfig.id]: !expanded,
                        }))
                      }
                      className="pm-settings__row"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                        border: "none",
                        background: "transparent",
                        padding: "var(--space-2) 0",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div className="pm-settings__rowText">
                        <div
                          className="pm-settings__rowTitle"
                          style={{ fontSize: "0.95rem" }}
                        >
                          {sectionConfig.title}
                        </div>
                        {sectionConfig.desc && (
                          <div className="pm-settings__rowDesc">
                            {sectionConfig.desc}
                          </div>
                        )}
                      </div>
                      <span aria-hidden="true">
                        {expanded ? <FiChevronDown /> : <FiChevronRight />}
                      </span>
                    </button>

                    {expanded && (
                      <div
                        role="region"
                        id={contentId}
                        aria-labelledby={headerId}
                        style={{
                          display: "grid",
                          gap: "var(--space-2)",
                          paddingBottom: "var(--space-2)",
                        }}
                      >
                        {sectionConfig.content}
                      </div>
                    )}

                    {index < 4 && <div className="pm-settings__divider" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}