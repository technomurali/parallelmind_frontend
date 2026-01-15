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
    showMinimap: boolean;
    nodeHeaderFontSize: number;
    nodeBodyFontSize: number;
  };
  interaction: {
    lockNodePositions: boolean;
  };
}

/**
 * Complete mind map state
 */
export interface MindMapState {
  // ReactFlow data
  nodes: any[]; // TODO: Replace with MindMapNode[]
  edges: any[]; // TODO: Replace with Edge[]

  // Selection state
  selectedNodeId: string | null;
  selectedEdgeId: string | null;

  /**
   * Pending node-creation flow (in-memory only).
   *
   * We defer "committing" a newly created node until the user supplies the
   * required metadata (name) and it is saved from the Node Details panel.
   * This avoids orphan/premature nodes and makes the interaction predictable.
   */
  pendingChildCreation: {
    tempNodeId: string;
    parentNodeId: string;
  } | null;

  // Application settings
  settings: AppSettings;

  // UI state
  leftPanelWidth: number;
  rightPanelWidth: number;
  rootDirectoryHandle: FileSystemDirectoryHandle | null;
  rootFolderJson: RootFolderJson | null;
  inlineEditNodeId: string | null;
  settingsOpen: boolean;
}

/**
 * Actions for updating the mind map state
 */
export interface MindMapActions {
  setNodes: (nodes: any[]) => void;
  setEdges: (edges: any[]) => void;
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  setPendingChildCreation: (
    pending: { tempNodeId: string; parentNodeId: string } | null
  ) => void;
  finalizePendingChildCreation: () => void;
  discardPendingChildCreationIfSelected: () => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  // Root can be selected via browser directory handle or via desktop path (Tauri).
  // When using a desktop path, handle will be null and root.path will contain the absolute folder path.
  setRoot: (handle: FileSystemDirectoryHandle | null, root: RootFolderJson) => void;
  clearRoot: () => void;
  setInlineEditNodeId: (nodeId: string | null) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  toggleSettings: () => void;
}

/**
 * Combined store type
 */
export type MindMapStore = MindMapState & MindMapActions;

/**
 * Zustand store hook
 * 
 * Usage example:
 * ```tsx
 * const { nodes, setNodes, selectedNodeId } = useMindMapStore();
 * ```
 */
export const useMindMapStore = create<MindMapStore>((set) => ({
  // ReactFlow data
  nodes: [],
  edges: [],

  // Selection state
  selectedNodeId: null,
  selectedEdgeId: null,

  pendingChildCreation: null,

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
        showMinimap: true,
        nodeHeaderFontSize: 4,
        nodeBodyFontSize: 7,
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
  rootDirectoryHandle: null,
  rootFolderJson: null,
  inlineEditNodeId: null,
  settingsOpen: false,

  // Actions
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  selectEdge: (edgeId) => set({ selectedEdgeId: edgeId }),
  setPendingChildCreation: (pending) => set({ pendingChildCreation: pending }),
  finalizePendingChildCreation: () =>
    set((state) => {
      const pending = state.pendingChildCreation;
      if (!pending) return state;

      const { tempNodeId, parentNodeId } = pending;
      const tempNode = (state.nodes ?? []).find((n: any) => n?.id === tempNodeId);
      const parentNode = (state.nodes ?? []).find((n: any) => n?.id === parentNodeId);

      // If either node is missing, we can't finalize; just clear pending to avoid getting stuck.
      if (!tempNode || !parentNode) {
        return { ...state, pendingChildCreation: null };
      }

      // Mark node as finalized (no longer a draft).
      const nextNodes = (state.nodes ?? []).map((n: any) => {
        if (n?.id !== tempNodeId) return n;
        return {
          ...n,
          data: { ...(n.data ?? {}), isDraft: false },
        };
      });

      // Create an edge only on finalize (name-gated commit).
      const edgeId = `e_${parentNodeId}_${tempNodeId}`;
      const edgeExists = (state.edges ?? []).some((e: any) => e?.id === edgeId);
      const cycle = wouldCreateCycle(state.edges ?? [], parentNodeId, tempNodeId);
      const nextEdges =
        edgeExists || cycle
          ? state.edges
          : [
              ...(state.edges ?? []),
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
        nodes: nextNodesWithLink,
        edges: nextEdges,
        pendingChildCreation: null,
      };
    }),
  discardPendingChildCreationIfSelected: () =>
    set((state) => {
      const pending = state.pendingChildCreation;
      if (!pending) return state;
      if (state.selectedNodeId !== pending.tempNodeId) return state;

      const tempNode = (state.nodes ?? []).find((n: any) => n?.id === pending.tempNodeId);
      const isDraft = !!(tempNode?.data as any)?.isDraft;
      const name = (tempNode?.data as any)?.name;
      const hasName = typeof name === "string" && name.trim().length > 0;

      // "Reversible before save": if the user deselects before providing a name,
      // discard the temporary node and clear the pending flow.
      if (isDraft && !hasName) {
        return {
          ...state,
          nodes: (state.nodes ?? []).filter((n: any) => n?.id !== pending.tempNodeId),
          pendingChildCreation: null,
          selectedNodeId: null,
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
    set({
      rootDirectoryHandle: handle,
      rootFolderJson: root,
    }),
  clearRoot: () =>
    set({
      rootDirectoryHandle: null,
      rootFolderJson: null,
      selectedNodeId: null,
      selectedEdgeId: null,
      pendingChildCreation: null,
      inlineEditNodeId: null,
      nodes: [],
      edges: [],
    }),
  setInlineEditNodeId: (nodeId) => set({ inlineEditNodeId: nodeId }),
  updateNodeData: (nodeId, data) =>
    set((state) => ({
      // Keep rootFolderJson in sync when editing the root node (single source of truth in-memory).
      rootFolderJson:
        nodeId === '00' && state.rootFolderJson
          ? ({ ...state.rootFolderJson, ...(data as any) } as any)
          : state.rootFolderJson,
      nodes: state.nodes.map((n) =>
        n?.id === nodeId ? { ...n, data: { ...(n.data ?? {}), ...data } } : n,
      ),
    })),
  toggleSettings: () =>
    set((state) => ({ settingsOpen: !state.settingsOpen })),
}));