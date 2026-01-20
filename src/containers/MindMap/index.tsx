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
  applyEdgeChanges,
  applyNodeChanges,
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
  const spacingDragRef = useRef<{
    active: boolean;
    offsetX: number;
    offsetY: number;
  }>({ active: false, offsetX: 0, offsetY: 0 });
  const lastFitRootIdRef = useRef<string | null>(null);
  const [rf, setRf] = useState<ReactFlowInstance | null>(null);
  const fileManager = useMemo(() => new FileManager(), []);
  const [layoutSaveStatus, setLayoutSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
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
  const nodeTypes = useMemo(
    () => ({
      rootFolder: RootFolderNode,
      file: FileNode,
      decision: DecisionNode,
      polaroidImage: ImageNode,
    }),
    []
  );
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

  const renderedEdges = useMemo(() => {
    const edgeType = settings.appearance.edgeStyle || "default";
    const edgeOpacity =
      typeof settings.appearance.edgeOpacity === "number"
        ? settings.appearance.edgeOpacity
        : 0.85;
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
    parentPath.edgeIds,
    childrenPath.edgeIds,
    settings.appearance.edgeStyle,
    settings.appearance.edgeOpacity,
  ]);

  const FILE_NODE_BASE_WIDTH = 125;
  const DEFAULT_IMAGE_WIDTH_RATIO = 0.8;

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

  const renderedNodes = useMemo(() => {
    if (!nodes?.length) return nodes;
    return nodes.map((node: any) => {
      const highlight =
        parentPath.nodeIds.has(node?.id) || childrenPath.nodeIds.has(node?.id);
      const highlightStyle = highlight
        ? {
            boxShadow: "0 0 12px rgba(57, 255, 235, 0.9)",
            borderColor: "rgba(57, 255, 235, 0.9)",
          }
        : null;

      if (node?.type !== "polaroidImage") {
        return {
          ...node,
          style: highlightStyle
            ? { ...(node.style ?? {}), ...highlightStyle }
            : node.style,
        };
      }
      const imageWidth =
        typeof node?.data?.imageWidth === "number" ? node.data.imageWidth : 0;
      const imageHeight =
        typeof node?.data?.imageHeight === "number" ? node.data.imageHeight : 0;
      const { nodeWidth, nodeHeight } =
        imageWidth > 0 && imageHeight > 0
          ? getPolaroidDimensions(imageWidth, imageHeight)
          : { nodeWidth: undefined, nodeHeight: undefined };
      const sizeStyle =
        typeof nodeWidth === "number" && typeof nodeHeight === "number"
          ? { ...(node.style ?? {}), width: nodeWidth, height: nodeHeight }
          : node.style;
      return {
        ...node,
        type: "polaroidImage",
        data: {
          ...(node.data ?? {}),
          type: "polaroidImage",
          node_type: "polaroidImage",
        },
        style: highlightStyle ? { ...(sizeStyle ?? {}), ...highlightStyle } : sizeStyle,
      };
    });
  }, [nodes, parentPath.nodeIds, childrenPath.nodeIds]);

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

  useEffect(() => {
    if (!rootFolderJson || !rf) {
      lastFitRootIdRef.current = null;
      return;
    }
    if (!nodes.length) return;

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
    if (hasPositionChange && rootFolderJson) {
      const nextPositions = {
        ...(rootFolderJson.node_positions ?? {}),
      } as Record<string, { x: number; y: number }>;
      changes
        .filter((change) => change.type === "position")
        .forEach((change) => {
          const moved = nextNodes.find((node) => node.id === change.id);
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
    setNodes(nextNodes);
  };

  const onEdgesChange = (changes: EdgeChange[]) => {
    setEdges(applyEdgeChanges(changes, edges));
  };

  /**
   * Keep selected node id in the global store so the right panel can show details.
   */
  const onNodeClick = (_: unknown, node: Node) => {
    selectNode(node.id);
  };

  /**
   * Clear selection when clicking on empty canvas (pane).
   */
  const onPaneClick = () => {
    // If the user was in the middle of creating a child and clicks away before
    // naming/saving, discard the temporary node (reversible-before-save behavior).
    discardPendingChildCreationIfSelected();
    selectNode(null);
  };

  const isDetailsPreviewNode = (node: Node | null): boolean =>
    !!node && (node.type === "rootFolder" || node.type === "file");

  const getPreviewPosition = (clientX: number, clientY: number) => {
    const rect = canvasBodyRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const onNodeMouseEnter = (event: any, node: Node) => {
    if (!showDetailsActive || !isDetailsPreviewNode(node)) return;
    const pos = getPreviewPosition(event.clientX, event.clientY);
    setDetailsPreview({ node, ...pos });
  };

  const onNodeMouseMove = (event: any, node: Node) => {
    if (!showDetailsActive || !isDetailsPreviewNode(node)) return;
    const pos = getPreviewPosition(event.clientX, event.clientY);
    setDetailsPreview({ node, ...pos });
  };

  const onNodeMouseLeave = () => {
    if (!showDetailsActive) return;
    setDetailsPreview(null);
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
      selectedNode && isFolderNode(selectedNode) ? selectedNode.id : null;
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

      // Check if a folder is selected to be the parent, OR if a draft image node is selected (update it)
      const selectedNode = selectedNodeId
        ? (nodes ?? []).find((n: any) => n?.id === selectedNodeId)
        : null;
      const isDraftImage =
        selectedNode &&
        ((selectedNode?.data as any)?.isDraft === true &&
          ((selectedNode?.data as any)?.node_type === "polaroidImage" ||
            (selectedNode?.data as any)?.type === "polaroidImage" ||
            selectedNode?.type === "polaroidImage"));
      
      if (isDraftImage) {
        // Update the selected draft image node with the pasted image
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          const { nodeWidth, nodeHeight } = getPolaroidDimensions(
            img.naturalWidth,
            img.naturalHeight
          );
          const currentNodes = nodes ?? [];
          const updatedNodes = currentNodes.map((n: any) => {
            if (n?.id !== selectedNodeId) return n;
            return {
              ...n,
              data: {
                ...(n.data ?? {}),
                imageSrc: url,
                imageWidth: img.naturalWidth,
                imageHeight: img.naturalHeight,
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
        const { nodeWidth, nodeHeight } = getPolaroidDimensions(
          img.naturalWidth,
          img.naturalHeight
        );
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
          type: "polaroidImage",
          position: flowPos,
          style: {
            opacity: 1,
            transition: "opacity 180ms ease",
            width: nodeWidth,
            height: nodeHeight,
          },
          data: {
            type: "polaroidImage",
            node_type: "polaroidImage",
            name: "",
            caption: "",
            purpose: "",
            imageSrc: url,
            imageWidth: img.naturalWidth,
            imageHeight: img.naturalHeight,
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
    if (hasCustomLayout && existingRoot?.position) {
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
          {layoutSaveStatus !== "idle" && layoutStatusMessage && (
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
              {layoutStatusMessage}
            </div>
          )}

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
              {/* New File */}
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

              {/* New Polaroid Image */}
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
                    type: "polaroidImage",
                    position: flowPos,
                    style: {
                      opacity: 1,
                      transition: "opacity 180ms ease",
                    },
                    data: {
                      type: "polaroidImage",
                      node_type: "polaroidImage",
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
                            // when a parallelmind_index.json file already exists in the chosen folder.
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
