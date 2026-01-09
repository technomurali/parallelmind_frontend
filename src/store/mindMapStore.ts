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

  // Application settings
  settings: AppSettings;

  // UI state
  leftPanelWidth: number;
  rightPanelWidth: number;
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
  updateSettings: (settings: Partial<AppSettings>) => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
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
  settingsOpen: false,

  // Actions
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  selectEdge: (edgeId) => set({ selectedEdgeId: edgeId }),
  updateSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),
  setLeftPanelWidth: (width) => set({ leftPanelWidth: width }),
  setRightPanelWidth: (width) => set({ rightPanelWidth: width }),
  toggleSettings: () =>
    set((state) => ({ settingsOpen: !state.settingsOpen })),
}));