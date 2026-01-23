/**
 * mindMapStore.ts
 * 
 * Centralized app state (node selection, settings, etc.)
 * Manages global application state including:
 * - Node and edge data for ReactFlow
 * - Selected nodes and edges
 * - Application settings
 * - UI state (panels, modals, etc.)
 * 
 * Uses Zustand for lightweight state management.
 */

import { create } from 'zustand';
import type { RootFolderJson } from '../data/fileManager';
import type { CognitiveNotesJson } from '../extensions/cognitiveNotes/data/cognitiveNotesManager';
// import { MindMapNode, Edge } from '../types/nodeTypes';

const SETTINGS_STORAGE_KEY = 'parallelmind.settings.v1';

function readPersistedSettings(): Partial<AppSettings> | null {
  try {
    // In some runtimes (SSR/tests) window/localStorage may not exist.
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as Partial<AppSettings>;
  } catch {
    return null;
  }
}

function persistSettings(settings: AppSettings) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Intentionally ignore persistence failures (private mode, quota, etc.)
  }
}

function wouldCreateCycle(
  edges: any[],
  source: string,
  target: string,
  ignoreEdgeId?: string
): boolean {
  if (!source || !target) return true;
  if (source === target) return true;

  const adj = new Map<string, string[]>();
  for (const e of edges ?? []) {
    if (ignoreEdgeId && e?.id === ignoreEdgeId) continue;
    const s = e?.source;
    const t = e?.target;
    if (typeof s !== 'string' || typeof t !== 'string') continue;
    if (!adj.has(s)) adj.set(s, []);
    adj.get(s)!.push(t);
  }

  // Adding source -> target creates a cycle iff target can already reach source.
  const stack: string[] = [target];
  const visited = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === source) return true;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const next = adj.get(cur);
    if (next) stack.push(...next);
  }
  return false;
}

