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

import { selectActiveTab, useMindMapStore } from "../../store/mindMapStore";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
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
  const activeTab = useMindMapStore(selectActiveTab);
  const selectedNodeId = activeTab?.selectedNodeId ?? null;
  const nodes = activeTab?.nodes ?? [];
  const updateNodeData = useMindMapStore((s) => s.updateNodeData);
  const pendingChildCreation = activeTab?.pendingChildCreation ?? null;
  const finalizePendingChildCreation = useMindMapStore(
    (s) => s.finalizePendingChildCreation
  );
  const rootDirectoryHandle = activeTab?.rootDirectoryHandle ?? null;
  const rootFolderJson = activeTab?.rootFolderJson ?? null;
  const setRoot = useMindMapStore((s) => s.setRoot);

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
  const lastExpandedWidthRef = useRef<number>(360);

  useEffect(() => {
    if (!isReduced) {
      lastExpandedWidthRef.current = rightPanelWidth;
    }
  }, [rightPanelWidth, isReduced]);

  const togglePanel = () => {
    if (isReduced) {
      setRightPanelWidth(Math.max(MIN_WIDTH, lastExpandedWidthRef.current));
      return;
    }
    lastExpandedWidthRef.current = rightPanelWidth;
    setRightPanelWidth(MIN_WIDTH);
  };

  const fileManager = useMemo(() => new FileManager(), []);

  // Draft state lives only in this container to satisfy "single container rule".
  const [draft, setDraft] = useState({
    name: "",
    purpose: "",
    details: "",
  });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const [dirty, setDirty] = useState(false);

  // Used to auto-focus and visually guide the user when name is mandatory.
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const detailsTextareaRef = useRef<HTMLTextAreaElement | null>(null);
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
      setDraft({ name: "", purpose: "", details: "" });
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
        purpose: typeof data.purpose === "string" ? data.purpose : "",
        details: typeof data.details === "string" ? data.details : "",
      });
    }
    if (selectionChanged) {
      setSaveStatus("idle");
      setDirty(false);
    }
    lastHydratedSelectedIdRef.current = selectedNodeId;
  }, [nodes, selectedNodeId]);

  const resizeTextarea = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  // Helper: detect whether the currently selected node is a temporary (deferred-commit) node.
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return (nodes ?? []).find((n: any) => n?.id === selectedNodeId) ?? null;
  }, [nodes, selectedNodeId]);

  const isDraftNode = !!(selectedNode?.data as any)?.isDraft;
  const isDecisionNode =
    (selectedNode?.data as any)?.node_type === "decision" ||
    (selectedNode?.data as any)?.type === "decision";
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

  useEffect(() => {
    resizeTextarea(detailsTextareaRef.current);
  }, [draft.details, selectedNodeId]);

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
      purpose: draft.purpose,
      details: draft.details,
    });

    if (isDecisionNode) {
      setDirty(false);
      setSaveStatus("saved");
      return;
    }

    // Persist to parallelmind_index.json only for the root node (existing mechanism).
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
        schema_version: "1.0.0",
        id: rootFolderJson?.id ?? "",
        name: draft.name.trim(),
        purpose: draft.purpose,
        type: "root_folder",
        level: 0,
        // Browser mode keeps path empty; desktop mode uses absolute path.
        path: rootFolderJson?.path ?? "",
        created_on: rootFolderJson?.created_on ?? "",
        updated_on: nowIso,
        // Views logic handled later; keep as-is.
        last_viewed_on: rootFolderJson?.last_viewed_on ?? rootFolderJson?.created_on ?? "",
        views: rootFolderJson?.views ?? 0,
        notifications: rootFolderJson?.notifications ?? [],
        recommendations: rootFolderJson?.recommendations ?? [],
        error_messages: rootFolderJson?.error_messages ?? [],
        child: rootFolderJson?.child ?? [],
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
        updateNodeData(selectedNodeId, { updated_on: nowIso });
        setDirty(false);
        setSaveStatus("saved");
      } catch (error) {
        console.error("[RightPanel] Failed to save parallelmind_index.json:", error);
        setDirty(true); // Keep dirty state so user knows save failed
        setSaveStatus("idle");
      }
    } else {
      const hasDirectoryHandle = !!rootDirectoryHandle;
      const hasPath = !!(rootFolderJson?.path && rootFolderJson.path.trim() !== "");
      if (!hasDirectoryHandle && !hasPath) {
        setDirty(true);
        setSaveStatus("idle");
        return;
      }

      try {
        const updatedRoot = hasDirectoryHandle
          ? await fileManager.updateNodePurposeFromHandle({
              dirHandle: rootDirectoryHandle!,
              existing: rootFolderJson!,
              nodeId: selectedNodeId,
              nodePath: (selectedNode?.data as any)?.path ?? null,
              nextPurpose: draft.purpose,
            })
          : await fileManager.updateNodePurposeFromPath({
              dirPath: rootFolderJson!.path,
              existing: rootFolderJson!,
              nodeId: selectedNodeId,
              nodePath: (selectedNode?.data as any)?.path ?? null,
              nextPurpose: draft.purpose,
            });

        setRoot(hasDirectoryHandle ? rootDirectoryHandle : null, updatedRoot);
        setDirty(false);
        setSaveStatus("saved");
      } catch (error) {
        const msg = `Failed to save node purpose: ${String(error)}`;
        if (hasDirectoryHandle) {
          await fileManager.appendRootErrorMessageFromHandle({
            dirHandle: rootDirectoryHandle!,
            existing: rootFolderJson ?? null,
            message: msg,
          });
        } else if (hasPath) {
          await fileManager.appendRootErrorMessageFromPath({
            dirPath: rootFolderJson!.path,
            existing: rootFolderJson ?? null,
            message: msg,
          });
        }
        setDirty(true);
        setSaveStatus("idle");
      }
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
    [draft.name, draft.purpose, draft.details, selectedNodeId, dirty],
    dirty
  );

  const onFieldChange =
    (field: "name" | "purpose" | "details") => (value: string) => {
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-2)",
          }}
        >
          {!isReduced && (
            <div className="pm-panel__title">{uiText.panels.node}</div>
          )}
          <button
            type="button"
            onClick={togglePanel}
            aria-label={uiText.tooltips.toggleRightPanel}
            title={uiText.tooltips.toggleRightPanel}
            style={{
              height: "var(--control-size-sm)",
              width: "var(--control-size-sm)",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
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
            {isReduced ? (
              <FiChevronLeft aria-hidden="true" />
            ) : (
              <FiChevronRight aria-hidden="true" />
            )}
          </button>
        </div>
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
                {!isDecisionNode && (
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
                      onBlur={() => {
                        void commitSave();
                      }}
                      placeholder={uiText.placeholders.nodeName}
                      aria-label={uiText.fields.nodeDetails.name}
                      disabled={!isDraftNode}
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
                        background: isDraftNode
                          ? "var(--surface-1)"
                          : "var(--surface-2)",
                        color: "var(--text)",
                        fontFamily: "var(--font-family)",
                        boxShadow: isDraftNode
                          ? "0 0 0 2px rgba(100, 108, 255, 0.2)"
                          : "none",
                        cursor: isDraftNode ? "text" : "not-allowed",
                        opacity: isDraftNode ? 1 : 0.7,
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
                )}

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
                    {isDecisionNode
                      ? "If & Else Statement"
                      : uiText.fields.nodeDetails.purpose}
                  </div>
                  {isDecisionNode ? (
                    <input
                      value={draft.purpose}
                      onChange={(e) =>
                        onFieldChange("purpose")(e.target.value)
                      }
                      onBlur={() => {
                        void commitSave();
                      }}
                      placeholder={uiText.placeholders.nodePurpose}
                      aria-label={uiText.fields.nodeDetails.purpose}
                      style={{
                        width: "100%",
                        minWidth: 0,
                        boxSizing: "border-box",
                        borderRadius: "var(--radius-md)",
                        border: "var(--border-width) solid var(--border)",
                        padding: "var(--space-2)",
                        background: "var(--surface-1)",
                        color: "var(--text)",
                        fontFamily: "var(--font-family)",
                      }}
                    />
                  ) : (
                    <textarea
                      value={draft.purpose}
                      onChange={(e) =>
                        onFieldChange("purpose")(e.target.value)
                      }
                      onBlur={() => {
                        void commitSave();
                      }}
                      placeholder={uiText.placeholders.nodePurpose}
                      aria-label={uiText.fields.nodeDetails.purpose}
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
                  )}
                </label>
                {isDecisionNode && (
                  <label
                    style={{
                      display: "grid",
                      gap: "var(--space-2)",
                      width: "100%",
                      minWidth: 0,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>Details</div>
                    <textarea
                      ref={detailsTextareaRef}
                      value={draft.details}
                      onChange={(e) =>
                        onFieldChange("details")(e.target.value)
                      }
                      onBlur={() => {
                        void commitSave();
                      }}
                      placeholder="Enter details"
                      aria-label="Details"
                      rows={2}
                      style={{
                        width: "100%",
                        minWidth: 0,
                        boxSizing: "border-box",
                        resize: "none",
                        overflow: "hidden",
                        borderRadius: "var(--radius-md)",
                        border: "var(--border-width) solid var(--border)",
                        padding: "var(--space-2)",
                        background: "var(--surface-1)",
                        color: "var(--text)",
                        fontFamily: "var(--font-family)",
                      }}
                    />
                  </label>
                )}
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
                    {formatDateTime(rootFolderJson?.created_on)}"
                  </div>
                  <div style={{ width: "100%" }}>
                    {uiText.fields.nodeDetails.updatedTime}: "
                    {formatDateTime(rootFolderJson?.updated_on)}"
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
