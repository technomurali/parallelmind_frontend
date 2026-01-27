/**
 * MindMap/index.tsx
 *
 * Main MindMap container component.
 * Renders the central ReactFlow canvas for visualizing the mind map structure.
 *
 * Features:
 * - Displays nodes and edges from the global store
 * - Automatically centers root folder node when selected
 * - Supports custom node types (currently RootFolderNode)
 * - Provides accessibility labels for screen readers
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  MarkerType,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import { FiMenu } from "react-icons/fi";
import { uiText } from "../../constants/uiText";
import { FileManager } from "../../data/fileManager";
import { CognitiveNotesManager } from "../../extensions/cognitiveNotes/data/cognitiveNotesManager";
import type { IndexNode, RootFolderJson } from "../../data/fileManager";
import { CanvasTabs } from "../../components/CanvasTabs/CanvasTabs";
import { selectActiveTab, useMindMapStore } from "../../store/mindMapStore";
import { composeMindMapGraphFromRoot } from "../../utils/mindMapComposer";
import { getNodeFillColor } from "../../utils/nodeFillColors";
import { useAutoSave } from "../../hooks/useAutoSave";
import {
  areAllNodesVisible,
  getFitViewport,
  shouldBlockZoomOut,
} from "../../utils/viewportGuards";
import RootFolderNode from "./RootFolderNode";
import FileNode from "./FileNode";
import InputFileNode from "./InputFileNode.tsx";
import OutputFileNode from "./OutputFileNode";
import DecisionNode from "./DecisionNode";
import ImageNode from "./ImageNode";
import FullImageNode from "./FullImageNode";
import {
  FlowchartRoundRectNode,
  FlowchartRectNode,
  FlowchartTriangleNode,
  FlowchartDecisionNode,
  FlowchartCircleNode,
  FlowchartParallelogramNode,
  FlowchartYoutubeNode,
  isFlowchartNodeType,
} from "./flowchartnode";

const NODE_TYPES = {
  rootFolder: RootFolderNode,
  file: FileNode,
  shieldFile: InputFileNode,
  outputFile: OutputFileNode,
  decision: DecisionNode,
  polaroidImage: ImageNode,
  fullImageNode: FullImageNode,
  "flowchart.roundRect": FlowchartRoundRectNode,
  "flowchart.rect": FlowchartRectNode,
  "flowchart.triangle": FlowchartTriangleNode,
  "flowchart.decision": FlowchartDecisionNode,
  "flowchart.circle": FlowchartCircleNode,
  "flowchart.parallelogram": FlowchartParallelogramNode,
  "flowchart.youtube": FlowchartYoutubeNode,
} as const;

/**
 * MindMap component
 *
 * Main container for the mind map visualization canvas.
 * When a root folder is selected, it creates a single root node at the
 * viewport center and enables inline editing.
 */
