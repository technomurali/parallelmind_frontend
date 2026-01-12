/**
 * RightPanel/index.tsx
 *
 * Right panel container component for node details and editor.
 *
 * Features:
 * - Resizable panel with drag handle on the left edge
 * - Collapsible to icon-only view when minimized
 * - Node detail view and editor (placeholder for now)
 *
 * The panel can be resized between MIN_WIDTH (56px) and MAX_WIDTH (400px).
 * When minimized, it shows only the panel header.
 */

import { useMindMapStore } from "../../store/mindMapStore";
import { useEffect, useMemo, useRef, useState } from "react";
import { uiText } from "../../constants/uiText";
import { FileManager } from "../../data/fileManager";
import { useAutoSave } from "../../hooks/useAutoSave";

/**
 * RightPanel component
 *
 * Renders the right sidebar with node details and editor.
 * Handles panel resizing via mouse drag on the left resize handle.
 */
export default function RightPanel() {
  const rightPanelWidth = useMindMapStore((s) => s.rightPanelWidth);
  const setRightPanelWidth = useMindMapStore((s) => s.setRightPanelWidth);
  const selectedNodeId = useMindMapStore((s) => s.selectedNodeId);
  const nodes = useMindMapStore((s) => s.nodes);
  const updateNodeData = useMindMapStore((s) => s.updateNodeData);
  const pendingChildCreation = useMindMapStore((s) => s.pendingChildCreation);
  const finalizePendingChildCreation = useMindMapStore(
    (s) => s.finalizePendingChildCreation
  );
  const rootDirectoryHandle = useMindMapStore((s) => s.rootDirectoryHandle);
  const rootFolderJson = useMindMapStore((s) => s.rootFolderJson);

  const dragRef = useRef<{
    startX: number;
    startWidth: number;
    raf: number | null;
    latestX: number;
    dragging: boolean;
  } | null>(null);

  // Right Panel width constraints
  const MIN_WIDTH = 56;
  const MAX_WIDTH = 600;
  const isReduced = rightPanelWidth <= MIN_WIDTH;

  const fileManager = useMemo(() => new FileManager(), []);

  // Draft state lives only in this container to satisfy "single container rule".
  const [draft, setDraft] = useState({
    name: "",
    title: "",
    description: "",
  });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const [dirty, setDirty] = useState(false);

  // Used to auto-focus and visually guide the user when name is mandatory.
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const lastHydratedSelectedIdRef = useRef<string | null>(null);

  // Pull selected node data from the centralized store and hydrate the editor when selection changes.
  useEffect(() => {
    // We only want to "reset" draft/dirty status when selection actually changes.
    // If we reset on every `nodes` mutation, we can accidentally cancel the debounced
    // auto-save timer while the user is typing (ReactFlow can emit node updates for
    // selection/dragging/etc.). That would block the name-gated finalize step too.
    const selectionChanged =
      lastHydratedSelectedIdRef.current !== selectedNodeId;

    if (!selectedNodeId) {
      setDraft({ name: "", title: "", description: "" });
      setSaveStatus("idle");
      setDirty(false);
      lastHydratedSelectedIdRef.current = null;
      return;
    }

    const node = (nodes ?? []).find((n: any) => n?.id === selectedNodeId);
    const data = (node?.data ?? {}) as any;

    // If the selection changed, re-hydrate and reset editing state.
    // If only `nodes` changed while the user is typing (dirty=true), do not clobber
    // the draft or we will cancel the debounced save and confuse the creation flow.
    if (selectionChanged || !dirty) {
      setDraft({
        name: typeof data.name === "string" ? data.name : "",
        title: typeof data.title === "string" ? data.title : "",
        description:
          typeof data.description === "string" ? data.description : "",
      });
    }
    if (selectionChanged) {
      setSaveStatus("idle");
      setDirty(false);
    }
    lastHydratedSelectedIdRef.current = selectedNodeId;
  }, [nodes, selectedNodeId]);

  // Helper: detect whether the currently selected node is a temporary (deferred-commit) node.
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return (nodes ?? []).find((n: any) => n?.id === selectedNodeId) ?? null;
  }, [nodes, selectedNodeId]);

  const isDraftNode = !!(selectedNode?.data as any)?.isDraft;
  const parentIdForDraft =
    typeof (selectedNode?.data as any)?.parentId === "string"
      ? ((selectedNode?.data as any)?.parentId as string)
      : null;

  /**
   * File-name style validation (minimal and purpose-fit).
   *
   * Scope intentionally limited:
   * - Name presence is required for draft nodes.
   * - Basic filesystem invalid characters + trailing dot/space (Windows-style).
   * - Conflict check at the same level (siblings under the same parent).
   */
  const validateNodeNameForDraft = (name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return uiText.alerts.nodeNameRequired;

    // Windows-invalid filename characters (also a good cross-platform baseline).
    if (/[<>:"/\\|?*\u0000-\u001F]/.test(trimmed))
      return uiText.alerts.nodeNameInvalidFileName;
    if (/[. ]$/.test(trimmed)) return uiText.alerts.nodeNameInvalidFileName;

    // Reserved device names on Windows (case-insensitive).
    // Keep minimal: CON, PRN, AUX, NUL, COM1-9, LPT1-9
    const upper = trimmed.toUpperCase();
    if (
      upper === "CON" ||
      upper === "PRN" ||
      upper === "AUX" ||
      upper === "NUL" ||
      /^COM[1-9]$/.test(upper) ||
      /^LPT[1-9]$/.test(upper)
    )
      return uiText.alerts.nodeNameInvalidFileName;

    // Sibling conflict (same level).
    if (parentIdForDraft) {
      const conflict = (nodes ?? []).some((n: any) => {
        if (!n || n.id === selectedNodeId) return false;
        const pid = (n.data as any)?.parentId;
        if (pid !== parentIdForDraft) return false;
        const siblingName =
          typeof (n.data as any)?.name === "string" ? (n.data as any).name : "";
        return siblingName.trim().toLowerCase() === trimmed.toLowerCase();
      });
      if (conflict) return uiText.alerts.nodeNameConflictAtLevel;
    }

    return null;
  };

  const nameError =
    isDraftNode && selectedNodeId ? validateNodeNameForDraft(draft.name) : null;

  // Auto-focus the name field when a draft node is selected to guide the required step.
  useEffect(() => {
    if (!isDraftNode) return;
    // Defer focus to the next tick to ensure the input is mounted.
    const t = window.setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(t);
  }, [isDraftNode, selectedNodeId]);

  // Save callback: updates in-memory state and persists only when we already have a persistence mechanism.
  const commitSave = async () => {
    if (!dirty || !selectedNodeId) return;

    // Name-gated commit for draft nodes: do not finalize/save until name is valid.
    if (isDraftNode) {
      const err = validateNodeNameForDraft(draft.name);
      if (err) {
        // Keep the form in "dirty" state and prevent "Saved" from appearing.
        setDirty(true);
        setSaveStatus("idle");
        // Focus the user back to the required field.
        nameInputRef.current?.focus();
        return;
      }
    }

    // Always update in-memory node data (the UI is driven from centralized state).
    updateNodeData(selectedNodeId, {
      // Store trimmed name to match filesystem expectation and conflict checks.
      name: draft.name.trim(),
      title: draft.title,
      description: draft.description,
    });

    // Persist to root-folder.json only for the root node (existing mechanism).
    if (selectedNodeId === "00") {
      // Check if we have a valid persistence mechanism
      const hasDirectoryHandle = !!rootDirectoryHandle;
      const hasPath = !!(
        rootFolderJson?.path && rootFolderJson.path.trim() !== ""
      );

      if (!hasDirectoryHandle && !hasPath) {
        console.warn(
          "[RightPanel] Cannot save: no directory handle and no valid path available",
          {
            rootDirectoryHandle,
            rootFolderJsonPath: rootFolderJson?.path,
          }
        );
        setDirty(true); // Keep dirty state so user knows save failed
        setSaveStatus("idle");
        return;
      }

      const nowIso = new Date().toISOString();
      const payload = {
        id: 0,
        node_id: "00",
        level_id: 0,
        node_type: "root_folder",
        // Dates are finalized by FileManager.writeRootFolderJson (created preserved, update refreshed).
        created_date: rootFolderJson?.created_date ?? "",
        update_date: rootFolderJson?.update_date ?? "",
        path: rootFolderJson?.path ?? "",
        name: draft.name,
        title: draft.title,
        description: draft.description,
        // Preserve existing children (depth logic is out of scope, but we must not wipe it).
        children: rootFolderJson?.children ?? [],
      };

      try {
        // Browser mode: write via directory handle.
        if (hasDirectoryHandle) {
          console.log(
            "[RightPanel] Saving via directory handle (browser mode)"
          );
          await fileManager.writeRootFolderJson(
            rootDirectoryHandle!,
            payload as any
          );
        }

        // Tauri mode: write via absolute path.
        if (!hasDirectoryHandle && hasPath) {
          const savePath = rootFolderJson!.path!;
          console.log("[RightPanel] Saving via path (Tauri mode):", savePath);
          await fileManager.writeRootFolderJsonFromPath(
            savePath,
            payload as any
          );
        }

        // Update in-memory model timestamp so the panel reflects the latest save immediately.
        updateNodeData(selectedNodeId, { update_date: nowIso });
        setDirty(false);
        setSaveStatus("saved");
      } catch (error) {
        console.error("[RightPanel] Failed to save root-folder.json:", error);
        setDirty(true); // Keep dirty state so user knows save failed
        setSaveStatus("idle");
      }
    } else {
      setDirty(false);
      setSaveStatus("saved");
    }

    /**
     * Finalize a deferred-commit node creation ONLY after the save succeeds.
     *
     * We intentionally create the parent->child edge here (not at creation time)
     * so the user must confirm the node by providing the required `name`.
     */
    if (
      isDraftNode &&
      pendingChildCreation &&
      pendingChildCreation.tempNodeId === selectedNodeId
    ) {
      finalizePendingChildCreation();
    }
  };

  // Debounced auto-save: "Saving..." while debounce is active, "Saved" after commit.
  useAutoSave(
    () => {
      void commitSave();
    },
    3000,
    [draft.name, draft.title, draft.description, selectedNodeId, dirty],
    dirty
  );

  const onFieldChange =
    (field: "name" | "title" | "description") => (value: string) => {
      setDraft((d) => ({ ...d, [field]: value }));
      // Only show "Saving..." when the user has actually made edits.
      setDirty(true);
      setSaveStatus("saving");
    };

  /**
   * Formats an ISO timestamp into a readable datetime string:
   * YYYY-MM-DD HH:MM:SS (24h).
   *
   * Kept local to this container to avoid new abstractions/files.
   */
  const formatDateTime = (iso: unknown): string => {
    if (typeof iso !== "string") return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  };

  /**
   * Initiates panel resize operation
   *
   * Captures initial mouse position and panel width, then sets up
   * global mouse move/up listeners for drag tracking.
   * Note: Right panel resizes from its LEFT edge.
   */
  const onResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    dragRef.current = {
      startX: e.clientX,
      startWidth: rightPanelWidth,
      raf: null,
      latestX: e.clientX,
      dragging: true,
    };

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  };

  /**
   * Effect: Handle panel resizing via mouse drag
   *
   * Uses requestAnimationFrame for smooth resizing performance.
   * Right panel resizes from LEFT edge, so moving mouse right reduces width.
   * Calculates new width and clamps to MIN/MAX bounds.
   */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d?.dragging) return;

      d.latestX = e.clientX;
      if (d.raf != null) return;

      d.raf = window.requestAnimationFrame(() => {
        const dd = dragRef.current;
        if (!dd?.dragging) return;

        // Right panel resizes from its LEFT edge, so moving mouse right reduces width
        const dx = dd.latestX - dd.startX;
        const next = Math.max(
          MIN_WIDTH,
          Math.min(MAX_WIDTH, dd.startWidth - dx)
        );
        setRightPanelWidth(next);
        dd.raf = null;
      });
    };

    const onUp = () => {
      const d = dragRef.current;
      if (!d?.dragging) return;
      d.dragging = false;
      if (d.raf != null) {
        window.cancelAnimationFrame(d.raf);
        d.raf = null;
      }
      dragRef.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [setRightPanelWidth]);

  return (
    <aside
      className="pm-panel pm-panel--right"
      aria-label={uiText.ariaLabels.rightSidebar}
      style={{
        position: "relative",
        width: rightPanelWidth,
        minWidth: rightPanelWidth,
        maxWidth: rightPanelWidth,
        flex: "0 0 auto",
      }}
    >
      <div
        className="pm-resize-handle pm-resize-handle--left"
        role="separator"
        aria-label={uiText.tooltips.resizeRightSidebar}
        title={uiText.tooltips.resizeRightSidebar}
        onMouseDown={onResizeMouseDown}
      />

      <div className="pm-panel__header">
        {!isReduced && (
          <div className="pm-panel__title">{uiText.panels.node}</div>
        )}
      </div>

      {!isReduced ? (
        <div className="pm-panel__content">
          {!selectedNodeId ? (
            <div className="pm-placeholder">
              {uiText.placeholders.nodeDetails}
            </div>
          ) : (
            <div
              aria-label={uiText.ariaLabels.nodeEditor}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
                height: "100%",
                // Ensure the details container spans the full inner width of the panel.
                // Use 100% width and minWidth: 0 to allow flexbox to properly constrain it.
                width: "100%",
                minWidth: 0,
                // Ensure box-sizing accounts for any padding/borders in width calculations.
                boxSizing: "border-box",
              }}
            >
              {/* Grid container for form fields: spans full available width. */}
              <div
                style={{
                  display: "grid",
                  gap: "var(--space-2)",
                  // Explicitly set width to 100% to consume all horizontal space.
                  width: "100%",
                  minWidth: 0,
                  // Ensure grid columns fill available space.
                  gridTemplateColumns: "1fr",
                }}
              >
                {/* Label container: must span full grid column width. */}
                <label
                  style={{
                    display: "grid",
                    gap: "var(--space-2)",
                    // Critical: label must be 100% width to fill its grid column.
                    width: "100%",
                    minWidth: 0,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {uiText.fields.nodeDetails.name}
                  </div>
                  <input
                    ref={nameInputRef}
                    value={draft.name}
                    onChange={(e) => onFieldChange("name")(e.target.value)}
                    placeholder={uiText.placeholders.nodeName}
                    aria-label={uiText.fields.nodeDetails.name}
                    style={{
                      // Input fills 100% of its label container.
                      width: "100%",
                      minWidth: 0,
                      // Border-box ensures padding/border are included in width calculation.
                      boxSizing: "border-box",
                      borderRadius: "var(--radius-md)",
                      // Visually highlight the required field for draft nodes.
                      border: isDraftNode
                        ? "var(--border-width) solid var(--primary-color)"
                        : "var(--border-width) solid var(--border)",
                      padding: "var(--space-2)",
                      background: "var(--surface-1)",
                      color: "var(--text)",
                      fontFamily: "var(--font-family)",
                      boxShadow: isDraftNode
                        ? "0 0 0 2px rgba(100, 108, 255, 0.2)"
                        : "none",
                    }}
                  />
                  {/* Name validation message (draft nodes only). */}
                  {isDraftNode && nameError && (
                    <div
                      style={{
                        fontSize: "0.8em",
                        color: "var(--danger, #e5484d)",
                        opacity: 0.95,
                      }}
                    >
                      {nameError}
                    </div>
                  )}
                </label>

                {/* Label container: must span full grid column width. */}
                <label
                  style={{
                    display: "grid",
                    gap: "var(--space-2)",
                    // Critical: label must be 100% width to fill its grid column.
                    width: "100%",
                    minWidth: 0,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {uiText.fields.nodeDetails.title}
                  </div>
                  <input
                    value={draft.title}
                    onChange={(e) => onFieldChange("title")(e.target.value)}
                    placeholder={uiText.placeholders.nodeTitle}
                    aria-label={uiText.fields.nodeDetails.title}
                    style={{
                      // Input fills 100% of its label container.
                      width: "100%",
                      minWidth: 0,
                      // Border-box ensures padding/border are included in width calculation.
                      boxSizing: "border-box",
                      borderRadius: "var(--radius-md)",
                      border: "var(--border-width) solid var(--border)",
                      padding: "var(--space-2)",
                      background: "var(--surface-1)",
                      color: "var(--text)",
                      fontFamily: "var(--font-family)",
                    }}
                  />
                </label>

                {/* Label container: must span full grid column width. */}
                <label
                  style={{
                    display: "grid",
                    gap: "var(--space-2)",
                    // Critical: label must be 100% width to fill its grid column.
                    width: "100%",
                    minWidth: 0,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {uiText.fields.nodeDetails.description}
                  </div>
                  <textarea
                    value={draft.description}
                    onChange={(e) =>
                      onFieldChange("description")(e.target.value)
                    }
                    placeholder={uiText.placeholders.nodeDescription}
                    aria-label={uiText.fields.nodeDetails.description}
                    rows={6}
                    style={{
                      // Textarea fills 100% of its label container.
                      width: "100%",
                      minWidth: 0,
                      // Border-box ensures padding/border are included in width calculation.
                      boxSizing: "border-box",
                      resize: "vertical",
                      borderRadius: "var(--radius-md)",
                      border: "var(--border-width) solid var(--border)",
                      padding: "var(--space-2)",
                      background: "var(--surface-1)",
                      color: "var(--text)",
                      fontFamily: "var(--font-family)",
                    }}
                  />
                </label>
              </div>

              {/* Read-only timestamps (root only). Kept small and easy to scan. */}
              {selectedNodeId === "00" && (
                <div
                  style={{
                    display: "grid",
                    gap: "var(--space-2)",
                    fontSize: "0.75em",
                    opacity: 0.9,
                  }}
                >
                  <div style={{ width: "100%" }}>
                    {uiText.fields.nodeDetails.createdTime}: "
                    {formatDateTime(rootFolderJson?.created_date)}"
                  </div>
                  <div style={{ width: "100%" }}>
                    {uiText.fields.nodeDetails.updatedTime}: "
                    {formatDateTime(rootFolderJson?.update_date)}"
                  </div>
                </div>
              )}

              {/* Save status is always visible at the bottom of the container. */}
              <div
                style={{
                  marginTop: "auto",
                  opacity: 0.9,
                  // Ensure status text is small like normal body text (not header-like).
                  fontSize: "0.75em",
                  fontWeight: "normal",
                }}
              >
                {saveStatus === "saving"
                  ? uiText.statusMessages.saving
                  : saveStatus === "saved"
                  ? uiText.statusMessages.saved
                  : uiText.statusMessages.idle}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="pm-panel__collapsed" aria-hidden="true" />
      )}
    </aside>
  );
}