function generateTabId(): string {
  const c = (globalThis as any)?.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `pm_tab_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export type CanvasTab = {
  id: string;
  title: string;
  moduleType: "parallelmind" | "cognitiveNotes" | null;
  canvasSaveStatus: "idle" | "saving" | "saved" | "error";
  history: {
    past: TabSnapshot[];
    future: TabSnapshot[];
  };
  // ReactFlow data
  nodes: any[];
  edges: any[];
  // Selection state
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  pendingChildCreation: {
    tempNodeId: string;
    parentNodeId: string;
  } | null;
  lastCanvasPosition: { x: number; y: number } | null;
  canvasCenter: { x: number; y: number } | null;
  // Root state
  rootDirectoryHandle: FileSystemDirectoryHandle | null;
  rootFolderJson: RootFolderJson | null;
  cognitiveNotesRoot: CognitiveNotesJson | null;
  cognitiveNotesDirectoryHandle: FileSystemDirectoryHandle | null;
  cognitiveNotesFolderPath: string | null;
  inlineEditNodeId: string | null;
  areNodesCollapsed: boolean;
  hasCustomLayout: boolean;
  shouldFitView: boolean;
};

type TabSnapshot = {
  nodes: any[];
  edges: any[];
  rootFolderJson: RootFolderJson | null;
  cognitiveNotesRoot: CognitiveNotesJson | null;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  title: string;
  moduleType: CanvasTab["moduleType"];
};

function createEmptyTab(): CanvasTab {
  return {
    id: generateTabId(),
    title: "",
    moduleType: null,
    canvasSaveStatus: "idle",
    history: {
      past: [],
      future: [],
    },
    nodes: [],
    edges: [],
    selectedNodeId: null,
    selectedEdgeId: null,
    pendingChildCreation: null,
    lastCanvasPosition: null,
    canvasCenter: null,
    rootDirectoryHandle: null,
    rootFolderJson: null,
    cognitiveNotesRoot: null,
    cognitiveNotesDirectoryHandle: null,
    cognitiveNotesFolderPath: null,
    inlineEditNodeId: null,
    areNodesCollapsed: false,
    hasCustomLayout: false,
    shouldFitView: false,
  };
}

function resetTabCanvas(tab: CanvasTab): CanvasTab {
  return {
    ...tab,
    title: "",
    moduleType: null,
    canvasSaveStatus: "idle",
    history: {
      past: [],
      future: [],
    },
    nodes: [],
    edges: [],
    selectedNodeId: null,
    selectedEdgeId: null,
    pendingChildCreation: null,
    lastCanvasPosition: null,
    canvasCenter: null,
    rootDirectoryHandle: null,
    rootFolderJson: null,
    cognitiveNotesRoot: null,
    cognitiveNotesDirectoryHandle: null,
    cognitiveNotesFolderPath: null,
    inlineEditNodeId: null,
    areNodesCollapsed: false,
    hasCustomLayout: false,
    shouldFitView: false,
  };
}

function updateTabById(
  tabs: CanvasTab[],
  tabId: string,
  updater: (tab: CanvasTab) => CanvasTab
): CanvasTab[] {
  return tabs.map((tab) => (tab.id === tabId ? updater(tab) : tab));
}

const HISTORY_LIMIT = 100;

const cloneValue = <T,>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

const getSnapshot = (tab: CanvasTab): TabSnapshot => {
  return {
    nodes: cloneValue(tab.nodes ?? []),
    edges: cloneValue(tab.edges ?? []),
    rootFolderJson: cloneValue(tab.rootFolderJson),
    cognitiveNotesRoot: cloneValue(tab.cognitiveNotesRoot),
    selectedNodeId: tab.selectedNodeId ?? null,
    selectedEdgeId: tab.selectedEdgeId ?? null,
    title: tab.title ?? "",
    moduleType: tab.moduleType ?? null,
  };
};

const pushHistory = (tab: CanvasTab): CanvasTab => {
  const nextPast = [...(tab.history?.past ?? []), getSnapshot(tab)];
  const trimmed = nextPast.length > HISTORY_LIMIT
    ? nextPast.slice(nextPast.length - HISTORY_LIMIT)
    : nextPast;
  return {
    ...tab,
    history: {
      past: trimmed,
      future: [],
    },
  };
};

/**
 * Application settings state
 */
export interface AppSettings {
  theme: 'light' | 'dark';
  font: string;
  fontSize: number;
  llmModel: string;
  llmProvider: 'openai' | 'gemini' | 'chrome';
  appearance: {
    nodeSize: number;
    edgeStyle: string;
    edgeOpacity: number;
    gridColumns?: number;
    gridRows?: number;
    gridColumnGap: number;
    gridRowGap: number;
    showMinimap: boolean;
    nodeHeaderFontSize: number;
    nodeBodyFontSize: number;
    nodeFontColor: "black" | "white";
    enableNodeFillColors: boolean;
    levelHorizontalGaps?: number[];
    nodeFillColors: {
      root: string;
      level1: string;
      level2: string;
      level3: string;
      level4: string;
    };
    activeTabColors: {
      parallelmind: string;
      cognitiveNotes: string;
    };
    cognitiveNotesDefaultNodeColor: string;
  };
  interaction: {
    lockNodePositions: boolean;
  };
}

/**
 * Complete mind map state
 */
export interface MindMapState {
  // Application settings
  settings: AppSettings;

  // UI state
  leftPanelWidth: number;
  rightPanelWidth: number;
  settingsOpen: boolean;
  rightPanelMode: "nodeDetails" | "nodeSelector";
  tabs: CanvasTab[];
  activeTabId: string;
}

/**
 * Actions for updating the mind map state
 */
export interface MindMapActions {
  setNodes: (nodes: any[]) => void;
  setEdges: (edges: any[]) => void;
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  setCanvasSaveStatus: (status: CanvasTab["canvasSaveStatus"]) => void;
  setPendingChildCreation: (
    pending: { tempNodeId: string; parentNodeId: string } | null
  ) => void;
  setLastCanvasPosition: (position: { x: number; y: number } | null) => void;
  setCanvasCenter: (position: { x: number; y: number } | null) => void;
  finalizePendingChildCreation: () => void;
  discardPendingChildCreationIfSelected: () => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  // Root can be selected via browser directory handle or via desktop path (Tauri).
  // When using a desktop path, handle will be null and root.path will contain the absolute folder path.
  setRoot: (handle: FileSystemDirectoryHandle | null, root: RootFolderJson) => void;
  clearRoot: () => void;
  setCognitiveNotesRoot: (root: CognitiveNotesJson) => void;
  setCognitiveNotesSource: (
    handle: FileSystemDirectoryHandle | null,
    path: string | null
  ) => void;
  updateCognitiveNotesRoot: (root: CognitiveNotesJson) => void;
  setInlineEditNodeId: (nodeId: string | null) => void;
  updateRootFolderJson: (root: RootFolderJson) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  toggleSettings: () => void;
  setRightPanelMode: (mode: "nodeDetails" | "nodeSelector") => void;
  setNodesCollapsed: (collapsed: boolean) => void;
  createTab: () => string;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  setTabTitle: (tabId: string, title: string) => void;
  setTabModule: (tabId: string, moduleType: CanvasTab["moduleType"]) => void;
  setHasCustomLayout: (enabled: boolean) => void;
  setShouldFitView: (enabled: boolean) => void;
  undo: () => void;
  redo: () => void;
  deleteSelectedEdge: () => void;
}

/**
 * Combined store type
 */
export type MindMapStore = MindMapState & MindMapActions;

export const selectActiveTab = (state: MindMapStore): CanvasTab | null => {
  return state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;
};

/**
 * Zustand store hook
 * 
 * Usage example:
 * ```tsx
 * const { nodes, setNodes, selectedNodeId } = useMindMapStore();
 * ```
 */
export const useMindMapStore = create<MindMapStore>((set) => {
  const initialTab = createEmptyTab();
  return ({
  // Application settings
  settings: (() => {
    const defaults: AppSettings = {
      theme: 'dark',
      font: 'system-ui',
      fontSize: 14,
      llmModel: 'gpt-4',
      llmProvider: 'openai',
      appearance: {
        nodeSize: 200,
        edgeStyle: 'step',
        edgeOpacity: 0.85,
        gridColumns: 5,
        gridRows: undefined,
        gridColumnGap: 20,
        gridRowGap: 30,
        showMinimap: true,
        nodeHeaderFontSize: 4,
        nodeBodyFontSize: 7,
        nodeFontColor: "white",
        enableNodeFillColors: false,
        levelHorizontalGaps: Array.from({ length: 5 }, () => Math.round(200 * 1.4)),
        nodeFillColors: {
          root: '#1E1B4B',
          level1: '#312E81',
          level2: '#4F46E5',
          level3: '#60A5FA',
          level4: '#BFDBFE',
        },
        activeTabColors: {
          parallelmind: "#1a4a8e",
          cognitiveNotes: "#7412b5",
        },
        cognitiveNotesDefaultNodeColor: "#4330d5",
      },
      interaction: {
        lockNodePositions: false,
      },
    };

    const persisted = readPersistedSettings();
    if (!persisted) return defaults;

    // Deep-merge appearance so partial updates don’t drop nested keys.
    return {
      ...defaults,
      ...persisted,
      appearance: {
        ...defaults.appearance,
        ...(persisted as any).appearance,
      },
      interaction: {
        ...defaults.interaction,
        ...(persisted as any).interaction,
      },
    };
  })(),

  // UI state
  leftPanelWidth: 280,
  rightPanelWidth: 360,
  settingsOpen: false,
  rightPanelMode: "nodeDetails",
  tabs: [initialTab],
  activeTabId: initialTab.id,

  // Actions
  setNodes: (nodes) =>
    set((state) => ({
      tabs: updateTabById(state.tabs, state.activeTabId, (tab) => ({
        ...pushHistory(tab),
        nodes,
      })),
    })),
  setEdges: (edges) =>
    set((state) => ({
      tabs: updateTabById(state.tabs, state.activeTabId, (tab) => ({
        ...pushHistory(tab),
        edges,
      })),
    })),
  setCanvasSaveStatus: (status) =>
    set((state) => ({
      tabs: updateTabById(state.tabs, state.activeTabId, (tab) => ({
        ...tab,
        canvasSaveStatus: status,
      })),
    })),
  selectNode: (nodeId) =>
    set((state) => ({
      tabs: updateTabById(state.tabs, state.activeTabId, (tab) => ({
        ...tab,
        selectedNodeId: nodeId,
      })),
    })),
  selectEdge: (edgeId) =>
    set((state) => ({
      tabs: updateTabById(state.tabs, state.activeTabId, (tab) => ({
        ...tab,
        selectedEdgeId: edgeId,
      })),
    })),
  setPendingChildCreation: (pending) =>
    set((state) => ({
      tabs: updateTabById(state.tabs, state.activeTabId, (tab) => ({
        ...tab,
        pendingChildCreation: pending,
      })),
    })),
  setLastCanvasPosition: (position) =>
    set((state) => ({
      tabs: updateTabById(state.tabs, state.activeTabId, (tab) => ({
        ...tab,
        lastCanvasPosition: position,
      })),
    })),
  setCanvasCenter: (position) =>
    set((state) => ({
      tabs: updateTabById(state.tabs, state.activeTabId, (tab) => ({
        ...tab,
        canvasCenter: position,
      })),
    })),
  finalizePendingChildCreation: () =>
    set((state) => {
      const tab = selectActiveTab(state);
      if (!tab) return state;
      const pending = tab.pendingChildCreation;
      if (!pending) return state;

      const { tempNodeId, parentNodeId } = pending;
      const tempNode = (tab.nodes ?? []).find((n: any) => n?.id === tempNodeId);
      const parentNode = (tab.nodes ?? []).find((n: any) => n?.id === parentNodeId);

      // If either node is missing, we can't finalize; just clear pending to avoid getting stuck.
      if (!tempNode || !parentNode) {
        return {
          ...state,
          tabs: updateTabById(state.tabs, state.activeTabId, (active) => ({
            ...active,
            pendingChildCreation: null,
          })),
        };
      }

      // Mark node as finalized (no longer a draft).
      const nextNodes = (tab.nodes ?? []).map((n: any) => {
        if (n?.id !== tempNodeId) return n;
        return {
          ...n,
          data: { ...(n.data ?? {}), isDraft: false },
        };
      });

      // Create an edge only on finalize (name-gated commit).
      const edgeId = `e_${parentNodeId}_${tempNodeId}`;
      const edgeExists = (tab.edges ?? []).some((e: any) => e?.id === edgeId);
      const cycle = wouldCreateCycle(tab.edges ?? [], parentNodeId, tempNodeId);
      const nextEdges =
        edgeExists || cycle
          ? tab.edges
          : [
              ...(tab.edges ?? []),
              {
                id: edgeId,
                source: parentNodeId,
                target: tempNodeId,
                type: "default",
              },
            ];

      // Record parent->children relationship in memory only (JSON persistence is out of scope).
      const nextNodesWithLink = cycle
        ? nextNodes
        : nextNodes.map((n: any) => {
        if (n?.id !== parentNodeId) return n;
        const existing = (n?.data as any)?.childNodeIds;
        const childNodeIds: string[] = Array.isArray(existing) ? existing : [];
        if (childNodeIds.includes(tempNodeId)) return n;
        return {
          ...n,
          data: {
            ...(n.data ?? {}),
            childNodeIds: [...childNodeIds, tempNodeId],
          },
        };
      });

      return {
        ...state,
        tabs: updateTabById(state.tabs, state.activeTabId, (active) => ({
          ...active,
          nodes: nextNodesWithLink,
          edges: nextEdges,
          pendingChildCreation: null,
        })),
      };
    }),
  discardPendingChildCreationIfSelected: () =>
    set((state) => {
      const tab = selectActiveTab(state);
      if (!tab) return state;
      const pending = tab.pendingChildCreation;
      if (!pending) return state;
      if (tab.selectedNodeId !== pending.tempNodeId) return state;

      const tempNode = (tab.nodes ?? []).find((n: any) => n?.id === pending.tempNodeId);
      const isDraft = !!(tempNode?.data as any)?.isDraft;
      const name = (tempNode?.data as any)?.name;
      const hasName = typeof name === "string" && name.trim().length > 0;

      // "Reversible before save": if the user deselects before providing a name,
      // discard the temporary node and clear the pending flow.
      if (isDraft && !hasName) {
        const edgeId = `e_${pending.parentNodeId}_${pending.tempNodeId}`;
        return {
          ...state,
          tabs: updateTabById(state.tabs, state.activeTabId, (active) => ({
            ...active,
            nodes: (active.nodes ?? []).filter((n: any) => n?.id !== pending.tempNodeId),
            edges: (active.edges ?? []).filter((e: any) => e?.id !== edgeId),
            pendingChildCreation: null,
            selectedNodeId: null,
          })),
        };
      }
      return state;
    }),
  updateSettings: (newSettings) =>
    set((state) => {
      const next: AppSettings = {
        ...state.settings,
        ...newSettings,
        appearance: {
          ...state.settings.appearance,
          ...(newSettings.appearance ?? {}),
        },
        interaction: {
          ...state.settings.interaction,
          ...(newSettings.interaction ?? {}),
        },
      };
      persistSettings(next);
      return { settings: next };
    }),
  setLeftPanelWidth: (width) => set({ leftPanelWidth: width }),
  setRightPanelWidth: (width) => set({ rightPanelWidth: width }),
  setRoot: (handle, root) =>
    set((state) => ({
      tabs: updateTabById(state.tabs, state.activeTabId, (tab) => ({
        ...tab,
        rootDirectoryHandle: handle,
        rootFolderJson: root,
        cognitiveNotesRoot: null,
        cognitiveNotesDirectoryHandle: null,
        cognitiveNotesFolderPath: null,
        title: typeof root?.name === "string" ? root.name : tab.title,
        moduleType: "parallelmind",
        canvasSaveStatus: "idle",
        history: { past: [], future: [] },
        hasCustomLayout:
          !!root?.node_positions &&
          Object.keys(root.node_positions ?? {}).length > 0,
        shouldFitView: true,
      })),
    })),
  setCognitiveNotesRoot: (root) =>
    set((state) => ({
      tabs: updateTabById(state.tabs, state.activeTabId, (tab) => ({
        ...tab,
        rootDirectoryHandle: null,
        rootFolderJson: null,
        cognitiveNotesRoot: root,
        title: typeof root?.name === "string" ? root.name : tab.title,
        moduleType: "cognitiveNotes",
        canvasSaveStatus: "idle",
        history: { past: [], future: [] },
      })),
    })),
  setCognitiveNotesSource: (handle, path) =>
    set((state) => ({
      tabs: updateTabById(state.tabs, state.activeTabId, (tab) => ({
        ...tab,
        cognitiveNotesDirectoryHandle: handle,
        cognitiveNotesFolderPath: path,
      })),
    })),
  updateCognitiveNotesRoot: (root) =>
    set((state) => ({
      tabs: updateTabById(state.tabs, state.activeTabId, (tab) => ({
        ...pushHistory(tab),
        cognitiveNotesRoot: root,
        title: typeof root?.name === "string" ? root.name : tab.title,
        moduleType: "cognitiveNotes",
      })),
    })),
  clearRoot: () =>
    set((state) => ({
      tabs: updateTabById(state.tabs, state.activeTabId, (tab) =>
        resetTabCanvas(tab)
      ),
    })),
  setInlineEditNodeId: (nodeId) =>
    set((state) => ({
      tabs: updateTabById(state.tabs, state.activeTabId, (tab) => ({
        ...tab,
        inlineEditNodeId: nodeId,
      })),
    })),
  updateRootFolderJson: (root) =>
    set((state) => ({
      tabs: updateTabById(state.tabs, state.activeTabId, (tab) => ({
        ...pushHistory(tab),
        rootFolderJson: root,
        title: typeof root?.name === "string" ? root.name : tab.title,
        moduleType: "parallelmind",
      })),
    })),
  updateNodeData: (nodeId, data) =>
    set((state) => ({
      tabs: updateTabById(state.tabs, state.activeTabId, (tab) => ({
        ...pushHistory(tab),
        rootFolderJson:
          nodeId === "00" && tab.rootFolderJson
            ? ({ ...tab.rootFolderJson, ...(data as any) } as any)
            : tab.rootFolderJson,
        nodes: (tab.nodes ?? []).map((n) =>
          n?.id === nodeId ? { ...n, data: { ...(n.data ?? {}), ...data } } : n
        ),
      })),
    })),
  toggleSettings: () =>
    set((state) => ({ settingsOpen: !state.settingsOpen })),
  setRightPanelMode: (mode) =>
    set(() => ({
      rightPanelMode: mode,
    })),
  setNodesCollapsed: (collapsed) =>
    set((state) => ({
      tabs: updateTabById(state.tabs, state.activeTabId, (tab) => ({
        ...tab,
        areNodesCollapsed: collapsed,
      })),
    })),
  createTab: () => {
    const next = createEmptyTab();
    set((state) => ({
      tabs: [...state.tabs, next],
      activeTabId: next.id,
    }));
    return next.id;
  },
  closeTab: (tabId) =>
    set((state) => {
      const tabIndex = state.tabs.findIndex((tab) => tab.id === tabId);
      if (tabIndex === -1) return state;
      if (state.tabs.length === 1) {
        const reset = resetTabCanvas(state.tabs[0]);
        return {
          ...state,
          tabs: [reset],
          activeTabId: reset.id,
        };
      }
      const nextTabs = state.tabs.filter((tab) => tab.id !== tabId);
      let nextActiveId = state.activeTabId;
      if (tabId === state.activeTabId) {
        const nextIndex = tabIndex - 1 >= 0 ? tabIndex - 1 : 0;
        nextActiveId = nextTabs[nextIndex]?.id ?? nextTabs[0]?.id ?? "";
      }
      return {
        ...state,
        tabs: nextTabs,
        activeTabId: nextActiveId,
      };
    }),
  setActiveTab: (tabId) =>
    set((state) => {
      if (!state.tabs.find((tab) => tab.id === tabId)) return state;
      return { activeTabId: tabId };
    }),
  setTabTitle: (tabId, title) =>
    set((state) => ({
      tabs: updateTabById(state.tabs, tabId, (tab) => ({
        ...tab,
        title: typeof title === "string" ? title : tab.title,
      })),
    })),
  setTabModule: (tabId, moduleType) =>
    set((state) => ({
      tabs: updateTabById(state.tabs, tabId, (tab) => ({
        ...tab,
        moduleType,
      })),
    })),
  setHasCustomLayout: (enabled) =>
    set((state) => ({
      tabs: updateTabById(state.tabs, state.activeTabId, (tab) => ({
        ...tab,
        hasCustomLayout: enabled,
      })),
    })),
  setShouldFitView: (enabled) =>
    set((state) => ({
      tabs: updateTabById(state.tabs, state.activeTabId, (tab) => ({
        ...tab,
        shouldFitView: enabled,
      })),
    })),
  deleteSelectedEdge: () =>
    set((state) => {
      const tab = selectActiveTab(state);
      if (!tab || !tab.selectedEdgeId) return state;
      const edgeId = tab.selectedEdgeId;
      const nextEdges = (tab.edges ?? []).filter((edge: any) => edge?.id !== edgeId);
      const nextCognitiveRoot = tab.cognitiveNotesRoot
        ? {
            ...tab.cognitiveNotesRoot,
            child: (tab.cognitiveNotesRoot.child ?? []).map((node: any) => ({
              ...node,
              related_nodes: Array.isArray(node.related_nodes)
                ? node.related_nodes.filter((rel: any) => rel?.edge_id !== edgeId)
                : [],
            })),
          }
        : tab.cognitiveNotesRoot;
      return {
        ...state,
        tabs: updateTabById(state.tabs, tab.id, (current) => ({
          ...pushHistory(current),
          edges: nextEdges,
          cognitiveNotesRoot: nextCognitiveRoot,
          selectedEdgeId: null,
        })),
      };
    }),
  undo: () =>
    set((state) => {
      const tab = selectActiveTab(state);
      if (!tab) return state;
      const past = tab.history?.past ?? [];
      if (past.length === 0) return state;
      const prev = past[past.length - 1];
      const currentSnapshot = getSnapshot(tab);
      const nextPast = past.slice(0, -1);
      return {
        ...state,
        tabs: updateTabById(state.tabs, tab.id, (current) => ({
          ...current,
          nodes: cloneValue(prev.nodes),
          edges: cloneValue(prev.edges),
          rootFolderJson: cloneValue(prev.rootFolderJson),
          cognitiveNotesRoot: cloneValue(prev.cognitiveNotesRoot),
          selectedNodeId: prev.selectedNodeId,
          selectedEdgeId: prev.selectedEdgeId,
          title: prev.title,
          moduleType: prev.moduleType,
          history: {
            past: nextPast,
            future: [currentSnapshot, ...(current.history?.future ?? [])],
          },
        })),
      };
    }),
  redo: () =>
    set((state) => {
      const tab = selectActiveTab(state);
      if (!tab) return state;
      const future = tab.history?.future ?? [];
      if (future.length === 0) return state;
      const next = future[0];
      const currentSnapshot = getSnapshot(tab);
      const nextFuture = future.slice(1);
      return {
        ...state,
        tabs: updateTabById(state.tabs, tab.id, (current) => ({
          ...current,
          nodes: cloneValue(next.nodes),
          edges: cloneValue(next.edges),
          rootFolderJson: cloneValue(next.rootFolderJson),
          cognitiveNotesRoot: cloneValue(next.cognitiveNotesRoot),
          selectedNodeId: next.selectedNodeId,
          selectedEdgeId: next.selectedEdgeId,
          title: next.title,
          moduleType: next.moduleType,
          history: {
            past: [...(current.history?.past ?? []), currentSnapshot],
            future: nextFuture,
          },
        })),
      };
    }),
  });
});