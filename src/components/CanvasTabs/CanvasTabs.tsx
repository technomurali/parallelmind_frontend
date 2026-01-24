import { useEffect, useMemo, useRef, useState } from "react";
import { uiText } from "../../constants/uiText";
import { useMindMapStore } from "../../store/mindMapStore";
import { saveAppDataDirectoryHandle } from "../../utils/appDataHandleStore";
import {
  addBookmarkEntry,
  buildBookmarkEntry,
  getRootIndexFilePath,
  loadBookmarksFromHandle,
  loadBookmarksFromPath,
  saveBookmarksToHandle,
  saveBookmarksToPath,
} from "../../utils/bookmarksManager";

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
  const settings = useMindMapStore((s) => s.settings);
  const updateSettings = useMindMapStore((s) => s.updateSettings);
  const appDataDirectoryHandle = useMindMapStore((s) => s.appDataDirectoryHandle);
  const setAppDataDirectoryHandle = useMindMapStore(
    (s) => s.setAppDataDirectoryHandle
  );
  const activeTabColors = useMindMapStore(
    (s) => s.settings.appearance.activeTabColors
  );

  const [tabMenu, setTabMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    tabId: string | null;
  }>({ open: false, x: 0, y: 0, tabId: null });
  const menuRef = useRef<HTMLDivElement>(null);

  const fallbackTitle = uiText.tabs.untitled;

  const isDesktopMode =
    typeof (window as any).__TAURI_INTERNALS__ !== "undefined";

  const tabById = useMemo(() => {
    const map = new Map<string, (typeof tabs)[number]>();
    for (const tab of tabs) map.set(tab.id, tab);
    return map;
  }, [tabs]);

  const closeMenu = () =>
    setTabMenu((prev) =>
      prev.open ? { open: false, x: 0, y: 0, tabId: null } : prev
    );

  useEffect(() => {
    if (!tabMenu.open) return;
    const onClick = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      closeMenu();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [tabMenu.open]);

  const ensureAppDataLocation = async (): Promise<
    { dirPath?: string; dirHandle?: FileSystemDirectoryHandle } | null
  > => {
    if (isDesktopMode) {
      if (settings.storage.appDataFolderPath) {
        return { dirPath: settings.storage.appDataFolderPath };
      }
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({ directory: true, multiple: false });
        const dirPath = typeof selected === "string" ? selected : null;
        if (!dirPath) return null;
        const trimmed = dirPath.replace(/[\\/]+$/, "");
        const parts = trimmed.split(/[\\/]/);
        const name = parts[parts.length - 1] || trimmed;
        updateSettings({
          storage: {
            ...settings.storage,
            appDataFolderPath: dirPath,
            appDataFolderName: name,
          },
        });
        return { dirPath };
      } catch {
        return null;
      }
    }

    if (appDataDirectoryHandle) {
      return { dirHandle: appDataDirectoryHandle };
    }
    const showDirectoryPicker = (window as any).showDirectoryPicker as
      | (() => Promise<FileSystemDirectoryHandle>)
      | undefined;
    if (!showDirectoryPicker) return null;
    try {
      const handle = await showDirectoryPicker();
      if (!handle) return null;
      await saveAppDataDirectoryHandle(handle);
      setAppDataDirectoryHandle(handle);
      updateSettings({
        storage: {
          ...settings.storage,
          appDataFolderPath: null,
          appDataFolderName: handle.name ?? null,
        },
      });
      return { dirHandle: handle };
    } catch {
      return null;
    }
  };

  const getTabBookmarkInfo = (
    tab: (typeof tabs)[number]
  ): { path: string; name: string; moduleType: "parallelmind" | "cognitiveNotes" } | null => {
    if (tab.moduleType === "cognitiveNotes" && tab.cognitiveNotesRoot) {
      const rootName = tab.cognitiveNotesRoot.name ?? tab.title ?? "root";
      return {
        moduleType: "cognitiveNotes",
        name: rootName,
        path: getRootIndexFilePath(
          "cognitiveNotes",
          rootName,
          tab.cognitiveNotesRoot.path ?? null
        ),
      };
    }
    if (tab.moduleType === "parallelmind" && tab.rootFolderJson) {
      const rootName = tab.rootFolderJson.name ?? tab.title ?? "root";
      return {
        moduleType: "parallelmind",
        name: rootName,
        path: getRootIndexFilePath(
          "parallelmind",
          rootName,
          tab.rootFolderJson.path ?? null
        ),
      };
    }
    return null;
  };

  const handleBookmarkTab = async (tabId: string) => {
    const tab = tabById.get(tabId);
    if (!tab) return;
    const info = getTabBookmarkInfo(tab);
    if (!info) return;
    const location = await ensureAppDataLocation();
    if (!location) return;

    if (location.dirPath) {
      const data = await loadBookmarksFromPath(location.dirPath);
      const entry = buildBookmarkEntry(info);
      const next = addBookmarkEntry({ data, entry });
      if (next !== data) {
        await saveBookmarksToPath(location.dirPath, next);
        window.dispatchEvent(new CustomEvent("pm-bookmarks-updated"));
      }
      return;
    }

    if (location.dirHandle) {
      const data = await loadBookmarksFromHandle(location.dirHandle);
      const entry = buildBookmarkEntry(info);
      const next = addBookmarkEntry({ data, entry });
      if (next !== data) {
        await saveBookmarksToHandle(location.dirHandle, next);
        window.dispatchEvent(new CustomEvent("pm-bookmarks-updated"));
      }
    }
  };

  return (
    <div
      className="pm-tabs"
      role="tablist"
      aria-label={uiText.ariaLabels.canvasTabs}
      style={{ position: "relative" }}
    >
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
            onContextMenu={(event) => {
              event.preventDefault();
              setTabMenu({
                open: true,
                x: event.clientX,
                y: event.clientY,
                tabId: tab.id,
              });
            }}
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
      {tabMenu.open && (
        <div
          ref={menuRef}
          data-pm-context-menu="tabs"
          role="menu"
          aria-label={uiText.ariaLabels.contextMenu}
          style={{
            position: "fixed",
            top: tabMenu.y,
            left: tabMenu.x,
            minWidth: 160,
            background: "var(--surface-2)",
            border: "var(--border-width) solid var(--border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            zIndex: 2000,
            padding: "4px",
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              const id = tabMenu.tabId;
              closeMenu();
              if (!id) return;
              await handleBookmarkTab(id);
            }}
            className="pm-tab__menuitem"
            style={{
              width: "100%",
              textAlign: "left",
              padding: "6px 8px",
              border: "none",
              borderRadius: "var(--radius-sm)",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
              fontFamily: "var(--font-family)",
              fontSize: "0.85rem",
            }}
          >
            {uiText.contextMenus.tabs.bookmark}
          </button>
        </div>
      )}
    </div>
  );
}
