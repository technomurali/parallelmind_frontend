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

import { useEffect, useMemo, useRef, useState } from "react";
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
import DecisionNode from "./DecisionNode";
import ImageNode from "./ImageNode";
import FullImageNode from "./FullImageNode";

const NODE_TYPES = {
  rootFolder: RootFolderNode,
  file: FileNode,
  decision: DecisionNode,
  polaroidImage: ImageNode,
  fullImageNode: FullImageNode,
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
  const tabs = useMindMapStore((s) => s.tabs);
  const createTab = useMindMapStore((s) => s.createTab);
  const setActiveTab = useMindMapStore((s) => s.setActiveTab);
  const setRoot = useMindMapStore((s) => s.setRoot);
  const updateRootFolderJson = useMindMapStore((s) => s.updateRootFolderJson);
  const setHasCustomLayout = useMindMapStore((s) => s.setHasCustomLayout);
  const hasCustomLayout = activeTab?.hasCustomLayout ?? false;
  const shouldFitView = activeTab?.shouldFitView ?? false;
  const setShouldFitView = useMindMapStore((s) => s.setShouldFitView);
  const setRightPanelMode = useMindMapStore((s) => s.setRightPanelMode);
  const rootDirectoryHandle = activeTab?.rootDirectoryHandle ?? null;
  const selectedNodeId = activeTab?.selectedNodeId ?? null;
  const areNodesCollapsed = activeTab?.areNodesCollapsed ?? false;
  const setNodesCollapsed = useMindMapStore((s) => s.setNodesCollapsed);
  const setPendingChildCreation = useMindMapStore(
    (s) => s.setPendingChildCreation
  );
  const discardPendingChildCreationIfSelected = useMindMapStore(
    (s) => s.discardPendingChildCreationIfSelected
  );

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
  const lastFitRootIdRef = useRef<string | null>(null);
  const [rf, setRf] = useState<ReactFlowInstance | null>(null);
  const fileManager = useMemo(() => new FileManager(), []);
  const cognitiveNotesManager = useMemo(() => new CognitiveNotesManager(), []);
  const [layoutSaveStatus, setLayoutSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [cognitiveNotesDirty, setCognitiveNotesDirty] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [colorDraft, setColorDraft] = useState("#64748b");
  const canvasSaveStatus = activeTab?.canvasSaveStatus ?? "idle";
  const [showParentPath, setShowParentPath] = useState(false);
  const [showChildrenPath, setShowChildrenPath] = useState(false);
  const [pendingNodePositions, setPendingNodePositions] = useState<
    Record<string, { x: number; y: number }> | null
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
    const allowedHandlesByType: Record<
      string,
      { source: Set<string>; target: Set<string> }
    > = {
      file: {
        source: new Set(["source-left", "source-right", "source-bottom"]),
        target: new Set(["target-left", "target-right", "target-top", "target-bottom"]),
      },
      fullImageNode: {
        source: new Set(["source-left", "source-right", "source-bottom"]),
        target: new Set(["target-left", "target-right", "target-top", "target-bottom"]),
      },
      rootFolder: {
        source: new Set(["source-bottom"]),
        target: new Set(["target-top"]),
      },
    };
    const normalizeHandle = (
      handle: unknown,
      nodeType: string | undefined,
      kind: "source" | "target"
    ) => {
      if (typeof handle === "string" && handle.trim()) {
        const allowed = nodeType ? allowedHandlesByType[nodeType]?.[kind] : null;
        if (!allowed || allowed.has(handle)) return handle;
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

    const nextRoot = {
      ...cognitiveNotesRoot,
      updated_on: new Date().toISOString(),
      node_positions: nextPositions,
      node_colors: nextColors,
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
  const nodeTypes = NODE_TYPES;
  const selectedNode = useMemo(
    () => (nodes ?? []).find((node: any) => node?.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );
  const isValidHexColor = (value: string) =>
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
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
    const edgeType = settings.appearance.edgeStyle || "default";
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
    settings.appearance.edgeStyle,
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

  const toggleCanvasMenu = () => setCanvasMenu((s) => ({ open: !s.open }));

  const closeCanvasMenu = () => setCanvasMenu({ open: false });

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
          if (!isFolderNode(moved) || moved.id === "00") return;
          const moveChildrenOnDrag =
            (moved.data as any)?.moveChildrenOnDrag !== false;
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
      updateCognitiveNotesRoot({
        ...cognitiveNotesRoot,
        node_positions: nextPositions,
      });
    }
    setNodes(adjustedNodes);
  };

  const onEdgesChange = (changes: EdgeChange[]) => {
    setEdges(applyEdgeChanges(changes, edges));
    if (isCognitiveNotes && changes.length) {
      setCognitiveNotesDirty(true);
    }
  };

  const onConnect = (connection: Connection) => {
    if (!isCognitiveNotes) return;
    if (!connection.source || !connection.target) return;
    if (connection.source === connection.target) return;
    setCognitiveNotesDirty(true);
    const edgeId = `e_${connection.source}_${connection.target}_${Date.now()}`;
    setEdges(
      addEdge(
        {
          ...connection,
          id: edgeId,
          type: "default",
          data: { purpose: "" },
        },
        edges
      )
    );
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
    selectNode(null);
    selectEdge(edge.id);
  };

  /**
   * Keep selected node id in the global store so the right panel can show details.
   */
  const onNodeClick = (_: unknown, node: Node) => {
    selectEdge(null);
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
    selectNode(null);
  };

  const onEdgesDelete = (deleted: Edge[]) => {
    if (!deleted.length) return;
    if (isCognitiveNotes) {
      setCognitiveNotesDirty(true);
    }
    const deletedIds = new Set(deleted.map((edge) => edge.id));
    setEdges((edges ?? []).filter((edge: any) => !deletedIds.has(edge?.id)));
    selectEdge(null);
    if (isCognitiveNotes && cognitiveNotesRoot) {
      const nextChild = (cognitiveNotesRoot.child ?? []).map((node: any) => ({
        ...node,
        related_nodes: Array.isArray(node.related_nodes)
          ? node.related_nodes.filter((rel: any) => !deletedIds.has(rel?.edge_id))
          : [],
      }));
      useMindMapStore.getState().updateCognitiveNotesRoot({
        ...cognitiveNotesRoot,
        child: nextChild,
      });
    }
  };

  const isDetailsPreviewNode = (node: Node | null): boolean =>
    !!node && (node.type === "rootFolder" || node.type === "file");

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

  const onNodeDragStart = () => {
    if (!showDetailsActive) return;
    setIsNodeDragging(true);
    setDetailsPreview(null);
  };

  const onNodeDragStop = () => {
    setIsNodeDragging(false);
  };

  const onCanvasMouseDown = (event: any) => {
    canvasBodyRef.current?.focus();
    if (!showDetailsActive) return;
    const target = event.target as HTMLElement | null;
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
    if (node.id !== selectedNodeId) return;

    const container = canvasBodyRef.current?.getBoundingClientRect();
    const x = container ? e.clientX - container.left : e.clientX;
    const y = container ? e.clientY - container.top : e.clientY;
    setContextMenu({ open: true, x, y, node });
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
    const withSelection = composedNodes.map((node) => {
      const preserved =
        storedPositions.get(node.id) ?? existingPositions.get(node.id);
      const sizeValue = sizeMap[node.id];
      const existingNode = existing.find((n: any) => n?.id === node.id);
      const existingData = existingNode?.data ?? {};
      
      // Runtime fields that should be preserved from existing node data
      // These are not stored in RootFolderJson and should persist across recompositions
      const runtimeFields: Record<string, unknown> = {};
      // Preserve imageSrc only if it's a data URL or http/https URL (not blob URLs which can become invalid)
      // Blob URLs should be regenerated from path by ImageNode's resolution logic
      if (typeof existingData.imageSrc === "string") {
        const imageSrc = existingData.imageSrc;
        if (imageSrc.startsWith("data:") || imageSrc.startsWith("http://") || imageSrc.startsWith("https://")) {
          runtimeFields.imageSrc = imageSrc;
        }
        // For blob URLs, don't preserve - let ImageNode resolve from path
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
      
      // Merge: newly composed data (from RootFolderJson) + preserved runtime fields + node_size
      // Order matters: RootFolderJson data first (includes updated purpose, path), then runtime fields override
      const mergedData = {
        ...(node.data ?? {}),
        ...runtimeFields,
        ...(typeof sizeValue === "number" && Number.isFinite(sizeValue)
          ? { node_size: sizeValue }
          : {}),
      };
      
      // Preserve style properties (width, height) from existing node if they exist
      const preservedStyle = existingNode?.style
        ? { ...(node.style ?? {}), ...existingNode.style }
        : node.style;
      
      return {
        ...node,
        position: preserved ?? node.position,
        style: preservedStyle,
        data: mergedData,
        selected: node.id === selectedNodeId,
      };
    });

    const existingCustomNodes = existing.filter(
      (node: any) => !!(node?.data as any)?.nonPersistent
    );
    const customNodes = existingCustomNodes.map((node: any) => ({
      ...node,
      selected: node.id === selectedNodeId,
    }));
    const mergedNodes = [
      ...withSelection,
      ...customNodes.filter(
        (node: any) => !withSelection.some((n) => n.id === node.id)
      ),
    ];

    setNodes(mergedNodes);
    const existingEdges = selectActiveTab(useMindMapStore.getState())?.edges ?? [];
    const customEdges = (existingEdges ?? []).filter(
      (edge: any) => !!(edge?.data as any)?.nonPersistent
    );
    const composedIds = new Set((composedEdges ?? []).map((edge) => edge.id));
    const mergedEdges = [
      ...composedEdges,
      ...customEdges.filter((edge: any) => !composedIds.has(edge.id)),
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

    lastFocusedNodeIdRef.current = selectedNodeId;
  }, [nodes, rf, selectedNodeId, settings.appearance.nodeSize]);

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
                        if (!node) return;
                        if (!isFolderNode(node) || node.id === "00") return;
                        const current =
                          (node.data as any)?.moveChildrenOnDrag !== false;
                        updateNodeData(node.id, {
                          moveChildrenOnDrag: !current,
                        });
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
                      {(contextMenu.node.data as any)?.moveChildrenOnDrag ===
                      false
                        ? uiText.contextMenus.folder.moveFolderTree
                        : uiText.contextMenus.folder.moveOnlyFolder}
                    </button>
                  )}
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
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
