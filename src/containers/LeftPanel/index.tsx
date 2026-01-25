/**
 * LeftPanel/index.tsx
 *
 * Left panel container component for folder tree and file management.
 *
 * Features:
 * - Resizable panel with drag handle
 * - Root folder selection via File System Access API
 * - Collapsible to icon-only view when minimized
 * - TreeView component for displaying folder structure
 *
 * The panel can be resized between MIN_WIDTH (56px) and MAX_WIDTH (400px).
 * When minimized, it shows only the root folder selection button.
 */

import { TreeView } from "../../components/TreeView";
import { selectActiveTab, useMindMapStore } from "../../store/mindMapStore";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { uiText } from "../../constants/uiText";
import type { IndexNode, RootFolderJson } from "../../data/fileManager";
import type { BookmarkEntry } from "../../utils/bookmarksManager";
import {
  getRootIndexFilePath,
  incrementBookmarkViews,
  loadBookmarksFromHandle,
  loadBookmarksFromPath,
  resolveAppDataLocation,
  saveBookmarksToHandle,
  saveBookmarksToPath,
} from "../../utils/bookmarksManager";
import { FileManager } from "../../data/fileManager";
import { CognitiveNotesManager } from "../../extensions/cognitiveNotes/data/cognitiveNotesManager";
import { composeCognitiveNotesGraph } from "../../extensions/cognitiveNotes/utils/composeCognitiveNotesGraph";

/**
 * LeftPanel component
 *
 * Renders the left sidebar with folder tree and root folder selection.
 * Handles panel resizing via mouse drag on the resize handle.
 */
