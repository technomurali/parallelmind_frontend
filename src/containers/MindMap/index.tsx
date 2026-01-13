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
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import { FiMenu } from "react-icons/fi";
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
  const setPendingChildCreation = useMindMapStore(
    (s) => s.setPendingChildCreation
  );
  const discardPendingChildCreationIfSelected = useMindMapStore(
    (s) => s.discardPendingChildCreationIfSelected
  );

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
   * Prevent creating cycles in the directed graph.
   * We treat edges as directed source -> target, and disallow any edge that would create a cycle.
   */
  const wouldCreateCycle = (
    existingEdges: Edge[],
    source: string,
    target: string,
    ignoreEdgeId?: string
  ): boolean => {
    if (!source || !target) return true;
    // Disallow self-loop
    if (source === target) return true;

    // Build adjacency list excluding the edge we're updating (if any)
    const adj = new Map<string, string[]>();
    for (const e of existingEdges) {
      if (ignoreEdgeId && e.id === ignoreEdgeId) continue;
      const s = (e as any)?.source;
      const t = (e as any)?.target;
      if (typeof s !== "string" || typeof t !== "string") continue;
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
  };

  /**
   * Handle edge reconnection - allows users to change which handles edges connect to
   */
  const onEdgeUpdate = (oldEdge: Edge, newConnection: Connection) => {
    const nextSource = newConnection.source ?? "";
    const nextTarget = newConnection.target ?? "";
    // Reject updates that would create cycles (or invalid connections).
    if (wouldCreateCycle(edges as any, nextSource, nextTarget, oldEdge.id)) {
      return;
    }
    const updatedEdges = edges.map((edge: Edge) => {
      if (edge.id === oldEdge.id) {
        return {
          ...edge,
          source: nextSource || edge.source,
          target: nextTarget || edge.target,
          sourceHandle: newConnection.sourceHandle,
          targetHandle: newConnection.targetHandle,
        };
      }
      return edge;
    });
    setEdges(updatedEdges);
  };

  /**
   * Handle new edge connections
   */
  const onConnect = (connection: Connection) => {
    const edgeId = `e_${connection.source}_${connection.target}`;
    const source = connection.source ?? "";
    const target = connection.target ?? "";
    // Reject invalid connections / self-loops / cycles.
    if (wouldCreateCycle(edges as any, source, target)) return;
    // Avoid duplicate edges by id.
    if ((edges as any).some((e: any) => e?.id === edgeId)) return;
    const newEdge: Edge = {
      id: edgeId,
      source,
      target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      type: "default",
    };
    setEdges([...edges, newEdge]);
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

  /**
   * Right-click context menu for the canvas/pane.
   *
   * Requirement: Only show "New Folder" when a parent node is selected.
   * We also snapshot the parent node id at the moment the user opens the menu,
   * so the parent context is preserved through the deferred-commit flow.
   */
  const onPaneContextMenu = (e: React.MouseEvent) => {
    closeContextMenu();

    // If no parent is selected, allow default browser behavior (no custom menu).
    if (!selectedNodeId) return;
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
    setPaneMenu({ open: true, x, y, flowPos, parentNodeId: selectedNodeId });
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
    if (!contextMenu.open && !paneMenu.open && !canvasMenu.open) return;

    const onMouseDown = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null;
      if (!target) {
        closeContextMenu();
        closePaneMenu();
        closeCanvasMenu();
        return;
      }
      if (target.closest('[data-pm-context-menu="node"]')) return;
      if (target.closest('[data-pm-context-menu="pane"]')) return;
      if (target.closest('[data-pm-context-menu="canvas"]')) return;
      closeContextMenu();
      closePaneMenu();
      closeCanvasMenu();
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        closeContextMenu();
        closePaneMenu();
        closeCanvasMenu();
      }
    };

    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu.open, paneMenu.open, canvasMenu.open]);

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

    const existing = useMindMapStore.getState().nodes ?? [];
    const existingRoot = existing.find((n: any) => n?.id === "00");

    // If root node already exists, preserve its position; otherwise center it
    let pos: { x: number; y: number };
    if (existingRoot?.position) {
      pos = existingRoot.position;
    } else {
      const el = wrapperRef.current;
      const rect = el?.getBoundingClientRect();
      const centerClient = rect
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      pos = rf.screenToFlowPosition(centerClient);
    }

    const rootNode: Node = {
      id: "00",
      type: "rootFolder",
      position: pos,
      data: rootFolderJson,
      // Sync selection state with store: mark node as selected if it matches selectedNodeId.
      // ReactFlow will also manage selection on click, but this ensures consistency.
      selected: selectedNodeId === "00",
    };

    /**
     * Preserve non-root nodes when updating the root node.
     *
     * Previously this component enforced a single-node canvas by calling `setNodes([rootNode])`,
     * which would wipe any newly created children. For the guided child-creation flow we must
     * keep the rest of the graph in memory and only replace/update the root node.
     *
     * We intentionally read the latest nodes from the Zustand store here to avoid adding `nodes`
     * as an effect dependency (which would re-center the root on every node mutation).
     */
    const nonRoot = existing.filter((n: any) => n?.id !== "00");
    setNodes([rootNode, ...nonRoot]);
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
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
            }}
          >
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
              }}
            >
              View: Details
            </div>
          </div>
        )}

        <div className="pm-canvas__body" ref={canvasBodyRef}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            nodeTypes={nodeTypes}
            zoomOnScroll={true}
            onWheel={(event) => {
              if (rf) {
                // Increase zoom sensitivity by using a larger delta multiplier
                const zoom = rf.getZoom();
                // Adjust these values to change zoom speed:
                // - Smaller values (e.g., 0.80/1.20) = faster zoom
                // - Larger values (e.g., 0.98/1.02) = slower zoom
                const delta = event.deltaY > 0 ? 0.8 : 1.2;
                const newZoom = Math.max(0.1, Math.min(2, zoom * delta));
                rf.zoomTo(newZoom + 3.5);
                event.preventDefault();
              }
            }}
            onInit={setRf}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeUpdate={onEdgeUpdate}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onPaneContextMenu={onPaneContextMenu}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeContextMenu={onNodeContextMenu}
          />

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
                    // Reuse existing circular folder renderer for now.
                    type: "rootFolder",
                    position: flowPos,
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
                    },
                    selected: true,
                  };

                  const existing = useMindMapStore.getState().nodes ?? [];
                  const next = [
                    ...existing.map((n: any) => ({
                      ...n,
                      selected: n?.id === tempNodeId,
                    })),
                    tempNode,
                  ];
                  setNodes(next);
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
              {isTauri() &&
                contextMenu.node &&
                isFolderNode(contextMenu.node) && (
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
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
