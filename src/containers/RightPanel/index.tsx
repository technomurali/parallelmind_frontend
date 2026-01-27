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
import { marked } from "marked";
import { uiText } from "../../constants/uiText";
import { DEFAULT_PURPOSE_TEMPLATE } from "../../constants/defaultPurposeTemplate";
import { FileManager, type RootFolderJson } from "../../data/fileManager";
import {
  FLOWCHART_NODE_DEFINITIONS,
  FlowchartNodeIcons,
  isFlowchartNodeType,
  type FlowchartNodeType,
} from "../MindMap/flowchartnode";
import {
  CognitiveNotesManager,
  type CognitiveNotesJson,
} from "../../extensions/cognitiveNotes/data/cognitiveNotesManager";
import { useAutoSave } from "../../hooks/useAutoSave";
import SmartPad from "../../components/SmartPad";
import { parseYouTubeVideoId } from "../../utils/youtube";

type YoutubeSettings = {
  startSeconds: number;
  endSeconds: number;
  loop: boolean;
  mute: boolean;
  controls: boolean;
};

const DEFAULT_YT_SETTINGS: YoutubeSettings = {
  startSeconds: 0,
  endSeconds: 0,
  loop: false,
  mute: false,
  controls: true,
};

const normalizeYoutubeSettings = (value: unknown): YoutubeSettings => {
  if (!value || typeof value !== "object") return { ...DEFAULT_YT_SETTINGS };
  const settings = value as Partial<YoutubeSettings>;
  const startSeconds =
    typeof settings.startSeconds === "number" && Number.isFinite(settings.startSeconds)
      ? Math.max(0, settings.startSeconds)
      : DEFAULT_YT_SETTINGS.startSeconds;
  const endSeconds =
    typeof settings.endSeconds === "number" && Number.isFinite(settings.endSeconds)
      ? Math.max(0, settings.endSeconds)
      : DEFAULT_YT_SETTINGS.endSeconds;
  return {
    startSeconds,
    endSeconds,
    loop: !!settings.loop,
    mute: !!settings.mute,
    controls:
      typeof settings.controls === "boolean"
        ? settings.controls
        : DEFAULT_YT_SETTINGS.controls,
  };
};

/**
 * RightPanel component
 *
 * Renders the right sidebar with node details and editor.
 * Handles panel resizing via mouse drag on the left resize handle.
 */
