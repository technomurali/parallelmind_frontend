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
  nodeDisplayMode: 'icons' | 'titles' | 'names';
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
  setNodeDisplayMode: (mode: 'icons' | 'titles' | 'names') => void;
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
  settings: {
    theme: 'dark',
    font: 'system-ui',
    fontSize: 14,
    llmModel: 'gpt-4',
    llmProvider: 'openai',
    appearance: {
      nodeSize: 200,
      edgeStyle: 'default',
      showMinimap: true,
    },
  },

  // UI state
  leftPanelWidth: 280,
  rightPanelWidth: 360,
  rootDirectoryHandle: null,
  rootFolderJson: null,
  inlineEditNodeId: null,
  settingsOpen: false,
  nodeDisplayMode: 'icons',

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
      const nextEdges = edgeExists
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
      const nextNodesWithLink = nextNodes.map((n: any) => {
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
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),
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
  setNodeDisplayMode: (mode) => set({ nodeDisplayMode: mode }),
}));