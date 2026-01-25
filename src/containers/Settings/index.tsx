import { useEffect, useMemo, useState } from "react";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import { uiText } from "../../constants/uiText";
import { useMindMapStore } from "../../store/mindMapStore";
import {
  clearAppDataDirectoryHandle,
  loadAppDataDirectoryHandle,
  saveAppDataDirectoryHandle,
} from "../../utils/appDataHandleStore";

type SettingsSection = "appearance" | "storage" | "bookmarks";

export default function Settings() {
  const settings = useMindMapStore((s) => s.settings);
  const updateSettings = useMindMapStore((s) => s.updateSettings);
  const nodeFillEnabled = !!settings.appearance.enableNodeFillColors;
  const setAppDataDirectoryHandle = useMindMapStore(
    (s) => s.setAppDataDirectoryHandle
  );

  const [section, setSection] = useState<SettingsSection>("appearance");
  const [openSections, setOpenSections] = useState({
    themeDisplay: true,
    nodeTypography: true,
    connectionsLayout: true,
    canvasAids: true,
    nodeColoring: true,
  });

  const navItems = useMemo(
    () =>
      [
        {
          id: "appearance" as const,
          label: "Appearance",
        },
        {
          id: "storage" as const,
          label: "Storage",
        },
        {
          id: "bookmarks" as const,
          label: uiText.settings.bookmarks.sectionTitle,
        },
      ] as const,
    []
  );

  useEffect(() => {
    const isDesktopMode =
      typeof (window as any).__TAURI_INTERNALS__ !== "undefined";
    if (isDesktopMode) return;
    void (async () => {
      const handle = await loadAppDataDirectoryHandle();
      if (!handle) return;
      setAppDataDirectoryHandle(handle);
      if (!settings.storage?.appDataFolderName) {
        updateSettings({
          storage: {
            ...settings.storage,
            appDataFolderName: handle.name ?? null,
            appDataFolderPath: null,
          },
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickAppDataFolder = async () => {
    const isDesktopMode =
      typeof (window as any).__TAURI_INTERNALS__ !== "undefined";
    if (isDesktopMode) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({ directory: true, multiple: false });
        const dirPath = typeof selected === "string" ? selected : null;
        if (!dirPath) return;
        const trimmed = dirPath.replace(/[\\/]+$/, "");
        const parts = trimmed.split(/[\\/]/);
        const name = parts[parts.length - 1] || trimmed;
        setAppDataDirectoryHandle(null);
        updateSettings({
          storage: {
            ...settings.storage,
            appDataFolderPath: dirPath,
            appDataFolderName: name,
          },
        });
      } catch {
        return;
      }
      return;
    }

    const showDirectoryPicker = (window as any).showDirectoryPicker as
      | (() => Promise<FileSystemDirectoryHandle>)
      | undefined;
    if (!showDirectoryPicker) return;
    try {
      const handle = await showDirectoryPicker();
      if (!handle) return;
      await saveAppDataDirectoryHandle(handle);
      setAppDataDirectoryHandle(handle);
      updateSettings({
        storage: {
          ...settings.storage,
          appDataFolderPath: null,
          appDataFolderName: handle.name ?? null,
        },
      });
    } catch {
      return;
    }
  };

  const clearAppDataFolder = async () => {
    const isDesktopMode =
      typeof (window as any).__TAURI_INTERNALS__ !== "undefined";
    if (!isDesktopMode) {
      await clearAppDataDirectoryHandle();
    }
    setAppDataDirectoryHandle(null);
    updateSettings({
      storage: {
        ...settings.storage,
        appDataFolderPath: null,
        appDataFolderName: null,
      },
    });
  };

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

                      <div className="pm-settings__divider" />

                      <div className="pm-settings__row">
                        <div className="pm-settings__rowText">
                          <div className="pm-settings__rowTitle">
                            Active tab color (Parallelmind)
                          </div>
                          <div className="pm-settings__rowDesc">
                            Controls the active tab background color.
                          </div>
                        </div>
                        <input
                          className="pm-settings__control"
                          type="color"
                          value={
                            settings.appearance.activeTabColors?.parallelmind ??
                            "#1a4a8e"
                          }
                          onChange={(e) =>
                            updateSettings({
                              appearance: {
                                ...settings.appearance,
                                activeTabColors: {
                                  ...settings.appearance.activeTabColors,
                                  parallelmind: e.target.value,
                                },
                              },
                            })
                          }
                          aria-label="Active tab color (Parallelmind)"
                        />
                      </div>

                      <div className="pm-settings__divider" />

                      <div className="pm-settings__row">
                        <div className="pm-settings__rowText">
                          <div className="pm-settings__rowTitle">
                            Active tab color (Cognitive Notes)
                          </div>
                          <div className="pm-settings__rowDesc">
                            Controls the active tab background color.
                          </div>
                        </div>
                        <input
                          className="pm-settings__control"
                          type="color"
                          value={
                            settings.appearance.activeTabColors?.cognitiveNotes ??
                            "#7412b5"
                          }
                          onChange={(e) =>
                            updateSettings({
                              appearance: {
                                ...settings.appearance,
                                activeTabColors: {
                                  ...settings.appearance.activeTabColors,
                                  cognitiveNotes: e.target.value,
                                },
                              },
                            })
                          }
                          aria-label="Active tab color (Cognitive Notes)"
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

                      <div className="pm-settings__divider" />

                      <div className="pm-settings__row">
                        <div className="pm-settings__rowText">
                          <div className="pm-settings__rowTitle">Node font color</div>
                          <div className="pm-settings__rowDesc">
                            Choose black or white for node text.
                          </div>
                        </div>
                        <select
                          className="pm-settings__control"
                          value={settings.appearance.nodeFontColor ?? "white"}
                          onChange={(e) =>
                            updateSettings({
                              appearance: {
                                ...settings.appearance,
                                nodeFontColor:
                                  e.target.value === "black" ? "black" : "white",
                              },
                            })
                          }
                          aria-label="Node font color"
                        >
                          <option value="white">White</option>
                          <option value="black">Black</option>
                        </select>
                      </div>
                    </>
                  ),
                },
                {
                  id: "connectionsLayout",
                  title: "Connections & Layout",
                  desc: "How nodes are visually connected.",
                  content: (
                    <>
                      <div className="pm-settings__row">
                        <div className="pm-settings__rowText">
                          <div className="pm-settings__rowTitle">Edge opacity</div>
                          <div className="pm-settings__rowDesc">
                            Control the visibility of connection lines.
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-2)",
                          }}
                        >
                          <input
                            className="pm-settings__control"
                            type="range"
                            min={0.2}
                            max={1}
                            step={0.05}
                            value={
                              typeof settings.appearance.edgeOpacity === "number"
                                ? settings.appearance.edgeOpacity
                                : 0.85
                            }
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              updateSettings({
                                appearance: {
                                  ...settings.appearance,
                                  edgeOpacity: Number.isFinite(n) ? n : 0.85,
                                },
                              });
                            }}
                            aria-label="Edge opacity"
                          />
                          <span style={{ fontSize: "0.85rem", opacity: 0.75 }}>
                            {Math.round(
                              (typeof settings.appearance.edgeOpacity === "number"
                                ? settings.appearance.edgeOpacity
                                : 0.85) * 100
                            )}
                            %
                          </span>
                        </div>
                      </div>

                      <div className="pm-settings__divider" />

                      <div className="pm-settings__row">
                        <div className="pm-settings__rowText">
                          <div className="pm-settings__rowTitle">
                            {uiText.tooltips.autoCenterSelection}
                          </div>
                          <div className="pm-settings__rowDesc">
                            Keep the selected node centered in view.
                          </div>
                        </div>
                        <button
                          type="button"
                          className="pm-settings__control"
                          onClick={() =>
                            updateSettings({
                              interaction: {
                                ...settings.interaction,
                                autoCenterOnSelection:
                                  !settings.interaction.autoCenterOnSelection,
                              },
                            })
                          }
                          aria-label={uiText.tooltips.autoCenterSelection}
                        >
                          {settings.interaction.autoCenterOnSelection
                            ? uiText.buttons.on
                            : uiText.buttons.off}
                        </button>
                      </div>

                      <div className="pm-settings__divider" />

                      <div className="pm-settings__row">
                        <div className="pm-settings__rowText">
                          <div className="pm-settings__rowTitle">Grid columns</div>
                          <div className="pm-settings__rowDesc">
                            Number of columns for Grid view layout.
                          </div>
                        </div>
                        <input
                          className="pm-settings__control"
                          type="number"
                          min={1}
                          max={20}
                          value={settings.appearance.gridColumns ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              updateSettings({
                                appearance: {
                                  ...settings.appearance,
                                  gridColumns: undefined,
                                },
                              });
                              return;
                            }
                            const n = Number(raw);
                            updateSettings({
                              appearance: {
                                ...settings.appearance,
                                gridColumns: Number.isFinite(n) ? n : undefined,
                                gridRows: undefined,
                              },
                            });
                          }}
                          placeholder="-"
                          aria-label="Grid columns"
                        />
                      </div>

                      <div className="pm-settings__divider" />

                      <div className="pm-settings__row">
                        <div className="pm-settings__rowText">
                          <div className="pm-settings__rowTitle">Grid rows</div>
                          <div className="pm-settings__rowDesc">
                            Number of rows for Grid view layout.
                          </div>
                        </div>
                        <input
                          className="pm-settings__control"
                          type="number"
                          min={1}
                          max={20}
                          value={settings.appearance.gridRows ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              updateSettings({
                                appearance: {
                                  ...settings.appearance,
                                  gridRows: undefined,
                                },
                              });
                              return;
                            }
                            const n = Number(raw);
                            updateSettings({
                              appearance: {
                                ...settings.appearance,
                                gridRows: Number.isFinite(n) ? n : undefined,
                                gridColumns: undefined,
                              },
                            });
                          }}
                          placeholder="-"
                          aria-label="Grid rows"
                        />
                      </div>

                      <div className="pm-settings__divider" />

                      <div className="pm-settings__row">
                        <div className="pm-settings__rowText">
                          <div className="pm-settings__rowTitle">
                            Grid horizontal gap
                          </div>
                          <div className="pm-settings__rowDesc">
                            Horizontal spacing between nodes in Grid view (px).
                          </div>
                        </div>
                        <input
                          className="pm-settings__control"
                          type="number"
                          min={0}
                          max={200}
                          value={settings.appearance.gridColumnGap ?? 20}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            updateSettings({
                              appearance: {
                                ...settings.appearance,
                                gridColumnGap: Number.isFinite(n) ? n : 20,
                              },
                            });
                          }}
                          aria-label="Grid horizontal gap"
                        />
                      </div>

                      <div className="pm-settings__divider" />

                      <div className="pm-settings__row">
                        <div className="pm-settings__rowText">
                          <div className="pm-settings__rowTitle">
                            Grid vertical gap
                          </div>
                          <div className="pm-settings__rowDesc">
                            Vertical spacing between nodes in Grid view (px).
                          </div>
                        </div>
                        <input
                          className="pm-settings__control"
                          type="number"
                          min={0}
                          max={200}
                          value={settings.appearance.gridRowGap ?? 30}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            updateSettings({
                              appearance: {
                                ...settings.appearance,
                                gridRowGap: Number.isFinite(n) ? n : 30,
                              },
                            });
                          }}
                          aria-label="Grid vertical gap"
                        />
                      </div>
                    </>
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
                          <div className="pm-settings__rowTitle">
                            Cognitive Notes default node color
                          </div>
                          <div className="pm-settings__rowDesc">
                            Applied to new Cognitive Notes nodes.
                          </div>
                        </div>
                        <input
                          className="pm-settings__control"
                          type="color"
                          value={
                            settings.appearance.cognitiveNotesDefaultNodeColor ??
                            "#4330d5"
                          }
                          onChange={(e) =>
                            updateSettings({
                              appearance: {
                                ...settings.appearance,
                                cognitiveNotesDefaultNodeColor: e.target.value,
                              },
                            })
                          }
                          aria-label="Cognitive Notes default node color"
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
        {section === "storage" && (
          <div className="pm-settings__page">
            <div className="pm-settings__pageTitle">Storage</div>
            <div className="pm-settings__card">
              <div className="pm-settings__row">
                <div className="pm-settings__rowText">
                  <div className="pm-settings__rowTitle">
                    {uiText.settings.storage.appDataFolderLabel}
                  </div>
                  <div className="pm-settings__rowDesc">
                    {uiText.settings.storage.appDataFolderDesc}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: "6px",
                    minWidth: 160,
                  }}
                >
                  <div style={{ fontSize: "0.75rem", opacity: 0.75 }}>
                    {settings.storage.appDataFolderPath ||
                      settings.storage.appDataFolderName ||
                      uiText.settings.storage.notSet}
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      className="pm-settings__control"
                      onClick={() => void pickAppDataFolder()}
                      aria-label={uiText.settings.storage.chooseFolder}
                    >
                      {uiText.settings.storage.chooseFolder}
                    </button>
                    <button
                      type="button"
                      className="pm-settings__control"
                      onClick={() => void clearAppDataFolder()}
                      aria-label={uiText.settings.storage.clear}
                    >
                      {uiText.settings.storage.clear}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {section === "bookmarks" && (
          <div className="pm-settings__page">
            <div className="pm-settings__pageTitle">
              {uiText.settings.bookmarks.sectionTitle}
            </div>
            <div className="pm-settings__card">
              <div className="pm-settings__row">
                <div className="pm-settings__rowText">
                  <div className="pm-settings__rowTitle">
                    {uiText.settings.bookmarks.sortOrderLabel}
                  </div>
                  <div className="pm-settings__rowDesc">
                    {uiText.settings.bookmarks.sortOrderDesc}
                  </div>
                </div>
                <select
                  className="pm-settings__control"
                  value={settings.bookmarks.sortOrder}
                  onChange={(e) =>
                    updateSettings({
                      bookmarks: {
                        ...settings.bookmarks,
                        sortOrder:
                          e.target.value === "views_asc"
                            ? "views_asc"
                            : "views_desc",
                      },
                    })
                  }
                  aria-label={uiText.settings.bookmarks.sortOrderLabel}
                >
                  <option value="views_desc">
                    {uiText.settings.bookmarks.sortOrders.viewsDesc}
                  </option>
                  <option value="views_asc">
                    {uiText.settings.bookmarks.sortOrders.viewsAsc}
                  </option>
                </select>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}