export default function MindMap() {
  const activeTab = useMindMapStore(selectActiveTab);
  const nodes = activeTab?.nodes ?? [];
  const edges = activeTab?.edges ?? [];
  const setNodes = useMindMapStore((s) => s.setNodes);
  const setEdges = useMindMapStore((s) => s.setEdges);
  const selectEdge = useMindMapStore((s) => s.selectEdge);
  const setCanvasSaveStatus = useMindMapStore((s) => s.setCanvasSaveStatus);
  const moduleTypeValue = String(activeTab?.moduleType ?? "");
  const isCognitiveNotes = moduleTypeValue === "cognitiveNotes";
  const cognitiveNotesRoot = activeTab?.cognitiveNotesRoot ?? null;
  const cognitiveNotesDirectoryHandle = activeTab?.cognitiveNotesDirectoryHandle ?? null;
  const cognitiveNotesFolderPath = activeTab?.cognitiveNotesFolderPath ?? null;
  const updateNodeData = useMindMapStore((s) => s.updateNodeData);
  const updateCognitiveNotesRoot = useMindMapStore((s) => s.updateCognitiveNotesRoot);
  const rootFolderJson = activeTab?.rootFolderJson ?? null;
  const settings = useMindMapStore((s) => s.settings);
  const updateSettings = useMindMapStore((s) => s.updateSettings);
  const setInlineEditNodeId = useMindMapStore((s) => s.setInlineEditNodeId);
  const selectNode = useMindMapStore((s) => s.selectNode);
  const setSelectedNodeIds = useMindMapStore((s) => s.setSelectedNodeIds);
  const toggleSelectedNode = useMindMapStore((s) => s.toggleSelectedNode);
  const clearSelectedNodes = useMindMapStore((s) => s.clearSelectedNodes);
  const createGroup = useMindMapStore((s) => s.createGroup);
  const removeGroup = useMindMapStore((s) => s.removeGroup);
  const removeNodeFromGroup = useMindMapStore((s) => s.removeNodeFromGroup);
  const selectGroup = useMindMapStore((s) => s.selectGroup);
  const updateGroupData = useMindMapStore((s) => s.updateGroupData);
  const tabs = useMindMapStore((s) => s.tabs);
  const createTab = useMindMapStore((s) => s.createTab);
  const setActiveTab = useMindMapStore((s) => s.setActiveTab);
  const setRoot = useMindMapStore((s) => s.setRoot);
  const updateRootFolderJson = useMindMapStore((s) => s.updateRootFolderJson);
  const setHasCustomLayout = useMindMapStore((s) => s.setHasCustomLayout);
  const hasCustomLayout = activeTab?.hasCustomLayout ?? false;
  const shouldFitView = activeTab?.shouldFitView ?? false;
  const lastViewport = activeTab?.lastViewport ?? null;
  const setShouldFitView = useMindMapStore((s) => s.setShouldFitView);
  const setRightPanelMode = useMindMapStore((s) => s.setRightPanelMode);
  const rootDirectoryHandle = activeTab?.rootDirectoryHandle ?? null;
  const selectedNodeId = activeTab?.selectedNodeId ?? null;
  const selectedNodeIds = activeTab?.selectedNodeIds ?? (selectedNodeId ? [selectedNodeId] : []);
  const selectedGroupId = activeTab?.selectedGroupId ?? null;
  const nodeGroups = activeTab?.groups ?? [];
  const areNodesCollapsed = activeTab?.areNodesCollapsed ?? false;
  const setNodesCollapsed = useMindMapStore((s) => s.setNodesCollapsed);
  const setPendingChildCreation = useMindMapStore(
    (s) => s.setPendingChildCreation
  );
  const discardPendingChildCreationIfSelected = useMindMapStore(
    (s) => s.discardPendingChildCreationIfSelected
  );
  const setEdgeStyle = useMindMapStore((s) => s.setEdgeStyle);
  const setLastCanvasPosition = useMindMapStore((s) => s.setLastCanvasPosition);
  const setCanvasCenter = useMindMapStore((s) => s.setCanvasCenter);
  const setLastViewport = useMindMapStore((s) => s.setLastViewport);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasBodyRef = useRef<HTMLDivElement | null>(null);
  const spacingPanelRef = useRef<HTMLDivElement | null>(null);
  const lastMousePositionRef = useRef({ x: 0, y: 0 });
  const lastFocusedNodeIdRef = useRef<string | null>(null);
  const spacingDragRef = useRef<{
    active: boolean;
    offsetX: number;
    offsetY: number;
  }>({ active: false, offsetX: 0, offsetY: 0 });
  const groupDragRef = useRef<{
    groupId: string;
    lastClient: { x: number; y: number };
  } | null>(null);
  const lastFitRootIdRef = useRef<string | null>(null);
  const lastRestoredTabIdRef = useRef<string | null>(null);
  const lastSavedViewportRef = useRef<{ x: number; y: number; zoom: number } | null>(
    null
  );
  const viewportSaveRafRef = useRef<number | null>(null);
  const pendingViewportRef = useRef<{ x: number; y: number; zoom: number } | null>(
    null
  );
  const [rf, setRf] = useState<ReactFlowInstance | null>(null);
  const [viewport, setViewport] = useState<{ x: number; y: number; zoom: number }>({
    x: 0,
    y: 0,
    zoom: 1,
  });
  const nodesRef = useRef<any[]>([]);
  const prevGroupsRef = useRef<Map<string, string[]>>(new Map());

  useEffect(() => {
    nodesRef.current = nodes ?? [];
  }, [nodes]);

  useEffect(() => {
    if (!rf) return;
    setViewport(rf.getViewport());
  }, [rf]);

  useEffect(() => {
    const prev = prevGroupsRef.current;
    const current = new Map((nodeGroups ?? []).map((group) => [group.id, group.nodeIds]));
    if (rf && typeof (rf as any).updateNodeInternals === "function") {
      prev.forEach((prevNodes, groupId) => {
        const currentNodes = current.get(groupId);
        if (!currentNodes) {
          if (prevNodes.length > 0) {
            (rf as any).updateNodeInternals(prevNodes);
          }
          return;
        }
        const removedNodes = prevNodes.filter((id) => !currentNodes.includes(id));
        if (removedNodes.length > 0) {
          (rf as any).updateNodeInternals(removedNodes);
        }
      });
    }
    prevGroupsRef.current = current;
  }, [nodeGroups, rf]);
  const fileManager = useMemo(() => new FileManager(), []);
  const cognitiveNotesManager = useMemo(() => new CognitiveNotesManager(), []);
  const defaultCognitiveNodeColor =
    settings.appearance.cognitiveNotesDefaultNodeColor ?? "";
  const isValidHexColor = (value: string) =>
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
  // "Canvas nodes" include real flowchart shapes AND special nodes stored in `flowchart_nodes`
  // (e.g. input/output/image nodes persisted for canvas usage).
  const persistedCanvasNodeIds = useMemo(() => {
    const list = isCognitiveNotes
      ? (cognitiveNotesRoot?.flowchart_nodes ?? [])
      : (rootFolderJson?.flowchart_nodes ?? []);
    return new Set(
      (list as any[])
        .map((node: any) => (typeof node?.id === "string" ? node.id : ""))
        .filter(Boolean)
    );
  }, [isCognitiveNotes, cognitiveNotesRoot?.flowchart_nodes, rootFolderJson?.flowchart_nodes]);

  const isCanvasNode = (node: any) =>
    !!node &&
    (persistedCanvasNodeIds.has(node.id) ||
      isFlowchartNodeType(node?.type) ||
      isFlowchartNodeType(node?.data?.node_type));

  const buildFlowchartEdges = (edgesList: Edge[], nodesList: any[]) => {
    const nodeIds = new Set<string>(Array.from(persistedCanvasNodeIds));
    (nodesList ?? []).forEach((node: any) => {
      if (node?.id && isCanvasNode(node)) nodeIds.add(node.id);
    });
    return (edgesList ?? [])
      .filter((edge: any) => {
        const sourceIsFlow = nodeIds.has(edge?.source);
        const targetIsFlow = nodeIds.has(edge?.target);
        return sourceIsFlow || targetIsFlow;
      })
      .map((edge: any) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        source_handle: edge.sourceHandle ?? edge.source_handle,
        target_handle: edge.targetHandle ?? edge.target_handle,
        purpose:
          typeof (edge?.data as any)?.purpose === "string"
            ? (edge.data as any).purpose
            : undefined,
      }));
  };
  const [layoutSaveStatus, setLayoutSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [cognitiveNotesDirty, setCognitiveNotesDirty] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [colorDraft, setColorDraft] = useState("#64748b");
  const canvasSaveStatus = activeTab?.canvasSaveStatus ?? "idle";
  const edgeStyle = activeTab?.edgeStyle ?? "default";
  const [showParentPath, setShowParentPath] = useState(false);
  const [showChildrenPath, setShowChildrenPath] = useState(false);
  const [pendingNodePositions, setPendingNodePositions] = useState<
    Record<string, { x: number; y: number }> | null
  >(null);
  const [pendingFlowchartEdges, setPendingFlowchartEdges] = useState<
    {
      id: string;
      source: string;
      target: string;
      source_handle?: string;
      target_handle?: string;
      purpose?: string;
    }[] | null
  >(null);
  const layoutStatusMessage =
    layoutSaveStatus === "saving"
      ? uiText.statusMessages.layoutSaving
      : layoutSaveStatus === "saved"
      ? uiText.statusMessages.layoutSaved
      : layoutSaveStatus === "error"
      ? uiText.statusMessages.layoutSaveFailed
      : "";
  const canvasStatusMessage =
    canvasSaveStatus === "saving"
      ? uiText.statusMessages.saving
      : canvasSaveStatus === "saved"
      ? uiText.statusMessages.saved
      : canvasSaveStatus === "error"
      ? uiText.statusMessages.saveFailed
      : "";


  const persistNodePositions = async () => {
    if (!pendingNodePositions || !rootFolderJson) return;
    const nextRoot: RootFolderJson = {
      ...rootFolderJson,
      node_positions: pendingNodePositions,
    };
    updateRootFolderJson(nextRoot);
    setLayoutSaveStatus("saving");
    try {
      if (rootDirectoryHandle) {
        await fileManager.writeRootFolderJson(rootDirectoryHandle, nextRoot);
      } else if (rootFolderJson.path) {
        await fileManager.writeRootFolderJsonFromPath(
          rootFolderJson.path,
          nextRoot
        );
      } else {
        setLayoutSaveStatus("error");
        return;
      }
      setLayoutSaveStatus("saved");
      setPendingNodePositions(null);
    } catch (err) {
      setLayoutSaveStatus("error");
      console.error("[MindMap] Persist node positions failed:", err);
    }
  };

  const persistFlowchartEdges = async () => {
    if (!pendingFlowchartEdges || !rootFolderJson) return;
    const nextRoot: RootFolderJson = {
      ...rootFolderJson,
      flowchart_edges: pendingFlowchartEdges,
    };
    updateRootFolderJson(nextRoot);
    setCanvasSaveStatus("saving");
    try {
      if (rootDirectoryHandle) {
        await fileManager.writeRootFolderJson(rootDirectoryHandle, nextRoot);
      } else if (rootFolderJson.path) {
        await fileManager.writeRootFolderJsonFromPath(rootFolderJson.path, nextRoot);
      } else {
        setCanvasSaveStatus("error");
        return;
      }
      setCanvasSaveStatus("saved");
      setPendingFlowchartEdges(null);
    } catch (err) {
      setCanvasSaveStatus("error");
      console.error("[MindMap] Persist flowchart edges failed:", err);
    }
  };

  const saveCognitiveNotesCanvas = async () => {
    if (!isCognitiveNotes || !cognitiveNotesRoot) return;
    setCanvasSaveStatus("saving");
    const defaultSourceHandle = (nodeType: string | undefined) => {
      if (nodeType === "rootFolder") return "source-bottom";
      return "source-right";
    };
    const defaultTargetHandle = (nodeType: string | undefined) => {
      if (nodeType === "rootFolder") return "target-top";
      return "target-left";
    };
    const normalizeHandle = (
      handle: unknown,
      nodeType: string | undefined,
      kind: "source" | "target"
    ) => {
      if (typeof handle === "string" && handle.trim()) {
        return handle;
      }
      return kind === "source"
        ? defaultSourceHandle(nodeType)
        : defaultTargetHandle(nodeType);
    };
    const nextPositions: Record<string, { x: number; y: number }> = {
      ...(cognitiveNotesRoot.node_positions ?? {}),
    };
    const nextColors: Record<string, string> = {
      ...(cognitiveNotesRoot.node_colors ?? {}),
    };
    (nodes ?? []).forEach((node: any) => {
      if (!node?.id || !node.position) return;
      nextPositions[node.id] = {
        x: node.position.x,
        y: node.position.y,
      };
    });

    const childById = new Map(
      (cognitiveNotesRoot.child ?? [])
        .filter((node: any) => node?.id)
        .map((node: any) => [node.id, node])
    );
    const nodeTypeById = new Map<string, string>();
    (nodes ?? []).forEach((node: any) => {
      if (node?.id && typeof node.type === "string") {
        nodeTypeById.set(node.id, node.type);
      }
    });
    const relationMap = new Map<
      string,
      {
        edge_id: string;
        target_id: string;
        purpose: string;
        source_handle?: string;
        target_handle?: string;
      }[]
    >();
    (edges ?? []).forEach((edge: any) => {
      if (!edge?.id || !edge?.source || !edge?.target) return;
      if (!childById.has(edge.source) || !childById.has(edge.target)) return;
      const sourceType = nodeTypeById.get(edge.source);
      const targetType = nodeTypeById.get(edge.target);
      const purpose =
        typeof (edge.data as any)?.purpose === "string"
          ? (edge.data as any).purpose
          : "";
      const relSource = {
        edge_id: edge.id,
        target_id: edge.target,
        purpose,
        source_handle: normalizeHandle(edge.sourceHandle, sourceType, "source"),
        target_handle: normalizeHandle(edge.targetHandle, targetType, "target"),
      };
      relationMap.set(edge.source, [...(relationMap.get(edge.source) ?? []), relSource]);
    });

    const nextChild = (cognitiveNotesRoot.child ?? []).map((node: any) => ({
      ...node,
      related_nodes: relationMap.get(node.id) ?? [],
    }));
    const nextFlowchartEdges = buildFlowchartEdges(edges ?? [], nodes ?? []);

    const nextRoot = {
      ...cognitiveNotesRoot,
      updated_on: new Date().toISOString(),
      node_positions: nextPositions,
      node_colors: nextColors,
      flowchart_edges: nextFlowchartEdges,
      child: nextChild,
    };

    updateCognitiveNotesRoot(nextRoot);
    try {
      if (cognitiveNotesDirectoryHandle) {
        await cognitiveNotesManager.writeCognitiveNotesJson(
          cognitiveNotesDirectoryHandle,
          nextRoot
        );
      } else {
        const targetPath = cognitiveNotesFolderPath ?? nextRoot.path ?? "";
        if (!targetPath) throw new Error("Cognitive Notes folder path is missing.");
        await cognitiveNotesManager.writeCognitiveNotesJsonFromPath(targetPath, nextRoot);
      }
      setCanvasSaveStatus("saved");
      setCognitiveNotesDirty(false);
    } catch (err) {
      console.error("[MindMap] Failed to save cognitive notes canvas:", err);
      setCanvasSaveStatus("error");
    }
  };

  useAutoSave(
    () => {
      void persistNodePositions();
    },
    3000,
    [
      pendingNodePositions,
      rootFolderJson?.id,
      rootFolderJson?.path,
      rootDirectoryHandle,
    ],
    !!pendingNodePositions
  );

  useAutoSave(
    () => {
      void persistFlowchartEdges();
    },
    3000,
    [
      pendingFlowchartEdges,
      rootFolderJson?.id,
      rootFolderJson?.path,
      rootDirectoryHandle,
    ],
    !!pendingFlowchartEdges
  );

  useEffect(() => {
    if (layoutSaveStatus !== "saved" && layoutSaveStatus !== "error") return;
    const timeout = window.setTimeout(() => {
      setLayoutSaveStatus("idle");
    }, 2000);
    return () => window.clearTimeout(timeout);
  }, [layoutSaveStatus]);
  useEffect(() => {
    if (canvasSaveStatus !== "saved" && canvasSaveStatus !== "error") return;
    const timeout = window.setTimeout(() => {
      setCanvasSaveStatus("idle");
    }, 2000);
    return () => window.clearTimeout(timeout);
  }, [canvasSaveStatus, setCanvasSaveStatus]);

  useEffect(() => {
    setCognitiveNotesDirty(false);
  }, [activeTab?.id, cognitiveNotesRoot?.id]);

  useEffect(() => {
    if (!rf) return;
    const updateCenter = () => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const center = rf.screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
      setCanvasCenter(center);
    };
    updateCenter();
    window.addEventListener("resize", updateCenter);
    return () => window.removeEventListener("resize", updateCenter);
  }, [rf, setCanvasCenter]);
  const nodeTypes = NODE_TYPES;
  const selectedNode = useMemo(
    () => (nodes ?? []).find((node: any) => node?.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );
  const selectedNodeColor =
    typeof (selectedNode?.data as any)?.node_color === "string" &&
    isValidHexColor((selectedNode?.data as any).node_color.trim())
      ? (selectedNode?.data as any).node_color.trim()
      : null;

  useEffect(() => {
    if (!isCognitiveNotes || !selectedNodeId) {
      setColorPickerOpen(false);
      return;
    }
    setColorDraft(selectedNodeColor ?? "#64748b");
  }, [isCognitiveNotes, selectedNodeColor, selectedNodeId]);

  const applySelectedNodeColor = (nextColor: string | null) => {
    if (!isCognitiveNotes || !selectedNodeId || !cognitiveNotesRoot) return;
    if (nextColor !== null && !isValidHexColor(nextColor)) return;
    const nextColors = {
      ...(cognitiveNotesRoot.node_colors ?? {}),
    } as Record<string, string>;
    if (nextColor === null) {
      delete nextColors[selectedNodeId];
    } else {
      nextColors[selectedNodeId] = nextColor;
    }
    setNodes(
      (nodes ?? []).map((node: any) =>
        node?.id === selectedNodeId
          ? {
              ...node,
              data: {
                ...(node.data ?? {}),
                node_color: nextColor ?? undefined,
              },
            }
          : node
      )
    );
    updateCognitiveNotesRoot({
      ...cognitiveNotesRoot,
      node_colors: nextColors,
    });
    setCognitiveNotesDirty(true);
  };
  const parentPath = useMemo(() => {
    if (!showParentPath || !selectedNodeId) {
      return { nodeIds: new Set<string>(), edgeIds: new Set<string>() };
    }
    const edgeByTarget = new Map<string, Edge>();
    (edges ?? []).forEach((edge: any) => {
      if (edge?.target && edge?.source) {
        edgeByTarget.set(edge.target, edge);
      }
    });
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();
    let currentId: string | null = selectedNodeId;
    while (currentId && edgeByTarget.has(currentId)) {
      const edge = edgeByTarget.get(currentId);
      if (!edge) break;
      edgeIds.add(edge.id);
      nodeIds.add(edge.source);
      currentId = edge.source;
    }
    return { nodeIds, edgeIds };
  }, [edges, selectedNodeId, showParentPath]);

  const childrenPath = useMemo(() => {
    if (!showChildrenPath || !selectedNodeId) {
      return { nodeIds: new Set<string>(), edgeIds: new Set<string>() };
    }
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();
    (edges ?? []).forEach((edge: any) => {
      if (edge?.source === selectedNodeId && edge?.target) {
        edgeIds.add(edge.id);
        nodeIds.add(edge.target);
      }
    });
    return { nodeIds, edgeIds };
  }, [edges, selectedNodeId, showChildrenPath]);

  const collapsedNodeIds = useMemo(() => {
    if (!rootFolderJson) return new Set<string>();
    const hidden = new Set<string>();
    const walk = (node: RootFolderJson | IndexNode, hideChildren: boolean) => {
      const children = Array.isArray((node as any).child)
        ? ((node as any).child as IndexNode[])
        : [];
      const isCollapsed = !!(node as any).isTreeCollapsed;
      const shouldHideChildren = hideChildren || isCollapsed;
      children.forEach((child) => {
        const childId = (child as any).id;
        if (shouldHideChildren && typeof childId === "string") {
          hidden.add(childId);
        }
        walk(child, shouldHideChildren);
      });
    };
    walk(rootFolderJson, false);
    return hidden;
  }, [rootFolderJson]);

  const renderedEdges = useMemo(() => {
    const edgeType = edgeStyle || "default";
    const edgeOpacity =
      typeof settings.appearance.edgeOpacity === "number"
        ? settings.appearance.edgeOpacity
        : 0.85;
    const cognitiveRootId =
      isCognitiveNotes && cognitiveNotesRoot?.id ? cognitiveNotesRoot.id : null;
    return (edges ?? []).map((edge: any) => {
      const highlight =
        parentPath.edgeIds.has(edge?.id) || childrenPath.edgeIds.has(edge?.id);
      const highlightStyle = highlight
        ? {
            ...(edge?.style ?? {}),
            stroke: "rgba(57, 255, 235, 0.95)",
            strokeWidth: 3,
            strokeDasharray: "8 6",
            filter: "drop-shadow(0 0 6px rgba(57, 255, 235, 0.8))",
          opacity: 1,
          }
        : null;
      const markerColor =
        highlightStyle && typeof highlightStyle.stroke === "string"
          ? highlightStyle.stroke
          : undefined;
      const baseStyle = highlightStyle
        ? highlightStyle
        : {
            ...(edge?.style ?? {}),
            opacity: edgeOpacity,
          };
      return {
        ...edge,
        type: edgeType,
        animated: highlight,
        hidden:
          collapsedNodeIds.has(edge?.source) ||
          collapsedNodeIds.has(edge?.target) ||
          (cognitiveRootId &&
            (edge?.source === cognitiveRootId || edge?.target === cognitiveRootId)),
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          ...(markerColor ? { color: markerColor } : {}),
        },
        style: baseStyle,
      };
    });
  }, [
    edges,
    isCognitiveNotes,
    cognitiveNotesRoot?.id,
    parentPath.edgeIds,
    childrenPath.edgeIds,
    collapsedNodeIds,
    edgeStyle,
    settings.appearance.edgeOpacity,
  ]);

  const FILE_NODE_BASE_WIDTH = 125;
  const DEFAULT_IMAGE_WIDTH_RATIO = 0.8;
  const FULL_IMAGE_FRAME_PADDING = 3;
  const FULL_IMAGE_CONTROL_STRIP_HEIGHT = 16;

  const getPolaroidDimensions = (width: number, height: number) => {
    const maxWidth = Math.round(FILE_NODE_BASE_WIDTH * DEFAULT_IMAGE_WIDTH_RATIO);
    const padding = 12;
    const captionGap = 12;
    const captionHeight = 28;
    const safeWidth = Math.max(1, width);
    const safeHeight = Math.max(1, height);
    const scale = Math.min(1, maxWidth / safeWidth);
    const imageWidth = Math.round(safeWidth * scale);
    const imageHeight = Math.round(safeHeight * scale);
    return {
      nodeWidth: imageWidth + padding * 2,
      nodeHeight: imageHeight + padding * 2 + captionGap + captionHeight,
      imageWidth,
      imageHeight,
    };
  };

  const getFullImageDimensions = (width: number, height: number) => {
    const maxWidth = Math.round(FILE_NODE_BASE_WIDTH * DEFAULT_IMAGE_WIDTH_RATIO);
    const padding = FULL_IMAGE_FRAME_PADDING;
    const safeWidth = Math.max(1, width);
    const safeHeight = Math.max(1, height);
    const scale = Math.min(1, maxWidth / safeWidth);
    const imageWidth = Math.round(safeWidth * scale);
    const imageHeight = Math.round(safeHeight * scale);
    return {
      nodeWidth: imageWidth + padding * 2,
      nodeHeight: imageHeight + padding * 2 + FULL_IMAGE_CONTROL_STRIP_HEIGHT,
      imageWidth,
      imageHeight,
    };
  };

  const renderedNodes = useMemo(() => {
    if (!nodes?.length) return nodes;
    return nodes.map((node: any) => {
      const isHidden = collapsedNodeIds.has(node?.id);
      if (isCognitiveNotes && node?.type === "rootFolder") {
        return {
          ...node,
          hidden: true,
          selectable: false,
          draggable: false,
          connectable: false,
          style: { ...(node.style ?? {}), display: "none" },
        };
      }
      const highlight =
        parentPath.nodeIds.has(node?.id) || childrenPath.nodeIds.has(node?.id);
      const highlightStyle = highlight
        ? {
            boxShadow: "0 0 12px rgba(57, 255, 235, 0.9)",
            borderColor: "rgba(57, 255, 235, 0.9)",
          }
        : null;

      const isPolaroid =
        node?.type === "polaroidImage" ||
        (node?.data as any)?.type === "polaroidImage" ||
        (node?.data as any)?.node_type === "polaroidImage";
      const isFullImage =
        node?.type === "fullImageNode" ||
        (node?.data as any)?.type === "fullImageNode" ||
        (node?.data as any)?.node_type === "fullImageNode";
      if (!isPolaroid && !isFullImage) {
        return {
          ...node,
          hidden: isHidden,
          style: highlightStyle
            ? { ...(node.style ?? {}), ...highlightStyle }
            : node.style,
        };
      }
      const imageWidth =
        typeof node?.data?.imageWidth === "number" ? node.data.imageWidth : 0;
      const imageHeight =
        typeof node?.data?.imageHeight === "number" ? node.data.imageHeight : 0;
      const sizeResult =
        imageWidth > 0 && imageHeight > 0
          ? isFullImage
            ? getFullImageDimensions(imageWidth, imageHeight)
            : getPolaroidDimensions(imageWidth, imageHeight)
          : { nodeWidth: undefined, nodeHeight: undefined };
      const sizeStyle =
        typeof sizeResult.nodeWidth === "number" &&
        typeof sizeResult.nodeHeight === "number"
          ? {
              ...(node.style ?? {}),
              width: sizeResult.nodeWidth,
              height: sizeResult.nodeHeight,
            }
          : node.style;
      const nodeType = isFullImage ? "fullImageNode" : "polaroidImage";
      return {
        ...node,
        type: nodeType,
        data: {
          ...(node.data ?? {}),
          type: nodeType,
          node_type: nodeType,
        },
        hidden: isHidden,
        style: highlightStyle ? { ...(sizeStyle ?? {}), ...highlightStyle } : sizeStyle,
      };
    });
  }, [nodes, parentPath.nodeIds, childrenPath.nodeIds, collapsedNodeIds]);

  const isTauri = () =>
    typeof (window as any).__TAURI_INTERNALS__ !== "undefined";

  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    node: Node | null;
  }>({ open: false, x: 0, y: 0, node: null });

  const [paneMenu, setPaneMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    flowPos: { x: number; y: number } | null;
    parentNodeId: string | null;
  }>({ open: false, x: 0, y: 0, flowPos: null, parentNodeId: null });

  const [canvasMenu, setCanvasMenu] = useState<{
    open: boolean;
  }>({ open: false });
  const [edgeStyleMenuOpen, setEdgeStyleMenuOpen] = useState(false);

  const [spacingPanel, setSpacingPanel] = useState<{
    open: boolean;
    x: number;
    y: number;
  }>({ open: false, x: 40, y: 120 });
  const [isSpacingDragging, setIsSpacingDragging] = useState(false);

  const [showDetailsActive, setShowDetailsActive] = useState(true);
  const [detailsPreview, setDetailsPreview] = useState<{
    node: Node;
    x: number;
    y: number;
  } | null>(null);
  const [isNodeDragging, setIsNodeDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const decisionMenuLabel = (uiText.contextMenus.canvas as any)
    .newDecision as string;
  const edgeStyleOptions = [
    {
      value: "default",
      label: uiText.settings.appearance.edgeTypeOptions.bezier,
    },
    {
      value: "straight",
      label: uiText.settings.appearance.edgeTypeOptions.straight,
    },
    {
      value: "simpleBezier",
      label: uiText.settings.appearance.edgeTypeOptions.simpleBezier,
    },
    { value: "step", label: uiText.settings.appearance.edgeTypeOptions.step },
    {
      value: "smoothstep",
      label: uiText.settings.appearance.edgeTypeOptions.smoothstep,
    },
  ];

  const closeContextMenu = () =>
    setContextMenu((s) =>
      s.open ? { open: false, x: 0, y: 0, node: null } : s
    );

  const closePaneMenu = () =>
    setPaneMenu((s) =>
      s.open
        ? { open: false, x: 0, y: 0, flowPos: null, parentNodeId: null }
        : s
    );

  const toggleCanvasMenu = () =>
    setCanvasMenu((s) => {
      const nextOpen = !s.open;
      if (!nextOpen) setEdgeStyleMenuOpen(false);
      return { open: nextOpen };
    });

  const closeCanvasMenu = () => {
    setCanvasMenu({ open: false });
    setEdgeStyleMenuOpen(false);
  };

  const closeSpacingPanel = () =>
    setSpacingPanel((s) => (s.open ? { ...s, open: false } : s));

  const isFolderNode = (node: Node): boolean => {
    // Root node is always a folder conceptually.
    if (node?.type === "rootFolder" || node?.id === "00") return true;

    const data = (node?.data ?? {}) as any;
    // Prefer explicit `type` if present (future: file/folder nodes).
    if (data?.type === "folder") return true;
    if (data?.type === "file") return false;

    // Fallback: treat any node_type containing "folder" as a folder.
    const nodeType = data?.node_type;
    if (
      typeof nodeType === "string" &&
      nodeType.toLowerCase().includes("folder")
    )
      return true;

    return false;
  };

  const getDescendantIds = (
    root: RootFolderJson | null,
    folderId: string
  ): string[] => {
    if (!root) return [];
    const stack: IndexNode[] = [root as unknown as IndexNode];
    let target: IndexNode | null = null;
    while (stack.length) {
      const current = stack.pop();
      if (!current) continue;
      if ((current as any).id === folderId) {
        target = current;
        break;
      }
      const children = Array.isArray((current as any).child)
        ? ((current as any).child as IndexNode[])
        : [];
      stack.push(...children);
    }
    if (!target) return [];

    const descendants: string[] = [];
    const walk = (node: IndexNode) => {
      const children = Array.isArray((node as any).child)
        ? ((node as any).child as IndexNode[])
        : [];
      children.forEach((child) => {
        const id = (child as any).id;
        if (typeof id === "string") descendants.push(id);
        walk(child);
      });
    };
    walk(target);
    return descendants;
  };

  const updateFolderNodeInRoot = (
    root: RootFolderJson,
    nodeId: string,
    updater: (node: IndexNode) => IndexNode
  ): RootFolderJson => {
    let updated = false;
    const updateList = (list: IndexNode[]): IndexNode[] =>
      list.map((item) => {
        if (!item || typeof item !== "object") return item;
        const id = (item as any).id;
        if (id === nodeId) {
          updated = true;
          return updater(item);
        }
        const children = Array.isArray((item as any).child)
          ? ((item as any).child as IndexNode[])
          : null;
        if (!children) return item;
        const nextChildren = updateList(children);
        if (nextChildren === children) return item;
        updated = true;
        return { ...(item as any), child: nextChildren } as IndexNode;
      });

    const nextChildren = updateList((root.child ?? []) as IndexNode[]);
    if (!updated) return root;
    return { ...root, child: nextChildren };
  };

  const persistRootFolderJson = async (nextRoot: RootFolderJson) => {
    updateRootFolderJson(nextRoot);
    try {
      if (rootDirectoryHandle) {
        await fileManager.writeRootFolderJson(rootDirectoryHandle, nextRoot);
      } else if (rootFolderJson?.path) {
        await fileManager.writeRootFolderJsonFromPath(
          rootFolderJson.path,
          nextRoot
        );
      }
    } catch (err) {
      console.error("[MindMap] Persist folder tree state failed:", err);
    }
  };

  const persistViewport = useCallback(
    (viewport: { x: number; y: number; zoom: number } | null) => {
      if (!viewport) return;
      const { x, y, zoom } = viewport;
      if (![x, y, zoom].every((v) => Number.isFinite(v))) return;
      const last = lastSavedViewportRef.current;
      if (
        last &&
        Math.abs(last.x - x) < 0.5 &&
        Math.abs(last.y - y) < 0.5 &&
        Math.abs(last.zoom - zoom) < 0.0001
      ) {
        return;
      }
      lastSavedViewportRef.current = { x, y, zoom };
      setLastViewport({ x, y, zoom });
    },
    [setLastViewport]
  );

  const queueViewportSave = useCallback(
    (viewport: { x: number; y: number; zoom: number } | null) => {
      pendingViewportRef.current = viewport;
      if (viewportSaveRafRef.current != null) return;
      viewportSaveRafRef.current = window.requestAnimationFrame(() => {
        const next = pendingViewportRef.current;
        pendingViewportRef.current = null;
        viewportSaveRafRef.current = null;
        if (next) persistViewport(next);
      });
    },
    [persistViewport]
  );

  const showAllNodesInCanvas = () => {
    if (!rf) return;
    const rect = canvasBodyRef.current?.getBoundingClientRect();
    if (!rect || !nodes.length) return;
    const padding = isTauri() ? 0 : 0.05;
    const fitViewport = getFitViewport({
      nodes,
      canvasRect: rect,
      maxZoom: 6,
      padding,
    });
    rf.setViewport(fitViewport);
    persistViewport(fitViewport);
  };

  const applyGridViewLayout = () => {
    if (!rf || !nodes.length || !rootFolderJson) return;
    const rect = canvasBodyRef.current?.getBoundingClientRect();
    if (!rect) return;

    const rootNode =
      nodes.find((node) => node.type === "rootFolder") ??
      nodes.find((node) => node.id === rootFolderJson.id) ??
      nodes.find((node) => node.id === "00") ??
      null;
    if (!rootNode) return;

    const otherNodes = nodes.filter((node) => node.id !== rootNode.id);
    const getNodeDimensions = (node: Node) => {
      const sizeFromData =
        typeof (node.data as any)?.node_size === "number" &&
        Number.isFinite((node.data as any).node_size)
          ? (node.data as any).node_size
          : settings.appearance.nodeSize;
      const width =
        typeof node.width === "number" && Number.isFinite(node.width)
          ? node.width
          : sizeFromData;
      const height =
        typeof node.height === "number" && Number.isFinite(node.height)
          ? node.height
          : sizeFromData;
      return {
        width: Math.max(40, Math.round(width)),
        height: Math.max(40, Math.round(height)),
      };
    };

    const rootSize = getNodeDimensions(rootNode);
    const columnGap =
      typeof settings.appearance.gridColumnGap === "number" &&
      Number.isFinite(settings.appearance.gridColumnGap)
        ? Math.max(0, Math.round(settings.appearance.gridColumnGap))
        : 20;
    const rowGap =
      typeof settings.appearance.gridRowGap === "number" &&
      Number.isFinite(settings.appearance.gridRowGap)
        ? Math.max(0, Math.round(settings.appearance.gridRowGap))
        : 30;
    const centerFlow = rf.screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + 24,
    });

    const rootPosition = {
      x: centerFlow.x - rootSize.width / 2,
      y: centerFlow.y,
    };

    const maxTileWidth =
      otherNodes.length > 0
        ? Math.max(...otherNodes.map((node) => getNodeDimensions(node).width))
        : settings.appearance.nodeSize;
    const columnWidth = maxTileWidth + columnGap;
    const providedColumns =
      typeof settings.appearance.gridColumns === "number" &&
      Number.isFinite(settings.appearance.gridColumns)
        ? Math.max(1, Math.round(settings.appearance.gridColumns))
        : null;
    const providedRows =
      typeof settings.appearance.gridRows === "number" &&
      Number.isFinite(settings.appearance.gridRows)
        ? Math.max(1, Math.round(settings.appearance.gridRows))
        : null;
    const columns =
      providedColumns ??
      (providedRows ? Math.max(1, Math.ceil(otherNodes.length / providedRows)) : 5);
    const rows =
      providedRows ??
      (providedColumns ? Math.max(1, Math.ceil(otherNodes.length / providedColumns)) : 5);
    const gridWidth = columns * columnWidth - columnGap;
    const startX = centerFlow.x - gridWidth / 2;
    const startY = rootPosition.y + rootSize.height + rowGap * 2;

    const nextPositions: Record<string, { x: number; y: number }> = {};
    nextPositions[rootNode.id] = rootPosition;

    const maxGridItems = columns * rows;
    const rowHeights = new Array(rows).fill(0);
    otherNodes.forEach((node, index) => {
      if (index >= maxGridItems) return;
      const size = getNodeDimensions(node);
      const row = Math.floor(index / columns);
      rowHeights[row] = Math.max(rowHeights[row], size.height);
    });
    const rowOffsets = rowHeights.reduce<number[]>((acc, _height, idx) => {
      if (idx === 0) return [0];
      const prev = acc[idx - 1] + rowHeights[idx - 1] + rowGap;
      return [...acc, prev];
    }, []);

    otherNodes.forEach((node, index) => {
      if (index >= maxGridItems) return;
      const size = getNodeDimensions(node);
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = startX + col * columnWidth + (maxTileWidth - size.width) / 2;
      const y = startY + (rowOffsets[row] ?? 0);
      nextPositions[node.id] = { x, y };
    });

    const nextNodes = nodes.map((node) =>
      nextPositions[node.id]
        ? { ...node, position: nextPositions[node.id] }
        : node
    );

    setNodes(nextNodes);
    setHasCustomLayout(true);
    setPendingNodePositions(nextPositions);
    setLayoutSaveStatus("saving");
    updateRootFolderJson({
      ...rootFolderJson,
      node_positions: nextPositions,
    });

    requestAnimationFrame(() => {
      showAllNodesInCanvas();
    });
  };

  useEffect(() => {
    if (!rf || !nodes.length) return;
    if (!rootFolderJson) {
      lastFitRootIdRef.current = null;
      if (shouldFitView) {
        window.requestAnimationFrame(() => {
          showAllNodesInCanvas();
        });
        setShouldFitView(false);
      }
      return;
    }

    const rootId = rootFolderJson.id;
    const alreadyFit = lastFitRootIdRef.current === rootId;
    if (!shouldFitView && alreadyFit) return;

    // Defer one frame so ReactFlow has the latest node positions.
    window.requestAnimationFrame(() => {
      showAllNodesInCanvas();
    });
    lastFitRootIdRef.current = rootId;
    if (shouldFitView) setShouldFitView(false);
  }, [rootFolderJson, rf, nodes.length, shouldFitView, setShouldFitView]);

  useEffect(() => {
    lastSavedViewportRef.current = lastViewport;
  }, [activeTab?.id, lastViewport]);

  useEffect(() => {
    if (!rf) return;
    const tabId = activeTab?.id ?? null;
    if (!tabId) return;
    if (shouldFitView) {
      lastRestoredTabIdRef.current = tabId;
      return;
    }
    if (!lastViewport) return;
    if (lastRestoredTabIdRef.current === tabId) return;
    rf.setViewport(lastViewport);
    lastRestoredTabIdRef.current = tabId;
  }, [rf, activeTab?.id, lastViewport, shouldFitView]);

  const getMaxDepthFromRoot = (root: RootFolderJson | null): number => {
    if (!root) return 0;
    const walk = (node: RootFolderJson | IndexNode, depth: number): number => {
      const children = Array.isArray((node as any)?.child)
        ? ((node as any).child as IndexNode[])
        : [];
      if (!children.length) return depth;
      let maxDepth = depth;
      children.forEach((child) => {
        maxDepth = Math.max(maxDepth, walk(child, depth + 1));
      });
      return maxDepth;
    };
    return walk(root, 0);
  };

  const maxDepth = useMemo(
    () => getMaxDepthFromRoot(rootFolderJson),
    [rootFolderJson]
  );
  const displayLevels = Math.min(5, Math.max(0, maxDepth));
  const defaultLevelGap = Math.round(settings.appearance.nodeSize * 1.4);
  const levelGaps = settings.appearance.levelHorizontalGaps ?? [];

  const getLevelGapValue = (level: number): number => {
    const value = levelGaps[level - 1];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    return defaultLevelGap;
  };

  const clampGapValue = (value: number): number => {
    const clamped = Math.max(30, Math.min(600, Math.round(value)));
    return clamped;
  };

  const setLevelGapValue = (level: number, nextValue: number) => {
    const nextGaps = Array.from({ length: 5 }, (_, idx) => {
      const existing = getLevelGapValue(idx + 1);
      return Number.isFinite(existing) ? existing : defaultLevelGap;
    });
    nextGaps[level - 1] = clampGapValue(nextValue);
    updateSettings({
      appearance: {
        ...settings.appearance,
        levelHorizontalGaps: nextGaps,
      },
    });
  };

  const getNodeFolderPath = (node: Node): string | null => {
    const path = (node?.data as any)?.path;
    if (typeof path !== "string" || !path.trim()) return null;
    return path;
  };

  /**
   * ReactFlow is "controlled" here (nodes/edges come from the global store),
   * so we must apply change events back into the store for selection/dragging
   * and other interactions to work correctly.
   */
  const onNodesChange = (changes: NodeChange[]) => {
    const hasPositionChange = changes.some(
      (change) => change.type === "position"
    );
    if (isCognitiveNotes && hasPositionChange) {
      setCognitiveNotesDirty(true);
    }
    if (!settings.interaction.lockNodePositions && hasPositionChange) {
      setHasCustomLayout(true);
    }
    if (settings.interaction.lockNodePositions) {
      const filtered = changes.filter((change) => change.type !== "position");
      if (!filtered.length) return;
      setNodes(applyNodeChanges(filtered, nodes));
      return;
    }
    const nextNodes = applyNodeChanges(changes, nodes);
    let adjustedNodes = nextNodes;

    if (hasPositionChange && rootFolderJson) {
      const movedIds = new Set(
        changes
          .filter((change) => change.type === "position")
          .map((change) => change.id)
      );
      const descendantDeltaMap = new Map<string, { x: number; y: number }>();

      changes
        .filter((change) => change.type === "position")
        .forEach((change) => {
          const moved = nodes.find((node) => node.id === change.id);
          if (!moved || !moved.position || !change.position) return;
          if (!isFolderNode(moved)) return;
          const moveChildrenOnDrag =
            (moved.data as any)?.moveChildrenOnDrag === true;
          if (!moveChildrenOnDrag) return;

          const delta = {
            x: change.position.x - moved.position.x,
            y: change.position.y - moved.position.y,
          };
          if (delta.x === 0 && delta.y === 0) return;

          const descendants = getDescendantIds(rootFolderJson, moved.id);
          descendants.forEach((descendantId) => {
            if (movedIds.has(descendantId)) return;
            if (!descendantDeltaMap.has(descendantId)) {
              descendantDeltaMap.set(descendantId, delta);
            }
          });
        });

      if (descendantDeltaMap.size > 0) {
        adjustedNodes = nextNodes.map((node) => {
          const delta = descendantDeltaMap.get(node.id);
          if (!delta || !node.position) return node;
          return {
            ...node,
            position: {
              x: node.position.x + delta.x,
              y: node.position.y + delta.y,
            },
          };
        });
      }

      const nextPositions = {
        ...(rootFolderJson.node_positions ?? {}),
      } as Record<string, { x: number; y: number }>;

      changes
        .filter((change) => change.type === "position")
        .forEach((change) => {
          const moved = adjustedNodes.find((node) => node.id === change.id);
          if (!moved || !moved.position) return;
          nextPositions[moved.id] = {
            x: moved.position.x,
            y: moved.position.y,
          };
        });

      descendantDeltaMap.forEach((_delta, descendantId) => {
        const moved = adjustedNodes.find((node) => node.id === descendantId);
        if (!moved || !moved.position) return;
        nextPositions[moved.id] = {
          x: moved.position.x,
          y: moved.position.y,
        };
      });

      setPendingNodePositions(nextPositions);
      setLayoutSaveStatus("saving");
      updateRootFolderJson({
        ...rootFolderJson,
        node_positions: nextPositions,
      });
    }
    if (hasPositionChange && isCognitiveNotes && cognitiveNotesRoot) {
      const nextPositions: Record<string, { x: number; y: number }> = {
        ...(cognitiveNotesRoot.node_positions ?? {}),
      };
      const movedIds = new Set(
        changes
          .filter((change) => change.type === "position")
          .map((change) => change.id)
      );
      const relatedDeltaMap = new Map<string, { x: number; y: number }>();

      changes
        .filter((change) => change.type === "position")
        .forEach((change) => {
          const moved = nodes.find((node) => node.id === change.id);
          if (!moved || !moved.position || !change.position) return;
          const moveChildrenOnDrag =
            (moved.data as any)?.moveChildrenOnDrag === true;
          if (!moveChildrenOnDrag) return;
          const delta = {
            x: change.position.x - moved.position.x,
            y: change.position.y - moved.position.y,
          };
          if (delta.x === 0 && delta.y === 0) return;
          const relatedIds = getRelatedDescendantIds(moved.id);
          relatedIds.forEach((targetId) => {
            if (!targetId || movedIds.has(targetId)) return;
            if (!relatedDeltaMap.has(targetId)) {
              relatedDeltaMap.set(targetId, delta);
            }
          });
        });

      if (relatedDeltaMap.size > 0) {
        adjustedNodes = adjustedNodes.map((node) => {
          const delta = relatedDeltaMap.get(node.id);
          if (!delta || !node.position) return node;
          return {
            ...node,
            position: {
              x: node.position.x + delta.x,
              y: node.position.y + delta.y,
            },
          };
        });
      }

      changes
        .filter((change) => change.type === "position")
        .forEach((change) => {
          const moved = adjustedNodes.find((node) => node.id === change.id);
          if (!moved || !moved.position) return;
          nextPositions[moved.id] = {
            x: moved.position.x,
            y: moved.position.y,
          };
        });
      relatedDeltaMap.forEach((_delta, relatedId) => {
        const moved = adjustedNodes.find((node) => node.id === relatedId);
        if (!moved || !moved.position) return;
        nextPositions[moved.id] = {
          x: moved.position.x,
          y: moved.position.y,
        };
      });
      updateCognitiveNotesRoot({
        ...cognitiveNotesRoot,
        node_positions: nextPositions,
      });
    }
    setNodes(adjustedNodes);
  };

  const onEdgesChange = (changes: EdgeChange[]) => {
    const nextEdges = applyEdgeChanges(changes, edges);
    setEdges(nextEdges);
    if (changes.length) {
      const nextFlowchartEdges = buildFlowchartEdges(nextEdges, nodes);
      if (isCognitiveNotes && cognitiveNotesRoot) {
        updateCognitiveNotesRoot({
          ...cognitiveNotesRoot,
          flowchart_edges: nextFlowchartEdges,
        });
        setCognitiveNotesDirty(true);
      } else if (rootFolderJson) {
        updateRootFolderJson({
          ...rootFolderJson,
          flowchart_edges: nextFlowchartEdges,
        });
        setPendingFlowchartEdges(nextFlowchartEdges);
      }
    }
  };

  const onConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    if (connection.source === connection.target) return;

    const sourceNode = (nodes ?? []).find(
      (node: any) => node?.id === connection.source
    );
    const targetNode = (nodes ?? []).find(
      (node: any) => node?.id === connection.target
    );
    const isFlowchartEdge =
      isCanvasNode(sourceNode) ||
      isCanvasNode(targetNode) ||
      persistedCanvasNodeIds.has(connection.source) ||
      persistedCanvasNodeIds.has(connection.target);
    if (!isCognitiveNotes && !isFlowchartEdge) return;

    const edgeId = `e_${connection.source}_${connection.target}_${Date.now()}`;
    const nextEdges = addEdge(
      {
        ...connection,
        id: edgeId,
        type: "default",
        data: { purpose: "" },
      },
      edges
    );
    setEdges(nextEdges);

    if (isFlowchartEdge) {
      const nextFlowchartEdges = buildFlowchartEdges(nextEdges, nodes);
      if (isCognitiveNotes && cognitiveNotesRoot) {
        updateCognitiveNotesRoot({
          ...cognitiveNotesRoot,
          flowchart_edges: nextFlowchartEdges,
        });
        setCognitiveNotesDirty(true);
      } else if (rootFolderJson) {
        updateRootFolderJson({
          ...rootFolderJson,
          flowchart_edges: nextFlowchartEdges,
        });
        setPendingFlowchartEdges(nextFlowchartEdges);
      }
      return;
    }

    setCognitiveNotesDirty(true);
    if (cognitiveNotesRoot) {
      const updatedChild = (cognitiveNotesRoot.child ?? []).map((node: any) => {
        if (node?.id !== connection.source) return node;
        const nextRelations = Array.isArray(node.related_nodes)
          ? [
              ...node.related_nodes,
              {
                edge_id: edgeId,
                target_id: connection.target,
                purpose: "",
                source_handle:
                  typeof connection.sourceHandle === "string"
                    ? connection.sourceHandle
                    : undefined,
                target_handle:
                  typeof connection.targetHandle === "string"
                    ? connection.targetHandle
                    : undefined,
              },
            ]
          : [
              {
                edge_id: edgeId,
                target_id: connection.target,
                purpose: "",
                source_handle:
                  typeof connection.sourceHandle === "string"
                    ? connection.sourceHandle
                    : undefined,
                target_handle:
                  typeof connection.targetHandle === "string"
                    ? connection.targetHandle
                    : undefined,
              },
            ];
        return { ...node, related_nodes: nextRelations };
      });
      useMindMapStore.getState().setCognitiveNotesRoot({
        ...cognitiveNotesRoot,
        child: updatedChild,
      });
    }
  };

  const onEdgeClick = (_: unknown, edge: Edge) => {
    clearSelectedNodes();
    selectEdge(edge.id);
  };

  /**
   * Keep selected node id in the global store so the right panel can show details.
   */
  const onNodeClick = (_: unknown, node: Node) => {
    const event = _ as MouseEvent | undefined;
    const isMultiSelect = !!event?.ctrlKey || !!event?.metaKey;
    selectEdge(null);
    if (isMultiSelect) {
      toggleSelectedNode(node.id);
      return;
    }
    selectNode(node.id);
  };

  /**
   * Clear selection when clicking on empty canvas (pane).
   */
  const onPaneClick = () => {
    // If the user was in the middle of creating a child and clicks away before
    // naming/saving, discard the temporary node (reversible-before-save behavior).
    discardPendingChildCreationIfSelected();
    selectEdge(null);
    clearSelectedNodes();
    selectGroup(null);
  };

  const onEdgesDelete = (deleted: Edge[]) => {
    if (!deleted.length) return;
    if (isCognitiveNotes) {
      setCognitiveNotesDirty(true);
    }
    const deletedIds = new Set(deleted.map((edge) => edge.id));
    const nextEdges = (edges ?? []).filter(
      (edge: any) => !deletedIds.has(edge?.id)
    );
    setEdges(nextEdges);
    selectEdge(null);
    if (isCognitiveNotes && cognitiveNotesRoot) {
      const nextChild = (cognitiveNotesRoot.child ?? []).map((node: any) => ({
        ...node,
        related_nodes: Array.isArray(node.related_nodes)
          ? node.related_nodes.filter((rel: any) => !deletedIds.has(rel?.edge_id))
          : [],
      }));
      const nextFlowchartEdges = buildFlowchartEdges(nextEdges, nodes);
      useMindMapStore.getState().updateCognitiveNotesRoot({
        ...cognitiveNotesRoot,
        child: nextChild,
        flowchart_edges: nextFlowchartEdges,
      });
      setCognitiveNotesDirty(true);
    } else if (rootFolderJson) {
      const nextFlowchartEdges = buildFlowchartEdges(nextEdges, nodes);
      updateRootFolderJson({
        ...rootFolderJson,
        flowchart_edges: nextFlowchartEdges,
      });
      setPendingFlowchartEdges(nextFlowchartEdges);
    }
  };

  const isDetailsPreviewNode = (node: Node | null): boolean =>
    !!node && (node.type === "rootFolder" || node.type === "file");

  const selectedNodeIdSet = useMemo(
    () => new Set(selectedNodeIds ?? []),
    [selectedNodeIds]
  );
  const isMultiSelect = selectedNodeIds.length > 1;

  const findGroupIdForNode = useCallback(
    (nodeId: string): string | null => {
      if (!nodeId) return null;
      const match = (nodeGroups ?? []).find((group) =>
        group.nodeIds.includes(nodeId)
      );
      return match?.id ?? null;
    },
    [nodeGroups]
  );

  const getNodeBounds = useCallback(
    (node: any) => {
      const position = node?.position ?? { x: 0, y: 0 };
      const width =
        typeof node?.width === "number"
          ? node.width
          : typeof node?.data?.nodeWidth === "number"
          ? node.data.nodeWidth
          : typeof node?.style?.width === "number"
          ? node.style.width
          : settings.appearance.nodeSize ?? 200;
      const height =
        typeof node?.height === "number"
          ? node.height
          : typeof node?.data?.nodeHeight === "number"
          ? node.data.nodeHeight
          : typeof node?.style?.height === "number"
          ? node.style.height
          : settings.appearance.nodeSize ?? 200;
      return {
        x: position.x,
        y: position.y,
        width,
        height,
      };
    },
    [settings.appearance.nodeSize]
  );

  const getGroupBounds = useCallback(
    (group: { nodeIds: string[] }) => {
      const members = (nodesRef.current ?? []).filter((node: any) =>
        group.nodeIds.includes(node?.id)
      );
      if (!members.length) return null;
      const bounds = members.map(getNodeBounds);
      const minX = Math.min(...bounds.map((b) => b.x));
      const minY = Math.min(...bounds.map((b) => b.y));
      const maxX = Math.max(...bounds.map((b) => b.x + b.width));
      const maxY = Math.max(...bounds.map((b) => b.y + b.height));
      const padding = 18;
      const headerHeight = 28;
      return {
        x: minX - padding,
        y: minY - padding - headerHeight,
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2 + headerHeight,
        headerHeight,
        padding,
      };
    },
    [getNodeBounds]
  );

  const getGroupBaseSizes = useCallback(
    (group: { nodeIds: string[] }, fallbackScale = 1) => {
      const baseSizes: Record<
        string,
        { nodeSize?: number; nodeWidth?: number; nodeHeight?: number }
      > = {};
      const baseNodeSize = settings.appearance.nodeSize;
      (nodesRef.current ?? []).forEach((node: any) => {
        if (!group.nodeIds.includes(node?.id)) return;
        const data = node.data ?? {};
        const nodeWidth =
          typeof (data as any).nodeWidth === "number" ? (data as any).nodeWidth : undefined;
        const nodeHeight =
          typeof (data as any).nodeHeight === "number" ? (data as any).nodeHeight : undefined;
        if (typeof nodeWidth === "number" && typeof nodeHeight === "number") {
          baseSizes[node.id] = {
            nodeWidth: nodeWidth / fallbackScale,
            nodeHeight: nodeHeight / fallbackScale,
          };
          return;
        }
        const nodeSize =
          typeof (data as any).node_size === "number" &&
          Number.isFinite((data as any).node_size)
            ? (data as any).node_size / fallbackScale
            : baseNodeSize;
        baseSizes[node.id] = { nodeSize };
      });
      return baseSizes;
    },
    [settings.appearance.nodeSize]
  );

  const getGroupBasePositions = useCallback((group: { nodeIds: string[] }) => {
    const positions: Record<string, { x: number; y: number }> = {};
    (nodesRef.current ?? []).forEach((node: any) => {
      if (!group.nodeIds.includes(node?.id)) return;
      if (!node?.position) return;
      positions[node.id] = { x: node.position.x, y: node.position.y };
    });
    return positions;
  }, []);

  const scaleGroupNodes = useCallback(
    (groupId: string, direction: "up" | "down") => {
      const group = (nodeGroups ?? []).find((item) => item.id === groupId);
      if (!group) return;
      const currentScale = typeof group.scale === "number" ? group.scale : 1;
      const step = 0.1;
      const nextScaleRaw = direction === "up" ? currentScale + step : currentScale - step;
      const nextScale = Math.min(2, Math.max(0.5, Number(nextScaleRaw.toFixed(2))));
      if (nextScale === currentScale) return;
      const baseSizes =
        group.baseSizes ??
        getGroupBaseSizes(group, currentScale > 0 ? currentScale : 1);
      const basePositions = group.basePositions ?? getGroupBasePositions(group);
      const baseCenter = (() => {
        const coords = Object.values(basePositions);
        if (coords.length === 0) return { x: 0, y: 0 };
        const xs = coords.map((p) => p.x);
        const ys = coords.map((p) => p.y);
        return {
          x: (Math.min(...xs) + Math.max(...xs)) / 2,
          y: (Math.min(...ys) + Math.max(...ys)) / 2,
        };
      })();
      const nextNodes = (nodesRef.current ?? []).map((node: any) => {
        if (!group.nodeIds.includes(node?.id)) return node;
        const base = baseSizes[node.id];
        if (!base) return node;
        const data = { ...(node.data ?? {}) };
        if (
          typeof base.nodeWidth === "number" &&
          typeof base.nodeHeight === "number"
        ) {
          data.nodeWidth = Math.round(base.nodeWidth * nextScale);
          data.nodeHeight = Math.round(base.nodeHeight * nextScale);
        } else if (typeof base.nodeSize === "number") {
          data.node_size = Math.round(base.nodeSize * nextScale);
        }
        const basePos = basePositions[node.id];
        const nextPos = basePos
          ? {
              x: baseCenter.x + (basePos.x - baseCenter.x) * nextScale,
              y: baseCenter.y + (basePos.y - baseCenter.y) * nextScale,
            }
          : node.position;
        return { ...node, data, position: nextPos ?? node.position };
      });
      nodesRef.current = nextNodes;
      setNodes(nextNodes);
      if (rf && typeof (rf as any).updateNodeInternals === "function") {
        requestAnimationFrame(() => {
          (rf as any).updateNodeInternals(group.nodeIds);
        });
        window.setTimeout(() => {
          (rf as any).updateNodeInternals(group.nodeIds);
        }, 0);
      }
      updateGroupData(groupId, {
        scale: nextScale,
        baseSizes,
        basePositions,
        updatedOn: new Date().toISOString(),
      });
    },
    [getGroupBasePositions, getGroupBaseSizes, nodeGroups, setNodes, updateGroupData]
  );

  const getPreviewPosition = (clientX: number, clientY: number) => {
    const rect = canvasBodyRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const onNodeMouseEnter = (event: any, node: Node) => {
    if (!showDetailsActive || isNodeDragging || !isDetailsPreviewNode(node)) return;
    const pos = getPreviewPosition(event.clientX, event.clientY);
    setDetailsPreview({ node, ...pos });
  };

  const onNodeMouseMove = (event: any, node: Node) => {
    if (!showDetailsActive || isNodeDragging || !isDetailsPreviewNode(node)) return;
    const pos = getPreviewPosition(event.clientX, event.clientY);
    setDetailsPreview({ node, ...pos });
  };

  const onNodeMouseLeave = () => {
    if (!showDetailsActive || isNodeDragging) return;
    setDetailsPreview(null);
  };

  const onNodeDragStart = (_: unknown, _node: Node) => {
    if (!showDetailsActive) return;
    setIsNodeDragging(true);
    setDetailsPreview(null);
  };

  const onNodeDragStop = () => {
    setIsNodeDragging(false);
  };

  const startGroupDrag = useCallback((clientX: number, clientY: number, groupId: string) => {
    groupDragRef.current = {
      groupId,
      lastClient: { x: clientX, y: clientY },
    };
    setIsNodeDragging(true);
  }, []);

  const onGroupMouseDown = useCallback(
    (event: React.MouseEvent, groupId: string) => {
      event.preventDefault();
      event.stopPropagation();
      selectGroup(groupId);
      startGroupDrag(event.clientX, event.clientY, groupId);
    },
    [selectGroup, startGroupDrag]
  );

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const active = groupDragRef.current;
      if (!active) return;
      event.preventDefault();
      const deltaX = (event.clientX - active.lastClient.x) / viewport.zoom;
      const deltaY = (event.clientY - active.lastClient.y) / viewport.zoom;
      if (deltaX === 0 && deltaY === 0) return;
      active.lastClient = { x: event.clientX, y: event.clientY };
      const group = (nodeGroups ?? []).find((g) => g.id === active.groupId);
      if (!group) return;
      const nextNodes = (nodesRef.current ?? []).map((node: any) => {
        if (!group.nodeIds.includes(node.id)) return node;
        const position = node.position ?? { x: 0, y: 0 };
        return {
          ...node,
          position: {
            x: position.x + deltaX,
            y: position.y + deltaY,
          },
        };
      });
      nodesRef.current = nextNodes;
      setNodes(nextNodes);
    };
    const onUp = () => {
      if (!groupDragRef.current) return;
      groupDragRef.current = null;
      setIsNodeDragging(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [nodeGroups, setNodes, viewport.zoom]);

  useEffect(() => {
    if (!rf) return;

    const onFocusNode = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail as
        | { tabId?: string; nodeId?: string; zoom?: number }
        | undefined;
      const nodeId = detail?.nodeId;
      if (!nodeId) return;
      const tabId = typeof detail?.tabId === "string" ? detail.tabId : null;
      if (tabId && tabId !== (activeTab?.id ?? "")) return;

      const target = (nodes ?? []).find((n: any) => n?.id === nodeId);
      if (!target?.position) return;

      const fallbackSize = settings.appearance.nodeSize;
      const styleWidth = (target.style as any)?.width;
      const styleHeight = (target.style as any)?.height;
      const nodeWidth =
        typeof target.width === "number"
          ? target.width
          : typeof styleWidth === "number"
          ? styleWidth
          : fallbackSize;
      const nodeHeight =
        typeof target.height === "number"
          ? target.height
          : typeof styleHeight === "number"
          ? styleHeight
          : fallbackSize;
      const centerX = target.position.x + Math.max(1, nodeWidth) / 2;
      const centerY = target.position.y + Math.max(1, nodeHeight) / 2;
      const zoom =
        typeof detail?.zoom === "number" && Number.isFinite(detail.zoom)
          ? Math.max(0.1, Math.min(6, detail.zoom))
          : rf.getZoom();

      if (typeof (rf as any).setCenter === "function") {
        (rf as any).setCenter(centerX, centerY, { zoom, duration: 250 });
      } else {
        const rect = wrapperRef.current?.getBoundingClientRect();
        if (!rect) return;
        rf.setViewport({
          x: rect.width / 2 - centerX * zoom,
          y: rect.height / 2 - centerY * zoom,
          zoom,
        });
      }
      queueViewportSave(rf.getViewport());
    };

    window.addEventListener("pm-focus-node", onFocusNode as EventListener);
    return () => {
      window.removeEventListener("pm-focus-node", onFocusNode as EventListener);
    };
  }, [rf, activeTab?.id, nodes, settings.appearance.nodeSize, queueViewportSave]);

  const onCanvasMouseDown = (event: any) => {
    canvasBodyRef.current?.focus();
    if (!showDetailsActive) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest(".react-flow__node")) return;
    const rect = canvasBodyRef.current?.getBoundingClientRect();
    if (rect) {
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      const hitGroup = (nodeGroups ?? []).find((group) => {
        const bounds = getGroupBounds(group);
        if (!bounds) return false;
        const left = bounds.x * viewport.zoom + viewport.x;
        const top = bounds.y * viewport.zoom + viewport.y;
        const width = bounds.width * viewport.zoom;
        const height = bounds.height * viewport.zoom;
        return (
          offsetX >= left &&
          offsetX <= left + width &&
          offsetY >= top &&
          offsetY <= top + height
        );
      });
      if (hitGroup) {
        event.preventDefault();
        event.stopPropagation();
        selectGroup(hitGroup.id);
        startGroupDrag(event.clientX, event.clientY, hitGroup.id);
        return;
      }
    }
    if (target?.closest(".react-flow__pane")) {
      setIsPanning(true);
    }
  };

  const onCanvasMouseUp = () => {
    if (!showDetailsActive) return;
    setIsPanning(false);
  };

  /**
   * Right-click context menu for the canvas/pane.
   *
   * Shows a lightweight creation menu ("New File", "New Folder") at the click point.
   * We snapshot the parent node id at the moment the user opens the menu so the
   * parent context is preserved through the deferred-commit flow.
   */
  const onPaneContextMenu = (e: React.MouseEvent) => {
    closeContextMenu();

    if (!rf) return;

    // Only prevent default when we're showing our custom menu
    e.preventDefault();
    e.stopPropagation();

    const container = canvasBodyRef.current?.getBoundingClientRect();
    const x = container ? e.clientX - container.left : e.clientX;
    const y = container ? e.clientY - container.top : e.clientY;

    // Convert the click to flow coordinates so the new node appears exactly
    // where the user right-clicked on the canvas.
    const flowPos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    setLastCanvasPosition(flowPos);
    const selectedNode =
      selectedNodeId && (nodes ?? []).find((node) => node?.id === selectedNodeId);
    const parentNodeId =
      isCognitiveNotes
        ? cognitiveNotesRoot?.id ?? null
        : selectedNode && isFolderNode(selectedNode)
        ? selectedNode.id
        : null;
    if (isCognitiveNotes) {
      console.log("[CognitiveNotes] Context menu parent", {
        parentNodeId,
        rootId: cognitiveNotesRoot?.id ?? null,
        selectedNodeId,
      });
    }
    setPaneMenu({ open: true, x, y, flowPos, parentNodeId });
  };

  /**
   * Right-click context menu for nodes.
   * Shows menu for selected nodes with options like "Add Handle" and "Open Folder" (Tauri only).
   */
  const onNodeContextMenu = (e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    e.stopPropagation();
    closePaneMenu();

    // Show context menu for selected nodes
    if (!selectedNodeIdSet.has(node.id)) return;

    const container = canvasBodyRef.current?.getBoundingClientRect();
    const x = container ? e.clientX - container.left : e.clientX;
    const y = container ? e.clientY - container.top : e.clientY;
    setContextMenu({ open: true, x, y, node });
  };

  const getRelatedDescendantIds = (nodeId: string): string[] => {
    if (!cognitiveNotesRoot || !nodeId) return [];
    const relatedById = new Map<string, string[]>();
    (cognitiveNotesRoot.child ?? []).forEach((node: any) => {
      if (!node?.id) return;
      const rels = Array.isArray(node.related_nodes) ? node.related_nodes : [];
      const targets = rels
        .map((rel: any) => rel?.target_id)
        .filter((target: any) => typeof target === "string" && target);
      relatedById.set(node.id, targets);
    });
    const visited = new Set<string>();
    const queue: string[] = [];
    (relatedById.get(nodeId) ?? []).forEach((target) => queue.push(target));
    while (queue.length) {
      const current = queue.shift();
      if (!current || visited.has(current) || current === nodeId) continue;
      visited.add(current);
      (relatedById.get(current) ?? []).forEach((next) => {
        if (!visited.has(next)) queue.push(next);
      });
    }
    return Array.from(visited);
  };

  const hasMoveChildrenTargets = (node: Node | null): boolean => {
    if (!node) return false;
    if (isCognitiveNotes && cognitiveNotesRoot) {
      return getRelatedDescendantIds(node.id).length > 0;
    }
    if (rootFolderJson && isFolderNode(node)) {
      const descendants = getDescendantIds(rootFolderJson, node.id);
      return descendants.length > 0;
    }
    return false;
  };

  const canShowSubtreeNotes = (node: Node | null): boolean => {
    if (!isCognitiveNotes || !node) return false;
    if (node.type !== "file" && node.type !== "fullImageNode") return false;
    return hasMoveChildrenTargets(node);
  };

  const onNodeDoubleClick = (_: unknown, _node: Node) => {
    // Intentionally disabled: folder open is now only via context menu.
    return;
  };

  // Close context menu on outside click / Escape.
  // Task-2: Detect any subsequent mouse click (left or right)
  // Task-3: Identify click location (inside vs outside menu)
  // Task-4: Hide context menu if click is outside
  useEffect(() => {
    if (!contextMenu.open && !paneMenu.open && !canvasMenu.open) return;

    const isClickInsideMenu = (target: HTMLElement | null): boolean => {
      if (!target) return false;
      // Check if click is inside any context menu area
      return !!(
        target.closest('[data-pm-context-menu="node"]') ||
        target.closest('[data-pm-context-menu="pane"]') ||
        target.closest('[data-pm-context-menu="canvas"]') ||
        target.closest('[data-pm-context-menu="spacing"]')
      );
    };

    const closeAllMenus = () => {
      closeContextMenu();
      closePaneMenu();
      closeCanvasMenu();
    };

    // Handle both mousedown and click events for better reliability
    // mousedown: catches clicks early, click: catches clicks after mouseup
    const onMouseDown = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null;
      // Task-3: Identify click location
      if (!isClickInsideMenu(target)) {
        // Task-4: Hide context menu if click is outside
        // Use setTimeout to allow menu item clicks to process first
        setTimeout(() => {
          closeAllMenus();
        }, 0);
      }
    };

    const onClick = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null;
      // Task-3: Identify click location
      if (!isClickInsideMenu(target)) {
        // Task-4: Hide context menu if click is outside
        closeAllMenus();
      }
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        closeAllMenus();
      }
    };

    // Listen to both mousedown and click for comprehensive coverage
    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu.open, paneMenu.open, canvasMenu.open]);

  useEffect(() => {
    if (!spacingPanel.open) return;

    const onMouseMove = (ev: MouseEvent) => {
      if (!spacingDragRef.current.active) return;
      const rect = canvasBodyRef.current?.getBoundingClientRect();
      if (!rect) return;
      const panelRect = spacingPanelRef.current?.getBoundingClientRect();
      const panelWidth = panelRect?.width ?? 280;
      const panelHeight = panelRect?.height ?? 220;
      const rawX = ev.clientX - rect.left - spacingDragRef.current.offsetX;
      const rawY = ev.clientY - rect.top - spacingDragRef.current.offsetY;
      const minX = 8;
      const minY = 8;
      const maxX = Math.max(minX, rect.width - panelWidth - 8);
      const maxY = Math.max(minY, rect.height - panelHeight - 8);
      const x = Math.min(maxX, Math.max(minX, rawX));
      const y = Math.min(maxY, Math.max(minY, rawY));
      setSpacingPanel((prev) => ({ ...prev, x, y }));
    };

    const onMouseUp = () => {
      if (spacingDragRef.current.active) {
        spacingDragRef.current.active = false;
        setIsSpacingDragging(false);
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [spacingPanel.open]);

  useEffect(() => {
    if (!showDetailsActive) {
      setDetailsPreview(null);
      setIsNodeDragging(false);
      setIsPanning(false);
      return;
    }

    const onWindowMouseUp = () => setIsPanning(false);
    window.addEventListener("mouseup", onWindowMouseUp);
    return () => {
      window.removeEventListener("mouseup", onWindowMouseUp);
    };
  }, [showDetailsActive]);

  useEffect(() => {
    if (!rf) return;
    const el = canvasBodyRef.current;
    if (!el) return;

    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (document.activeElement !== el && !el.contains(target)) return;

      const items = event.clipboardData?.items ?? [];
      const imageItem = Array.from(items).find((item) =>
        item.type.startsWith("image/")
      );
      if (!imageItem) return;
      const file = imageItem.getAsFile();
      if (!file) return;
      event.preventDefault();

      // Check if a folder is selected to be the parent, OR if an image node is selected (update it)
      const selectedNode = selectedNodeId
        ? (nodes ?? []).find((n: any) => n?.id === selectedNodeId)
        : null;
      const isSelectedImageNode =
        selectedNode &&
        ((selectedNode?.data as any)?.node_type === "polaroidImage" ||
          (selectedNode?.data as any)?.type === "polaroidImage" ||
          selectedNode?.type === "polaroidImage" ||
          (selectedNode?.data as any)?.node_type === "fullImageNode" ||
          (selectedNode?.data as any)?.type === "fullImageNode" ||
          selectedNode?.type === "fullImageNode");
      
      if (isSelectedImageNode) {
        // Update the selected image node with the pasted image
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          const isFullImage =
            (selectedNode?.data as any)?.node_type === "fullImageNode" ||
            (selectedNode?.data as any)?.type === "fullImageNode" ||
            selectedNode?.type === "fullImageNode";
          const { nodeWidth, nodeHeight, imageWidth, imageHeight } = isFullImage
            ? getFullImageDimensions(img.naturalWidth, img.naturalHeight)
            : getPolaroidDimensions(img.naturalWidth, img.naturalHeight);
          const currentNodes = nodes ?? [];
          const updatedNodes = currentNodes.map((n: any) => {
            if (n?.id !== selectedNodeId) return n;
            return {
              ...n,
              data: {
                ...(n.data ?? {}),
                imageSrc: url,
                imageWidth,
                imageHeight,
                nodeWidth,
                nodeHeight,
                clipboardFile: file,
                clipboardMimeType: imageItem.type,
              },
              style: {
                ...(n.style ?? {}),
                width: nodeWidth,
                height: nodeHeight,
              },
            };
          });
          setNodes(updatedNodes);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
        };
        img.src = url;
        return;
      }

      const isFolder =
        selectedNode &&
        ((selectedNode?.data as any)?.node_type === "folder" ||
          (selectedNode?.data as any)?.type === "folder" ||
          selectedNode?.type === "rootFolder");
      const parentNodeId = isFolder ? selectedNodeId : null;

      if (!parentNodeId) {
        // No folder selected - ignore paste (or could show a toast/error)
        return;
      }

      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const { nodeWidth, nodeHeight, imageWidth, imageHeight } =
          getFullImageDimensions(img.naturalWidth, img.naturalHeight);
        const lastPos = lastMousePositionRef.current;
        let flowPos = rf.screenToFlowPosition(lastPos);
        if (!lastPos.x && !lastPos.y) {
          const rect = el.getBoundingClientRect();
          const center = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };
          flowPos = rf.screenToFlowPosition(center);
        }

        // Create draft image node with parent edge
        const tempNodeId = `tmp_image_${Date.now()}_${Math.random()
          .toString(16)
          .slice(2)}`;
        const tempNode: Node = {
          id: tempNodeId,
          type: "fullImageNode",
          position: flowPos,
          style: {
            opacity: 1,
            transition: "opacity 180ms ease",
            width: nodeWidth,
            height: nodeHeight,
          },
          data: {
            type: "fullImageNode",
            node_type: "fullImageNode",
            name: "",
            caption: "",
            purpose: "",
            imageSrc: url,
            imageWidth,
            imageHeight,
            nodeWidth,
            nodeHeight,
            clipboardFile: file,
            clipboardMimeType: imageItem.type,
            parentId: parentNodeId,
            isDraft: true,
            nonPersistent: true,
          },
          selected: true,
        };
        const existing = nodes ?? [];
        const edgeId = `e_${parentNodeId}_${tempNodeId}`;
        const nextEdges = (edges ?? []).some(
          (edge: any) => edge?.id === edgeId
        )
          ? edges
          : [
              ...(edges ?? []),
              {
                id: edgeId,
                source: parentNodeId,
                target: tempNodeId,
                type: "default",
                style: { opacity: 1, transition: "opacity 180ms ease" },
                data: { isDraft: true, nonPersistent: true },
              },
            ];
        const next = [
          ...existing.map((n: any) => ({
            ...n,
            selected: n?.id === tempNodeId,
          })),
          tempNode,
        ];
        setNodes(next);
        setEdges(nextEdges);
        setPendingChildCreation({ tempNodeId, parentNodeId });
        selectNode(tempNodeId);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
      };
      img.src = url;
    };

    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("paste", onPaste);
    };
  }, [rf, nodes, edges, setNodes, setEdges, selectNode, selectedNodeId, setPendingChildCreation]);

  /**
   * Effect: Create/replace root node when root folder is selected
   *
   * When a root folder is selected, this effect:
   * 1. Checks if a root node already exists
   * 2. If it exists, preserves its current position
   * 3. If it doesn't exist (first creation), centers it in the viewport
   * 4. Enables inline editing for the root node
   *
   * Only one root node is allowed at a time (enforced by setNodes([rootNode])).
   */
  useEffect(() => {
    if (!rootFolderJson || !rf) return;

    const existing =
      selectActiveTab(useMindMapStore.getState())?.nodes ?? [];
    const existingRoot = existing.find((n: any) => n?.id === "00");

    // If root node already exists, preserve its position; otherwise center it.
    let rootPosition: { x: number; y: number };
    if (existingRoot?.position) {
      rootPosition = existingRoot.position;
    } else {
      const el = wrapperRef.current;
      const rect = el?.getBoundingClientRect();
      const topPadding = Math.max(
        20,
        Math.round(settings.appearance.nodeSize * 0.2)
      );
      const topCenterClient = rect
        ? { x: rect.left + rect.width / 2, y: rect.top + topPadding }
        : { x: window.innerWidth / 2, y: topPadding };
      rootPosition = rf.screenToFlowPosition(topCenterClient);
    }

    const { nodes: composedNodes, edges: composedEdges, warnings } =
      composeMindMapGraphFromRoot(rootFolderJson, {
        rootNodeId: "00",
        rootPosition,
        nodeSize: settings.appearance.nodeSize,
        levelHorizontalGaps: levelGaps,
      });

    if (warnings.length > 0) {
      console.warn("[MindMap] Compose warnings:", warnings);
    }

    // Sync selection state with store: mark node as selected if it matches selectedNodeId.
    const storedPositions =
      hasCustomLayout && rootFolderJson?.node_positions
        ? new Map(
            Object.entries(rootFolderJson.node_positions).map(
              ([id, pos]) => [id, pos]
            )
          )
        : new Map<string, { x: number; y: number }>();

    const existingPositions = hasCustomLayout
      ? new Map(
          existing
            .filter((node: any) => node?.id && node?.position)
            .map((node: any) => [node.id, node.position])
        )
      : new Map<string, { x: number; y: number }>();

    const sizeMap = rootFolderJson?.node_size ?? {};
    const buildRuntimeFields = (existingData: Record<string, unknown>) => {
      const runtimeFields: Record<string, unknown> = {};
      const imageSrc = existingData.imageSrc;
      if (typeof imageSrc === "string") {
        if (
          imageSrc.startsWith("data:") ||
          imageSrc.startsWith("http://") ||
          imageSrc.startsWith("https://")
        ) {
          runtimeFields.imageSrc = imageSrc;
        }
      }
      if (typeof existingData.imageWidth === "number") {
        runtimeFields.imageWidth = existingData.imageWidth;
      }
      if (typeof existingData.imageHeight === "number") {
        runtimeFields.imageHeight = existingData.imageHeight;
      }
      if (typeof existingData.nodeWidth === "number") {
        runtimeFields.nodeWidth = existingData.nodeWidth;
      }
      if (typeof existingData.nodeHeight === "number") {
        runtimeFields.nodeHeight = existingData.nodeHeight;
      }
      if (typeof existingData.caption === "string") {
        runtimeFields.caption = existingData.caption;
      }
      if (existingData.clipboardFile instanceof File) {
        runtimeFields.clipboardFile = existingData.clipboardFile;
      }
      if (typeof existingData.clipboardMimeType === "string") {
        runtimeFields.clipboardMimeType = existingData.clipboardMimeType;
      }
      if (typeof existingData.isDraft === "boolean") {
        runtimeFields.isDraft = existingData.isDraft;
      }
      if (typeof existingData.nonPersistent === "boolean") {
        runtimeFields.nonPersistent = existingData.nonPersistent;
      }
      if (typeof existingData.parentId === "string") {
        runtimeFields.parentId = existingData.parentId;
      }
      if (typeof existingData.moveChildrenOnDrag === "boolean") {
        runtimeFields.moveChildrenOnDrag = existingData.moveChildrenOnDrag;
      }
      return runtimeFields;
    };

    const withSelection = composedNodes.map((node) => {
      const preserved =
        storedPositions.get(node.id) ?? existingPositions.get(node.id);
      const sizeValue = sizeMap[node.id];
      const existingNode = existing.find((n: any) => n?.id === node.id);
      const existingData = existingNode?.data ?? {};
      const runtimeFields = buildRuntimeFields(existingData);

      const mergedData = {
        ...(node.data ?? {}),
        ...runtimeFields,
        ...(typeof sizeValue === "number" && Number.isFinite(sizeValue)
          ? { node_size: sizeValue }
          : {}),
      };

      const preservedStyle = existingNode?.style
        ? { ...(node.style ?? {}), ...existingNode.style }
        : node.style;

      return {
        ...node,
        position: preserved ?? node.position,
        style: preservedStyle,
        data: mergedData,
        selected: selectedNodeIdSet.has(node.id),
      };
    });

    const flowchartNodes = Array.isArray(rootFolderJson.flowchart_nodes)
      ? rootFolderJson.flowchart_nodes
      : [];
    const flowchartNodeObjects = flowchartNodes.map((flowNode: any) => {
      const existingNode = existing.find((n: any) => n?.id === flowNode?.id);
      const existingData = existingNode?.data ?? {};
      const runtimeFields = buildRuntimeFields(existingData);
      const sizeValue = flowNode?.id ? sizeMap[flowNode.id] : undefined;
      const baseNode = {
        id: flowNode.id,
        type: flowNode.type,
        position: rootPosition,
        data: {
          ...flowNode,
          type: flowNode.type,
          node_type: flowNode.type,
        },
      } as Node;
      const preserved =
        storedPositions.get(flowNode.id) ?? existingPositions.get(flowNode.id);
      const mergedData = {
        ...(baseNode.data ?? {}),
        ...runtimeFields,
        ...(typeof sizeValue === "number" && Number.isFinite(sizeValue)
          ? { node_size: sizeValue }
          : {}),
      };
      const preservedStyle = existingNode?.style
        ? { ...(baseNode.style ?? {}), ...existingNode.style }
        : baseNode.style;
      return {
        ...baseNode,
        position: preserved ?? baseNode.position,
        style: preservedStyle,
        data: mergedData,
        selected: selectedNodeIdSet.has(flowNode.id),
      };
    });

    const existingCustomNodes = existing.filter(
      (node: any) => !!(node?.data as any)?.nonPersistent
    );
    const customNodes = existingCustomNodes.map((node: any) => ({
      ...node,
      selected: selectedNodeIdSet.has(node.id),
    }));
    const mergedNodes = [
      ...withSelection,
      ...flowchartNodeObjects.filter(
        (node) => !withSelection.some((n) => n.id === node.id)
      ),
      ...customNodes.filter(
        (node: any) => !withSelection.some((n) => n.id === node.id)
      ),
    ];

    setNodes(mergedNodes);
    const existingEdges = selectActiveTab(useMindMapStore.getState())?.edges ?? [];
    const customEdges = (existingEdges ?? []).filter(
      (edge: any) => !!(edge?.data as any)?.nonPersistent
    );
    const flowchartEdges = (rootFolderJson.flowchart_edges ?? []).map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: "default",
      sourceHandle: edge.source_handle,
      targetHandle: edge.target_handle,
      data: { purpose: edge.purpose ?? "" },
    }));
    const composedIds = new Set((composedEdges ?? []).map((edge) => edge.id));
    const allIds = new Set<string>(composedIds);
    flowchartEdges.forEach((edge) => allIds.add(edge.id));
    const mergedEdges = [
      ...composedEdges,
      ...flowchartEdges.filter((edge) => !composedIds.has(edge.id)),
      ...customEdges.filter((edge: any) => !allIds.has(edge.id)),
    ];
    setEdges(mergedEdges);
    setInlineEditNodeId("00");
  }, [
    rf,
    rootFolderJson,
    selectedNodeId,
    settings.appearance.nodeSize,
    settings.appearance.levelHorizontalGaps,
    setInlineEditNodeId,
    setNodes,
    setEdges,
    hasCustomLayout,
  ]);

  useEffect(() => {
    if (!rf) return;
    if (!settings.interaction.autoCenterOnSelection) return;
    if (!selectedNodeId) {
      lastFocusedNodeIdRef.current = null;
      return;
    }
    if (lastFocusedNodeIdRef.current === selectedNodeId) return;

    const selectedNode = (nodes ?? []).find((node) => node?.id === selectedNodeId);
    if (!selectedNode?.position) return;

    const fallbackSize = settings.appearance.nodeSize;
    const styleWidth = (selectedNode.style as any)?.width;
    const styleHeight = (selectedNode.style as any)?.height;
    const nodeWidth =
      typeof selectedNode.width === "number"
        ? selectedNode.width
        : typeof styleWidth === "number"
        ? styleWidth
        : fallbackSize;
    const nodeHeight =
      typeof selectedNode.height === "number"
        ? selectedNode.height
        : typeof styleHeight === "number"
        ? styleHeight
        : fallbackSize;
    const centerX = selectedNode.position.x + Math.max(1, nodeWidth) / 2;
    const centerY = selectedNode.position.y + Math.max(1, nodeHeight) / 2;
    const zoom = rf.getZoom();

    if (typeof (rf as any).setCenter === "function") {
      (rf as any).setCenter(centerX, centerY, { zoom, duration: 250 });
    } else {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      rf.setViewport({
        x: rect.width / 2 - centerX * zoom,
        y: rect.height / 2 - centerY * zoom,
        zoom,
      });
    }

    queueViewportSave(rf.getViewport());

    lastFocusedNodeIdRef.current = selectedNodeId;
  }, [
    nodes,
    rf,
    selectedNodeId,
    settings.appearance.nodeSize,
    settings.interaction.autoCenterOnSelection,
    queueViewportSave,
  ]);

  const onViewportMove = useCallback(
    (_: any, viewport: { x: number; y: number; zoom: number }) => {
      queueViewportSave(viewport);
      setViewport(viewport);
    },
    [queueViewportSave]
  );

  return (
    <main className="pm-center" aria-label={uiText.ariaLabels.mindMapCanvas}>
      <div className="pm-canvas" ref={wrapperRef}>
        <header className="pm-canvas__header">
          <div className="pm-canvas__tabs">
            <CanvasTabs />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "2px",
            }}
          >
            {isCognitiveNotes ? (
              <>
                <button
                  type="button"
                  onClick={() => void saveCognitiveNotesCanvas()}
                  aria-label={uiText.buttons.save}
                  title={uiText.buttons.save}
                  disabled={!cognitiveNotesDirty || canvasSaveStatus === "saving"}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "var(--control-size-sm)",
                    width: "var(--control-size-sm)",
                    borderRadius: "var(--radius-md)",
                    border: "none",
                    background:
                      !cognitiveNotesDirty || canvasSaveStatus === "saving"
                        ? "transparent"
                        : "var(--surface-1)",
                    color: "var(--text)",
                    cursor:
                      !cognitiveNotesDirty || canvasSaveStatus === "saving"
                        ? "default"
                        : "pointer",
                    opacity:
                      !cognitiveNotesDirty || canvasSaveStatus === "saving" ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!cognitiveNotesDirty || canvasSaveStatus === "saving") return;
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "var(--surface-2)";
                  }}
                  onMouseLeave={(e) => {
                    if (!cognitiveNotesDirty || canvasSaveStatus === "saving") return;
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "var(--surface-1)";
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 3H16L20 7V21H5V3Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M8 3V8H16V3"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M8 14H16"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M8 17H14"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedNodeId) return;
                      setColorPickerOpen((prev) => !prev);
                    }}
                    aria-label="Node color"
                    title="Node color"
                    disabled={!selectedNodeId}
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
                      cursor: selectedNodeId ? "pointer" : "not-allowed",
                      opacity: selectedNodeId ? 1 : 0.5,
                    }}
                    onMouseEnter={(e) => {
                      if (!selectedNodeId) return;
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "var(--surface-1)";
                    }}
                    onMouseLeave={(e) => {
                      if (!selectedNodeId) return;
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "transparent";
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 999,
                        border: "1px solid var(--border)",
                        background: selectedNodeColor ?? "transparent",
                        boxShadow: selectedNodeColor ? "0 0 0 1px rgba(0,0,0,0.1)" : "none",
                      }}
                    />
                  </button>
                  {colorPickerOpen && selectedNodeId ? (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        right: 0,
                        zIndex: 60,
                        padding: "10px",
                        borderRadius: "var(--radius-md)",
                        border: "var(--border-width) solid var(--border)",
                        background: "var(--surface-2)",
                        boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
                        display: "grid",
                        gap: "8px",
                        minWidth: 180,
                      }}
                    >
                      <input
                        type="color"
                        value={isValidHexColor(colorDraft) ? colorDraft : "#64748b"}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          setColorDraft(nextValue);
                          applySelectedNodeColor(nextValue);
                        }}
                        style={{
                          width: "100%",
                          height: 36,
                          padding: 0,
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                        }}
                      />
                      <input
                        type="text"
                        value={colorDraft}
                        onChange={(e) => setColorDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          if (isValidHexColor(colorDraft)) {
                            applySelectedNodeColor(colorDraft);
                          } else {
                            setColorDraft(selectedNodeColor ?? "#64748b");
                          }
                        }}
                        onBlur={() => {
                          if (isValidHexColor(colorDraft)) {
                            applySelectedNodeColor(colorDraft);
                          } else {
                            setColorDraft(selectedNodeColor ?? "#64748b");
                          }
                        }}
                        placeholder="#64748b"
                        aria-label="Node color hex"
                        style={{
                          width: "100%",
                          borderRadius: "var(--radius-md)",
                          border: "var(--border-width) solid var(--border)",
                          padding: "6px 8px",
                          background: "var(--surface-1)",
                          color: "var(--text)",
                          fontFamily: "var(--font-family)",
                          fontSize: "0.8rem",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          applySelectedNodeColor(null);
                          setColorDraft("#64748b");
                        }}
                        style={{
                          borderRadius: "999px",
                          border: "var(--border-width) solid var(--border)",
                          background: "var(--surface-1)",
                          color: "var(--text)",
                          padding: "4px 10px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
            <button
              type="button"
              onClick={() =>
                updateSettings({
                  interaction: {
                    ...settings.interaction,
                    lockNodePositions: !settings.interaction.lockNodePositions,
                  },
                })
              }
              aria-label={
                settings.interaction.lockNodePositions
                  ? uiText.tooltips.unlockNodePositions
                  : uiText.tooltips.lockNodePositions
              }
              aria-pressed={settings.interaction.lockNodePositions}
              title={
                settings.interaction.lockNodePositions
                  ? uiText.tooltips.unlockNodePositions
                  : uiText.tooltips.lockNodePositions
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: "var(--control-size-sm)",
                width: "var(--control-size-sm)",
                borderRadius: "var(--radius-md)",
                border: "none",
                background: settings.interaction.lockNodePositions
                  ? "var(--surface-1)"
                  : "transparent",
                color: "var(--text)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "var(--surface-1)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  settings.interaction.lockNodePositions
                    ? "var(--surface-1)"
                    : "transparent";
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M7 10V7C7 4.7909 8.7909 3 11 3C13.2091 3 15 4.7909 15 7V10M6 10H16C17.1046 10 18 10.8954 18 12V19C18 20.1046 17.1046 21 16 21H6C4.8954 21 4 20.1046 4 19V12C4 10.8954 4.8954 10 6 10ZM11 14A1 1 0 1 1 11.001 14ZM11 15.5V17"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={showAllNodesInCanvas}
              aria-label="Show all nodes"
              title="Show all nodes"
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
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" />
                <rect
                  x="7"
                  y="7"
                  width="6"
                  height="6"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
                <line
                  x1="14.5"
                  y1="14.5"
                  x2="20"
                  y2="20"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setShowDetailsActive((prev) => !prev)}
              aria-label="Show Details"
              aria-pressed={showDetailsActive}
              title="Show Details"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: "var(--control-size-sm)",
                width: "var(--control-size-sm)",
                borderRadius: "var(--radius-md)",
                border: "none",
                background: showDetailsActive ? "var(--surface-1)" : "transparent",
                color: "var(--text)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "var(--surface-1)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  showDetailsActive ? "var(--surface-1)" : "transparent";
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 400 320"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M 64 40 H 336 A 24 24 0 0 1 360 64 V 216 A 24 24 0 0 1 336 240 H 176 L 128 288 V 240 H 64 A 24 24 0 0 1 40 216 V 64 A 24 24 0 0 1 64 40 Z"
                  stroke="currentColor"
                  strokeWidth="16"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={toggleCanvasMenu}
              aria-label="Canvas menu"
              title="Canvas menu"
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
              <FiMenu
                style={{ fontSize: "var(--icon-size-md)" }}
                aria-hidden="true"
              />
            </button>
          </div>
        </header>

        {canvasMenu.open && (
          <div
            data-pm-context-menu="canvas"
            role="menu"
            aria-label="Canvas menu"
            style={{
              position: "absolute",
              top: "var(--panel-header-height)",
              right: "var(--panel-header-padding-x)",
              zIndex: 50,
              minWidth: 200,
              width: 100,
              maxWidth: 100,
              borderRadius: "var(--radius-md)",
              border: "var(--border-width) solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--text)",
              boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
              padding: "6px",
            }}
          >
            <div
              style={{
                padding: "8px 10px",
                fontSize: "0.85em",
                opacity: 0.85,
                whiteSpace: "normal",
                overflowWrap: "anywhere",
              }}
            >
              View: Details
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => setEdgeStyleMenuOpen((prev) => !prev)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                fontFamily: "var(--font-family)",
                whiteSpace: "normal",
                overflowWrap: "anywhere",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--space-2)",
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
              <span>{uiText.settings.appearance.edgeTypeLabel}</span>
              <span aria-hidden="true">{edgeStyleMenuOpen ? "−" : "+"}</span>
            </button>
            {edgeStyleMenuOpen && (
              <div
                style={{
                  margin: "4px 8px 8px",
                  padding: "8px",
                  borderRadius: "var(--radius-md)",
                  border: "var(--border-width) solid var(--border)",
                  background: "var(--surface-1)",
                  display: "grid",
                  gap: "6px",
                }}
              >
                {edgeStyleOptions.map((option) => (
                  <label
                    key={option.value}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "0.85em",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name={`edge-style-${activeTab?.id ?? "active"}`}
                      value={option.value}
                      checked={edgeStyle === option.value}
                      onChange={() => {
                        setEdgeStyle(option.value);
                      }}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeCanvasMenu();
                showAllNodesInCanvas();
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                fontFamily: "var(--font-family)",
                whiteSpace: "normal",
                overflowWrap: "anywhere",
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
              {uiText.canvas.viewMenu.showAllNodes}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeCanvasMenu();
                applyGridViewLayout();
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                fontFamily: "var(--font-family)",
                whiteSpace: "normal",
                overflowWrap: "anywhere",
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
              {uiText.canvas.viewMenu.gridView}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeCanvasMenu();
                setHasCustomLayout(false);
                if (rootFolderJson) {
                  const cleared: RootFolderJson = {
                    ...rootFolderJson,
                    node_positions: {},
                  };
                  updateRootFolderJson(cleared);
                  setPendingNodePositions({});
                  setLayoutSaveStatus("saving");
                }
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                fontFamily: "var(--font-family)",
                whiteSpace: "normal",
                overflowWrap: "anywhere",
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
              {uiText.canvas.viewMenu.resetLayout}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeCanvasMenu();
                if (!rootFolderJson) return;
                const cleared: RootFolderJson = {
                  ...rootFolderJson,
                  node_size: {},
                };
                updateRootFolderJson(cleared);
                const nextNodes = (nodes ?? []).map((node) => {
                  if (!node?.data) return node;
                  const nextData = { ...(node.data ?? {}) };
                  delete (nextData as any).node_size;
                  return { ...node, data: nextData };
                });
                setNodes(nextNodes);
                void (async () => {
                  try {
                    if (rootDirectoryHandle) {
                      await fileManager.writeRootFolderJson(
                        rootDirectoryHandle,
                        cleared
                      );
                    } else if (rootFolderJson.path) {
                      await fileManager.writeRootFolderJsonFromPath(
                        rootFolderJson.path,
                        cleared
                      );
                    }
                  } catch (err) {
                    console.error("[MindMap] Reset node sizes failed:", err);
                  }
                })();
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                fontFamily: "var(--font-family)",
                whiteSpace: "normal",
                overflowWrap: "anywhere",
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
              {uiText.canvas.viewMenu.resetNodeSizes}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setNodesCollapsed(!areNodesCollapsed);
                closeCanvasMenu();
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                fontFamily: "var(--font-family)",
                whiteSpace: "normal",
                overflowWrap: "anywhere",
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
              {areNodesCollapsed
                ? uiText.canvas.viewMenu.expandAllNodes
                : uiText.canvas.viewMenu.collapseAllNodes}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const rect = canvasBodyRef.current?.getBoundingClientRect();
                const panelWidth = 280;
                const panelHeight = 220;
                const x = rect ? rect.width / 2 - panelWidth / 2 : 40;
                const y = rect ? rect.height / 2 - panelHeight / 2 : 120;
                setSpacingPanel({ open: true, x, y });
                closeCanvasMenu();
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
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
              Adjust node spacing
            </button>
          </div>
        )}

        <div
          className="pm-canvas__body"
          ref={canvasBodyRef}
          style={{
            cursor: showDetailsActive
              ? isPanning
                ? "grabbing"
                : "zoom-in"
              : undefined,
          }}
          tabIndex={0}
          onMouseDown={onCanvasMouseDown}
          onMouseUp={onCanvasMouseUp}
          onMouseMove={(event) => {
            lastMousePositionRef.current = {
              x: event.clientX,
              y: event.clientY,
            };
          }}
        >
          {spacingPanel.open && (
            <div
              ref={spacingPanelRef}
              data-pm-context-menu="spacing"
              role="dialog"
              aria-label="Node spacing controls"
              style={{
                position: "absolute",
                left: spacingPanel.x,
                top: spacingPanel.y,
                zIndex: 60,
                minWidth: 260,
                maxWidth: 320,
                borderRadius: "var(--radius-md)",
                border: "var(--border-width) solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--text)",
                boxShadow: "0 12px 28px rgba(0,0,0,0.3)",
                overflow: "hidden",
              }}
            >
              <div
                role="button"
                aria-label="Drag node spacing panel"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const rect = spacingPanelRef.current?.getBoundingClientRect();
                  spacingDragRef.current.active = true;
                  spacingDragRef.current.offsetX = rect
                    ? e.clientX - rect.left
                    : 0;
                  spacingDragRef.current.offsetY = rect
                    ? e.clientY - rect.top
                    : 0;
                  setIsSpacingDragging(true);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  fontWeight: 600,
                  cursor: isSpacingDragging ? "grabbing" : "grab",
                  background: "var(--surface-1)",
                  borderBottom: "var(--border-width) solid var(--border)",
                }}
              >
                <span>Horizontal spacing</span>
                <button
                  type="button"
                  onClick={closeSpacingPanel}
                  aria-label="Close spacing panel"
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "inherit",
                    cursor: "pointer",
                    fontSize: "1.05rem",
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{ padding: "10px 12px" }}>
                {displayLevels === 0 && (
                  <div style={{ fontSize: "0.85rem", opacity: 0.75 }}>
                    No child levels to adjust.
                  </div>
                )}
                {Array.from({ length: displayLevels }).map((_, idx) => {
                  const level = idx + 1;
                  const value = getLevelGapValue(level);
                  return (
                    <div
                      key={`level-gap-${level}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        padding: "6px 0",
                      }}
                    >
                      <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                        Level {level}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setLevelGapValue(level, value - 5)}
                          aria-label={`Decrease level ${level} spacing`}
                          style={{
                            height: 26,
                            width: 26,
                            borderRadius: "var(--radius-sm)",
                            border: "var(--border-width) solid var(--border)",
                            background: "transparent",
                            color: "inherit",
                            cursor: "pointer",
                          }}
                        >
                          −
                        </button>
                        <div
                          style={{
                            minWidth: 44,
                            textAlign: "center",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {value}px
                        </div>
                        <button
                          type="button"
                          onClick={() => setLevelGapValue(level, value + 5)}
                          aria-label={`Increase level ${level} spacing`}
                          style={{
                            height: 26,
                            width: 26,
                            borderRadius: "var(--radius-sm)",
                            border: "var(--border-width) solid var(--border)",
                            background: "transparent",
                            color: "inherit",
                            cursor: "pointer",
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
                {displayLevels > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: "0.75rem",
                      opacity: 0.7,
                    }}
                  >
                    Leaf levels stay at 30px minimum to avoid overlap.
                  </div>
                )}
              </div>
            </div>
          )}
          {nodeGroups.length > 0 &&
            nodeGroups.map((group) => {
              const bounds = getGroupBounds(group);
              if (!bounds) return null;
              const left = bounds.x * viewport.zoom + viewport.x;
              const top = bounds.y * viewport.zoom + viewport.y;
              return (
                <Fragment key={group.id}>
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left,
                      top,
                      width: bounds.width,
                      height: bounds.height,
                      transform: `scale(${viewport.zoom})`,
                      transformOrigin: "top left",
                      pointerEvents: "none",
                      zIndex: 30,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        border: "1px solid rgba(255, 255, 255, 0.25)",
                        borderRadius: "18px",
                        background: "transparent",
                        boxShadow:
                          "inset 0 0 14px rgba(64, 200, 255, 0.5), 0 6px 18px rgba(0,0,0,0.18)",
                      }}
                    />
                  </div>
                  <div
                    onMouseDown={(event) => onGroupMouseDown(event, group.id)}
                    style={{
                      position: "absolute",
                      left,
                      top,
                      height: bounds.headerHeight,
                      width: bounds.width,
                      transform: `scale(${viewport.zoom})`,
                      transformOrigin: "top left",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0 10px",
                      boxSizing: "border-box",
                      background: "rgba(0,0,0,0.2)",
                      color: "var(--text)",
                      borderTopLeftRadius: "18px",
                      borderTopRightRadius: "18px",
                      cursor: "grab",
                      pointerEvents: "auto",
                      zIndex: 31,
                    }}
                  >
                    <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                      {group.name?.trim() ? group.name : uiText.grouping.groupedNodes}
                    </span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <button
                        type="button"
                        aria-label={uiText.tooltips.groupScaleDown}
                        title={uiText.tooltips.groupScaleDown}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          scaleGroupNodes(group.id, "down");
                        }}
                        disabled={(group.scale ?? 1) <= 0.5}
                        style={{
                          height: 20,
                          width: 20,
                          borderRadius: "var(--radius-sm)",
                          border: "none",
                          background: "transparent",
                          color: "inherit",
                          cursor:
                            (group.scale ?? 1) <= 0.5 ? "not-allowed" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.95rem",
                          lineHeight: 1,
                          opacity: (group.scale ?? 1) <= 0.5 ? 0.5 : 1,
                        }}
                        onMouseEnter={(e) => {
                          if ((group.scale ?? 1) <= 0.5) return;
                          (e.currentTarget as HTMLButtonElement).style.background =
                            "rgba(255,255,255,0.12)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background =
                            "transparent";
                        }}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        aria-label={uiText.tooltips.groupScaleUp}
                        title={uiText.tooltips.groupScaleUp}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          scaleGroupNodes(group.id, "up");
                        }}
                        disabled={(group.scale ?? 1) >= 2}
                        style={{
                          height: 20,
                          width: 20,
                          borderRadius: "var(--radius-sm)",
                          border: "none",
                          background: "transparent",
                          color: "inherit",
                          cursor:
                            (group.scale ?? 1) >= 2 ? "not-allowed" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.95rem",
                          lineHeight: 1,
                          opacity: (group.scale ?? 1) >= 2 ? 0.5 : 1,
                        }}
                        onMouseEnter={(e) => {
                          if ((group.scale ?? 1) >= 2) return;
                          (e.currentTarget as HTMLButtonElement).style.background =
                            "rgba(255,255,255,0.12)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background =
                            "transparent";
                        }}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        aria-label={uiText.tooltips.ungroupNodes}
                        title={uiText.tooltips.ungroupNodes}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          removeGroup(group.id);
                        }}
                        style={{
                          height: 20,
                          width: 20,
                          borderRadius: "var(--radius-sm)",
                          border: "none",
                          background: "transparent",
                          color: "inherit",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.95rem",
                          lineHeight: 1,
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background =
                            "rgba(255,255,255,0.12)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background =
                            "transparent";
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </Fragment>
              );
            })}
          <ReactFlow
            nodes={renderedNodes}
            edges={renderedEdges}
            fitView
            nodeTypes={nodeTypes}
            maxZoom={6}
            zoomOnScroll={true}
            onConnect={onConnect}
            onEdgeClick={onEdgeClick}
            onEdgesDelete={onEdgesDelete}
            nodesDraggable={!settings.interaction.lockNodePositions}
            onWheel={(event) => {
              if (!rf) return;
              const zoom = rf.getZoom();
              const isZoomingOut = event.deltaY > 0;
              const maxZoom = 6;

              const rect = canvasBodyRef.current?.getBoundingClientRect();
              if (!rect) return;
              const viewport = rf.getViewport();
              const allVisible = areAllNodesVisible({
                nodes,
                viewport,
                canvasRect: rect,
              });
              const padding = isTauri() ? 0 : 0.05;
              const fitViewport = getFitViewport({
                nodes,
                canvasRect: rect,
                maxZoom,
                padding,
              });
              const minFitZoom = fitViewport.zoom;

              if (
                shouldBlockZoomOut({
                  nodes,
                  viewport,
                  canvasRect: rect,
                  minFitZoom,
                  isZoomingOut,
                })
              ) {
                // Snap only if not already exactly at fit.
                if (
                  isZoomingOut &&
                  !allVisible &&
                  Math.abs(viewport.zoom - minFitZoom) > 0.0001
                ) {
                  rf.setViewport(fitViewport);
                }
                return;
              }

              const delta = isZoomingOut ? 0.8 : 1.2;
              const clampedZoom = Math.max(
                minFitZoom,
                Math.min(maxZoom, zoom * delta)
              );
              rf.zoomTo(clampedZoom);
              event.preventDefault();
            }}
            onInit={setRf}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onPaneContextMenu={onPaneContextMenu}
            onMove={onViewportMove}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeContextMenu={onNodeContextMenu}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseMove={onNodeMouseMove}
            onNodeMouseLeave={onNodeMouseLeave}
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
          />

          {showDetailsActive && detailsPreview && (
            <div
              role="presentation"
              aria-hidden="true"
              style={{
                position: "absolute",
                left: detailsPreview.x + 18,
                top: detailsPreview.y + 18,
                zIndex: 55,
                minWidth: 220,
                maxWidth: 280,
                padding: "12px 14px",
                borderRadius: "var(--radius-md)",
                border: "var(--border-width) solid var(--border)",
                background: getNodeFillColor(
                  settings,
                  typeof (detailsPreview.node.data as any)?.level === "number"
                    ? (detailsPreview.node.data as any).level
                    : 0,
                  "var(--surface-2)"
                ),
                color: "var(--text)",
                boxShadow: "0 12px 28px rgba(0,0,0,0.35)",
                pointerEvents: "none",
                transform: "scale(1.05)",
                transformOrigin: "top left",
              }}
            >
              <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>
                {detailsPreview.node.type === "rootFolder" ? "Folder" : "File"}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  wordBreak: "break-word",
                }}
              >
                {(detailsPreview.node.data as any)?.name ?? ""}
              </div>
              {(detailsPreview.node.data as any)?.purpose && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: "0.85rem",
                    lineHeight: 1.35,
                    opacity: 0.9,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {(detailsPreview.node.data as any)?.purpose}
                </div>
              )}
            </div>
          )}
          {(layoutSaveStatus !== "idle" && layoutStatusMessage) ||
          (canvasSaveStatus !== "idle" && canvasStatusMessage) ? (
            <div
              aria-live="polite"
              style={{
                position: "absolute",
                right: "var(--space-3)",
                bottom: "var(--space-3)",
                zIndex: 50,
                padding: "6px 10px",
                borderRadius: "var(--radius-md)",
                border: "var(--border-width) solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--text)",
                fontSize: "0.8rem",
                boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
                pointerEvents: "none",
              }}
            >
              {layoutStatusMessage || canvasStatusMessage}
            </div>
          ) : null}

          {paneMenu.open && (
            <div
              data-pm-context-menu="pane"
              role="menu"
              aria-label={uiText.ariaLabels.contextMenu}
              style={{
                position: "absolute",
                left: paneMenu.x,
                top: paneMenu.y,
                zIndex: 50,
                minWidth: 180,
                width: 90,
                maxWidth: 90,
                borderRadius: "var(--radius-md)",
                border: "var(--border-width) solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--text)",
                boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
                padding: "6px",
              }}
            >
              {/* Node Selector */}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setRightPanelMode("nodeSelector");
                  closePaneMenu();
                  // TODO: Implement Node Selector logic.
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: "transparent",
                  color: "inherit",
                  cursor: "pointer",
                  fontFamily: "var(--font-family)",
                  whiteSpace: "normal",
                  overflowWrap: "anywhere",
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
                {uiText.contextMenus.canvas.nodeSelector}
              </button>

              {/* Node Details */}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setRightPanelMode("nodeDetails");
                  closePaneMenu();
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: "transparent",
                  color: "inherit",
                  cursor: "pointer",
                  fontFamily: "var(--font-family)",
                  whiteSpace: "normal",
                  overflowWrap: "anywhere",
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
                {uiText.contextMenus.canvas.nodeDetails}
              </button>

              {/* New File */}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const flowPos = paneMenu.flowPos;
                  const parentNodeId = paneMenu.parentNodeId;
                  closePaneMenu();
                  if (!flowPos || !parentNodeId) return;
                  if (isCognitiveNotes) {
                    console.log("[CognitiveNotes] New File draft", {
                      parentNodeId,
                      flowPos,
                    });
                  }

                  // Create a temporary node with no name. It will not be committed (and no edge is created)
                  // until the user enters a valid name and it is saved from the Node Details panel.
                  const tempNodeId = `tmp_${Date.now()}_${Math.random()
                    .toString(16)
                    .slice(2)}`;

                  const tempNode: Node = {
                    id: tempNodeId,
                    type: "file",
                    position: flowPos,
                    style: {
                      opacity: 1,
                      transition: "opacity 180ms ease",
                    },
                    data: {
                      type: "file",
                      node_type: "file",
                      name: "",
                      purpose: "",
                      node_color:
                        isCognitiveNotes &&
                        isValidHexColor(defaultCognitiveNodeColor)
                          ? defaultCognitiveNodeColor
                          : undefined,
                      // Preserve parent context for finalize step (in-memory only).
                      parentId: parentNodeId,
                      // Marks the node as temporary until the required name is saved.
                      isDraft: true,
                      // Keep draft nodes when the graph is recomposed.
                      nonPersistent: true,
                    },
                    selected: true,
                  };

                  const existing = nodes ?? [];
                  const edgeId = `e_${parentNodeId}_${tempNodeId}`;
                  const nextEdges =
                    isCognitiveNotes
                      ? edges
                      : (edges ?? []).some((edge: any) => edge?.id === edgeId)
                      ? edges
                      : [
                          ...(edges ?? []),
                          {
                            id: edgeId,
                            source: parentNodeId,
                            target: tempNodeId,
                            type: "default",
                            style: { opacity: 1, transition: "opacity 180ms ease" },
                            data: { isDraft: true, nonPersistent: true },
                          },
                        ];
                  const next = [
                    ...existing.map((n: any) => ({
                      ...n,
                      selected: n?.id === tempNodeId,
                    })),
                    tempNode,
                  ];
                  setNodes(next);
                  setEdges(nextEdges);
                  setPendingChildCreation({ tempNodeId, parentNodeId });
                  selectNode(tempNodeId);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: "transparent",
                  color: "inherit",
                  cursor: paneMenu.parentNodeId ? "pointer" : "not-allowed",
                  fontFamily: "var(--font-family)",
                  whiteSpace: "normal",
                  overflowWrap: "anywhere",
                  opacity: paneMenu.parentNodeId ? 1 : 0.5,
                }}
                onMouseEnter={(e) => {
                  if (!paneMenu.parentNodeId) return;
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "var(--surface-1)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "transparent";
                }}
                disabled={!paneMenu.parentNodeId}
              >
                {uiText.contextMenus.canvas.newFile}
              </button>

              {/* New Image */}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const flowPos = paneMenu.flowPos;
                  const parentNodeId = paneMenu.parentNodeId;
                  closePaneMenu();
                  if (!flowPos || !parentNodeId) return;
                  const tempNodeId = `tmp_image_${Date.now()}_${Math.random()
                    .toString(16)
                    .slice(2)}`;
                  const tempNode: Node = {
                    id: tempNodeId,
                    type: "fullImageNode",
                    position: flowPos,
                    style: {
                      opacity: 1,
                      transition: "opacity 180ms ease",
                    },
                    data: {
                      type: "fullImageNode",
                      node_type: "fullImageNode",
                      name: "",
                      caption: "",
                      purpose: "",
                      node_color:
                        isCognitiveNotes &&
                        isValidHexColor(defaultCognitiveNodeColor)
                          ? defaultCognitiveNodeColor
                          : undefined,
                      parentId: parentNodeId,
                      isDraft: true,
                      nonPersistent: true,
                    },
                    selected: true,
                  };
                  const existing = nodes ?? [];
                  const edgeId = `e_${parentNodeId}_${tempNodeId}`;
                  if (isCognitiveNotes) {
                    console.log("[CognitiveNotes] New Image draft", {
                      parentNodeId,
                      flowPos,
                    });
                  }
                  const nextEdges =
                    isCognitiveNotes
                      ? edges
                      : (edges ?? []).some((edge: any) => edge?.id === edgeId)
                      ? edges
                      : [
                          ...(edges ?? []),
                          {
                            id: edgeId,
                            source: parentNodeId,
                            target: tempNodeId,
                            type: "default",
                            style: { opacity: 1, transition: "opacity 180ms ease" },
                            data: { isDraft: true, nonPersistent: true },
                          },
                        ];
                  const next = [
                    ...existing.map((n: any) => ({
                      ...n,
                      selected: n?.id === tempNodeId,
                    })),
                    tempNode,
                  ];
                  setNodes(next);
                  setEdges(nextEdges);
                  setPendingChildCreation({ tempNodeId, parentNodeId });
                  selectNode(tempNodeId);
                }}
                disabled={!paneMenu.parentNodeId}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: "transparent",
                  color: "inherit",
                  cursor: paneMenu.parentNodeId ? "pointer" : "not-allowed",
                  fontFamily: "var(--font-family)",
                  whiteSpace: "normal",
                  overflowWrap: "anywhere",
                  opacity: paneMenu.parentNodeId ? 1 : 0.5,
                }}
                onMouseEnter={(e) => {
                  if (!paneMenu.parentNodeId) return;
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "var(--surface-1)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "transparent";
                }}
              >
                {uiText.contextMenus.canvas.newPolaroidImage}
              </button>

              {/* New Decision */}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const flowPos = paneMenu.flowPos;
                  closePaneMenu();
                  if (!flowPos) return;

                  const decisionNodeId = `decision_${Date.now()}_${Math.random()
                    .toString(16)
                    .slice(2)}`;

                  const decisionNode: Node = {
                    id: decisionNodeId,
                    type: "decision",
                    position: flowPos,
                    data: {
                      type: "decision",
                      node_type: "decision",
                      name: "Decision",
                      purpose: "Describe purpose...",
                      node_color:
                        isCognitiveNotes &&
                        isValidHexColor(defaultCognitiveNodeColor)
                          ? defaultCognitiveNodeColor
                          : undefined,
                      allowNameEdit: true,
                      nonPersistent: true,
                    },
                    selected: true,
                  };

                  const existing = nodes ?? [];
                  const next = [
                    ...existing.map((n: any) => ({
                      ...n,
                      selected: n?.id === decisionNodeId,
                    })),
                    decisionNode,
                  ];
                  setNodes(next);
                  selectNode(decisionNodeId);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: "transparent",
                  color: "inherit",
                  cursor: "pointer",
                  fontFamily: "var(--font-family)",
                  whiteSpace: "normal",
                  overflowWrap: "anywhere",
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
                {decisionMenuLabel}
              </button>

              {/* New Folder (existing behavior) */}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const flowPos = paneMenu.flowPos;
                  const parentNodeId = paneMenu.parentNodeId;
                  closePaneMenu();
                  if (!flowPos || !parentNodeId) return;

                  // Create a temporary node with no name. It will not be committed (and no edge is created)
                  // until the user enters a valid name and it is saved from the Node Details panel.
                  const tempNodeId = `tmp_${Date.now()}_${Math.random()
                    .toString(16)
                    .slice(2)}`;

                  const tempNode: Node = {
                    id: tempNodeId,
                    // Reuse existing folder renderer for now.
                    type: "rootFolder",
                    position: flowPos,
                    style: {
                      opacity: 1,
                      transition: "opacity 180ms ease",
                    },
                    data: {
                      type: "folder",
                      node_type: "folder",
                      name: "",
                      header: "",
                      title: "",
                      purpose: "",
                      // Preserve parent context for finalize step (in-memory only).
                      parentId: parentNodeId,
                      // Marks the node as temporary until the required name is saved.
                      isDraft: true,
                      // Keep draft nodes when the graph is recomposed.
                      nonPersistent: true,
                    },
                    selected: true,
                  };

                  const existing = nodes ?? [];
                  const edgeId = `e_${parentNodeId}_${tempNodeId}`;
                  const nextEdges = (edges ?? []).some(
                    (edge: any) => edge?.id === edgeId
                  )
                    ? edges
                    : [
                        ...(edges ?? []),
                        {
                          id: edgeId,
                          source: parentNodeId,
                          target: tempNodeId,
                          type: "default",
                          style: { opacity: 1, transition: "opacity 180ms ease" },
                          data: { isDraft: true, nonPersistent: true },
                        },
                      ];
                  const next = [
                    ...existing.map((n: any) => ({
                      ...n,
                      selected: n?.id === tempNodeId,
                    })),
                    tempNode,
                  ];
                  setNodes(next);
                  setEdges(nextEdges);
                  setPendingChildCreation({ tempNodeId, parentNodeId });
                  selectNode(tempNodeId);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: "transparent",
                  color: "inherit",
                  cursor:
                    paneMenu.parentNodeId && !isCognitiveNotes
                      ? "pointer"
                      : "not-allowed",
                  fontFamily: "var(--font-family)",
                  whiteSpace: "normal",
                  overflowWrap: "anywhere",
                  opacity:
                    paneMenu.parentNodeId && !isCognitiveNotes
                      ? 1
                      : 0.5,
                }}
                onMouseEnter={(e) => {
                  if (!paneMenu.parentNodeId || isCognitiveNotes) return;
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "var(--surface-1)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "transparent";
                }}
                disabled={!paneMenu.parentNodeId || isCognitiveNotes}
              >
                {uiText.contextMenus.canvas.newFolder}
              </button>
            </div>
          )}

          {contextMenu.open && (
            <div
              data-pm-context-menu="node"
              role="menu"
              aria-label={uiText.ariaLabels.contextMenu}
              style={{
                position: "absolute",
                left: contextMenu.x,
                top: contextMenu.y,
                zIndex: 50,
                minWidth: 180,
                borderRadius: "var(--radius-md)",
                border: "var(--border-width) solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--text)",
                boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
                padding: "6px",
              }}
            >
              {isMultiSelect ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    createGroup(selectedNodeIds);
                    closeContextMenu();
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
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
                  {uiText.contextMenus.node.groupNodes}
                </button>
              ) : (
                <>
              {canShowSubtreeNotes(contextMenu.node) && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      const node = contextMenu.node;
                      closeContextMenu();
                      if (!node || !activeTab?.id) return;
                      window.dispatchEvent(
                        new CustomEvent("pm-open-notes-feed", {
                          detail: { tabId: activeTab.id, nodeId: node.id },
                        })
                      );
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
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
                    {uiText.contextMenus.node.showSubtreeNotes}
                  </button>
                )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const node = contextMenu.node;
                  closeContextMenu();
                  if (!node) return;
                  updateNodeData(node.id, { moveChildrenOnDrag: false });
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
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
                {uiText.contextMenus.node.moveNode}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const node = contextMenu.node;
                  closeContextMenu();
                  if (!node) return;
                  if (!hasMoveChildrenTargets(node)) return;
                  updateNodeData(node.id, { moveChildrenOnDrag: true });
                }}
                disabled={!hasMoveChildrenTargets(contextMenu.node)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: "transparent",
                  color: "inherit",
                  cursor: hasMoveChildrenTargets(contextMenu.node)
                    ? "pointer"
                    : "not-allowed",
                  fontFamily: "var(--font-family)",
                  opacity: hasMoveChildrenTargets(contextMenu.node) ? 1 : 0.5,
                }}
                onMouseEnter={(e) => {
                  if (!hasMoveChildrenTargets(contextMenu.node)) return;
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "var(--surface-1)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "transparent";
                }}
              >
                {uiText.contextMenus.node.moveWithChildren}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setShowParentPath((prev) => !prev);
                  closeContextMenu();
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
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
                {showParentPath
                  ? uiText.contextMenus.node.hideParentPath
                  : uiText.contextMenus.node.showParentPath}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setShowChildrenPath((prev) => !prev);
                  closeContextMenu();
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
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
                {showChildrenPath
                  ? uiText.contextMenus.node.hideChildren
                  : uiText.contextMenus.node.showChildren}
              </button>
              {contextMenu.node && isFolderNode(contextMenu.node) && (
                <>
                  {contextMenu.node.id !== "00" && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        const node = contextMenu.node;
                        closeContextMenu();
                        if (!node || !rootFolderJson) return;
                        if (!isFolderNode(node) || node.id === "00") return;
                        const isCollapsed =
                          (node.data as any)?.isTreeCollapsed === true;
                        const nextRoot = updateFolderNodeInRoot(
                          rootFolderJson,
                          node.id,
                          (item) => {
                            const nextNode = { ...(item as any) };
                            if (!isCollapsed) {
                              nextNode.isTreeCollapsed = true;
                            } else {
                              delete nextNode.isTreeCollapsed;
                            }
                            return nextNode as IndexNode;
                          }
                        );
                        if (nextRoot === rootFolderJson) return;
                        void persistRootFolderJson(nextRoot);
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 10px",
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
                      {(contextMenu.node.data as any)?.isTreeCollapsed === true
                        ? uiText.contextMenus.folder.openTree
                        : uiText.contextMenus.folder.closeTree}
                    </button>
                  )}
                  {isTauri() && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={async () => {
                        const node = contextMenu.node;
                        closeContextMenu();
                        if (!node) return;
                        if (!isFolderNode(node)) return;
                        const path = getNodeFolderPath(node);
                        if (!path) return;
                        try {
                          const { openPath } = await import(
                            "@tauri-apps/plugin-opener"
                          );
                          await openPath(path);
                        } catch (err) {
                          // Keep UX silent (no alerts/toasts), but log for debugging.
                          console.error(
                            "[MindMap] Context menu open failed:",
                            err
                          );
                        }
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 10px",
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
                      {uiText.contextMenus.folder.openFolder}
                    </button>
                  )}
                  {isTauri() && getNodeFolderPath(contextMenu.node) && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={async () => {
                        const node = contextMenu.node;
                        closeContextMenu();
                        if (!node) return;
                        if (!isFolderNode(node)) return;
                        const path = getNodeFolderPath(node);
                        if (!path) return;

                        const match = tabs.find(
                          (tab) => tab.rootFolderJson?.path === path
                        );
                        if (match) {
                          setActiveTab(match.id);
                          return;
                        }

                        createTab();
                        try {
                          const result =
                            await fileManager.loadOrCreateRootFolderJsonFromPath(
                              path
                            );
                          if (!result.created) {
                            // TODO: define the "existing root" flow (e.g., merge, refresh, or re-scan)
                            // when a <root>_rootIndex.json file already exists in the chosen folder.
                          }
                          setRoot(null, result.root);
                          selectNode("00");
                        } catch (err) {
                          // Keep UX silent (no alerts/toasts), but log for debugging.
                          console.error(
                            "[MindMap] Open in new tab failed:",
                            err
                          );
                        }
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 10px",
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
                      {uiText.contextMenus.folder.openInNewTab}
                    </button>
                  )}
                </>
              )}
              {contextMenu.node &&
                !isFolderNode(contextMenu.node) &&
                isTauri() && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={async () => {
                      const node = contextMenu.node;
                      closeContextMenu();
                      if (!node) return;
                      if (isFolderNode(node)) return;
                      const path = (node?.data as any)?.path;
                      if (typeof path !== "string" || !path) return;
                      try {
                        const { openPath } = await import(
                          "@tauri-apps/plugin-opener"
                        );
                        await openPath(path);
                      } catch (err) {
                        console.error(
                          "[MindMap] Context menu open file failed:",
                          err
                        );
                      }
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
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
                    {uiText.contextMenus.file.openFile}
                  </button>
                )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