export default function RightPanel() {
  const rightPanelWidth = useMindMapStore((s) => s.rightPanelWidth);
  const setRightPanelWidth = useMindMapStore((s) => s.setRightPanelWidth);
  const rightPanelMode = useMindMapStore((s) => s.rightPanelMode);
  const setRightPanelMode = useMindMapStore((s) => s.setRightPanelMode);
  const settings = useMindMapStore((s) => s.settings);
  const activeTab = useMindMapStore(selectActiveTab);
  const selectedNodeId = activeTab?.selectedNodeId ?? null;
  const selectedEdgeId = activeTab?.selectedEdgeId ?? null;
  const nodes = activeTab?.nodes ?? [];
  const edges = activeTab?.edges ?? [];
  const cognitiveNotesRoot = activeTab?.cognitiveNotesRoot ?? null;
  const moduleType = activeTab?.moduleType ?? null;
  const cognitiveNotesDirectoryHandle =
    activeTab?.cognitiveNotesDirectoryHandle ?? null;
  const cognitiveNotesFolderPath = activeTab?.cognitiveNotesFolderPath ?? null;
  const updateNodeData = useMindMapStore((s) => s.updateNodeData);
  const setNodes = useMindMapStore((s) => s.setNodes);
  const setEdges = useMindMapStore((s) => s.setEdges);
  const setCanvasSaveStatus = useMindMapStore((s) => s.setCanvasSaveStatus);
  const pendingChildCreation = activeTab?.pendingChildCreation ?? null;
  const finalizePendingChildCreation = useMindMapStore(
    (s) => s.finalizePendingChildCreation
  );
  const setPendingChildCreation = useMindMapStore(
    (s) => s.setPendingChildCreation
  );
  const rootDirectoryHandle = activeTab?.rootDirectoryHandle ?? null;
  const rootFolderJson = activeTab?.rootFolderJson ?? null;
  const lastCanvasPosition = activeTab?.lastCanvasPosition ?? null;
  const canvasCenter = activeTab?.canvasCenter ?? null;
  const updateCognitiveNotesRoot = useMindMapStore(
    (s) => s.updateCognitiveNotesRoot
  );
  const setRoot = useMindMapStore((s) => s.setRoot);
  const updateRootFolderJson = useMindMapStore((s) => s.updateRootFolderJson);
  const selectNode = useMindMapStore((s) => s.selectNode);
  const selectEdge = useMindMapStore((s) => s.selectEdge);

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
  const cognitiveNotesManager = useMemo(() => new CognitiveNotesManager(), []);
  // Draft state lives only in this container to satisfy "single container rule".
  const [draft, setDraft] = useState({
    name: "",
    purpose: "",
    details: "",
    youtube_url: "",
    youtube_video_id: "",
    yt_settings: DEFAULT_YT_SETTINGS,
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
  const [detailsFileStatus, setDetailsFileStatus] = useState<
    "idle" | "creating" | "created" | "error"
  >("idle");
  const [detailsFileError, setDetailsFileError] = useState<string | null>(null);
  const [fileDetailsExpanded, setFileDetailsExpanded] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>("");
  const [imageLoadError, setImageLoadError] = useState(false);
  const [edgeDraft, setEdgeDraft] = useState({ purpose: "" });
  const [edgeDirty, setEdgeDirty] = useState(false);
  const [edgeSaveStatus, setEdgeSaveStatus] = useState<
    "idle" | "saving" | "saved"
  >("idle");
  const [edgeDeleteConfirmOpen, setEdgeDeleteConfirmOpen] = useState(false);
  const [sortIndexDraft, setSortIndexDraft] = useState<number | "">("");
  const [sortIndexDirty, setSortIndexDirty] = useState(false);
  const [sortIndexSaveStatus, setSortIndexSaveStatus] = useState<
    "idle" | "saving" | "saved"
  >("idle");
  const [notesFeedSourceId, setNotesFeedSourceId] = useState<string | null>(null);
  const [notesFeedItems, setNotesFeedItems] = useState<
    { id: string; title: string; contentHtml: string }[]
  >([]);
  const [notesFeedLoading, setNotesFeedLoading] = useState(false);
  const [notesFeedHiddenIds, setNotesFeedHiddenIds] = useState<Set<string>>(
    () => new Set()
  );

  const hideNotesFeedItem = (id: string) => {
    if (!id) return;
    setNotesFeedHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (!selectedNodeId) return;
    if (rightPanelMode === "notesFeed" && selectedNodeId === notesFeedSourceId) {
      return;
    }
    setRightPanelMode("nodeDetails");
  }, [selectedNodeId, setRightPanelMode, rightPanelMode, notesFeedSourceId]);

  // Used to auto-focus and visually guide the user when name is mandatory.
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const purposeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const detailsTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastHydratedSelectedIdRef = useRef<string | null>(null);
  const lastHydratedEdgeIdRef = useRef<string | null>(null);

  // Pull selected node data from the centralized store and hydrate the editor when selection changes.
  useEffect(() => {
    // We only want to "reset" draft/dirty status when selection actually changes.
    // If we reset on every `nodes` mutation, we can accidentally cancel the debounced
    // auto-save timer while the user is typing (ReactFlow can emit node updates for
    // selection/dragging/etc.). That would block the name-gated finalize step too.
    const selectionChanged =
      lastHydratedSelectedIdRef.current !== selectedNodeId;

    if (!selectedNodeId) {
      setDraft({
        name: "",
        purpose: "",
        details: "",
        youtube_url: "",
        youtube_video_id: "",
        yt_settings: DEFAULT_YT_SETTINGS,
      });
      setSaveStatus("idle");
      setDirty(false);
      setCreateError(null);
      setRenameActive(false);
      setActionError(null);
      setDeleteConfirmOpen(false);
      setDeleteInProgress(false);
      setDetailsFileStatus("idle");
      setDetailsFileError(null);
      setSortIndexDraft("");
      setSortIndexDirty(false);
      setSortIndexSaveStatus("idle");
      lastHydratedSelectedIdRef.current = null;
      return;
    }

    const node = (nodes ?? []).find((n: any) => n?.id === selectedNodeId);
    const data = (node?.data ?? {}) as any;
    const isFile =
      data?.node_type === "file" || data?.type === "file" || node?.type === "file";
    const isImage =
      data?.node_type === "polaroidImage" ||
      data?.type === "polaroidImage" ||
      node?.type === "polaroidImage" ||
      data?.node_type === "fullImageNode" ||
      data?.type === "fullImageNode" ||
      node?.type === "fullImageNode";
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
    const youtubeUrl =
      typeof data.youtube_url === "string" ? data.youtube_url : "";
    const youtubeVideoId =
      typeof data.youtube_video_id === "string"
        ? data.youtube_video_id
        : parseYouTubeVideoId(youtubeUrl) ?? "";
    const ytSettings = normalizeYoutubeSettings(data.yt_settings);

    // If the selection changed, re-hydrate and reset editing state.
    // If only `nodes` changed while the user is typing (dirty=true), do not clobber
    // the draft or we will cancel the debounced save and confuse the creation flow.
    if (selectionChanged || !dirty) {
      setDraft({
        name: hydratedName,
        purpose: typeof data.purpose === "string" ? data.purpose : "",
        details: typeof data.details === "string" ? data.details : "",
        youtube_url: youtubeUrl,
        youtube_video_id: youtubeVideoId,
        yt_settings: ytSettings,
      });
      const sortIndexValue =
        typeof data.sort_index === "number" && Number.isFinite(data.sort_index)
          ? data.sort_index
          : "";
      setSortIndexDraft(sortIndexValue);
    }
    if (selectionChanged) {
      setSaveStatus("idle");
      setDirty(false);
      setCreateError(null);
      setRenameActive(false);
      setActionError(null);
      setDeleteConfirmOpen(false);
      setDeleteInProgress(false);
      setDetailsFileStatus("idle");
      setDetailsFileError(null);
      setSortIndexDirty(false);
      setSortIndexSaveStatus("idle");
    }
    lastHydratedSelectedIdRef.current = selectedNodeId;
  }, [nodes, selectedNodeId]);

  const selectedEdge = selectedEdgeId
    ? (edges ?? []).find((edge: any) => edge?.id === selectedEdgeId) ?? null
    : null;

  useEffect(() => {
    const selectionChanged = lastHydratedEdgeIdRef.current !== selectedEdgeId;

    if (!selectedEdgeId || !selectedEdge) {
      setEdgeDraft({ purpose: "" });
      setEdgeDirty(false);
      setEdgeSaveStatus("idle");
      setEdgeDeleteConfirmOpen(false);
      lastHydratedEdgeIdRef.current = null;
      return;
    }

    if (selectionChanged || !edgeDirty) {
      const purpose =
        typeof (selectedEdge.data as any)?.purpose === "string"
          ? (selectedEdge.data as any).purpose
          : "";
      setEdgeDraft({ purpose });
    }

    if (selectionChanged) {
      setEdgeSaveStatus("idle");
      setEdgeDirty(false);
      setEdgeDeleteConfirmOpen(false);
    }
    lastHydratedEdgeIdRef.current = selectedEdgeId;
  }, [selectedEdgeId, selectedEdge, edgeDirty]);

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
  const flowchartType =
    (selectedNode?.data as any)?.node_type ?? (selectedNode as any)?.type;
  const isFlowchartNode = isFlowchartNodeType(flowchartType);
  const isYoutubeNode = flowchartType === "flowchart.youtube";
  const isNonPersistentNode = !!(selectedNode?.data as any)?.nonPersistent;
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
    selectedNode?.type === "file" ||
    selectedNode?.type === "shieldFile";
  const isImageNode =
    (selectedNode?.data as any)?.node_type === "polaroidImage" ||
    (selectedNode?.data as any)?.type === "polaroidImage" ||
    selectedNode?.type === "polaroidImage" ||
    (selectedNode?.data as any)?.node_type === "fullImageNode" ||
    (selectedNode?.data as any)?.type === "fullImageNode" ||
    selectedNode?.type === "fullImageNode";
  const isShieldFileNode =
    isFileNode &&
    (((selectedNode?.data as any)?.node_variant as string) === "shieldFile" ||
      selectedNode?.type === "shieldFile");
  const detailsPath =
    typeof (selectedNode?.data as any)?.details_path === "string"
      ? ((selectedNode?.data as any)?.details_path as string)
      : "";
  const detailsOptOut = !!(selectedNode?.data as any)?.details_opt_out;
  const shouldOfferDetailsFile =
    isFlowchartNode || isShieldFileNode || isImageNode;
  const youtubeSettings = draft.yt_settings ?? DEFAULT_YT_SETTINGS;
  const showSortIndex =
    moduleType === "cognitiveNotes" &&
    !isRootNode &&
    (isFileNode || isImageNode);
  const sortIndexOptions = useMemo(() => {
    if (!showSortIndex || !cognitiveNotesRoot) return [];
    const total = cognitiveNotesRoot.child?.length ?? 0;
    const used = new Set<number>();
    (cognitiveNotesRoot.child ?? []).forEach((node: any) => {
      if (!node || node.id === selectedNodeId) return;
      if (typeof node.sort_index === "number" && Number.isFinite(node.sort_index)) {
        used.add(node.sort_index);
      }
    });
    const options: number[] = [];
    for (let i = 1; i <= total; i += 1) {
      if (!used.has(i) || sortIndexDraft === i) {
        options.push(i);
      }
    }
    return options;
  }, [showSortIndex, cognitiveNotesRoot, selectedNodeId, sortIndexDraft]);

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

    if (isFlowchartNode) return null;

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
    const shouldOpen = !!selectedNodeId && isDraftNode;
    setFileDetailsExpanded(shouldOpen);
  }, [selectedNodeId, isDraftNode]);

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
        youtube_url: draft.youtube_url,
        youtube_video_id: draft.youtube_video_id,
        yt_settings: draft.yt_settings,
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
      youtube_url: draft.youtube_url,
      youtube_video_id: draft.youtube_video_id,
      yt_settings: draft.yt_settings,
    });

    if (isFlowchartNode) {
      const nowIso = new Date().toISOString();
      const flowType =
        (selectedNode?.data as any)?.node_type ?? (selectedNode as any)?.type ?? "";
      if (moduleType === "cognitiveNotes") {
        if (cognitiveNotesRoot) {
          const nextFlowNodes = upsertFlowchartNode(
            cognitiveNotesRoot.flowchart_nodes ?? [],
            {
              id: selectedNodeId,
              type: flowType,
              name: draft.name.trim(),
              purpose: draft.purpose,
              youtube_url: draft.youtube_url,
              youtube_video_id: draft.youtube_video_id,
              yt_settings: draft.yt_settings,
              updated_on: nowIso,
            }
          );
          await persistCognitiveNotesRoot({
            ...cognitiveNotesRoot,
            updated_on: nowIso,
            flowchart_nodes: nextFlowNodes,
          });
        }
      } else if (rootFolderJson) {
        const nextFlowNodes = upsertFlowchartNode(
          rootFolderJson.flowchart_nodes ?? [],
          {
            id: selectedNodeId,
            type: flowType,
            name: draft.name.trim(),
            purpose: draft.purpose,
            youtube_url: draft.youtube_url,
            youtube_video_id: draft.youtube_video_id,
            yt_settings: draft.yt_settings,
            updated_on: nowIso,
          }
        );
        await persistParallelmindRoot({
          ...rootFolderJson,
          updated_on: nowIso,
          flowchart_nodes: nextFlowNodes,
        });
      }
      setDirty(false);
      setSaveStatus("saved");
      return;
    }

    if (isDecisionNode) {
      setDirty(false);
      setSaveStatus("saved");
      return;
    }

    // Persist to <root>_rootIndex.json only for the root node (existing mechanism).
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
        flowchart_nodes: rootFolderJson?.flowchart_nodes ?? [],
        flowchart_edges: rootFolderJson?.flowchart_edges ?? [],
        child: rootFolderJson?.child ?? [],
      };

      setCanvasSaveStatus("saving");
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
        setCanvasSaveStatus("saved");
      } catch (error) {
        console.error("[RightPanel] Failed to save rootIndex json:", error);
        setDirty(true); // Keep dirty state so user knows save failed
        setSaveStatus("idle");
        setCanvasSaveStatus("error");
      }
    } else {
      const hasDirectoryHandle = !!rootDirectoryHandle;
      const hasPath = !!(rootFolderJson?.path && rootFolderJson.path.trim() !== "");
      if (!hasDirectoryHandle && !hasPath) {
        setDirty(true);
        setSaveStatus("idle");
        return;
      }

      setCanvasSaveStatus("saving");
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
        setCanvasSaveStatus("saved");
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
        setCanvasSaveStatus("error");
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

  const persistCognitiveNotesRoot = async (nextRoot: CognitiveNotesJson) => {
    updateCognitiveNotesRoot(nextRoot);
    setCanvasSaveStatus("saving");
    try {
      if (cognitiveNotesDirectoryHandle) {
        await cognitiveNotesManager.writeCognitiveNotesJson(
          cognitiveNotesDirectoryHandle,
          nextRoot
        );
      } else {
        const targetPath = cognitiveNotesFolderPath ?? nextRoot.path ?? "";
        if (targetPath) {
          await cognitiveNotesManager.writeCognitiveNotesJsonFromPath(
            targetPath,
            nextRoot
          );
        }
      }
      setCanvasSaveStatus("saved");
    } catch (err) {
      console.error("[RightPanel] Failed to save cognitive notes:", err);
      setCanvasSaveStatus("error");
    }
  };

  const persistParallelmindRoot = async (nextRoot: RootFolderJson) => {
    updateRootFolderJson(nextRoot);
    setCanvasSaveStatus("saving");
    try {
      if (rootDirectoryHandle) {
        await fileManager.writeRootFolderJson(rootDirectoryHandle, nextRoot);
      } else if (nextRoot.path) {
        await fileManager.writeRootFolderJsonFromPath(nextRoot.path, nextRoot);
      } else {
        throw new Error("Root folder path is missing.");
      }
      setCanvasSaveStatus("saved");
    } catch (err) {
      console.error("[RightPanel] Failed to save flowchart nodes:", err);
      setCanvasSaveStatus("error");
    }
  };

  const upsertFlowchartNode = (
    list: {
      id: string;
      type: string;
      name: string;
      purpose: string;
      created_on: string;
      updated_on: string;
      youtube_url?: string;
      youtube_video_id?: string;
      yt_settings?: YoutubeSettings;
    }[],
    payload: {
      id: string;
      type: string;
      name: string;
      purpose: string;
      updated_on: string;
      youtube_url?: string;
      youtube_video_id?: string;
      yt_settings?: YoutubeSettings;
    }
  ) => {
    const index = list.findIndex((node) => node.id === payload.id);
    if (index >= 0) {
      const existing = list[index];
      const updated = {
        ...existing,
        type: payload.type || existing.type,
        name: payload.name,
        purpose: payload.purpose,
        youtube_url:
          typeof payload.youtube_url === "string"
            ? payload.youtube_url
            : existing.youtube_url,
        youtube_video_id:
          typeof payload.youtube_video_id === "string"
            ? payload.youtube_video_id
            : existing.youtube_video_id,
        yt_settings: payload.yt_settings ?? existing.yt_settings,
        updated_on: payload.updated_on,
      };
      return [
        ...list.slice(0, index),
        updated,
        ...list.slice(index + 1),
      ];
    }
    return [
      ...list,
      {
        id: payload.id,
        type: payload.type,
        name: payload.name,
        purpose: payload.purpose,
        youtube_url: payload.youtube_url,
        youtube_video_id: payload.youtube_video_id,
        yt_settings: payload.yt_settings,
        created_on: payload.updated_on,
        updated_on: payload.updated_on,
      },
    ];
  };

  // Debounced auto-save: "Saving..." while debounce is active, "Saved" after commit.
  useAutoSave(
    () => {
      void commitSave();
    },
    3000,
    [
      draft.name,
      draft.purpose,
      draft.details,
      draft.youtube_url,
      draft.youtube_video_id,
      draft.yt_settings,
      selectedNodeId,
      dirty,
    ],
    dirty
  );

  useAutoSave(
    () => {
      if (!selectedEdgeId) return;
      const nextPurpose = edgeDraft.purpose;
      setEdges(
        (edges ?? []).map((edge: any) =>
          edge?.id === selectedEdgeId
            ? {
                ...edge,
                data: { ...(edge.data ?? {}), purpose: nextPurpose },
              }
            : edge
        )
      );
      if (cognitiveNotesRoot) {
        const updatedChild = (cognitiveNotesRoot.child ?? []).map((node: any) => ({
          ...node,
          related_nodes: Array.isArray(node.related_nodes)
            ? node.related_nodes.map((rel: any) =>
                rel?.edge_id === selectedEdgeId
                  ? { ...rel, purpose: nextPurpose }
                  : rel
              )
            : [],
        }));
        useMindMapStore.getState().setCognitiveNotesRoot({
          ...cognitiveNotesRoot,
          child: updatedChild,
        });
      }
      setEdgeDirty(false);
      setEdgeSaveStatus("saved");
    },
    3000,
    [edgeDraft.purpose, selectedEdgeId, edgeDirty, edges],
    edgeDirty
  );

  useAutoSave(
    () => {
      if (moduleType !== "cognitiveNotes") return;
      if (!selectedNodeId || !cognitiveNotesRoot) return;
      if (selectedNodeId === "00") return;
      const nextSortIndex =
        typeof sortIndexDraft === "number" && Number.isFinite(sortIndexDraft)
          ? sortIndexDraft
          : null;
      setNodes(
        (nodes ?? []).map((node: any) =>
          node?.id === selectedNodeId
            ? {
                ...node,
                data: { ...(node.data ?? {}), sort_index: nextSortIndex },
              }
            : node
        )
      );
      const nextChild = (cognitiveNotesRoot.child ?? []).map((node: any) =>
        node?.id === selectedNodeId
          ? { ...node, sort_index: nextSortIndex }
          : node
      );
      void persistCognitiveNotesRoot({ ...cognitiveNotesRoot, child: nextChild });
      setSortIndexDirty(false);
      setSortIndexSaveStatus("saved");
    },
    3000,
    [
      sortIndexDraft,
      selectedNodeId,
      sortIndexDirty,
      moduleType,
      cognitiveNotesRoot,
      nodes,
    ],
    sortIndexDirty
  );

  const onFieldChange =
    (field: "name" | "purpose" | "details") => (value: string) => {
      setDraft((d) => ({ ...d, [field]: value }));
      // Only show "Saving..." when the user has actually made edits.
      setDirty(true);
      setSaveStatus("saving");
    };

  const onYoutubeUrlChange = (value: string) => {
    const videoId = parseYouTubeVideoId(value) ?? "";
    setDraft((d) => ({
      ...d,
      youtube_url: value,
      youtube_video_id: videoId,
    }));
    setDirty(true);
    setSaveStatus("saving");
  };

  const onYoutubeSettingsChange = (partial: Partial<YoutubeSettings>) => {
    setDraft((d) => ({
      ...d,
      yt_settings: {
        ...d.yt_settings,
        ...partial,
      },
    }));
    setDirty(true);
    setSaveStatus("saving");
  };

  const onEdgePurposeChange = (value: string) => {
    setEdgeDraft((d) => ({ ...d, purpose: value }));
    setEdgeDirty(true);
    setEdgeSaveStatus("saving");
  };

  const onSortIndexChange = (value: string) => {
    if (!value) {
      setSortIndexDraft("");
    } else {
      const parsed = Number(value);
      setSortIndexDraft(Number.isFinite(parsed) ? parsed : "");
    }
    setSortIndexDirty(true);
    setSortIndexSaveStatus("saving");
  };

  const onDeleteSelectedEdge = () => {
    if (!selectedEdgeId) return;
    setEdges((edges ?? []).filter((edge: any) => edge?.id !== selectedEdgeId));
    setEdgeDeleteConfirmOpen(false);
    selectNode(null);
    selectEdge(null);
    if (cognitiveNotesRoot) {
      const nextChild = (cognitiveNotesRoot.child ?? []).map((node: any) => ({
        ...node,
        related_nodes: Array.isArray(node.related_nodes)
          ? node.related_nodes.filter(
              (rel: any) => rel?.edge_id !== selectedEdgeId
            )
          : [],
      }));
      void persistCognitiveNotesRoot({
        ...cognitiveNotesRoot,
        child: nextChild,
      });
    }
  };

  const updateFlowchartNodeDetails = (
    list: any[],
    nodeId: string,
    details: { details_path?: string; details_opt_out?: boolean }
  ): any[] => {
    const updatedAt = new Date().toISOString();
    return (list ?? []).map((node) =>
      node?.id === nodeId
        ? { ...node, ...details, updated_on: updatedAt }
        : node
    );
  };

  const updateFileNodeDetails = (
    list: any[],
    nodeId: string,
    details: { details_path?: string; details_opt_out?: boolean }
  ): { nodes: any[]; updated: boolean } => {
    let updated = false;
    const next = (list ?? []).map((node) => {
      if (!node) return node;
      if (node.id === nodeId) {
        updated = true;
        return { ...node, ...details };
      }
      if (Array.isArray(node.child)) {
        const childResult = updateFileNodeDetails(node.child, nodeId, details);
        if (childResult.updated) {
          updated = true;
          return { ...node, child: childResult.nodes };
        }
      }
      return node;
    });
    return { nodes: next, updated };
  };

  const persistDetailsLink = async (payload: {
    detailsPath?: string;
    detailsOptOut?: boolean;
  }) => {
    if (!selectedNodeId) return;
    updateNodeData(selectedNodeId, {
      details_path: payload.detailsPath,
      details_opt_out: payload.detailsOptOut,
    });

    if (isFlowchartNode) {
      if (moduleType === "cognitiveNotes" && cognitiveNotesRoot) {
        const nextFlowchartNodes = updateFlowchartNodeDetails(
          cognitiveNotesRoot.flowchart_nodes ?? [],
          selectedNodeId,
          {
            details_path: payload.detailsPath,
            details_opt_out: payload.detailsOptOut,
          }
        );
        await persistCognitiveNotesRoot({
          ...cognitiveNotesRoot,
          flowchart_nodes: nextFlowchartNodes,
        });
      } else if (rootFolderJson) {
        const nextFlowchartNodes = updateFlowchartNodeDetails(
          rootFolderJson.flowchart_nodes ?? [],
          selectedNodeId,
          {
            details_path: payload.detailsPath,
            details_opt_out: payload.detailsOptOut,
          }
        );
        await persistParallelmindRoot({
          ...rootFolderJson,
          flowchart_nodes: nextFlowchartNodes,
        });
      }
      return;
    }

    if (isShieldFileNode && rootFolderJson) {
      const updatedTree = updateFileNodeDetails(
        rootFolderJson.child ?? [],
        selectedNodeId,
        {
          details_path: payload.detailsPath,
          details_opt_out: payload.detailsOptOut,
        }
      );
      if (updatedTree.updated) {
        await persistParallelmindRoot({
          ...rootFolderJson,
          child: updatedTree.nodes,
        });
      }
    }
  };

  const createAssociatedTextFile = async () => {
    if (!selectedNodeId) return;
    const trimmedName = draft.name.trim();
    if (!trimmedName) {
      setDetailsFileStatus("error");
      setDetailsFileError("Name is required before creating a text file.");
      return;
    }
    setDetailsFileStatus("creating");
    setDetailsFileError(null);

    try {
      const { exists } = await import("@tauri-apps/plugin-fs");
      const fileName = splitDraftFileName(trimmedName).fullName;
      const data = (selectedNode?.data ?? {}) as any;

      if (isShieldFileNode) {
        const existingPath = typeof data.path === "string" ? data.path : "";
        let targetPath = existingPath;

        if (!targetPath) {
          if (rootDirectoryHandle) {
            targetPath = fileName;
            await ensureTextFileExistsFromHandle(rootDirectoryHandle, targetPath);
          } else {
            const basePath = rootFolderJson?.path ?? "";
            if (!basePath) {
              throw new Error("Root folder path is missing.");
            }
            targetPath = joinPath(basePath, fileName);
            const alreadyExists = await exists(targetPath);
            if (!alreadyExists) {
              await fileManager.writeTextFileFromPath(targetPath, "");
            }
          }
        } else if (rootDirectoryHandle && !isAbsolutePath(existingPath)) {
          await ensureTextFileExistsFromHandle(rootDirectoryHandle, existingPath);
        } else if (existingPath) {
          const alreadyExists = await exists(existingPath);
          if (!alreadyExists) {
            await fileManager.writeTextFileFromPath(existingPath, "");
          }
        }

        await persistDetailsLink({
          detailsPath: targetPath,
          detailsOptOut: false,
        });
        setDetailsFileStatus("created");
        return;
      }

      if (isImageNode) {
        let targetPath = "";
        if (moduleType === "cognitiveNotes") {
          if (cognitiveNotesDirectoryHandle) {
            targetPath = fileName;
            await ensureTextFileExistsFromHandle(
              cognitiveNotesDirectoryHandle,
              targetPath
            );
          } else {
            const basePath = cognitiveNotesFolderPath ?? cognitiveNotesRoot?.path ?? "";
            if (!basePath) {
              throw new Error("Cognitive Notes folder path is missing.");
            }
            targetPath = joinPath(basePath, fileName);
            const alreadyExists = await exists(targetPath);
            if (!alreadyExists) {
              await fileManager.writeTextFileFromPath(targetPath, "");
            }
          }
        } else {
          if (rootDirectoryHandle) {
            targetPath = fileName;
            await ensureTextFileExistsFromHandle(rootDirectoryHandle, targetPath);
          } else {
            const basePath = rootFolderJson?.path ?? "";
            if (!basePath) {
              throw new Error("Root folder path is missing.");
            }
            targetPath = joinPath(basePath, fileName);
            const alreadyExists = await exists(targetPath);
            if (!alreadyExists) {
              await fileManager.writeTextFileFromPath(targetPath, "");
            }
          }
        }

        await persistDetailsLink({
          detailsPath: targetPath,
          detailsOptOut: false,
        });
        setDetailsFileStatus("created");
        return;
      }

      if (isFlowchartNode) {
        let targetPath = "";
        if (moduleType === "cognitiveNotes") {
          if (cognitiveNotesDirectoryHandle) {
            targetPath = fileName;
            await ensureTextFileExistsFromHandle(
              cognitiveNotesDirectoryHandle,
              targetPath
            );
          } else {
            const basePath = cognitiveNotesFolderPath ?? cognitiveNotesRoot?.path ?? "";
            if (!basePath) {
              throw new Error("Cognitive Notes folder path is missing.");
            }
            targetPath = joinPath(basePath, fileName);
            const alreadyExists = await exists(targetPath);
            if (!alreadyExists) {
              await fileManager.writeTextFileFromPath(targetPath, "");
            }
          }
        } else {
          if (rootDirectoryHandle) {
            targetPath = fileName;
            await ensureTextFileExistsFromHandle(rootDirectoryHandle, targetPath);
          } else {
            const basePath = rootFolderJson?.path ?? "";
            if (!basePath) {
              throw new Error("Root folder path is missing.");
            }
            targetPath = joinPath(basePath, fileName);
            const alreadyExists = await exists(targetPath);
            if (!alreadyExists) {
              await fileManager.writeTextFileFromPath(targetPath, "");
            }
          }
        }

        await persistDetailsLink({
          detailsPath: targetPath,
          detailsOptOut: false,
        });
        setDetailsFileStatus("created");
      }
    } catch (error) {
      console.error("[RightPanel] Failed to create associated text file:", error);
      setDetailsFileStatus("error");
      setDetailsFileError(
        error instanceof Error
          ? error.message
          : "Failed to create associated text file."
      );
    }
  };

  const skipAssociatedTextFile = async () => {
    setDetailsFileStatus("idle");
    setDetailsFileError(null);
    await persistDetailsLink({ detailsOptOut: true, detailsPath: "" });
  };

  const joinPath = (dirPath: string, fileName: string): string => {
    const trimmed = (dirPath ?? "").replace(/[\\/]+$/, "");
    if (!trimmed) return fileName;
    const sep = trimmed.includes("\\") ? "\\" : "/";
    return `${trimmed}${sep}${fileName}`;
  };

  const isAbsolutePath = (value: string): boolean => {
    if (!value) return false;
    if (value.startsWith("/") || value.startsWith("\\")) return true;
    return /^[a-zA-Z]:[\\/]/.test(value);
  };

  const ensureTextFileExistsFromHandle = async (
    rootHandle: FileSystemDirectoryHandle,
    relPath: string,
  ): Promise<void> => {
    const parts = (relPath ?? "").split(/[\\/]/).filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) {
      throw new Error("File path is missing a filename.");
    }
    let current = rootHandle;
    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: false });
    }
    try {
      await current.getFileHandle(fileName, { create: false });
      return;
    } catch (_error) {
      // Intentionally create a new file if missing.
    }
    const fileHandle = await current.getFileHandle(fileName, { create: true });
    const writable = await (fileHandle as any).createWritable?.();
    if (!writable) {
      throw new Error("Failed to create associated text file.");
    }
    await writable.write("");
    await writable.close();
  };

  const writeCognitiveNotesFile = async (fileName: string, content: string) => {
    if (cognitiveNotesDirectoryHandle) {
      const fileHandle = await cognitiveNotesDirectoryHandle.getFileHandle(fileName, {
        create: true,
      });
      const writable = await (fileHandle as any).createWritable?.();
      if (!writable) throw new Error("Failed to create cognitive notes file.");
      await writable.write(content);
      await writable.close();
      return;
    }
    const targetPath = cognitiveNotesFolderPath ?? cognitiveNotesRoot?.path ?? "";
    if (!targetPath) throw new Error("Cognitive Notes folder path is missing.");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    await writeTextFile(joinPath(targetPath, fileName), content, { create: true });
  };

  const writeCognitiveNotesImage = async (fileName: string, file: File) => {
    if (cognitiveNotesDirectoryHandle) {
      const fileHandle = await cognitiveNotesDirectoryHandle.getFileHandle(fileName, {
        create: true,
      });
      const writable = await (fileHandle as any).createWritable?.();
      if (!writable) throw new Error("Failed to create cognitive notes image.");
      await writable.write(file);
      await writable.close();
      return;
    }
    const targetPath = cognitiveNotesFolderPath ?? cognitiveNotesRoot?.path ?? "";
    if (!targetPath) throw new Error("Cognitive Notes folder path is missing.");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const buffer = await file.arrayBuffer();
    await writeFile(joinPath(targetPath, fileName), new Uint8Array(buffer));
  };

  const hasParallelmindPersistence =
    !!rootDirectoryHandle ||
    (typeof rootFolderJson?.path === "string" &&
      rootFolderJson.path.trim().length > 0);
  const hasCognitiveNotesPersistence =
    !!cognitiveNotesRoot &&
    (!!cognitiveNotesDirectoryHandle ||
      (typeof cognitiveNotesFolderPath === "string" &&
        cognitiveNotesFolderPath.trim().length > 0) ||
      (typeof cognitiveNotesRoot?.path === "string" &&
        cognitiveNotesRoot.path.trim().length > 0));

  const canCreateDraft =
    isDraftNode &&
    !nameError &&
    (isFlowchartNode
      ? moduleType === "cognitiveNotes"
        ? hasCognitiveNotesPersistence
        : !!rootFolderJson && hasParallelmindPersistence
      : !!parentIdForDraft &&
        (moduleType === "cognitiveNotes"
          ? hasCognitiveNotesPersistence
          : hasParallelmindPersistence));
  const canAddFlowchartNodes =
    moduleType === "cognitiveNotes"
      ? hasCognitiveNotesPersistence
      : !!rootFolderJson && hasParallelmindPersistence;
  const canAddFileNodes =
    moduleType === "cognitiveNotes"
      ? hasCognitiveNotesPersistence
      : !!rootFolderJson && hasParallelmindPersistence;

  const flowchartTextByType: Record<
    FlowchartNodeType,
    { name: string; purpose: string }
  > = {
    "flowchart.roundRect": uiText.flowchartNodes.roundRect,
    "flowchart.rect": uiText.flowchartNodes.rect,
    "flowchart.triangle": uiText.flowchartNodes.triangle,
    "flowchart.decision": uiText.flowchartNodes.decision,
    "flowchart.circle": uiText.flowchartNodes.circle,
    "flowchart.parallelogram": uiText.flowchartNodes.parallelogram,
    "flowchart.youtube": uiText.flowchartNodes.youtube,
  };

  const flowchartSelectorItems = FLOWCHART_NODE_DEFINITIONS.map((def) => ({
    ...def,
    name: flowchartTextByType[def.type]?.name ?? def.label,
    description: flowchartTextByType[def.type]?.purpose ?? def.purpose,
  }));

  const createFlowchartDraftNode = (type: FlowchartNodeType) => {
    const position = lastCanvasPosition ?? canvasCenter ?? { x: 0, y: 0 };
    const tempNodeId = `flow_${Date.now()}_${Math.random()
      .toString(16)
      .slice(2)}`;
    const nowIso = new Date().toISOString();
    const defaultColor = settings.appearance.cognitiveNotesDefaultNodeColor ?? "";
    const nodeColor =
      moduleType === "cognitiveNotes" &&
      /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(defaultColor.trim())
        ? defaultColor.trim()
        : undefined;
    const isYoutubeType = type === "flowchart.youtube";
    const tempNode: any = {
      id: tempNodeId,
      type,
      position,
      data: {
        type,
        node_type: type,
        name: "",
        purpose: "",
        youtube_url: isYoutubeType ? "" : undefined,
        youtube_video_id: isYoutubeType ? "" : undefined,
        yt_settings: isYoutubeType ? { ...DEFAULT_YT_SETTINGS } : undefined,
        created_on: nowIso,
        updated_on: nowIso,
        node_color: nodeColor,
        isDraft: true,
        nonPersistent: true,
      },
      selected: true,
    };
    const existing = nodes ?? [];
    const next = [
      ...existing.map((n: any) => ({
        ...n,
        selected: n?.id === tempNodeId,
      })),
      tempNode,
    ];
    setNodes(next);
    selectNode(tempNodeId);
    setRightPanelMode("nodeDetails");
  };

  const resolveFileDraftParentId = (): string | null => {
    if (moduleType === "cognitiveNotes") {
      return typeof cognitiveNotesRoot?.id === "string" && cognitiveNotesRoot.id
        ? cognitiveNotesRoot.id
        : "00";
    }
    if (selectedNodeId && (isFolderNode || selectedNodeId === "00")) {
      return selectedNodeId;
    }
    return "00";
  };

  const createShieldFileDraftNode = () => {
    if (!canAddFileNodes) return;
    setCreateError(null);
    const position = lastCanvasPosition ?? canvasCenter ?? { x: 0, y: 0 };
    const parentNodeId = resolveFileDraftParentId();
    if (!parentNodeId) {
      setCreateError(uiText.alerts.errorCreateFailed);
      return;
    }
    const tempNodeId = `tmp_shield_${Date.now()}_${Math.random()
      .toString(16)
      .slice(2)}`;
    const defaultColor = settings.appearance.cognitiveNotesDefaultNodeColor ?? "";
    const nodeColor =
      moduleType === "cognitiveNotes" &&
      /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(defaultColor.trim())
        ? defaultColor.trim()
        : undefined;
    const tempNode: any = {
      id: tempNodeId,
      type: "shieldFile",
      position,
      style: {
        opacity: 1,
        transition: "opacity 180ms ease",
      },
      data: {
        type: "file",
        node_type: "file",
        node_variant: "shieldFile",
        name: "",
        purpose: "",
        node_color: nodeColor,
        parentId: parentNodeId,
        isDraft: true,
        nonPersistent: true,
      },
      selected: true,
    };
    const existing = nodes ?? [];
    const edgeId = `e_${parentNodeId}_${tempNodeId}`;
    const nextEdges =
      moduleType === "cognitiveNotes"
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
    setRightPanelMode("nodeDetails");
  };

  const onCreateDraft = async () => {
    if (!isDraftNode || !selectedNodeId) return;
    setCreateError(null);
    const err = validateNodeNameForDraft(draft.name);
    if (err) {
      setCreateError(err);
      nameInputRef.current?.focus();
      return;
    }
    if (isFlowchartNode) {
      const nowIso = new Date().toISOString();
      const trimmedName = draft.name.trim();
      const draftNodeId = selectedNodeId;
      const nextRecord = {
        id: draftNodeId,
        type: (selectedNode?.data as any)?.node_type ?? (selectedNode as any)?.type,
        name: trimmedName,
        purpose: draft.purpose,
        youtube_url: draft.youtube_url,
        youtube_video_id: draft.youtube_video_id,
        yt_settings: draft.yt_settings,
        created_on: nowIso,
        updated_on: nowIso,
      };
      const nodePosition = (selectedNode as any)?.position ?? null;
      if (moduleType === "cognitiveNotes") {
        if (!cognitiveNotesRoot) {
          setCreateError(uiText.alerts.errorCreateFailed);
          setSaveStatus("idle");
          return;
        }
        const nextPositions = {
          ...(cognitiveNotesRoot.node_positions ?? {}),
        };
        if (nodePosition) {
          nextPositions[draftNodeId] = {
            x: nodePosition.x,
            y: nodePosition.y,
          };
        }
        const nextColors = { ...(cognitiveNotesRoot.node_colors ?? {}) };
        const draftColor = (selectedNode?.data as any)?.node_color;
        if (
          typeof draftColor === "string" &&
          /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(draftColor.trim())
        ) {
          if (!nextColors[draftNodeId]) {
            nextColors[draftNodeId] = draftColor.trim();
          }
        }
        const nextFlowNodes = [
          ...(cognitiveNotesRoot.flowchart_nodes ?? []),
          nextRecord,
        ];
        const nextRoot = {
          ...cognitiveNotesRoot,
          updated_on: nowIso,
          flowchart_nodes: nextFlowNodes,
          node_colors: nextColors,
          node_positions: nextPositions,
        };
        setNodes(
          (nodes ?? []).map((node: any) =>
            node?.id === draftNodeId
              ? {
                  ...node,
                  data: {
                    ...(node.data ?? {}),
                    name: trimmedName,
                    purpose: draft.purpose,
                    isDraft: false,
                    nonPersistent: false,
                  },
                }
              : node
          )
        );
        await persistCognitiveNotesRoot(nextRoot);
      } else {
        if (!rootFolderJson) {
          setCreateError(uiText.alerts.errorCreateFailed);
          setSaveStatus("idle");
          return;
        }
        const nextPositions = {
          ...(rootFolderJson.node_positions ?? {}),
        };
        if (nodePosition) {
          nextPositions[draftNodeId] = {
            x: nodePosition.x,
            y: nodePosition.y,
          };
        }
        const nextFlowNodes = [
          ...(rootFolderJson.flowchart_nodes ?? []),
          nextRecord,
        ];
        const nextRoot = {
          ...rootFolderJson,
          updated_on: nowIso,
          flowchart_nodes: nextFlowNodes,
          node_positions: nextPositions,
        };
        setNodes(
          (nodes ?? []).map((node: any) =>
            node?.id === draftNodeId
              ? {
                  ...node,
                  data: {
                    ...(node.data ?? {}),
                    name: trimmedName,
                    purpose: draft.purpose,
                    isDraft: false,
                    nonPersistent: false,
                  },
                }
              : node
          )
        );
        await persistParallelmindRoot(nextRoot);
      }
      selectNode(draftNodeId);
      setDirty(false);
      setSaveStatus("saved");
      setFileDetailsExpanded(false);
      return;
    }
    if (!parentIdForDraft) {
      setCreateError(uiText.alerts.errorCreateFailed);
      return;
    }
    if (moduleType !== "cognitiveNotes" && !rootFolderJson) {
      setCreateError(uiText.alerts.errorCreateFailed);
      return;
    }

    const trimmedName = draft.name.trim();
    const trimmedCaption = trimmedName; // For images, name field is the caption
    const nodeVariant =
      typeof (selectedNode?.data as any)?.node_variant === "string"
        ? ((selectedNode?.data as any).node_variant as string)
        : undefined;
    const draftNodeId = selectedNodeId;
    const edgeId = parentIdForDraft
      ? `e_${parentIdForDraft}_${draftNodeId}`
      : null;
    const defaultCognitiveNodeColor =
      settings.appearance.cognitiveNotesDefaultNodeColor ?? "#4330d5";
    const getNextNodeColors = () => {
      const existing = cognitiveNotesRoot?.node_colors ?? {};
      if (!defaultCognitiveNodeColor || !draftNodeId) return existing;
      if (typeof existing[draftNodeId] === "string") return existing;
      return {
        ...existing,
        [draftNodeId]: defaultCognitiveNodeColor,
      };
    };
    setSaveStatus("saving");
    try {
      if (moduleType === "cognitiveNotes") {
        if (!cognitiveNotesRoot) {
          setCreateError(uiText.alerts.errorCreateFailed);
          setSaveStatus("idle");
          return;
        }
        if (isImageNode) {
          const draftNode = (nodes ?? []).find((n: any) => n?.id === draftNodeId);
          const clipboardFile = (draftNode?.data as any)?.clipboardFile as File | null;
          const clipboardMimeType = (draftNode?.data as any)?.clipboardMimeType as string | null;
          if (!clipboardFile) {
            setCreateError("Image file not found. Please paste an image again.");
            setSaveStatus("idle");
            return;
          }
          const ext = clipboardMimeType ? getExtensionFromMimeType(clipboardMimeType) : "png";
          const fileName = trimmedCaption
            ? `${trimmedCaption}.${ext}`
            : `image_${Date.now()}.${ext}`;
          await writeCognitiveNotesImage(fileName, clipboardFile);
          const nodePath = cognitiveNotesDirectoryHandle ? fileName : joinPath(
            cognitiveNotesFolderPath ?? cognitiveNotesRoot.path ?? "",
            fileName
          );
          const nextNodeColors = getNextNodeColors();
          setNodes(
            (nodes ?? []).map((node: any) =>
              node?.id === draftNodeId
                ? {
                    ...node,
                    data: {
                      ...(node.data ?? {}),
                      name: trimmedCaption,
                      caption: trimmedCaption,
                      extension: ext,
                      path: nodePath,
                      purpose: draft.purpose,
                      node_color:
                        (node.data as any)?.node_color ??
                        nextNodeColors[draftNodeId] ??
                        undefined,
                      isDraft: false,
                      nonPersistent: false,
                    },
                  }
                : node
            )
          );
          const nextChild = [
            ...(cognitiveNotesRoot.child ?? []),
            {
              id: draftNodeId,
              name: trimmedCaption,
              extension: ext,
              purpose: draft.purpose,
              type: "file_A",
              level: 1,
              path: nodePath,
              created_on: new Date().toISOString(),
              updated_on: new Date().toISOString(),
              last_viewed_on: new Date().toISOString(),
              views: 0,
              related_nodes: [],
              sort_index: null,
            },
          ];
          await persistCognitiveNotesRoot({
            ...cognitiveNotesRoot,
            child: nextChild,
            node_colors: nextNodeColors,
          });
        } else {
          const nextFileName = splitDraftFileName(trimmedName).fullName;
          await writeCognitiveNotesFile(nextFileName, "");
          const nodePath = cognitiveNotesDirectoryHandle ? nextFileName : joinPath(
            cognitiveNotesFolderPath ?? cognitiveNotesRoot.path ?? "",
            nextFileName
          );
          const nextNodeColors = getNextNodeColors();
          setNodes(
            (nodes ?? []).map((node: any) =>
              node?.id === draftNodeId
                ? {
                    ...node,
                    data: {
                      ...(node.data ?? {}),
                      name: splitDraftFileName(trimmedName).name,
                      extension: splitDraftFileName(trimmedName).extension,
                      path: nodePath,
                      purpose: draft.purpose,
                      node_variant: nodeVariant,
                      node_color:
                        (node.data as any)?.node_color ??
                        nextNodeColors[draftNodeId] ??
                        undefined,
                      isDraft: false,
                      nonPersistent: false,
                    },
                  }
                : node
            )
          );
          const nextChild = [
            ...(cognitiveNotesRoot.child ?? []),
            {
              id: draftNodeId,
              name: splitDraftFileName(trimmedName).name,
              extension: splitDraftFileName(trimmedName).extension,
              purpose: draft.purpose,
              type: "file_A",
              level: 1,
              path: nodePath,
              created_on: new Date().toISOString(),
              updated_on: new Date().toISOString(),
              last_viewed_on: new Date().toISOString(),
              views: 0,
              related_nodes: [],
              sort_index: null,
              node_variant: nodeVariant === "shieldFile" ? "shieldFile" : undefined,
            },
          ];
          await persistCognitiveNotesRoot({
            ...cognitiveNotesRoot,
            child: nextChild,
            node_colors: nextNodeColors,
          });
        }

        setPendingChildCreation(null);
        selectNode(draftNodeId);
        setDirty(false);
        setSaveStatus("saved");
        setFileDetailsExpanded(false);
        return;
      }

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
                nodeVariant: nodeVariant === "shieldFile" ? "shieldFile" : undefined,
              })
            : await fileManager.createFileChildFromPath({
                dirPath: rootFolderJson.path,
                existing: rootFolderJson,
                parentNodeId: parentIdForDraft,
                fileName: nextFileName,
                purpose: draft.purpose,
                nodeVariant: nodeVariant === "shieldFile" ? "shieldFile" : undefined,
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
      setFileDetailsExpanded(false);
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
    (isFolderNode || isFileNode || isImageNode || isFlowchartNode) &&
    !isRootNode &&
    !isDraftNode &&
    !!selectedNodeId;

  const onRenameItem = async () => {
    if (!canRenameItem || !selectedNodeId) return;
    setActionError(null);
    if (isFlowchartNode) {
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
      try {
        const nowIso = new Date().toISOString();
        const flowType =
          (selectedNode?.data as any)?.node_type ?? (selectedNode as any)?.type ?? "";
        if (moduleType === "cognitiveNotes") {
          if (cognitiveNotesRoot) {
            const nextFlowNodes = upsertFlowchartNode(
              cognitiveNotesRoot.flowchart_nodes ?? [],
              {
                id: selectedNodeId,
                type: flowType,
                name: draft.name.trim(),
                purpose: draft.purpose,
                updated_on: nowIso,
              }
            );
            await persistCognitiveNotesRoot({
              ...cognitiveNotesRoot,
              updated_on: nowIso,
              flowchart_nodes: nextFlowNodes,
            });
          }
        } else if (rootFolderJson) {
          const nextFlowNodes = upsertFlowchartNode(
            rootFolderJson.flowchart_nodes ?? [],
            {
              id: selectedNodeId,
              type: flowType,
              name: draft.name.trim(),
              purpose: draft.purpose,
              updated_on: nowIso,
            }
          );
          await persistParallelmindRoot({
            ...rootFolderJson,
            updated_on: nowIso,
            flowchart_nodes: nextFlowNodes,
          });
        }
        setRenameActive(false);
        setDirty(false);
        setSaveStatus("saved");
      } catch (error) {
        console.error("[RightPanel] Rename flowchart node failed:", error);
        setActionError(uiText.alerts.errorCreateFailed);
        setSaveStatus("idle");
      }
      return;
    }
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
    setSaveStatus("saving");
    try {
      if (moduleType === "cognitiveNotes") {
        if (!cognitiveNotesRoot) {
          setActionError(uiText.alerts.errorCreateFailed);
          setSaveStatus("idle");
          return;
        }
        const target = (cognitiveNotesRoot.child ?? []).find(
          (node: any) => node?.id === selectedNodeId
        );
        if (!target) throw new Error("Cognitive Notes node not found.");
        const currentExt =
          typeof target.extension === "string" && target.extension.trim()
            ? target.extension.trim()
            : "txt";
        const trimmedName = draft.name.trim();
        const nextFileName = isImageNode
          ? trimmedName
            ? `${trimmedName}.${currentExt}`
            : `image.${currentExt}`
          : splitDraftFileName(trimmedName).fullName;
        const targetPath = typeof target.path === "string" ? target.path : "";
        if (!targetPath) throw new Error("Cognitive Notes file path not found.");
        if (cognitiveNotesDirectoryHandle) {
          const oldName = targetPath.split(/[\\/]/).pop() ?? targetPath;
          const oldHandle = await cognitiveNotesDirectoryHandle.getFileHandle(oldName);
          const oldFile = await oldHandle.getFile();
          const newHandle = await cognitiveNotesDirectoryHandle.getFileHandle(nextFileName, {
            create: true,
          });
          const writable = await (newHandle as any).createWritable?.();
          if (!writable) throw new Error("Failed to rename Cognitive Notes file.");
          await writable.write(oldFile);
          await writable.close();
          await cognitiveNotesDirectoryHandle.removeEntry(oldName);
        } else {
          const { rename } = await import("@tauri-apps/plugin-fs");
          const basePath = cognitiveNotesFolderPath ?? cognitiveNotesRoot.path ?? "";
          if (!basePath) throw new Error("Cognitive Notes folder path is missing.");
          await rename(targetPath, joinPath(basePath, nextFileName));
        }
        const nextPath = cognitiveNotesDirectoryHandle
          ? nextFileName
          : joinPath(cognitiveNotesFolderPath ?? cognitiveNotesRoot.path ?? "", nextFileName);
        const nextChild = (cognitiveNotesRoot.child ?? []).map((node: any) => {
          if (node?.id !== selectedNodeId) return node;
          const nextName = isImageNode
            ? trimmedName || "image"
            : splitDraftFileName(trimmedName).name;
          return {
            ...node,
            name: nextName,
            extension: currentExt,
            path: nextPath,
            updated_on: new Date().toISOString(),
          };
        });
        setNodes(
          (nodes ?? []).map((node: any) =>
            node?.id === selectedNodeId
              ? {
                  ...node,
                  data: {
                    ...(node.data ?? {}),
                    name: isImageNode
                      ? trimmedName || "image"
                      : splitDraftFileName(trimmedName).name,
                    extension: currentExt,
                    path: nextPath,
                  },
                }
              : node
          )
        );
        await persistCognitiveNotesRoot({ ...cognitiveNotesRoot, child: nextChild });
      } else {
        if (!rootFolderJson?.path) {
          setActionError(uiText.alerts.errorCreateFailed);
          setSaveStatus("idle");
          return;
        }
        let result: any;
        if (isImageNode) {
          // For images: rename the file using caption as base name, preserve extension
          const target = (nodes ?? []).find((n: any) => n?.id === selectedNodeId);
          const currentExt = typeof (target?.data as any)?.extension === "string"
            ? (target.data as any).extension
            : "png";
          const newFileName = draft.name.trim()
            ? `${draft.name.trim()}.${currentExt}`
            : `image.${currentExt}`;
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
        updateRootFolderJson(result.root);
      }
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
    !!selectedNodeId &&
    !isRootNode &&
    (isDraftNode
      ? true
      : (isFolderNode || isFileNode || isImageNode || isFlowchartNode || isNonPersistentNode) &&
        (isNonPersistentNode
          ? true
          : moduleType === "cognitiveNotes"
          ? !!cognitiveNotesRoot
          : !!rootFolderJson));

  const fileDetailsTitle =
    isFileNode || isImageNode
      ? `File: ${draft.name.trim() || "(no name)"}`
      : uiText.fields.nodeDetails.sectionTitle;

  const onDeleteItem = async () => {
    if (!canDeleteItem || !selectedNodeId) return;
    setActionError(null);
    if (isDraftNode) {
      const draftId = selectedNodeId;
      const draftParentId = parentIdForDraft;
      setNodes((nodes ?? []).filter((node: any) => node?.id !== draftId));
      setEdges(
        (edges ?? []).filter((edge: any) => {
          if (edge?.source === draftId || edge?.target === draftId) return false;
          if (draftParentId && edge?.id === `e_${draftParentId}_${draftId}`) {
            return false;
          }
          return true;
        })
      );
      setPendingChildCreation(null);
      setDeleteConfirmOpen(false);
      setDeleteInProgress(false);
      selectNode(null);
      selectEdge(null);
      return;
    }
    setDeleteConfirmOpen(true);
  };

  useEffect(() => {
    const onDeleteRequest = () => {
      if (!selectedNodeId) return;
      void onDeleteItem();
    };
    window.addEventListener("pm-request-delete-selected-node", onDeleteRequest);
    return () => {
      window.removeEventListener(
        "pm-request-delete-selected-node",
        onDeleteRequest
      );
    };
  }, [selectedNodeId, onDeleteItem]);

  const deleteCognitiveNotesNode = async () => {
    if (!cognitiveNotesRoot || !selectedNodeId) return;
    const target = (cognitiveNotesRoot.child ?? []).find(
      (node: any) => node?.id === selectedNodeId
    );
    if (!target) throw new Error("Cognitive Notes node not found.");
    const targetPath = typeof target.path === "string" ? target.path : "";
    if (!targetPath) throw new Error("Cognitive Notes file path not found.");

    if (cognitiveNotesDirectoryHandle) {
      const fileName = targetPath.split(/[\\/]/).pop() ?? targetPath;
      await cognitiveNotesDirectoryHandle.removeEntry(fileName);
    } else {
      const { remove } = await import("@tauri-apps/plugin-fs");
      await remove(targetPath, { recursive: false });
    }

    const removedIds = new Set([selectedNodeId]);
    const removedEdgeIds = new Set<string>();
    if (Array.isArray(target.related_nodes)) {
      target.related_nodes.forEach((rel: any) => {
        if (rel?.edge_id) removedEdgeIds.add(rel.edge_id);
      });
    }

    setNodes((nodes ?? []).filter((node: any) => !removedIds.has(node?.id)));
    setEdges(
      (edges ?? []).filter(
        (edge: any) =>
          !removedEdgeIds.has(edge?.id) &&
          !removedIds.has(edge?.source) &&
          !removedIds.has(edge?.target)
      )
    );
    selectNode(null);
    selectEdge(null);

    const nextChild = (cognitiveNotesRoot.child ?? [])
      .filter((node: any) => node?.id !== selectedNodeId)
      .map((node: any) => ({
        ...node,
        related_nodes: Array.isArray(node.related_nodes)
          ? node.related_nodes.filter(
              (rel: any) =>
                !removedIds.has(rel?.target_id) &&
                !removedEdgeIds.has(rel?.edge_id)
            )
          : [],
      }));
    const nextFlowEdges = (cognitiveNotesRoot.flowchart_edges ?? []).filter(
      (edge) => !removedIds.has(edge.source) && !removedIds.has(edge.target)
    );
    await persistCognitiveNotesRoot({
      ...cognitiveNotesRoot,
      child: nextChild,
      flowchart_edges: nextFlowEdges,
    });
  };

  const confirmDeleteItem = async () => {
    if (!canDeleteItem || !selectedNodeId) return;
    setDeleteInProgress(true);
    if (isNonPersistentNode && !isFlowchartNode) {
      const nodeId = selectedNodeId;
      setNodes((nodes ?? []).filter((node: any) => node?.id !== nodeId));
      setEdges(
        (edges ?? []).filter(
          (edge: any) => edge?.source !== nodeId && edge?.target !== nodeId
        )
      );
      selectNode(null);
      selectEdge(null);
      setDirty(false);
      setSaveStatus("saved");
      setDeleteConfirmOpen(false);
      setDeleteInProgress(false);
      return;
    }
    if (isFlowchartNode) {
      setSaveStatus("saving");
      try {
        const nodeId = selectedNodeId;
        setNodes((nodes ?? []).filter((node: any) => node?.id !== nodeId));
        setEdges(
          (edges ?? []).filter(
            (edge: any) => edge?.source !== nodeId && edge?.target !== nodeId
          )
        );
        selectNode(null);
        selectEdge(null);
        const nowIso = new Date().toISOString();
        if (moduleType === "cognitiveNotes") {
          if (cognitiveNotesRoot) {
            const nextPositions = { ...(cognitiveNotesRoot.node_positions ?? {}) };
            const nextSizes = { ...(cognitiveNotesRoot.node_size ?? {}) };
            delete nextPositions[nodeId];
            delete nextSizes[nodeId];
            const nextFlowNodes = (cognitiveNotesRoot.flowchart_nodes ?? []).filter(
              (node) => node.id !== nodeId
            );
            const nextFlowEdges = (cognitiveNotesRoot.flowchart_edges ?? []).filter(
              (edge) => edge.source !== nodeId && edge.target !== nodeId
            );
            await persistCognitiveNotesRoot({
              ...cognitiveNotesRoot,
              updated_on: nowIso,
              flowchart_nodes: nextFlowNodes,
              flowchart_edges: nextFlowEdges,
              node_positions: nextPositions,
              node_size: nextSizes,
            });
          }
        } else if (rootFolderJson) {
          const nextPositions = { ...(rootFolderJson.node_positions ?? {}) };
          const nextSizes = { ...(rootFolderJson.node_size ?? {}) };
          delete nextPositions[nodeId];
          delete nextSizes[nodeId];
          const nextFlowNodes = (rootFolderJson.flowchart_nodes ?? []).filter(
            (node) => node.id !== nodeId
          );
          const nextFlowEdges = (rootFolderJson.flowchart_edges ?? []).filter(
            (edge) => edge.source !== nodeId && edge.target !== nodeId
          );
          await persistParallelmindRoot({
            ...rootFolderJson,
            updated_on: nowIso,
            flowchart_nodes: nextFlowNodes,
            flowchart_edges: nextFlowEdges,
            node_positions: nextPositions,
            node_size: nextSizes,
          });
        }
        setDirty(false);
        setSaveStatus("saved");
        setDeleteConfirmOpen(false);
      } catch (error) {
        console.error("[RightPanel] Delete flowchart node failed:", error);
        setActionError(uiText.alerts.errorDeleteFailed);
        setSaveStatus("idle");
      } finally {
        setDeleteInProgress(false);
      }
      return;
    }
    if (moduleType === "cognitiveNotes") {
      setSaveStatus("saving");
      try {
        await deleteCognitiveNotesNode();
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
      return;
    }
    if (!rootFolderJson) return;
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

  const panelTitle =
    rightPanelMode === "nodeSelector"
      ? uiText.panels.nodeSelector
      : rightPanelMode === "notesFeed"
      ? uiText.panels.notesFeed
      : selectedEdgeId && !selectedNodeId
      ? uiText.panels.edge
      : uiText.panels.node;

  const TEXT_EXTENSIONS = new Set([
    "txt",
    "md",
    "markdown",
    "mdx",
    "json",
    "csv",
    "tsv",
    "yaml",
    "yml",
    "xml",
    "html",
    "css",
    "js",
    "jsx",
    "ts",
    "tsx",
    "log",
    "ini",
    "conf",
    "toml",
    "env",
    "py",
    "java",
    "go",
    "rs",
    "c",
    "cpp",
    "h",
    "hpp",
    "cs",
    "php",
    "rb",
    "sh",
    "bat",
    "ps1",
    "sql",
  ]);

  const getExtensionFromPath = (value: string): string => {
    const parts = (value ?? "").split(".");
    if (parts.length <= 1) return "";
    return (parts.pop() ?? "").toLowerCase();
  };

  useEffect(() => {
    const onOpenNotesFeed = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail as
        | { tabId?: string; nodeId?: string }
        | undefined;
      const tabId = typeof detail?.tabId === "string" ? detail.tabId : null;
      const nodeId = typeof detail?.nodeId === "string" ? detail.nodeId : null;
      if (!tabId || !nodeId) return;
      if (activeTab?.id && tabId !== activeTab.id) return;
      if (!cognitiveNotesRoot) return;
      setNotesFeedHiddenIds(new Set());
      setNotesFeedSourceId(nodeId);
      setRightPanelMode("notesFeed");
    };
    window.addEventListener("pm-open-notes-feed", onOpenNotesFeed as EventListener);
    return () => {
      window.removeEventListener("pm-open-notes-feed", onOpenNotesFeed as EventListener);
    };
  }, [activeTab?.id, cognitiveNotesRoot, setRightPanelMode]);

  useEffect(() => {
    if (rightPanelMode !== "notesFeed") return;
    if (!cognitiveNotesRoot || !notesFeedSourceId) return;

    const nodes = cognitiveNotesRoot.child ?? [];
    if (!nodes.length) {
      setNotesFeedItems([]);
      return;
    }

    const byId = new Map(nodes.map((node: any) => [node.id, node]));
    if (!byId.has(notesFeedSourceId)) {
      setNotesFeedItems([]);
      return;
    }
    const adjacency = new Map<string, string[]>();
    nodes.forEach((node: any) => {
      if (!node?.id) return;
      const rels = Array.isArray(node.related_nodes) ? node.related_nodes : [];
      const targets = rels
        .map((rel: any) => rel?.target_id)
        .filter((target: any) => typeof target === "string" && target);
      adjacency.set(node.id, targets);
    });

    let currentLevel = [notesFeedSourceId];

    const orderedIds: string[] = [];
    const visited = new Set<string>();
    const compareCreatedOn = (aId: string, bId: string) => {
      const a = byId.get(aId);
      const b = byId.get(bId);
      const aKey = typeof a?.created_on === "string" ? a.created_on : "";
      const bKey = typeof b?.created_on === "string" ? b.created_on : "";
      return bKey.localeCompare(aKey);
    };

    while (currentLevel.length) {
      const levelSorted = Array.from(new Set(currentLevel))
        .filter((id) => !visited.has(id) && byId.has(id))
        .sort(compareCreatedOn);
      levelSorted.forEach((id) => {
        visited.add(id);
        orderedIds.push(id);
      });
      const nextSet = new Set<string>();
      levelSorted.forEach((id) => {
        (adjacency.get(id) ?? []).forEach((childId) => {
          if (!visited.has(childId)) nextSet.add(childId);
        });
      });
      currentLevel = Array.from(nextSet);
    }

    let isActive = true;
    setNotesFeedLoading(true);
    const load = async () => {
      const items: { id: string; title: string; contentHtml: string }[] = [];
      for (const id of orderedIds) {
        const node = byId.get(id);
        if (!node) continue;
        const name = typeof node.name === "string" ? node.name : "";
        const ext = typeof node.extension === "string" ? node.extension : "";
        const title = ext ? `${name}.${ext}` : name || "Untitled";
        const rawPath = typeof node.path === "string" ? node.path : "";
        const basePath =
          typeof cognitiveNotesFolderPath === "string" && cognitiveNotesFolderPath
            ? cognitiveNotesFolderPath
            : cognitiveNotesRoot.path;
        const absPath =
          rawPath && !isAbsolutePath(rawPath) && basePath
            ? joinPath(basePath, rawPath)
            : rawPath;
        const extension = ext || getExtensionFromPath(rawPath);
        let contentHtml = "";
        if (TEXT_EXTENSIONS.has(extension)) {
          try {
            let content = "";
            if (rawPath && !isAbsolutePath(rawPath) && cognitiveNotesDirectoryHandle) {
              const result = await fileManager.readTextFileFromHandle({
                rootHandle: cognitiveNotesDirectoryHandle,
                relPath: rawPath,
              });
              content = result.content ?? "";
            } else if (absPath) {
              content = await fileManager.readTextFileFromPath(absPath);
            }
            if (content) {
              contentHtml = marked.parse(content) as string;
            }
          } catch {
            contentHtml = "";
          }
        }
        items.push({ id, title, contentHtml });
      }
      if (!isActive) return;
      setNotesFeedItems(items);
      setNotesFeedLoading(false);
    };
    void load();
    return () => {
      isActive = false;
    };
  }, [
    rightPanelMode,
    notesFeedSourceId,
    cognitiveNotesRoot,
    cognitiveNotesDirectoryHandle,
    cognitiveNotesFolderPath,
    fileManager,
  ]);

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
            <div className="pm-panel__title">{panelTitle}</div>
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
          {rightPanelMode === "nodeSelector" ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
                padding: "var(--space-3)",
                color: "var(--text)",
                fontSize: "0.85rem",
              }}
            >
              <div style={{ fontWeight: 600 }}>{uiText.panels.nodeSelector}</div>
              <div style={{ opacity: 0.75 }}>
                {uiText.nodeSelector.intro}
              </div>
              <div
                style={{
                  display: "grid",
                  gap: "var(--space-2)",
                }}
              >
                <div style={{ fontWeight: 600 }}>{uiText.nodeSelector.flowchartTitle}</div>
                <div style={{ opacity: 0.75 }}>
                  {uiText.nodeSelector.flowchartDescription}
                </div>
                <div style={{ display: "grid", gap: "var(--space-2)" }}>
                  {flowchartSelectorItems.map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => createFlowchartDraftNode(item.type)}
                      disabled={!canAddFlowchartNodes}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "28px 1fr",
                        alignItems: "center",
                        gap: "var(--space-2)",
                        padding: "10px",
                        borderRadius: "var(--radius-md)",
                        border: "var(--border-width) solid var(--border)",
                        background: "var(--surface-2)",
                        color: "inherit",
                        cursor: canAddFlowchartNodes ? "pointer" : "not-allowed",
                        opacity: canAddFlowchartNodes ? 1 : 0.6,
                        textAlign: "left",
                      }}
                      onMouseEnter={(e) => {
                        if (!canAddFlowchartNodes) return;
                        (e.currentTarget as HTMLButtonElement).style.background =
                          "var(--surface-1)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background =
                          "var(--surface-2)";
                      }}
                    >
                      <span aria-hidden="true">
                        <FlowchartNodeIcons type={item.type} size={22} />
                      </span>
                      <span style={{ display: "grid", gap: 2 }}>
                        <span style={{ fontWeight: 600 }}>{item.name}</span>
                        <span style={{ opacity: 0.75 }}>{item.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
                <div
                  style={{
                    fontWeight: 600,
                    marginTop: "var(--space-2)",
                  }}
                >
                  {uiText.nodeSelector.fileTitle}
                </div>
                <div style={{ opacity: 0.75 }}>
                  {uiText.nodeSelector.fileDescription}
                </div>
                <div style={{ display: "grid", gap: "var(--space-2)" }}>
                  <button
                    type="button"
                    onClick={createShieldFileDraftNode}
                    disabled={!canAddFileNodes}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "28px 1fr",
                      alignItems: "center",
                      gap: "var(--space-2)",
                      padding: "10px",
                      borderRadius: "var(--radius-md)",
                      border: "var(--border-width) solid var(--border)",
                      background: "var(--surface-2)",
                      color: "inherit",
                      cursor: canAddFileNodes ? "pointer" : "not-allowed",
                      opacity: canAddFileNodes ? 1 : 0.6,
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      if (!canAddFileNodes) return;
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "var(--surface-1)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "var(--surface-2)";
                    }}
                  >
                    <span aria-hidden="true">
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 200 200"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{ display: "block" }}
                      >
                        <path
                          d="M 29 11 H 170 V 40 H 29 Z M 29 40 V 150 L 100 185 L 170 150 V 40"
                          fill="currentColor"
                        />
                      </svg>
                    </span>
                    <span style={{ display: "grid", gap: 2 }}>
                      <span style={{ fontWeight: 600 }}>
                        {uiText.nodeSelector.items.shieldFile.name}
                      </span>
                      <span style={{ opacity: 0.75 }}>
                        {uiText.nodeSelector.items.shieldFile.purpose}
                      </span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ) : rightPanelMode === "notesFeed" ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
                padding: "var(--space-3)",
                color: "var(--text)",
                fontSize: "0.85rem",
                height: "100%",
                overflow: "auto",
              }}
            >
              {notesFeedLoading && (
                <div style={{ opacity: 0.7 }}>Loading notes...</div>
              )}
              {!notesFeedLoading &&
                notesFeedItems.filter((item) => !notesFeedHiddenIds.has(item.id))
                  .length === 0 && (
                <div style={{ opacity: 0.7 }}>No notes found.</div>
              )}
              {!notesFeedLoading &&
                notesFeedItems
                  .filter((item) => !notesFeedHiddenIds.has(item.id))
                  .map((item) => (
                  <div
                    key={item.id}
                    style={{
                      borderRadius: "var(--radius-md)",
                      border: "var(--border-width) solid var(--border)",
                      background: "var(--surface-2)",
                      padding: "var(--space-2)",
                      display: "grid",
                      gap: "var(--space-2)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "var(--space-2)",
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{item.title}</div>
                      <button
                        type="button"
                        aria-label="Hide note"
                        title="Hide note"
                        onClick={() => hideNotesFeedItem(item.id)}
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
                          fontSize: "0.95rem",
                          lineHeight: 1,
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
                        ×
                      </button>
                    </div>
                    {item.contentHtml ? (
                      <div
                        style={{ fontSize: "0.85rem", lineHeight: 1.5 }}
                        dangerouslySetInnerHTML={{ __html: item.contentHtml }}
                      />
                    ) : null}
                  </div>
                ))}
            </div>
          ) : selectedEdgeId && !selectedNodeId ? (
            <div
              aria-label={uiText.fields.edgeDetails.sectionTitle}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
                height: "100%",
                width: "100%",
                minWidth: 0,
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: "var(--space-2)",
                  width: "100%",
                  minWidth: 0,
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
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      marginBottom: "var(--space-1)",
                    }}
                  >
                    {uiText.fields.edgeDetails.purpose}
                  </label>
                  <textarea
                    value={edgeDraft.purpose}
                    onChange={(event) => onEdgePurposeChange(event.target.value)}
                    placeholder={uiText.fields.edgeDetails.purpose}
                    style={{
                      width: "100%",
                      minHeight: 120,
                      resize: "vertical",
                      borderRadius: "var(--radius-sm)",
                      border: "var(--border-width) solid var(--border)",
                      padding: "var(--space-2)",
                      background: "var(--surface-1)",
                      color: "inherit",
                      fontFamily: "inherit",
                      fontSize: "0.85rem",
                      boxSizing: "border-box",
                    }}
                  />
                  <div
                    style={{
                      marginTop: "var(--space-2)",
                      fontSize: "0.75rem",
                      opacity: 0.7,
                    }}
                  >
                    {edgeSaveStatus === "saving"
                      ? uiText.statusMessages.saving
                      : edgeSaveStatus === "saved"
                      ? uiText.statusMessages.saved
                      : ""}
                  </div>
                  <div
                    style={{
                      marginTop: "var(--space-3)",
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                    }}
                  >
                    {edgeDeleteConfirmOpen ? (
                      <>
                        <button
                          type="button"
                          onClick={onDeleteSelectedEdge}
                          style={{
                            padding: "var(--space-2) var(--space-3)",
                            borderRadius: "var(--radius-sm)",
                            border: "none",
                            background: "var(--danger)",
                            color: "white",
                            cursor: "pointer",
                          }}
                        >
                          {uiText.buttons.delete}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEdgeDeleteConfirmOpen(false)}
                          style={{
                            padding: "var(--space-2) var(--space-3)",
                            borderRadius: "var(--radius-sm)",
                            border: "var(--border-width) solid var(--border)",
                            background: "transparent",
                            color: "inherit",
                            cursor: "pointer",
                          }}
                        >
                          {uiText.buttons.cancel}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEdgeDeleteConfirmOpen(true)}
                        style={{
                          padding: "var(--space-2) var(--space-3)",
                          borderRadius: "var(--radius-sm)",
                          border: "var(--border-width) solid var(--border)",
                          background: "transparent",
                          color: "inherit",
                          cursor: "pointer",
                        }}
                      >
                        {uiText.buttons.delete}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : !selectedNodeId ? null : (
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
                      <span>{fileDetailsTitle}</span>
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
                              disabled={!isDraftNode && !renameActive && !isFlowchartNode}
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

                        {showSortIndex && (
                          <label
                            style={{
                              display: "grid",
                              gap: "var(--space-2)",
                              width: "100%",
                              minWidth: 0,
                            }}
                          >
                            <div style={{ fontWeight: 600, fontSize: "0.8rem" }}>
                              {uiText.fields.nodeDetails.sortOrder}
                            </div>
                            <select
                              value={sortIndexDraft === "" ? "" : String(sortIndexDraft)}
                              onChange={(e) => onSortIndexChange(e.target.value)}
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
                            >
                              <option value="">—</option>
                              {sortIndexOptions.map((value) => (
                                <option key={value} value={String(value)}>
                                  {value}
                                </option>
                              ))}
                            </select>
                            <div
                              style={{
                                fontSize: "0.75rem",
                                opacity: 0.7,
                              }}
                            >
                              {sortIndexSaveStatus === "saving"
                                ? uiText.statusMessages.saving
                                : sortIndexSaveStatus === "saved"
                                ? uiText.statusMessages.saved
                                : ""}
                            </div>
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
                              onFocus={() => {
                                if (!draft.purpose.trim()) {
                                  setDraft((prev) => ({
                                    ...prev,
                                    purpose: DEFAULT_PURPOSE_TEMPLATE,
                                  }));
                                }
                              }}
                              onBlur={() => {
                                void commitSave();
                              }}
                              placeholder={DEFAULT_PURPOSE_TEMPLATE}
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
                              onFocus={() => {
                                if (!draft.purpose.trim()) {
                                  setDraft((prev) => ({
                                    ...prev,
                                    purpose: DEFAULT_PURPOSE_TEMPLATE,
                                  }));
                                }
                              }}
                              onBlur={() => {
                                void commitSave();
                              }}
                              placeholder={DEFAULT_PURPOSE_TEMPLATE}
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
                        {shouldOfferDetailsFile && (
                          <div
                            style={{
                              display: "grid",
                              gap: "var(--space-2)",
                              width: "100%",
                              minWidth: 0,
                              border: "var(--border-width) solid var(--border)",
                              borderRadius: "var(--radius-md)",
                              padding: "var(--space-2)",
                              background: "var(--surface-1)",
                            }}
                          >
                            <div style={{ fontWeight: 600, fontSize: "0.8rem" }}>
                              {detailsPath || detailsOptOut
                                ? uiText.fields.nodeDetails.associatedTextFileLabel
                                : uiText.fields.nodeDetails.associatedTextFileQuestion}
                            </div>
                            {detailsPath ? (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "var(--space-1)",
                                  fontSize: "0.8rem",
                                }}
                              >
                                <div style={{ wordBreak: "break-all" }}>
                                  {detailsPath}
                                </div>
                                {detailsFileStatus === "created" && (
                                  <div style={{ color: "var(--success, #2f9e44)" }}>
                                    {uiText.fields.nodeDetails.associatedTextFileCreated}
                                  </div>
                                )}
                              </div>
                            ) : detailsOptOut ? (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "var(--space-2)",
                                  fontSize: "0.8rem",
                                }}
                              >
                                <div style={{ opacity: 0.7 }}>
                                  {uiText.fields.nodeDetails.associatedTextFileSkipped}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void createAssociatedTextFile()}
                                  disabled={
                                    detailsFileStatus === "creating" ||
                                    !draft.name.trim()
                                  }
                                  style={{
                                    borderRadius: "999px",
                                    border: "var(--border-width) solid var(--border)",
                                    background: "var(--surface-2)",
                                    color: "var(--text)",
                                    padding: "4px 12px",
                                    fontSize: "0.8rem",
                                    fontWeight: 600,
                                    cursor:
                                      detailsFileStatus === "creating" ||
                                      !draft.name.trim()
                                        ? "not-allowed"
                                        : "pointer",
                                    opacity:
                                      detailsFileStatus === "creating" ||
                                      !draft.name.trim()
                                        ? 0.6
                                        : 1,
                                    width: "fit-content",
                                  }}
                                >
                                  {uiText.fields.nodeDetails.associatedTextFileCreate}
                                </button>
                              </div>
                            ) : (
                              <>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "var(--space-2)",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => void createAssociatedTextFile()}
                                    disabled={
                                      detailsFileStatus === "creating" ||
                                      !draft.name.trim()
                                    }
                                    style={{
                                      borderRadius: "999px",
                                      border: "var(--border-width) solid var(--border)",
                                      background: "var(--surface-2)",
                                      color: "var(--text)",
                                      padding: "4px 12px",
                                      fontSize: "0.8rem",
                                      fontWeight: 600,
                                      cursor:
                                        detailsFileStatus === "creating" ||
                                        !draft.name.trim()
                                          ? "not-allowed"
                                          : "pointer",
                                      opacity:
                                        detailsFileStatus === "creating" ||
                                        !draft.name.trim()
                                          ? 0.6
                                          : 1,
                                    }}
                                  >
                                    {uiText.fields.nodeDetails.associatedTextFileCreate}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void skipAssociatedTextFile()}
                                    style={{
                                      borderRadius: "999px",
                                      border: "var(--border-width) solid var(--border)",
                                      background: "transparent",
                                      color: "inherit",
                                      padding: "4px 12px",
                                      fontSize: "0.8rem",
                                      fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                  >
                                    {uiText.fields.nodeDetails.associatedTextFileSkip}
                                  </button>
                                </div>
                                {detailsFileStatus === "creating" && (
                                  <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                                    {uiText.statusMessages.saving}
                                  </div>
                                )}
                                {detailsFileStatus === "error" && detailsFileError && (
                                  <div
                                    style={{
                                      fontSize: "0.8rem",
                                      color: "var(--danger, #e5484d)",
                                    }}
                                  >
                                    {detailsFileError}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                        {(isDraftNode || canRenameItem || canDeleteItem || actionError) && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "var(--space-2)",
                              flexWrap: "wrap",
                            }}
                          >
                            {isDraftNode && (
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
                            )}
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
                            {createError && isDraftNode && (
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
                        )}
                        {isYoutubeNode && (
                          <div
                            style={{
                              display: "grid",
                              gap: "var(--space-2)",
                              width: "100%",
                              minWidth: 0,
                            }}
                          >
                            <label
                              style={{
                                display: "grid",
                                gap: "var(--space-2)",
                                width: "100%",
                                minWidth: 0,
                              }}
                            >
                              <div style={{ fontWeight: 600, fontSize: "0.8rem" }}>
                                {uiText.fields.nodeDetails.youtubeLink}
                              </div>
                              <input
                                value={draft.youtube_url}
                                onChange={(e) => onYoutubeUrlChange(e.target.value)}
                                onBlur={() => {
                                  void commitSave();
                                }}
                                placeholder={uiText.placeholders.youtubeLink}
                                aria-label={uiText.fields.nodeDetails.youtubeLink}
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
                            </label>
                            <div
                              style={{
                                display: "grid",
                                gap: "var(--space-2)",
                                width: "100%",
                                minWidth: 0,
                                padding: "var(--space-2)",
                                borderRadius: "var(--radius-md)",
                                border: "var(--border-width) solid var(--border)",
                                background: "var(--surface-1)",
                              }}
                            >
                              <div style={{ fontWeight: 600, fontSize: "0.8rem" }}>
                                {uiText.fields.nodeDetails.youtubeSettings}
                              </div>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr 1fr",
                                  gap: "var(--space-2)",
                                }}
                              >
                                <label style={{ display: "grid", gap: 6 }}>
                                  <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                                    {uiText.fields.nodeDetails.youtubeStart}
                                  </span>
                                  <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={youtubeSettings.startSeconds}
                                    onChange={(e) => {
                                      const next = Number(e.target.value);
                                      onYoutubeSettingsChange({
                                        startSeconds: Number.isFinite(next) ? Math.max(0, next) : 0,
                                      });
                                    }}
                                    onBlur={() => {
                                      void commitSave();
                                    }}
                                    style={{
                                      width: "100%",
                                      borderRadius: "var(--radius-md)",
                                      border: "var(--border-width) solid var(--border)",
                                      padding: "var(--space-2)",
                                      background: "var(--surface-2)",
                                      color: "var(--text)",
                                      fontFamily: "var(--font-family)",
                                    }}
                                  />
                                </label>
                                <label style={{ display: "grid", gap: 6 }}>
                                  <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                                    {uiText.fields.nodeDetails.youtubeEnd}
                                  </span>
                                  <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={youtubeSettings.endSeconds}
                                    onChange={(e) => {
                                      const next = Number(e.target.value);
                                      onYoutubeSettingsChange({
                                        endSeconds: Number.isFinite(next) ? Math.max(0, next) : 0,
                                      });
                                    }}
                                    onBlur={() => {
                                      void commitSave();
                                    }}
                                    style={{
                                      width: "100%",
                                      borderRadius: "var(--radius-md)",
                                      border: "var(--border-width) solid var(--border)",
                                      padding: "var(--space-2)",
                                      background: "var(--surface-2)",
                                      color: "var(--text)",
                                      fontFamily: "var(--font-family)",
                                    }}
                                  />
                                </label>
                              </div>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                                  gap: "var(--space-2)",
                                }}
                              >
                                <label
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    fontSize: "0.8rem",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={!!youtubeSettings.loop}
                                    onChange={(e) =>
                                      onYoutubeSettingsChange({ loop: e.target.checked })
                                    }
                                  />
                                  {uiText.fields.nodeDetails.youtubeLoop}
                                </label>
                                <label
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    fontSize: "0.8rem",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={!!youtubeSettings.mute}
                                    onChange={(e) =>
                                      onYoutubeSettingsChange({ mute: e.target.checked })
                                    }
                                  />
                                  {uiText.fields.nodeDetails.youtubeMute}
                                </label>
                                <label
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    fontSize: "0.8rem",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={!!youtubeSettings.controls}
                                    onChange={(e) =>
                                      onYoutubeSettingsChange({ controls: e.target.checked })
                                    }
                                  />
                                  {uiText.fields.nodeDetails.youtubeControls}
                                </label>
                              </div>
                            </div>
                          </div>
                        )}
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
            isFlowchartNode
              ? uiText.alerts.confirmDelete
              : isFileNode
              ? uiText.alerts.confirmDeleteFile
              : uiText.alerts.confirmDeleteFolder
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
              {isFlowchartNode
                ? uiText.alerts.confirmDelete
                : isFileNode
                ? uiText.alerts.confirmDeleteFile
                : uiText.alerts.confirmDeleteFolder}
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
