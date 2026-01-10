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
  type EdgeChange,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import { uiText } from "../../constants/uiText";
import { useMindMapStore } from "../../store/mindMapStore";
import RootFolderNode from "./RootFolderNode";

/**
 * MindMap component
 *
 * Main container for the mind map visualization canvas.
 * When a root folder is selected, it creates a single root node at the
 * viewport center and enables inline editing.
 */
export default function MindMap() {
  const nodes = useMindMapStore((s) => s.nodes);
  const edges = useMindMapStore((s) => s.edges);
  const setNodes = useMindMapStore((s) => s.setNodes);
  const setEdges = useMindMapStore((s) => s.setEdges);
  const rootFolderJson = useMindMapStore((s) => s.rootFolderJson);
  const setInlineEditNodeId = useMindMapStore((s) => s.setInlineEditNodeId);
  const selectNode = useMindMapStore((s) => s.selectNode);
  const selectedNodeId = useMindMapStore((s) => s.selectedNodeId);
  const nodeDisplayMode = useMindMapStore((s) => s.nodeDisplayMode);
  const setNodeDisplayMode = useMindMapStore((s) => s.setNodeDisplayMode);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasBodyRef = useRef<HTMLDivElement | null>(null);
  const [rf, setRf] = useState<ReactFlowInstance | null>(null);
  const nodeTypes = useMemo(() => ({ rootFolder: RootFolderNode }), []);

  const isTauri = () =>
    typeof (window as any).__TAURI_INTERNALS__ !== "undefined";

  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    node: Node | null;
  }>({ open: false, x: 0, y: 0, node: null });

  const closeContextMenu = () =>
    setContextMenu((s) =>
      s.open ? { open: false, x: 0, y: 0, node: null } : s
    );

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
    setNodes(applyNodeChanges(changes, nodes));
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
   * Right-click context menu for nodes (desktop only for file explorer actions).
   */
  const onNodeContextMenu = (e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    e.stopPropagation();

    // Only show the context menu when we can actually perform desktop actions.
    if (!isTauri()) return;
    if (!isFolderNode(node)) return;
    const path = getNodeFolderPath(node);
    if (!path) return;

    const container = canvasBodyRef.current?.getBoundingClientRect();
    const x = container ? e.clientX - container.left : e.clientX;
    const y = container ? e.clientY - container.top : e.clientY;
    setContextMenu({ open: true, x, y, node });
  };

  /**
   * Double-click opens the node folder in the OS file explorer (Tauri desktop).
   * This is feature-detected and silent on failure (no alerts/toasts).
   */
  const onNodeDoubleClick = async (_: unknown, node: Node) => {
    // Web browsers cannot open local folders in the OS file explorer.
    if (!isTauri()) {
      // No-op by design; we avoid alerts/toasts.
      return;
    }

    // Only folders should open in the OS file explorer.
    if (!isFolderNode(node)) return;

    const path = (node?.data as any)?.path;
    if (typeof path !== "string" || !path) return;
    try {
      const { openPath } = await import("@tauri-apps/plugin-opener");
      await openPath(path);
    } catch (err) {
      // Keep UX silent (no alerts/toasts), but log for debugging.
      console.error("[MindMap] Double-click open failed:", err);
    }
  };

  // Close context menu on outside click / Escape.
  useEffect(() => {
    if (!contextMenu.open) return;

    const onMouseDown = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return closeContextMenu();
      if (target.closest('[data-pm-context-menu="node"]')) return;
      closeContextMenu();
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") closeContextMenu();
    };

    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu.open]);

  /**
   * Effect: Create/replace root node when root folder is selected
   *
   * When a root folder is selected, this effect:
   * 1. Calculates the center of the viewport
   * 2. Converts screen coordinates to flow coordinates
   * 3. Creates a single root node at that position
   * 4. Enables inline editing for the root node
   *
   * Only one root node is allowed at a time (enforced by setNodes([rootNode])).
   */
  useEffect(() => {
    if (!rootFolderJson || !rf) return;
    const el = wrapperRef.current;
    const rect = el?.getBoundingClientRect();
    const centerClient = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    const pos = rf.screenToFlowPosition(centerClient);
    const rootNode: Node = {
      id: "00",
      type: "rootFolder",
      position: pos,
      data: rootFolderJson,
      // Sync selection state with store: mark node as selected if it matches selectedNodeId.
      // ReactFlow will also manage selection on click, but this ensures consistency.
      selected: selectedNodeId === "00",
    };

    // Enforce single root node only (replace any existing root)
    setNodes([rootNode]);
    setInlineEditNodeId("00");
  }, [rf, rootFolderJson, selectedNodeId, setInlineEditNodeId, setNodes]);

  return (
    <main className="pm-center" aria-label={uiText.ariaLabels.mindMapCanvas}>
      <div className="pm-canvas" ref={wrapperRef}>
        <header className="pm-canvas__header">
          <div className="pm-canvas__title" title={rootFolderJson?.path ?? ""}>
            {rootFolderJson?.name ?? ""}
          </div>
          <div
            role="radiogroup"
            aria-label="Node display mode"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              fontSize: "0.9em",
            }}
          >
            {(["icons", "titles", "names"] as const).map((mode) => (
              <label
                key={mode}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  cursor: "pointer",
                  userSelect: "none",
                }}
                title={uiText.canvas.displayModeTooltips[mode]}
              >
                <input
                  type="radio"
                  name="nodeDisplayMode"
                  value={mode}
                  checked={nodeDisplayMode === mode}
                  onChange={() => setNodeDisplayMode(mode)}
                  aria-label={uiText.canvas.displayMode[mode]}
                  style={{
                    cursor: "pointer",
                  }}
                />
                <span>{uiText.canvas.displayMode[mode]}</span>
              </label>
            ))}
          </div>
        </header>

        <div className="pm-canvas__body" ref={canvasBodyRef}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            nodeTypes={nodeTypes}
            onInit={setRf}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeContextMenu={onNodeContextMenu}
          />

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
                onClick={async () => {
                  const node = contextMenu.node;
                  closeContextMenu();
                  if (!node) return;
                  if (!isTauri()) return;
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
                    console.error("[MindMap] Context menu open failed:", err);
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
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
