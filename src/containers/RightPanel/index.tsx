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
import SmartPad from "../../components/SmartPad";

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
  const edges = activeTab?.edges ?? [];
  const updateNodeData = useMindMapStore((s) => s.updateNodeData);
  const setNodes = useMindMapStore((s) => s.setNodes);
  const setEdges = useMindMapStore((s) => s.setEdges);
  const pendingChildCreation = activeTab?.pendingChildCreation ?? null;
  const finalizePendingChildCreation = useMindMapStore(
    (s) => s.finalizePendingChildCreation
  );
  const setPendingChildCreation = useMindMapStore(
    (s) => s.setPendingChildCreation
  );
  const rootDirectoryHandle = activeTab?.rootDirectoryHandle ?? null;
  const rootFolderJson = activeTab?.rootFolderJson ?? null;
  const setRoot = useMindMapStore((s) => s.setRoot);
  const selectNode = useMindMapStore((s) => s.selectNode);

  const dragRef = useRef<{
    startX: number;
    startWidth: number;
    raf: number | null;
    latestX: number;
    dragging: boolean;
  } | null>(null);

  // Right Panel width constraints
  const MIN_WIDTH = 56;
  const MAX_WIDTH = 1000;
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
  const [createError, setCreateError] = useState<string | null>(null);
  const [renameActive, setRenameActive] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [fileDetailsExpanded, setFileDetailsExpanded] = useState(true);
  const [imageSrc, setImageSrc] = useState<string>("");
  const [imageLoadError, setImageLoadError] = useState(false);

  // Used to auto-focus and visually guide the user when name is mandatory.
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const purposeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
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
      setCreateError(null);
      setRenameActive(false);
      setActionError(null);
      setDeleteConfirmOpen(false);
      setDeleteInProgress(false);
      lastHydratedSelectedIdRef.current = null;
      return;
    }

    const node = (nodes ?? []).find((n: any) => n?.id === selectedNodeId);
    const data = (node?.data ?? {}) as any;
    const isFile =
      data?.node_type === "file" || data?.type === "file" || node?.type === "file";
    const isImage =
      data?.node_type === "polaroidImage" || data?.type === "polaroidImage" || node?.type === "polaroidImage";
    const baseName = typeof data.name === "string" ? data.name : "";
    const ext = typeof data.extension === "string" ? data.extension : "";
    const caption = typeof data.caption === "string" ? data.caption : "";
    const hydratedName = isFile && baseName
      ? ext
        ? `${baseName}.${ext}`
        : baseName
      : isImage && caption
      ? caption
      : baseName;

    // If the selection changed, re-hydrate and reset editing state.
    // If only `nodes` changed while the user is typing (dirty=true), do not clobber
    // the draft or we will cancel the debounced save and confuse the creation flow.
    if (selectionChanged || !dirty) {
      setDraft({
        name: hydratedName,
        purpose: typeof data.purpose === "string" ? data.purpose : "",
        details: typeof data.details === "string" ? data.details : "",
      });
    }
    if (selectionChanged) {
      setSaveStatus("idle");
      setDirty(false);
      setCreateError(null);
      setRenameActive(false);
      setActionError(null);
      setDeleteConfirmOpen(false);
      setDeleteInProgress(false);
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
  const isRootNode = selectedNodeId === "00";
  const isFolderNode =
    (selectedNode?.data as any)?.node_type === "folder" ||
    (selectedNode?.data as any)?.type === "folder" ||
    selectedNode?.type === "rootFolder";
  const isFileNode =
    (selectedNode?.data as any)?.node_type === "file" ||
    (selectedNode?.data as any)?.type === "file" ||
    selectedNode?.type === "file";
  const isImageNode =
    (selectedNode?.data as any)?.node_type === "polaroidImage" ||
    (selectedNode?.data as any)?.type === "polaroidImage" ||
    selectedNode?.type === "polaroidImage";

  const getExtensionFromMimeType = (mimeType: string): string => {
    const mime = (mimeType ?? "").toLowerCase();
    if (mime.includes("png")) return "png";
    if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
    if (mime.includes("gif")) return "gif";
    if (mime.includes("webp")) return "webp";
    if (mime.includes("bmp")) return "bmp";
    if (mime.includes("svg")) return "svg";
    return "png"; // default fallback
  };

  const normalizeDraftFileName = (rawValue: string): string => {
    const trimmed = (rawValue ?? "").trim();
    if (!trimmed) return "";
    // If user did not provide an extension, default to .md (Q2 = A).
    // Treat "a." as invalid later via validation (trailing dot).
    if (!trimmed.includes(".")) return `${trimmed}.md`;
    return trimmed;
  };

  const splitDraftFileName = (
    rawValue: string
  ): { name: string; extension: string; fullName: string } => {
    const normalized = normalizeDraftFileName(rawValue);
    const lastDot = normalized.lastIndexOf(".");
    if (lastDot <= 0 || lastDot === normalized.length - 1) {
      return { name: normalized, extension: "", fullName: normalized };
    }
    return {
      name: normalized.slice(0, lastDot),
      extension: normalized.slice(lastDot + 1),
      fullName: normalized,
    };
  };

  const findFolderNodeById = (
    list: any[],
    nodeId: string
  ): { child?: any[] } | null => {
    for (const item of list ?? []) {
      if (!item || typeof item !== "object") continue;
      if (item.id === nodeId && Array.isArray(item.child)) return item;
      if (Array.isArray(item.child)) {
        const nested = findFolderNodeById(item.child, nodeId);
        if (nested) return nested;
      }
    }
    return null;
  };

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

    // For file nodes: accept "filename.ext" and default to .md when missing.
    // For image nodes: use caption as base name, extension comes from clipboard MIME type.
    const fileParts = isFileNode ? splitDraftFileName(trimmed) : null;
    const effective = fileParts ? fileParts.fullName : trimmed;
    const reservedBase = fileParts ? fileParts.name : trimmed;

    // Windows-invalid filename characters (also a good cross-platform baseline).
    if (/[<>:"/\\|?*\u0000-\u001F]/.test(effective))
      return uiText.alerts.nodeNameInvalidFileName;
    if (/[. ]$/.test(effective)) return uiText.alerts.nodeNameInvalidFileName;

    // Reserved device names on Windows (case-insensitive).
    // Keep minimal: CON, PRN, AUX, NUL, COM1-9, LPT1-9
    const upper = reservedBase.toUpperCase();
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
    if (parentIdForDraft && rootFolderJson) {
      const siblings =
        parentIdForDraft === "00"
          ? rootFolderJson.child ?? []
          : findFolderNodeById(rootFolderJson.child ?? [], parentIdForDraft)
              ?.child ?? [];
      const conflict = siblings.some((sibling: any) => {
        const siblingName = typeof sibling?.name === "string" ? sibling.name : "";
        const siblingExt =
          typeof sibling?.extension === "string" ? sibling.extension : "";
        const siblingFull =
          siblingExt && siblingName ? `${siblingName}.${siblingExt}` : siblingName;
        // For image nodes, compare against the effective filename (caption + extension from clipboard)
        if (isImageNode) {
          // We'll check the actual filename that will be created (caption + extension)
          // This is handled in onCreateDraft where we build the fileName
          return siblingFull.trim().toLowerCase() === effective.toLowerCase();
        }
        return siblingFull.trim().toLowerCase() === effective.toLowerCase();
      });
      if (conflict) return uiText.alerts.nodeNameConflictAtLevel;
    }

    return null;
  };

  const nameError =
    (isDraftNode || renameActive) && selectedNodeId
      ? validateNodeNameForDraft(draft.name)
      : null;

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
    resizeTextarea(purposeTextareaRef.current);
    resizeTextarea(detailsTextareaRef.current);
  }, [draft.purpose, draft.details, selectedNodeId]);

  useEffect(() => {
    if (!fileDetailsExpanded) return;
    // Re-measure after expand so all content is visible.
    requestAnimationFrame(() => {
      resizeTextarea(purposeTextareaRef.current);
      resizeTextarea(detailsTextareaRef.current);
    });
  }, [fileDetailsExpanded]);

  // Load image for image nodes
  useEffect(() => {
    if (!isImageNode || !selectedNode) {
      setImageSrc("");
      setImageLoadError(false);
      return;
    }

    const rawImageSource =
      typeof (selectedNode?.data as any)?.imageSrc === "string"
        ? (selectedNode.data as any).imageSrc
        : typeof (selectedNode?.data as any)?.path === "string"
        ? (selectedNode.data as any).path
        : "";

    const source = (rawImageSource ?? "").trim();
    if (!source) {
      setImageSrc("");
      setImageLoadError(false);
      return;
    }

    const isDirectImageSource = (value: string) =>
      value.startsWith("data:") ||
      value.startsWith("blob:") ||
      value.startsWith("http://") ||
      value.startsWith("https://");

    if (isDirectImageSource(source)) {
      setImageSrc(source);
      setImageLoadError(false);
      return;
    }

    let isActive = true;
    let objectUrl: string | null = null;
    setImageLoadError(false);

    const getImageMimeType = (pathValue: string) => {
      const extension = (pathValue.split(".").pop() ?? "").toLowerCase();
      if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
      if (extension === "png") return "image/png";
      if (extension === "gif") return "image/gif";
      if (extension === "webp") return "image/webp";
      if (extension === "bmp") return "image/bmp";
      if (extension === "svg") return "image/svg+xml";
      return "application/octet-stream";
    };

    const resolveFromHandle = async () => {
      if (!rootDirectoryHandle) return false;
      try {
        const file = await fileManager.getFileFromHandle({
          rootHandle: rootDirectoryHandle,
          relPath: source,
        });
        objectUrl = URL.createObjectURL(file);
        if (isActive) {
          setImageSrc(objectUrl);
          setImageLoadError(false);
        }
        return true;
      } catch (err) {
        console.warn("[RightPanel] Failed to load image from handle:", err);
        if (isActive) {
          setImageLoadError(true);
        }
        return false;
      }
    };

    const resolveFromPath = async () => {
      const isTauri = typeof (window as any).__TAURI_INTERNALS__ !== "undefined";
      if (!isTauri) return false;
      try {
        const { readFile } = await import("@tauri-apps/plugin-fs");
        const bytes = await readFile(source);
        const blob = new Blob([bytes], { type: getImageMimeType(source) });
        objectUrl = URL.createObjectURL(blob);
        if (isActive) {
          setImageSrc(objectUrl);
          setImageLoadError(false);
        }
        return true;
      } catch (err) {
        console.warn("[RightPanel] Failed to load image from path:", err);
        if (isActive) {
          setImageLoadError(true);
        }
        return false;
      }
    };

    void (async () => {
      const resolved = await resolveFromHandle();
      if (!resolved) {
        await resolveFromPath();
      }
    })();

    return () => {
      isActive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [isImageNode, selectedNode, rootDirectoryHandle, fileManager]);

  useEffect(() => {
    setFileDetailsExpanded(true);
  }, [selectedNodeId]);

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
      updateNodeData(selectedNodeId, {
        name: draft.name.trim(),
        purpose: draft.purpose,
        details: draft.details,
      });
      setDirty(false);
      setSaveStatus("idle");
      return;
    }

    // Always update in-memory node data (the UI is driven from centralized state).
    updateNodeData(selectedNodeId, {
      ...(isDraftNode ? { name: draft.name.trim() } : {}),
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

  const canCreateDraft =
    isDraftNode &&
    !!parentIdForDraft &&
    !nameError &&
    (!!rootDirectoryHandle ||
      (typeof rootFolderJson?.path === "string" &&
        rootFolderJson.path.trim().length > 0));

  const onCreateDraft = async () => {
    if (!isDraftNode || !selectedNodeId) return;
    setCreateError(null);
    const err = validateNodeNameForDraft(draft.name);
    if (err) {
      setCreateError(err);
      nameInputRef.current?.focus();
      return;
    }
    if (!parentIdForDraft || !rootFolderJson) {
      setCreateError(uiText.alerts.errorCreateFailed);
      return;
    }

    const trimmedName = draft.name.trim();
    const trimmedCaption = trimmedName; // For images, name field is the caption
    const draftNodeId = selectedNodeId;
    const edgeId = parentIdForDraft
      ? `e_${parentIdForDraft}_${draftNodeId}`
      : null;
    setSaveStatus("saving");
    try {
      let result: any;
      if (isImageNode) {
        // Image node: get clipboard file and MIME type from draft node data
        const draftNode = (nodes ?? []).find((n: any) => n?.id === draftNodeId);
        const clipboardFile = (draftNode?.data as any)?.clipboardFile as File | null;
        const clipboardMimeType = (draftNode?.data as any)?.clipboardMimeType as string | null;
        if (!clipboardFile) {
          setCreateError("Image file not found. Please paste an image again.");
          setSaveStatus("idle");
          return;
        }
        const ext = clipboardMimeType ? getExtensionFromMimeType(clipboardMimeType) : "png";
        const fileName = trimmedCaption ? `${trimmedCaption}.${ext}` : `image_${Date.now()}.${ext}`;
        result = rootDirectoryHandle
          ? await fileManager.createImageFileChildFromHandle({
              dirHandle: rootDirectoryHandle,
              existing: rootFolderJson,
              parentNodeId: parentIdForDraft,
              fileName,
              imageFile: clipboardFile,
              caption: trimmedCaption,
              purpose: draft.purpose,
            })
          : await fileManager.createImageFileChildFromPath({
              dirPath: rootFolderJson.path,
              existing: rootFolderJson,
              parentNodeId: parentIdForDraft,
              fileName,
              imageFile: clipboardFile,
              caption: trimmedCaption,
              purpose: draft.purpose,
            });
      } else {
        const nextFileName = isFileNode
          ? splitDraftFileName(trimmedName).fullName
          : trimmedName;
        result = isFileNode
          ? rootDirectoryHandle
            ? await fileManager.createFileChildFromHandle({
                dirHandle: rootDirectoryHandle,
                existing: rootFolderJson,
                parentNodeId: parentIdForDraft,
                fileName: nextFileName,
                purpose: draft.purpose,
              })
            : await fileManager.createFileChildFromPath({
                dirPath: rootFolderJson.path,
                existing: rootFolderJson,
                parentNodeId: parentIdForDraft,
                fileName: nextFileName,
                purpose: draft.purpose,
              })
          : rootDirectoryHandle
          ? await fileManager.createFolderChildFromHandle({
              dirHandle: rootDirectoryHandle,
              existing: rootFolderJson,
              parentNodeId: parentIdForDraft,
              name: trimmedName,
              purpose: draft.purpose,
            })
          : await fileManager.createFolderChildFromPath({
              dirPath: rootFolderJson.path,
              existing: rootFolderJson,
              parentNodeId: parentIdForDraft,
              name: trimmedName,
              purpose: draft.purpose,
            });
      }
      // Fade out the draft node + edge before removing them.
      setNodes(
        (nodes ?? []).map((node: any) => {
          if (node?.id !== draftNodeId) return node;
          return {
            ...node,
            data: { ...(node.data ?? {}), isDraftClosing: true },
            style: {
              ...(node.style ?? {}),
              opacity: 0,
              transition: "opacity 180ms ease",
            },
          };
        })
      );
      if (edgeId) {
        setEdges(
          edges.map((edge: any) => {
            if (edge?.id !== edgeId) return edge;
            return {
              ...edge,
              data: { ...(edge.data ?? {}), isDraftClosing: true },
              style: {
                ...(edge.style ?? {}),
                opacity: 0,
                transition: "opacity 180ms ease",
              },
            };
          })
        );
      }
      setRoot(rootDirectoryHandle ?? null, result.root);
      setPendingChildCreation(null);
      selectNode(result.node.id);
      setDirty(false);
      setSaveStatus("saved");
      window.setTimeout(() => {
        const latest = useMindMapStore.getState();
        const latestTab = selectActiveTab(latest);
        const latestNodes = latestTab?.nodes ?? [];
        const latestEdges = latestTab?.edges ?? [];
        setNodes(latestNodes.filter((node: any) => node?.id !== draftNodeId));
        if (edgeId) {
          setEdges(latestEdges.filter((edge: any) => edge?.id !== edgeId));
        }
      }, 200);
    } catch (error) {
      console.error("[RightPanel] Create node failed:", error);
      setCreateError(uiText.alerts.errorCreateFailed);
      setSaveStatus("idle");
    }
  };

  const canRenameItem =
    (isFolderNode || isFileNode || isImageNode) && !isRootNode && !isDraftNode && !!selectedNodeId;

  const onRenameItem = async () => {
    if (!canRenameItem || !selectedNodeId || !rootFolderJson) return;
    setActionError(null);
    if (!renameActive) {
      setRenameActive(true);
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
      return;
    }
    const err = validateNodeNameForDraft(draft.name);
    if (err) {
      setActionError(err);
      nameInputRef.current?.focus();
      return;
    }
    if (!rootFolderJson.path) {
      setActionError(uiText.alerts.errorCreateFailed);
      return;
    }
    setSaveStatus("saving");
    try {
      let result: any;
      if (isImageNode) {
        // For images: rename the file using caption as base name, preserve extension
        const target = (nodes ?? []).find((n: any) => n?.id === selectedNodeId);
        const currentExt = typeof (target?.data as any)?.extension === "string"
          ? (target.data as any).extension
          : "png";
        const newFileName = draft.name.trim() ? `${draft.name.trim()}.${currentExt}` : `image.${currentExt}`;
        result = await fileManager.renameFileChildFromPath({
          dirPath: rootFolderJson.path,
          existing: rootFolderJson,
          nodeId: selectedNodeId,
          nextFileName: newFileName,
        });
      } else {
        result = isFileNode
          ? await fileManager.renameFileChildFromPath({
              dirPath: rootFolderJson.path,
              existing: rootFolderJson,
              nodeId: selectedNodeId,
              nextFileName: splitDraftFileName(draft.name.trim()).fullName,
            })
          : await fileManager.renameFolderChildFromPath({
              dirPath: rootFolderJson.path,
              existing: rootFolderJson,
              nodeId: selectedNodeId,
              newName: draft.name.trim(),
            });
      }
      setRoot(null, result.root);
      setRenameActive(false);
      setDirty(false);
      setSaveStatus("saved");
    } catch (error) {
      console.error("[RightPanel] Rename failed:", error);
      setActionError(uiText.alerts.errorCreateFailed);
      setSaveStatus("idle");
    }
  };

  const canDeleteItem =
    (isFolderNode || isFileNode || isImageNode) && !isRootNode && !isDraftNode && !!selectedNodeId;

  const onDeleteItem = async () => {
    if (!canDeleteItem || !selectedNodeId || !rootFolderJson) return;
    setActionError(null);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteItem = async () => {
    if (!canDeleteItem || !selectedNodeId || !rootFolderJson) return;
    setDeleteInProgress(true);
    if (!rootFolderJson.path) {
      setActionError(uiText.alerts.errorDeleteFailed);
      setDeleteInProgress(false);
      setDeleteConfirmOpen(false);
      return;
    }
    setSaveStatus("saving");
    try {
      // Both file and image nodes use deleteFileChildFromPath (images are stored as IndexFileNode)
      const result = (isFileNode || isImageNode)
        ? await fileManager.deleteFileChildFromPath({
            dirPath: rootFolderJson.path,
            existing: rootFolderJson,
            nodeId: selectedNodeId,
          })
        : await fileManager.deleteFolderChildFromPath({
            dirPath: rootFolderJson.path,
            existing: rootFolderJson,
            nodeId: selectedNodeId,
          });
      setRoot(null, result.root);
      setDirty(false);
      setSaveStatus("saved");
      setDeleteConfirmOpen(false);
    } catch (error) {
      console.error("[RightPanel] Delete failed:", error);
      setActionError(uiText.alerts.errorDeleteFailed);
      setSaveStatus("idle");
    } finally {
      setDeleteInProgress(false);
    }
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
                <div
                  style={{
                    borderRadius: "var(--radius-md)",
                    border: "var(--border-width) solid var(--border)",
                    background: "var(--surface-2)",
                    padding: "var(--space-2)",
                  }}
                >
                  <div
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 2,
                      background: "var(--surface-2)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setFileDetailsExpanded((prev) => !prev)}
                      aria-expanded={fileDetailsExpanded}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        letterSpacing: "0.02em",
                        textTransform: "uppercase",
                        opacity: 0.85,
                        paddingBottom: "calc(var(--space-1) + 20px)",
                        marginBottom: "calc(var(--space-1) + 20px)",
                        borderBottom: "var(--border-width) solid var(--border)",
                        border: "none",
                        background: "transparent",
                        color: "inherit",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span>{uiText.fields.nodeDetails.sectionTitle}</span>
                      <span aria-hidden="true">
                        {fileDetailsExpanded ? "−" : "+"}
                      </span>
                    </button>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gap: "var(--space-2)",
                      width: "100%",
                      minWidth: 0,
                    }}
                  >
                    {fileDetailsExpanded && (
                      <>
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
                            <div style={{ fontWeight: 600, fontSize: "0.8rem" }}>
                              {isImageNode ? uiText.fields.nodeDetails.caption : uiText.fields.nodeDetails.name}
                            </div>
                            <input
                              ref={nameInputRef}
                              value={draft.name}
                              onChange={(e) => onFieldChange("name")(e.target.value)}
                              onBlur={() => {
                                void commitSave();
                              }}
                              placeholder={isImageNode ? "Enter caption" : uiText.placeholders.nodeName}
                              aria-label={isImageNode ? uiText.fields.nodeDetails.caption : uiText.fields.nodeDetails.name}
                              disabled={!isDraftNode && !renameActive}
                              style={{
                                // Input fills 100% of its label container.
                                width: "100%",
                                minWidth: 0,
                                // Border-box ensures padding/border are included in width calculation.
                                boxSizing: "border-box",
                                borderRadius: "var(--radius-md)",
                                // Visually highlight the required field for draft nodes.
                                border: isDraftNode || renameActive
                                  ? "var(--border-width) solid var(--primary-color)"
                                  : "var(--border-width) solid var(--border)",
                                padding: "var(--space-2)",
                                background: isDraftNode || renameActive
                                  ? "var(--surface-1)"
                                  : "var(--surface-2)",
                                color: "var(--text)",
                                fontFamily: "var(--font-family)",
                                boxShadow: isDraftNode || renameActive
                                  ? "0 0 0 2px rgba(100, 108, 255, 0.2)"
                                  : "none",
                                cursor:
                                  isDraftNode || renameActive
                                    ? "text"
                                    : "not-allowed",
                                opacity: isDraftNode || renameActive ? 1 : 0.7,
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
                          <div style={{ fontWeight: 600, fontSize: "0.8rem" }}>
                            {isDecisionNode
                              ? uiText.fields.nodeDetails.decisionStatement
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
                              ref={purposeTextareaRef}
                              value={draft.purpose}
                              onChange={(e) =>
                                onFieldChange("purpose")(e.target.value)
                              }
                              onBlur={() => {
                                void commitSave();
                              }}
                              placeholder={uiText.placeholders.nodePurpose}
                              aria-label={uiText.fields.nodeDetails.purpose}
                              rows={2}
                              style={{
                                // Textarea fills 100% of its label container.
                                width: "100%",
                                minWidth: 0,
                                // Border-box ensures padding/border are included in width calculation.
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
                          )}
                        </label>
                      </>
                    )}

                    {/* Image preview for image nodes */}
                    {isImageNode && (
                      <div
                        style={{
                          marginTop: "var(--space-4)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "var(--space-2)",
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: "0.8rem" }}>
                          Image
                        </div>
                        <div
                          style={{
                            width: "100%",
                            maxHeight: "400px",
                            borderRadius: "var(--radius-md)",
                            border: "var(--border-width) solid var(--border)",
                            background: "var(--surface-2)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                            minHeight: "120px",
                          }}
                        >
                          {imageLoadError ? (
                            <div
                              style={{
                                padding: "var(--space-4)",
                                textAlign: "center",
                                color: "var(--text-secondary)",
                                fontSize: "0.85rem",
                                opacity: 0.7,
                              }}
                            >
                              Image could not be loaded
                            </div>
                          ) : imageSrc ? (
                            <img
                              src={imageSrc}
                              alt=""
                              style={{
                                width: "100%",
                                height: "auto",
                                maxHeight: "400px",
                                objectFit: "contain",
                                display: "block",
                              }}
                              onError={() => {
                                setImageLoadError(true);
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                padding: "var(--space-4)",
                                textAlign: "center",
                                color: "var(--text-secondary)",
                                fontSize: "0.85rem",
                                opacity: 0.7,
                              }}
                            >
                              Loading image...
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      marginTop: "var(--space-2)",
                      fontSize: "0.75em",
                      opacity: 0.9,
                    }}
                  >
                    {fileDetailsExpanded &&
                      (saveStatus === "saving"
                        ? uiText.statusMessages.saving
                        : saveStatus === "saved"
                        ? uiText.statusMessages.saved
                        : uiText.statusMessages.idle)}
                  </div>
                </div>

                {isDecisionNode && (
                  <label
                    style={{
                      display: "grid",
                      gap: "var(--space-2)",
                      width: "100%",
                      minWidth: 0,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>
                      {uiText.fields.nodeDetails.decisionDetailsLabel}
                    </div>
                    <textarea
                      ref={detailsTextareaRef}
                      value={draft.details}
                      onChange={(e) =>
                        onFieldChange("details")(e.target.value)
                      }
                      onBlur={() => {
                        void commitSave();
                      }}
                      placeholder={uiText.placeholders.nodeDecisionDetails}
                      aria-label={uiText.fields.nodeDetails.decisionDetailsLabel}
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

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                  flex: 1,
                  minHeight: 0,
                }}
              >
                <SmartPad
                  selectedNode={selectedNode}
                  rootDirectoryHandle={rootDirectoryHandle}
                />

                {isDraftNode && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => void onCreateDraft()}
                      disabled={!canCreateDraft}
                      style={{
                        borderRadius: "999px",
                        border: "var(--border-width) solid var(--border)",
                        background: canCreateDraft
                          ? "var(--surface-1)"
                          : "var(--surface-2)",
                        color: "var(--text)",
                        padding: "4px 12px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        cursor: canCreateDraft ? "pointer" : "not-allowed",
                        opacity: canCreateDraft ? 1 : 0.6,
                      }}
                    >
                      {uiText.buttons.create}
                    </button>
                    {createError && (
                      <div
                        style={{
                          fontSize: "0.8em",
                          color: "var(--danger, #e5484d)",
                          opacity: 0.95,
                        }}
                      >
                        {createError}
                      </div>
                    )}
                  </div>
                )}

                {canRenameItem || canDeleteItem ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                      flexWrap: "wrap",
                    }}
                  >
                    {canRenameItem && (
                      <button
                        type="button"
                        onClick={() => void onRenameItem()}
                        style={{
                          borderRadius: "999px",
                          border: "var(--border-width) solid var(--border)",
                          background: renameActive
                            ? "var(--surface-1)"
                            : "var(--surface-2)",
                          color: "var(--text)",
                          padding: "4px 12px",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {renameActive ? uiText.buttons.save : uiText.buttons.rename}
                      </button>
                    )}
                    {canDeleteItem && (
                      <button
                        type="button"
                        onClick={() => void onDeleteItem()}
                        disabled={deleteInProgress}
                        style={{
                          borderRadius: "999px",
                          border: "var(--border-width) solid var(--border)",
                          background: "var(--surface-2)",
                          color: "var(--danger, #e5484d)",
                          padding: "4px 12px",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          cursor: deleteInProgress ? "not-allowed" : "pointer",
                          opacity: deleteInProgress ? 0.6 : 1,
                        }}
                      >
                        {uiText.buttons.delete}
                      </button>
                    )}
                    {actionError && (
                      <div
                        style={{
                          fontSize: "0.8em",
                          color: "var(--danger, #e5484d)",
                          opacity: 0.95,
                        }}
                      >
                        {actionError}
                      </div>
                    )}
                  </div>
                ) : null}

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

              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="pm-panel__collapsed" aria-hidden="true" />
      )}
      {deleteConfirmOpen && (
        <div
          role="dialog"
          aria-label={
            isFileNode ? uiText.alerts.confirmDeleteFile : uiText.alerts.confirmDeleteFolder
          }
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.4)",
            zIndex: 80,
            padding: "var(--space-3)",
          }}
        >
          <div
            style={{
              minWidth: 220,
              maxWidth: 320,
              borderRadius: "var(--radius-md)",
              border: "var(--border-width) solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--text)",
              padding: "12px",
              boxShadow: "0 12px 28px rgba(0,0,0,0.35)",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: "8px" }}>
              {isFileNode ? uiText.alerts.confirmDeleteFile : uiText.alerts.confirmDeleteFolder}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
              }}
            >
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                style={{
                  borderRadius: "999px",
                  border: "var(--border-width) solid var(--border)",
                  background: "var(--surface-1)",
                  color: "var(--text)",
                  padding: "4px 12px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {uiText.buttons.cancel}
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteItem()}
                disabled={deleteInProgress}
                style={{
                  borderRadius: "999px",
                  border: "var(--border-width) solid var(--border)",
                  background: "var(--surface-2)",
                  color: "var(--danger, #e5484d)",
                  padding: "4px 12px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: deleteInProgress ? "not-allowed" : "pointer",
                  opacity: deleteInProgress ? 0.6 : 1,
                }}
              >
                {uiText.buttons.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
