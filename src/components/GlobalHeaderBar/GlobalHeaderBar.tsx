import { uiText } from "../../constants/uiText";
import { useMindMapStore } from "../../store/mindMapStore";
import { FiSettings } from "react-icons/fi";
import { FileManager } from "../../data/fileManager";
import { useMemo, useState, useRef, useEffect } from "react";

type GlobalHeaderBarProps = {
  /**
   * Placeholder until you decide the final content.
   * If omitted, we show a minimal app title.
   */
  title?: string;
};

export function GlobalHeaderBar({ title: _title }: GlobalHeaderBarProps) {
  const toggleSettings = useMindMapStore((s) => s.toggleSettings);
  const rootDirectoryHandle = useMindMapStore((s) => s.rootDirectoryHandle);
  const rootFolderJson = useMindMapStore((s) => s.rootFolderJson);
  const setRoot = useMindMapStore((s) => s.setRoot);
  const clearRoot = useMindMapStore((s) => s.clearRoot);
  const selectNode = useMindMapStore((s) => s.selectNode);
  const fileManager = useMemo(() => new FileManager(), []);
  
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(event.target as Node)) {
        setFileMenuOpen(false);
      }
    };

    if (fileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [fileMenuOpen]);

  /**
   * Handles root folder configuration via File System Access API
   * Opens directory picker and loads/creates the root folder index file
   */
  const onConfigRootFolder = async () => {
    setFileMenuOpen(false);
    let selection: FileSystemDirectoryHandle | string | null = null;
    try {
      selection = await fileManager.pickRootDirectory();
    } catch (err) {
      // Silent by UX rules; keep a console breadcrumb for debugging.
      console.error("[GlobalHeaderBar] pickRootDirectory failed:", err);
      return;
    }
    if (!selection) return; // Silent cancel - user closed picker

    // If a root already exists and the user picked a different folder, confirm replacement.
    // Note: in browser mode `rootFolderJson.path` can be empty by design.
    if (rootDirectoryHandle || rootFolderJson) {
      let isSame = false;
      if (typeof selection === "string") {
        isSame = rootFolderJson?.path === selection;
      } else if (rootDirectoryHandle) {
        try {
          if (typeof rootDirectoryHandle.isSameEntry === "function") {
            isSame = await rootDirectoryHandle.isSameEntry(selection);
          }
        } catch {
          // If comparison fails, treat as different and require confirmation.
          isSame = false;
        }
      }

      if (!isSame) {
        const ok = window.confirm(uiText.alerts.confirmReplaceRootFolder);
        if (!ok) return;
        // Switching to a new root must reset the in-memory graph and selection state,
        // otherwise nodes/edges from the previous root can leak into the new workspace.
        clearRoot();
      }
    }

    try {
      if (typeof selection === "string") {
        const result = await fileManager.loadOrCreateRootFolderJsonFromPath(
          selection
        );
        if (!result.created) {
          // TODO: define the "existing root" flow (e.g., merge, refresh, or re-scan)
          // when a parallelmind_index.json file already exists in the chosen folder.
        }
        setRoot(null, result.root);
      } else {
        const result = await fileManager.loadOrCreateRootFolderJson(selection);
        if (!result.created) {
          // TODO: define the "existing root" flow (e.g., merge, refresh, or re-scan)
          // when a parallelmind_index.json file already exists in the chosen folder.
        }
        setRoot(selection, result.root);
      }

      // Immediately focus the new root in the UI so the details panel is usable right away.
      selectNode("00");
    } catch (err) {
      // Silent by UX rules; keep a console breadcrumb for debugging.
      console.error("[GlobalHeaderBar] configure root failed:", err);
    }
  };

  return (
    <header className="pm-global-header" aria-label={uiText.ariaLabels.workspace}>
      <div className="pm-global-header__left">
        {/* File Menu */}
        <div ref={fileMenuRef} style={{ position: "relative", marginLeft: "var(--space-4)" }}>
          <button
            type="button"
            onClick={() => setFileMenuOpen(!fileMenuOpen)}
            aria-label={uiText.menus.file}
            aria-expanded={fileMenuOpen}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "var(--space-2) var(--space-3)",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: fileMenuOpen ? "var(--surface-1)" : "transparent",
              color: "var(--text)",
              cursor: "pointer",
              fontFamily: "var(--font-family)",
              fontSize: "var(--font-size-sm)",
            }}
            onMouseEnter={(e) => {
              if (!fileMenuOpen) {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-1)";
              }
            }}
            onMouseLeave={(e) => {
              if (!fileMenuOpen) {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }
            }}
          >
            {uiText.menus.file}
          </button>
          
          {fileMenuOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: "var(--space-1)",
                minWidth: "200px",
                background: "var(--surface-2)",
                border: "var(--border-width) solid var(--border)",
                borderRadius: "var(--radius-md)",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                zIndex: 1000,
                padding: "var(--space-1)",
              }}
            >
              <button
                type="button"
                onClick={onConfigRootFolder}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: "transparent",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontFamily: "var(--font-family)",
                  fontSize: "var(--font-size-sm)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-1)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                {uiText.menus.configRootFolder}
              </button>
            </div>
          )}
        </div>
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