export default function LeftPanel() {
  const leftPanelWidth = useMindMapStore((s) => s.leftPanelWidth);
  const setLeftPanelWidth = useMindMapStore((s) => s.setLeftPanelWidth);
  const activeTab = useMindMapStore(selectActiveTab);
  const nodes = activeTab?.nodes ?? [];
  const rootFolderJson = activeTab?.rootFolderJson ?? null;
  const cognitiveNotesRoot = activeTab?.cognitiveNotesRoot ?? null;
  const moduleType = activeTab?.moduleType ?? null;
  const selectNode = useMindMapStore((s) => s.selectNode);
  const setNodes = useMindMapStore((s) => s.setNodes);
  const setShouldFitView = useMindMapStore((s) => s.setShouldFitView);
  const setActiveTab = useMindMapStore((s) => s.setActiveTab);
  const createTab = useMindMapStore((s) => s.createTab);
  const setTabTitle = useMindMapStore((s) => s.setTabTitle);
  const setTabModule = useMindMapStore((s) => s.setTabModule);
  const setRoot = useMindMapStore((s) => s.setRoot);
  const setCognitiveNotesRoot = useMindMapStore((s) => s.setCognitiveNotesRoot);
  const setCognitiveNotesSource = useMindMapStore((s) => s.setCognitiveNotesSource);
  const setEdges = useMindMapStore((s) => s.setEdges);
  const settings = useMindMapStore((s) => s.settings);
  const appDataDirectoryHandle = useMindMapStore((s) => s.appDataDirectoryHandle);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<
    { id: string; label: string; name: string }[]
  >([]);
  const [leftPanelView, setLeftPanelView] = useState<"bookmarks" | "fileTree">(
    "bookmarks"
  );
  const [recentSearches, setRecentSearches] = useState<
    { id: string; label: string }[]
  >([]);
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
  const [bookmarksRefreshKey, setBookmarksRefreshKey] = useState(0);
  const fileManagerRef = useRef<FileManager | null>(null);
  const cognitiveNotesManagerRef = useRef<CognitiveNotesManager | null>(null);

  const dragRef = useRef<{
    startX: number;
    startWidth: number;
    raf: number | null;
    latestX: number;
    dragging: boolean;
  } | null>(null);

  // Left Panel width constraints
  const MIN_WIDTH = 56;
  const MAX_WIDTH = 600;
  const isReduced = leftPanelWidth <= MIN_WIDTH;
  const lastExpandedWidthRef = useRef<number>(280);

  useEffect(() => {
    if (!isReduced) {
      lastExpandedWidthRef.current = leftPanelWidth;
    }
  }, [leftPanelWidth, isReduced]);

  const togglePanel = () => {
    if (isReduced) {
      setLeftPanelWidth(Math.max(MIN_WIDTH, lastExpandedWidthRef.current));
      return;
    }
    lastExpandedWidthRef.current = leftPanelWidth;
    setLeftPanelWidth(MIN_WIDTH);
  };

  const fileIndexEntries = useMemo(() => {
    const entries: { id: string; name: string; label: string }[] = [];
    if (moduleType === "cognitiveNotes") {
      (cognitiveNotesRoot?.child ?? []).forEach((node: any) => {
        const name =
          typeof node?.name === "string" ? node.name.trim() : "";
        if (!name) return;
        const extension =
          typeof node?.extension === "string" ? node.extension.trim() : "";
        const label = extension ? `${name}.${extension}` : name;
        entries.push({ id: node.id as string, name, label });
      });
      return entries;
    }
    if (!rootFolderJson) return [];
    const walk = (list: IndexNode[]) => {
      list.forEach((node) => {
        const hasChildren = Array.isArray((node as any).child);
        const name =
          typeof (node as any).name === "string" ? (node as any).name.trim() : "";
        if (name) {
          const extension =
            typeof (node as any).extension === "string"
              ? (node as any).extension.trim()
              : "";
          const label = extension ? `${name}.${extension}` : name;
          entries.push({ id: (node as any).id as string, name, label });
        }
        if (hasChildren) {
          walk((node as any).child as IndexNode[]);
        }
      });
    };
    walk((rootFolderJson as RootFolderJson).child ?? []);
    return entries;
  }, [rootFolderJson, cognitiveNotesRoot, moduleType]);

  const runSearch = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setMatches([]);
      return;
    }
    const q = trimmed.toLowerCase();
    const result = fileIndexEntries
      .filter((entry) => entry.name.toLowerCase().includes(q))
      .map((entry) => ({
        id: entry.id,
        label: entry.label,
        name: entry.name,
      }));
    setMatches(result);
  };

  const selectMatchedNode = (entry: { id: string; label: string }) => {
    const node = nodes.find((n: any) => n?.id === entry.id);
    if (!node) return;
    selectNode(node.id);
    setNodes(
      (nodes ?? []).map((item: any) => ({
        ...item,
        selected: item?.id === entry.id,
      }))
    );
    setShouldFitView(true);
    setRecentSearches((prev) => {
      const next = [{ id: entry.id, label: entry.label }].concat(
        prev.filter((item) => item.id !== entry.id)
      );
      return next;
    });
    setMatches([]);
  };

  /**
   * Initiates panel resize operation
   *
   * Captures initial mouse position and panel width, then sets up
   * global mouse move/up listeners for drag tracking.
   */
  const onResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    dragRef.current = {
      startX: e.clientX,
      startWidth: leftPanelWidth,
      raf: null,
      latestX: e.clientX,
      dragging: true,
    };

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  };

  /**
   * Effect: Handle panel resizing via mouse drag
   *
   * Uses requestAnimationFrame for smooth resizing performance.
   * Calculates new width based on mouse movement and clamps to MIN/MAX bounds.
   */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d?.dragging) return;

      d.latestX = e.clientX;
      if (d.raf != null) return;

      d.raf = window.requestAnimationFrame(() => {
        const dd = dragRef.current;
        if (!dd?.dragging) return;

        const dx = dd.latestX - dd.startX;
        const next = Math.max(
          MIN_WIDTH,
          Math.min(MAX_WIDTH, dd.startWidth + dx)
        );
        setLeftPanelWidth(next);
        dd.raf = null;
      });
    };

    const onUp = () => {
      const d = dragRef.current;
      if (!d?.dragging) return;
      d.dragging = false;
      if (d.raf != null) {
        window.cancelAnimationFrame(d.raf);
        d.raf = null;
      }
      dragRef.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [setLeftPanelWidth]);

  useEffect(() => {
    if (leftPanelView !== "bookmarks") return;
    const isDesktopMode =
      typeof (window as any).__TAURI_INTERNALS__ !== "undefined";
    const dirPath = settings.storage.appDataFolderPath ?? null;
    const handle = appDataDirectoryHandle ?? null;
    if (isDesktopMode && !dirPath) {
      setBookmarks([]);
      return;
    }
    if (!isDesktopMode && !handle) {
      setBookmarks([]);
      return;
    }
    void (async () => {
      try {
        const data = isDesktopMode && dirPath
          ? await loadBookmarksFromPath(dirPath)
          : handle
            ? await loadBookmarksFromHandle(handle)
            : null;
        setBookmarks(data?.bookmarks ?? []);
      } catch {
        setBookmarks([]);
      }
    })();
  }, [
    leftPanelView,
    settings.storage.appDataFolderPath,
    appDataDirectoryHandle,
    bookmarksRefreshKey,
  ]);

  useEffect(() => {
    const onUpdate = () => setBookmarksRefreshKey((v) => v + 1);
    window.addEventListener("pm-bookmarks-updated", onUpdate as EventListener);
    return () =>
      window.removeEventListener("pm-bookmarks-updated", onUpdate as EventListener);
  }, []);

  const bookmarkName = (entry: BookmarkEntry): string => {
    const rawName = entry.name?.trim() || entry.path?.split(/[\\/]/).pop() || "";
    return rawName.endsWith(".json") ? rawName.slice(0, -5) : rawName;
  };

  const sortedBookmarks = useMemo(() => {
    const order = settings.bookmarks?.sortOrder ?? "views_desc";
    return [...bookmarks].sort((a, b) => {
      const aViews = typeof a.views === "number" ? a.views : 0;
      const bViews = typeof b.views === "number" ? b.views : 0;
      if (aViews === bViews) {
        return (a.name ?? "").localeCompare(b.name ?? "");
      }
      return order === "views_asc" ? aViews - bViews : bViews - aViews;
    });
  }, [bookmarks, settings.bookmarks?.sortOrder]);

  const isDesktopMode =
    typeof (window as any).__TAURI_INTERNALS__ !== "undefined";

  const getManagers = () => {
    if (!fileManagerRef.current) {
      fileManagerRef.current = new FileManager();
    }
    if (!cognitiveNotesManagerRef.current) {
      cognitiveNotesManagerRef.current = new CognitiveNotesManager();
    }
    return {
      fileManager: fileManagerRef.current,
      cognitiveNotesManager: cognitiveNotesManagerRef.current,
    };
  };

  const findOpenTabForBookmark = (entry: BookmarkEntry): string | null => {
    const path = entry.path;
    if (!path) return null;
    for (const tab of useMindMapStore.getState().tabs) {
      if (entry.moduleType === "parallelmind" && tab.rootFolderJson) {
        const tabPath = getRootIndexFilePath(
          "parallelmind",
          tab.rootFolderJson.name ?? tab.title ?? "root",
          tab.rootFolderJson.path ?? null
        );
        if (tabPath === path) return tab.id;
      }
      if (entry.moduleType === "cognitiveNotes" && tab.cognitiveNotesRoot) {
        const tabPath = getRootIndexFilePath(
          "cognitiveNotes",
          tab.cognitiveNotesRoot.name ?? tab.title ?? "root",
          tab.cognitiveNotesRoot.path ?? null
        );
        if (tabPath === path) return tab.id;
      }
    }
    return null;
  };

  const incrementBookmarkViewsForEntry = async (entry: BookmarkEntry) => {
    const location = await resolveAppDataLocation({
      settings,
      handle: appDataDirectoryHandle ?? null,
    });
    if (!location) return;
    if (location.dirPath) {
      const data = await loadBookmarksFromPath(location.dirPath);
      const next = incrementBookmarkViews({ data, path: entry.path });
      if (next) {
        await saveBookmarksToPath(location.dirPath, next);
        window.dispatchEvent(new CustomEvent("pm-bookmarks-updated"));
      }
      return;
    }
    if (location.dirHandle) {
      const data = await loadBookmarksFromHandle(location.dirHandle);
      const next = incrementBookmarkViews({ data, path: entry.path });
      if (next) {
        await saveBookmarksToHandle(location.dirHandle, next);
        window.dispatchEvent(new CustomEvent("pm-bookmarks-updated"));
      }
    }
  };

  const openBookmark = async (entry: BookmarkEntry) => {
    const existingId = findOpenTabForBookmark(entry);
    if (existingId) {
      setActiveTab(existingId);
      return;
    }
    if (!entry.path || !isDesktopMode) return;
    const dirPath = entry.path.replace(/[\\/][^\\/]+$/, "");
    if (!dirPath || dirPath === entry.path) return;

    const { fileManager, cognitiveNotesManager } = getManagers();
    try {
      if (entry.moduleType === "cognitiveNotes") {
        const result =
          await cognitiveNotesManager.loadOrCreateCognitiveNotesJsonFromPath(
            dirPath
          );
        const tabId = createTab();
        setActiveTab(tabId);
        setTabTitle(tabId, result.root.name ?? "Cognitive Notes");
        setTabModule(tabId, "cognitiveNotes");
        setCognitiveNotesRoot(result.root);
        setCognitiveNotesSource(null, dirPath);
        const { nodes, edges, rootNodeId } = composeCognitiveNotesGraph(result.root, {
          nodeSize: settings.appearance.nodeSize,
          columns: settings.appearance.gridColumns,
          columnGap: settings.appearance.gridColumnGap,
          rowGap: settings.appearance.gridRowGap,
        });
        setNodes(nodes);
        setEdges(edges);
        setShouldFitView(true);
        selectNode(rootNodeId);
      } else {
        const result = await fileManager.loadOrCreateRootFolderJsonFromPath(dirPath);
        const tabId = createTab();
        setActiveTab(tabId);
        setRoot(null, result.root);
        selectNode("00");
      }
      await incrementBookmarkViewsForEntry(entry);
    } catch {
      return;
    }
  };

  return (
    <aside
      className="pm-panel pm-panel--left"
      aria-label={uiText.ariaLabels.leftSidebar}
      style={{
        position: "relative",
        width: leftPanelWidth,
        minWidth: leftPanelWidth,
        maxWidth: leftPanelWidth,
        flex: "0 0 auto",
      }}
    >
      <div
        className="pm-panel__header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "var(--space-2)",
        }}
      >
        <button
          type="button"
          onClick={togglePanel}
          aria-label={uiText.tooltips.toggleLeftPanel}
          title={uiText.tooltips.toggleLeftPanel}
          style={{
            height: "var(--control-size-sm)",
            width: "var(--control-size-sm)",
            borderRadius: "var(--radius-sm)",
            border: "none",
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
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
          {isReduced ? (
            <FiChevronRight aria-hidden="true" />
          ) : (
            <FiChevronLeft aria-hidden="true" />
          )}
        </button>
      </div>

      {!isReduced ? (
        <div className="pm-panel__content">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
              padding: "var(--space-2)",
              borderBottom: "var(--border-width) solid var(--border)",
            }}
          >
            <label style={{ display: "grid", gap: "5px" }}>
              <span style={{ fontSize: "0.8rem", opacity: 0.75 }}>
                {moduleType === "cognitiveNotes"
                  ? "File Search"
                  : "Folder & File Search"}
              </span>
              <input
                value={query}
                onChange={(e) => {
                  const next = e.target.value;
                  setQuery(next);
                  runSearch(next);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (matches[0]) {
                      selectMatchedNode(matches[0]);
                    }
                  }
                }}
                placeholder="Search file name"
                style={{
                  width: "100%",
                  borderRadius: "var(--radius-md)",
                  border: "var(--border-width) solid var(--border)",
                  padding: "6px 8px",
                  background: "var(--surface-2)",
                  color: "var(--text)",
                  fontFamily: "var(--font-family)",
                }}
                aria-label="Search files"
              />
            </label>

            {matches.length > 0 && (
              <div
                role="listbox"
                aria-label="Search results"
                style={{
                  display: "grid",
                  gap: "var(--space-1)",
                  background: "var(--surface-2)",
                  border: "var(--border-width) solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "4px",
                  maxHeight: 180,
                  overflow: "auto",
                }}
              >
                {matches.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    onClick={() => selectMatchedNode(item)}
                    style={{
                      textAlign: "left",
                      padding: "6px 8px",
                      borderRadius: "var(--radius-sm)",
                      border: "none",
                      background: "transparent",
                      color: "inherit",
                      cursor: "pointer",
                      fontFamily: "var(--font-family)",
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
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {recentSearches.length > 0 && (
              <div style={{ display: "grid", gap: "var(--space-1)" }}>
                <div style={{ fontSize: "0.75rem", opacity: 0.6 }}>
                  Recent searches
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {recentSearches.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectMatchedNode(item)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "999px",
                        border: "var(--border-width) solid var(--border)",
                        background: "var(--surface-1)",
                        color: "inherit",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div
            style={{
              padding: "var(--space-2)",
              borderBottom: "var(--border-width) solid var(--border)",
              display: "grid",
              gap: "6px",
            }}
          >
            <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>
              {uiText.leftPanel.viewLabel}
            </div>
            <select
              value={leftPanelView}
              onChange={(e) =>
                setLeftPanelView(
                  e.target.value === "bookmarks" ? "bookmarks" : "fileTree"
                )
              }
              style={{
                width: "100%",
                borderRadius: "var(--radius-md)",
                border: "var(--border-width) solid var(--border)",
                padding: "6px 8px",
                background: "var(--surface-2)",
                color: "var(--text)",
                fontFamily: "var(--font-family)",
              }}
              aria-label={uiText.leftPanel.viewLabel}
            >
              <option value="bookmarks">{uiText.leftPanel.views.bookmarks}</option>
              <option value="fileTree">{uiText.leftPanel.views.fileTree}</option>
            </select>
          </div>

          {leftPanelView === "fileTree" ? (
            <TreeView />
          ) : (
            <div
              style={{
                padding: "var(--space-3)",
                fontSize: "0.85rem",
                opacity: 0.8,
              }}
            >
              {sortedBookmarks.length === 0 ? (
                uiText.leftPanel.emptyBookmarks
              ) : (
                <div style={{ display: "grid", gap: "6px" }}>
                  {sortedBookmarks.map((entry) => (
                    <div
                      key={`${entry.path}-${entry.moduleType}`}
                      title={entry.path}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        padding: "4px 6px",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--surface-1)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => void openBookmark(entry)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                          width: "100%",
                          border: "none",
                          background: "transparent",
                          color: "inherit",
                          cursor: "pointer",
                          padding: 0,
                          fontFamily: "var(--font-family)",
                        }}
                      >
                        <span>{bookmarkName(entry)}</span>
                        <span style={{ fontSize: "7px", opacity: 0.75 }}>
                          {entry.views ?? 0}
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="pm-panel__collapsed" aria-hidden="true" />
      )}

      <div
        className="pm-resize-handle pm-resize-handle--right"
        role="separator"
        aria-label={uiText.tooltips.resizeLeftSidebar}
        title={uiText.tooltips.resizeLeftSidebar}
        onMouseDown={onResizeMouseDown}
      />
    </aside>
  );
}
