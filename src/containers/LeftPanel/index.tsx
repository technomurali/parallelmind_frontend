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
import { FiChevronLeft, FiChevronRight, FiX } from "react-icons/fi";
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

const truncateChipLabel = (label: string, maxChars = 10): string => {
  const safe = (label ?? "").trim();
  if (!safe) return "";
  if (safe.length <= maxChars) return safe;
  return `${safe.slice(0, maxChars)}…`;
};

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
  const edges = activeTab?.edges ?? [];
  const rootFolderJson = activeTab?.rootFolderJson ?? null;
  const cognitiveNotesRoot = activeTab?.cognitiveNotesRoot ?? null;
  const rootDirectoryHandle = activeTab?.rootDirectoryHandle ?? null;
  const cognitiveNotesDirectoryHandle = activeTab?.cognitiveNotesDirectoryHandle ?? null;
  const cognitiveNotesFolderPath = activeTab?.cognitiveNotesFolderPath ?? null;
  const moduleType = activeTab?.moduleType ?? null;
  const selectNode = useMindMapStore((s) => s.selectNode);
  const setNodes = useMindMapStore((s) => s.setNodes);
  const setShouldFitView = useMindMapStore((s) => s.setShouldFitView);
  const updateRootFolderJson = useMindMapStore((s) => s.updateRootFolderJson);
  const updateCognitiveNotesRoot = useMindMapStore((s) => s.updateCognitiveNotesRoot);
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
  const [fileSearchInfo, setFileSearchInfo] = useState<string | null>(null);
  const [matches, setMatches] = useState<
    { id: string; label: string; name: string }[]
  >([]);
  const [leftPanelView, setLeftPanelView] = useState<"bookmarks" | "fileTree">(
    "bookmarks"
  );
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

  const fileSearchDisabled =
    moduleType == null &&
    !rootFolderJson &&
    !cognitiveNotesRoot &&
    (nodes ?? []).length === 0 &&
    (edges ?? []).length === 0;

  useEffect(() => {
    if (!fileSearchDisabled) {
      setFileSearchInfo(null);
    } else {
      setMatches([]);
      setQuery("");
    }
  }, [fileSearchDisabled]);

  const recentSearches = useMemo(() => {
    if (fileSearchDisabled) return [];
    const fromRoot =
      moduleType === "cognitiveNotes"
        ? (cognitiveNotesRoot as any)?.recent_searches
        : (rootFolderJson as any)?.recent_searches;
    if (!Array.isArray(fromRoot)) return [];
    return fromRoot
      .filter((x: any) => x && typeof x === "object")
      .map((x: any) => ({
        id: typeof x.id === "string" ? x.id : "",
        label: typeof x.label === "string" ? x.label : "",
      }))
      .filter((x: any) => x.id && x.label);
  }, [fileSearchDisabled, moduleType, cognitiveNotesRoot, rootFolderJson]);

  const recentSearchChips = useMemo(() => {
    if (recentSearches.length === 0) {
      return { recentOpened: [], mostViewed: [] as typeof recentSearches };
    }
    const recentLimitRaw = settings.fileSearch?.recentLimit;
    const recentLimit =
      typeof recentLimitRaw === "number" && Number.isFinite(recentLimitRaw)
        ? Math.max(1, Math.min(50, Math.round(recentLimitRaw)))
        : 5;
    const viewMap = new Map<string, number>();
    const lastViewedMap = new Map<string, string>();
    if (moduleType === "cognitiveNotes") {
      (cognitiveNotesRoot?.child ?? []).forEach((node: any) => {
        if (!node?.id) return;
        const count =
          typeof node.views === "number" && Number.isFinite(node.views)
            ? node.views
            : 0;
        viewMap.set(String(node.id), count);
        const lastViewed =
          typeof node.last_viewed_on === "string" ? node.last_viewed_on : "";
        lastViewedMap.set(String(node.id), lastViewed);
      });
    } else if (rootFolderJson) {
      const walk = (list: IndexNode[]) => {
        list.forEach((node) => {
          if (!node) return;
          const isFileNode = typeof (node as any)?.extension === "string";
          if (isFileNode && (node as any)?.id) {
            const count =
              typeof (node as any).views === "number" &&
              Number.isFinite((node as any).views)
                ? (node as any).views
                : 0;
            viewMap.set(String((node as any).id), count);
            const lastViewed =
              typeof (node as any).last_viewed_on === "string"
                ? (node as any).last_viewed_on
                : "";
            lastViewedMap.set(String((node as any).id), lastViewed);
          }
          if (Array.isArray((node as any)?.child)) {
            walk((node as any).child as IndexNode[]);
          }
        });
      };
      walk(rootFolderJson.child ?? []);
    }
    const enriched = [...recentSearches]
      .map((entry) => ({
        ...entry,
        views: viewMap.get(entry.id) ?? 0,
        last_viewed_on: lastViewedMap.get(entry.id) ?? "",
      }));

    const recentOpened = [...enriched]
      .sort((a, b) => {
        const aKey = typeof a.last_viewed_on === "string" ? a.last_viewed_on : "";
        const bKey = typeof b.last_viewed_on === "string" ? b.last_viewed_on : "";
        if (aKey === bKey) return (b.views ?? 0) - (a.views ?? 0);
        // ISO timestamps: lexical compare matches chronological order
        return bKey.localeCompare(aKey);
      })
      .slice(0, recentLimit);

    const recentIds = new Set(recentOpened.map((item) => item.id));
    const mostViewed = [...enriched]
      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
      .filter((item) => !recentIds.has(item.id));

    return { recentOpened, mostViewed };
  }, [recentSearches, moduleType, cognitiveNotesRoot, rootFolderJson, settings.fileSearch?.recentLimit]);

  const recentOpenedChips = recentSearchChips?.recentOpened ?? [];
  const mostViewedChips = recentSearchChips?.mostViewed ?? [];

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
    if (fileSearchDisabled) return;
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
    if (fileSearchDisabled) return;
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

    const MAX_RECENTS = 20;
    const nextRecents = [{ id: entry.id, label: entry.label }].concat(
      recentSearches.filter((item) => item.id !== entry.id)
    ).slice(0, MAX_RECENTS);

    void (async () => {
      const { fileManager, cognitiveNotesManager } = getManagers();
      try {
        if (moduleType === "parallelmind" && rootFolderJson) {
          const latestRoot = useMindMapStore.getState().tabs
            .find((tab) => tab.id === useMindMapStore.getState().activeTabId)
            ?.rootFolderJson;
          const baseRoot = latestRoot ?? rootFolderJson;
          const nextRoot = {
            ...baseRoot,
            recent_searches: nextRecents,
          } as any;
          updateRootFolderJson(nextRoot);
          if (rootDirectoryHandle) {
            await fileManager.writeRootFolderJson(rootDirectoryHandle, nextRoot);
          } else if (baseRoot?.path) {
            await fileManager.writeRootFolderJsonFromPath(baseRoot.path, nextRoot);
          }
        }
        if (moduleType === "cognitiveNotes" && cognitiveNotesRoot) {
          const latestRoot = useMindMapStore.getState().tabs
            .find((tab) => tab.id === useMindMapStore.getState().activeTabId)
            ?.cognitiveNotesRoot;
          const baseRoot = latestRoot ?? cognitiveNotesRoot;
          const nextRoot = {
            ...baseRoot,
            recent_searches: nextRecents,
          } as any;
          updateCognitiveNotesRoot(nextRoot);
          if (cognitiveNotesDirectoryHandle) {
            await cognitiveNotesManager.writeCognitiveNotesJson(
              cognitiveNotesDirectoryHandle,
              nextRoot
            );
          } else {
            const dirPath = cognitiveNotesFolderPath ?? baseRoot?.path;
            if (dirPath) {
              await cognitiveNotesManager.writeCognitiveNotesJsonFromPath(dirPath, nextRoot);
            }
          }
        }
      } catch {
        // Silent: search UI should not break if persistence fails.
      }
    })();

    setMatches([]);
  };

  const removeRecentSearchChip = (entryId: string) => {
    if (fileSearchDisabled) return;
    if (!entryId) return;

    void (async () => {
      const { fileManager, cognitiveNotesManager } = getManagers();
      try {
        if (moduleType === "parallelmind") {
          const latestRoot = useMindMapStore.getState().tabs
            .find((tab) => tab.id === useMindMapStore.getState().activeTabId)
            ?.rootFolderJson;
          const baseRoot = latestRoot ?? rootFolderJson;
          if (!baseRoot) return;
          const nextRecents = (Array.isArray((baseRoot as any).recent_searches)
            ? ((baseRoot as any).recent_searches as any[])
            : []
          ).filter((item: any) => item?.id !== entryId);
          const nextRoot = { ...baseRoot, recent_searches: nextRecents } as any;
          updateRootFolderJson(nextRoot);
          if (rootDirectoryHandle) {
            await fileManager.writeRootFolderJson(rootDirectoryHandle, nextRoot);
          } else if (baseRoot.path) {
            await fileManager.writeRootFolderJsonFromPath(baseRoot.path, nextRoot);
          }
          return;
        }

        if (moduleType === "cognitiveNotes") {
          const latestRoot = useMindMapStore.getState().tabs
            .find((tab) => tab.id === useMindMapStore.getState().activeTabId)
            ?.cognitiveNotesRoot;
          const baseRoot = latestRoot ?? cognitiveNotesRoot;
          if (!baseRoot) return;
          const nextRecents = (Array.isArray((baseRoot as any).recent_searches)
            ? ((baseRoot as any).recent_searches as any[])
            : []
          ).filter((item: any) => item?.id !== entryId);
          const nextRoot = { ...baseRoot, recent_searches: nextRecents } as any;
          updateCognitiveNotesRoot(nextRoot);
          if (cognitiveNotesDirectoryHandle) {
            await cognitiveNotesManager.writeCognitiveNotesJson(
              cognitiveNotesDirectoryHandle,
              nextRoot
            );
          } else {
            const dirPath = cognitiveNotesFolderPath ?? baseRoot.path;
            if (dirPath) {
              await cognitiveNotesManager.writeCognitiveNotesJsonFromPath(
                dirPath,
                nextRoot
              );
            }
          }
        }
      } catch {
        // Silent: removing a chip should never break the search UI.
      }
    })();
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

  const removeBookmarkForEntry = async (entry: BookmarkEntry) => {
    const location = await resolveAppDataLocation({
      settings,
      handle: appDataDirectoryHandle ?? null,
    });
    if (!location) return;

    try {
      if (location.dirPath) {
        const data = await loadBookmarksFromPath(location.dirPath);
        const next = {
          ...data,
          bookmarks: (data.bookmarks ?? []).filter((b) => b.path !== entry.path),
        };
        await saveBookmarksToPath(location.dirPath, next);
        setBookmarks(next.bookmarks ?? []);
        window.dispatchEvent(new CustomEvent("pm-bookmarks-updated"));
        return;
      }
      if (location.dirHandle) {
        const data = await loadBookmarksFromHandle(location.dirHandle);
        const next = {
          ...data,
          bookmarks: (data.bookmarks ?? []).filter((b) => b.path !== entry.path),
        };
        await saveBookmarksToHandle(location.dirHandle, next);
        setBookmarks(next.bookmarks ?? []);
        window.dispatchEvent(new CustomEvent("pm-bookmarks-updated"));
      }
    } catch {
      // Silent: removing bookmarks should not break UI.
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
      const store = useMindMapStore.getState();
      const isEmptyTab = (tab: any): boolean => {
        const nodesEmpty = (tab?.nodes ?? []).length === 0;
        const edgesEmpty = (tab?.edges ?? []).length === 0;
        return (
          tab?.moduleType == null &&
          nodesEmpty &&
          edgesEmpty &&
          tab?.rootFolderJson == null &&
          tab?.cognitiveNotesRoot == null
        );
      };
      const activeTabFromStore =
        store.tabs.find((t: any) => t?.id === store.activeTabId) ?? null;
      const firstEmptyTab =
        store.tabs.find((t: any) => isEmptyTab(t)) ?? null;
      const tabId = isEmptyTab(activeTabFromStore)
        ? store.activeTabId
        : firstEmptyTab?.id
          ? firstEmptyTab.id
          : createTab();

      setActiveTab(tabId);

      if (entry.moduleType === "cognitiveNotes") {
        const result =
          await cognitiveNotesManager.loadOrCreateCognitiveNotesJsonFromPath(
            dirPath
          );
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
                disabled={fileSearchDisabled}
                onMouseDown={(e) => {
                  if (!fileSearchDisabled) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setFileSearchInfo(uiText.alerts.fileSearchUnavailable);
                }}
                onChange={(e) => {
                  if (fileSearchDisabled) return;
                  const next = e.target.value;
                  setQuery(next);
                  runSearch(next);
                }}
                onKeyDown={(e) => {
                  if (fileSearchDisabled) return;
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
                  opacity: fileSearchDisabled ? 0.6 : 1,
                  cursor: fileSearchDisabled ? "not-allowed" : "text",
                }}
                aria-label="Search files"
              />
            </label>

            {fileSearchDisabled && fileSearchInfo && (
              <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>
                {fileSearchInfo}
              </div>
            )}

            {!fileSearchDisabled && matches.length > 0 && (
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

            {(recentOpenedChips.length > 0 || mostViewedChips.length > 0) && (
              <div style={{ display: "grid", gap: "var(--space-1)" }}>
                {recentOpenedChips.length > 0 && (
                  <div style={{ display: "grid", gap: "6px" }}>
                    <div style={{ fontSize: "0.75rem", opacity: 0.6 }}>
                      Recent (last opened)
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {recentOpenedChips.map((item) => (
                        <div
                          key={`recent-${item.id}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "4px 8px",
                            borderRadius: "999px",
                            border: "var(--border-width) solid var(--border)",
                            background: "var(--surface-1)",
                            color: "inherit",
                            fontSize: "0.75rem",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => selectMatchedNode(item)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "12px",
                              border: "none",
                              background: "transparent",
                              color: "inherit",
                              cursor: "pointer",
                              padding: 0,
                              fontSize: "inherit",
                              fontFamily: "var(--font-family)",
                            }}
                          >
                            <span title={item.label}>
                              {truncateChipLabel(item.label, 10)}
                            </span>
                            <span style={{ fontSize: "0.7em", opacity: 0.7 }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  padding: "1px 6px",
                                  borderRadius: "999px",
                                  border: "var(--border-width) solid var(--border)",
                                  background: "var(--surface-2)",
                                  fontSize: "0.7rem",
                                  lineHeight: 1.2,
                                  opacity: 0.85,
                                  minWidth: 18,
                                }}
                              >
                                {item.views ?? 0}
                              </span>
                            </span>
                          </button>
                          <button
                            type="button"
                            aria-label="Remove from search history"
                            title="Remove"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              removeRecentSearchChip(item.id);
                            }}
                            style={{
                              width: 16,
                              height: 16,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              border: "none",
                              background: "transparent",
                              color: "inherit",
                              cursor: "pointer",
                              opacity: 0.7,
                              padding: 0,
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.opacity = "0.7";
                            }}
                          >
                            <FiX aria-hidden="true" size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {mostViewedChips.length > 0 && (
                  <div style={{ display: "grid", gap: "6px" }}>
                    <div style={{ fontSize: "0.75rem", opacity: 0.6 }}>
                      Most viewed
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {mostViewedChips.map((item) => (
                        <div
                          key={`views-${item.id}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "4px 8px",
                            borderRadius: "999px",
                            border: "var(--border-width) solid var(--border)",
                            background: "var(--surface-1)",
                            color: "inherit",
                            fontSize: "0.75rem",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => selectMatchedNode(item)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "12px",
                              border: "none",
                              background: "transparent",
                              color: "inherit",
                              cursor: "pointer",
                              padding: 0,
                              fontSize: "inherit",
                              fontFamily: "var(--font-family)",
                            }}
                          >
                            <span title={item.label}>
                              {truncateChipLabel(item.label, 10)}
                            </span>
                            <span style={{ fontSize: "0.7em", opacity: 0.7 }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  padding: "1px 6px",
                                  borderRadius: "999px",
                                  border: "var(--border-width) solid var(--border)",
                                  background: "var(--surface-2)",
                                  fontSize: "0.7rem",
                                  lineHeight: 1.2,
                                  opacity: 0.85,
                                  minWidth: 18,
                                }}
                              >
                                {item.views ?? 0}
                              </span>
                            </span>
                          </button>
                          <button
                            type="button"
                            aria-label="Remove from search history"
                            title="Remove"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              removeRecentSearchChip(item.id);
                            }}
                            style={{
                              width: 16,
                              height: 16,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              border: "none",
                              background: "transparent",
                              color: "inherit",
                              cursor: "pointer",
                              opacity: 0.7,
                              padding: 0,
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.opacity = "0.7";
                            }}
                          >
                            <FiX aria-hidden="true" size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {sortedBookmarks.map((entry) => (
                    <div
                      key={`${entry.path}-${entry.moduleType}`}
                      title={entry.path}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 8px",
                        borderRadius: "999px",
                        border: "var(--border-width) solid var(--border)",
                        background: "var(--surface-1)",
                        color: "inherit",
                        fontSize: "0.75rem",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => void openBookmark(entry)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "12px",
                          border: "none",
                          background: "transparent",
                          color: "inherit",
                          cursor: "pointer",
                          padding: 0,
                          fontSize: "inherit",
                          fontFamily: "var(--font-family)",
                        }}
                      >
                        <span>{bookmarkName(entry)}</span>
                        <span style={{ fontSize: "0.7em", opacity: 0.7 }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "1px 6px",
                              borderRadius: "999px",
                              border: "var(--border-width) solid var(--border)",
                              background: "var(--surface-2)",
                              fontSize: "0.7rem",
                              lineHeight: 1.2,
                              opacity: 0.85,
                              minWidth: 18,
                            }}
                          >
                            {entry.views ?? 0}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label="Remove bookmark"
                        title="Remove"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void removeBookmarkForEntry(entry);
                        }}
                        style={{
                          width: 16,
                          height: 16,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "none",
                          background: "transparent",
                          color: "inherit",
                          cursor: "pointer",
                          opacity: 0.7,
                          padding: 0,
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.opacity = "0.7";
                        }}
                      >
                        <FiX aria-hidden="true" size={12} />
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
