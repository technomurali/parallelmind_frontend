import type { ExtensionEntry } from "../extensionTypes";
import { CognitiveNotesManager } from "./data/cognitiveNotesManager";
import { composeCognitiveNotesGraph } from "./utils/composeCognitiveNotesGraph";
import { type CanvasTab, useMindMapStore } from "../../store/mindMapStore";
import {
  getRootIndexFilePath,
  incrementBookmarkViews,
  loadBookmarksFromHandle,
  loadBookmarksFromPath,
  resolveAppDataLocation,
  saveBookmarksToHandle,
  saveBookmarksToPath,
} from "../../utils/bookmarksManager";

const cognitiveNotesManager = new CognitiveNotesManager();

const isEmptyTab = (tab: CanvasTab): boolean => {
  const nodesEmpty = (tab.nodes ?? []).length === 0;
  const edgesEmpty = (tab.edges ?? []).length === 0;
  return (
    tab.moduleType === null &&
    nodesEmpty &&
    edgesEmpty &&
    tab.rootFolderJson == null &&
    tab.cognitiveNotesRoot == null
  );
};

const openCognitiveNotes = async (): Promise<void> => {
  let selection: FileSystemDirectoryHandle | string | null = null;
  try {
    selection = await cognitiveNotesManager.pickRootDirectory();
  } catch (err) {
    console.error("[CognitiveNotes] pickRootDirectory failed:", err);
    return;
  }
  if (!selection) return;
  try {
    const result =
      typeof selection === "string"
        ? await cognitiveNotesManager.loadOrCreateCognitiveNotesJsonFromPath(selection)
        : await cognitiveNotesManager.loadOrCreateCognitiveNotesJson(selection);

    const store = useMindMapStore.getState();
    const existingTab = store.tabs.find(
      (tab) =>
        tab.moduleType === "cognitiveNotes" &&
        tab.cognitiveNotesRoot?.id === result.root.id
    );
    if (existingTab) {
      store.setActiveTab(existingTab.id);
      return;
    }
    const activeTab = store.tabs.find((tab) => tab.id === store.activeTabId) ?? null;
    const firstEmptyTab = store.tabs.find((tab) => isEmptyTab(tab)) ?? null;
    const tabId =
      activeTab && isEmptyTab(activeTab)
        ? activeTab.id
        : firstEmptyTab
          ? firstEmptyTab.id
          : store.createTab();
    store.setActiveTab(tabId);
    store.setTabTitle(tabId, result.root.name ?? "Cognitive Notes");
    store.setTabModule(tabId, "cognitiveNotes");
    store.setCognitiveNotesRoot(result.root);
    store.setCognitiveNotesSource(
      typeof selection === "string" ? null : selection,
      typeof selection === "string" ? selection : null
    );

    const location = await resolveAppDataLocation({
      settings: store.settings,
      handle: store.appDataDirectoryHandle ?? null,
    });
    if (location) {
      const bookmarkPath = getRootIndexFilePath(
        "cognitiveNotes",
        result.root.name ?? "root",
        result.root.path ?? null
      );
      if (location.dirPath) {
        const data = await loadBookmarksFromPath(location.dirPath);
        const next = incrementBookmarkViews({ data, path: bookmarkPath });
        if (next) {
          await saveBookmarksToPath(location.dirPath, next);
          window.dispatchEvent(new CustomEvent("pm-bookmarks-updated"));
        }
      } else if (location.dirHandle) {
        const data = await loadBookmarksFromHandle(location.dirHandle);
        const next = incrementBookmarkViews({ data, path: bookmarkPath });
        if (next) {
          await saveBookmarksToHandle(location.dirHandle, next);
          window.dispatchEvent(new CustomEvent("pm-bookmarks-updated"));
        }
      }
    }

    const settings = store.settings;
    const { nodes, edges, rootNodeId } = composeCognitiveNotesGraph(result.root, {
      nodeSize: settings.appearance.nodeSize,
      columns: settings.appearance.gridColumns,
      columnGap: settings.appearance.gridColumnGap,
      rowGap: settings.appearance.gridRowGap,
      inputFileNodeColor: settings.appearance.cognitiveNotesInputFileNodeColor,
      fileNodeColor: settings.appearance.cognitiveNotesFileNodeColor,
      outputNodeColor: settings.appearance.cognitiveNotesOutputNodeColor,
    });

    store.setNodes(nodes);
    store.setEdges(edges);
    store.setShouldFitView(true);
    store.selectNode(rootNodeId);
  } catch (err) {
    console.error("[CognitiveNotes] Failed to load cognitive notes:", err);
  }
};

const entry: ExtensionEntry = {
  id: "cognitiveNotes",
  actions: {
    open: openCognitiveNotes,
  },
};

export default entry;
export { openCognitiveNotes };
