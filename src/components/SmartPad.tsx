import { useEffect, useMemo, useRef, useState } from "react";
import type { Node } from "reactflow";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { marked } from "marked";
import { uiText } from "../constants/uiText";
import { FileManager } from "../data/fileManager";
import { CognitiveNotesManager } from "../extensions/cognitiveNotes/data/cognitiveNotesManager";
import { useAutoSave } from "../hooks/useAutoSave";
import { selectActiveTab, useMindMapStore } from "../store/mindMapStore";
import { isFlowchartNodeType } from "../containers/MindMap/flowchartnode";
import { htmlToMarkdownPreserveSpacing } from "../utils/clipboardToMarkdown";
import {
  getEditorPlainText,
  insertTextAtSelection,
} from "../utils/insertTextAtSelection";

marked.setOptions({ gfm: true });

type SmartPadProps = {
  selectedNode: Node | null;
  rootDirectoryHandle: FileSystemDirectoryHandle | null;
};

type PreviewState = {
  status: "idle" | "loading" | "ready" | "empty" | "ineligible" | "error";
  content: string;
  isMarkdown: boolean;
};

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

const normalizeExtension = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim().replace(/^\./, "").toLowerCase();
};

const isMarkdownExtension = (ext: string): boolean =>
  ext === "md" || ext === "markdown";

const isTextExtension = (ext: string): boolean =>
  !!ext && TEXT_EXTENSIONS.has(ext);

const isTextMime = (mimeType: string): boolean => {
  const lower = (mimeType ?? "").toLowerCase();
  if (!lower) return false;
  if (lower.startsWith("text/")) return true;
  if (lower.includes("json") || lower.includes("xml")) return true;
  if (lower.includes("yaml") || lower.includes("markdown")) return true;
  return false;
};

const joinPath = (dirPath: string, fileName: string): string => {
  const trimmed = dirPath.replace(/[\\/]+$/, "");
  const sep = trimmed.includes("\\") ? "\\" : "/";
  return `${trimmed}${sep}${fileName}`;
};

const isAbsolutePath = (value: string): boolean => {
  if (!value) return false;
  if (value.startsWith("/") || value.startsWith("\\")) return true;
  return /^[A-Za-z]:[\\/]/.test(value);
};

const isFileNode = (node: Node | null): boolean =>
  !!node &&
  ((node?.data as any)?.node_type === "file" ||
    (node?.data as any)?.type === "file" ||
    node?.type === "file" ||
    node?.type === "shieldFile");

const isImageNode = (node: Node | null): boolean =>
  !!node &&
  ((node?.data as any)?.node_type === "polaroidImage" ||
    (node?.data as any)?.type === "polaroidImage" ||
    node?.type === "polaroidImage" ||
    (node?.data as any)?.node_type === "fullImageNode" ||
    (node?.data as any)?.type === "fullImageNode" ||
    node?.type === "fullImageNode");

const isShieldFileNode = (node: Node | null): boolean =>
  !!node &&
  (((node?.data as any)?.node_variant as string) === "shieldFile" ||
    node?.type === "shieldFile");

const getDetailsPath = (node: Node | null): string => {
  if (!node) return "";
  const raw = (node?.data as any)?.details_path;
  return typeof raw === "string" ? raw.trim() : "";
};

const resolveSmartpadTarget = (
  node: Node | null
): { path: string; isAssociated: boolean; isFlowchart: boolean } => {
  if (!node) return { path: "", isAssociated: false, isFlowchart: false };
  const flowType = (node?.data as any)?.node_type ?? node?.type;
  const isFlowchart = isFlowchartNodeType(flowType);
  const detailsPath = getDetailsPath(node);
  if (detailsPath && (isFlowchart || isShieldFileNode(node) || isImageNode(node))) {
    return { path: detailsPath, isAssociated: true, isFlowchart };
  }
  if (isFileNode(node)) {
    const nodePath =
      typeof (node?.data as any)?.path === "string"
        ? ((node?.data as any)?.path as string).trim()
        : "";
    return { path: nodePath, isAssociated: false, isFlowchart };
  }
  return { path: "", isAssociated: false, isFlowchart };
};

export default function SmartPad({
  selectedNode,
  rootDirectoryHandle,
}: SmartPadProps) {
  const fileManager = useMemo(() => new FileManager(), []);
  const activeTab = useMindMapStore(selectActiveTab);
  const rootFolderJson = activeTab?.rootFolderJson ?? null;
  const cognitiveNotesRoot = activeTab?.cognitiveNotesRoot ?? null;
  const cognitiveNotesDirectoryHandle =
    activeTab?.cognitiveNotesDirectoryHandle ?? null;
  const cognitiveNotesFolderPath = activeTab?.cognitiveNotesFolderPath ?? null;
  const setRoot = useMindMapStore((s) => s.setRoot);
  const updateRootFolderJson = useMindMapStore((s) => s.updateRootFolderJson);
  const updateCognitiveNotesRoot = useMindMapStore((s) => s.updateCognitiveNotesRoot);
  const filePreviewRequestRef = useRef(0);
  const lastViewedNodeIdRef = useRef<string | null>(null);
  const cognitiveNotesManager = useMemo(() => new CognitiveNotesManager(), []);
  const contentEditableRef = useRef<HTMLDivElement | null>(null);
  const previewEditableRef = useRef<HTMLDivElement | null>(null);
  const [preview, setPreview] = useState<PreviewState>({
    status: "idle",
    content: "",
    isMarkdown: false,
  });
  const editableContentRef = useRef("");
  const [isContentEmpty, setIsContentEmpty] = useState(true);
  const [isPreview, setIsPreview] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [dirty, setDirty] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [contentVersion, setContentVersion] = useState(0);
  const lastSavedContentRef = useRef("");
  const wasFocusedRef = useRef(false);
  const savedSelectionRef = useRef<{ start: number; end: number } | null>(null);

  const applyEditorChange = (nextValue: string) => {
    editableContentRef.current = nextValue;
    setIsContentEmpty(!nextValue);
    const isDirty = nextValue !== lastSavedContentRef.current;
    setDirty(isDirty);
    if (isDirty) {
      setSaveStatus("saving");
      setContentVersion((prev) => prev + 1);
    }
  };

  useEffect(() => {
    if (!selectedNode || !isFileNode(selectedNode)) {
      lastViewedNodeIdRef.current = null;
      return;
    }
    const nodeId = typeof selectedNode.id === "string" ? selectedNode.id : null;
    if (!nodeId) return;
    if (lastViewedNodeIdRef.current === nodeId) return;
    lastViewedNodeIdRef.current = nodeId;

    const nodePath =
      typeof (selectedNode?.data as any)?.path === "string"
        ? ((selectedNode?.data as any)?.path as string).trim()
        : null;

    void (async () => {
      try {
        if (activeTab?.moduleType === "cognitiveNotes") {
          if (!cognitiveNotesRoot) return;
          if (cognitiveNotesDirectoryHandle) {
            const updated = await cognitiveNotesManager.updateFileNodeViewsFromHandle({
              dirHandle: cognitiveNotesDirectoryHandle,
              existing: cognitiveNotesRoot,
              nodeId,
              nodePath,
            });
            updateCognitiveNotesRoot(updated);
            return;
          }
          const dirPath = cognitiveNotesFolderPath ?? cognitiveNotesRoot.path ?? "";
          if (!dirPath) return;
          const updated = await cognitiveNotesManager.updateFileNodeViewsFromPath({
            dirPath,
            existing: cognitiveNotesRoot,
            nodeId,
            nodePath,
          });
          updateCognitiveNotesRoot(updated);
          return;
        }

        if (!rootFolderJson) return;
        if (rootDirectoryHandle) {
          const updated = await fileManager.updateFileNodeViewsFromHandle({
            dirHandle: rootDirectoryHandle,
            existing: rootFolderJson,
            nodeId,
            nodePath,
          });
          updateRootFolderJson(updated);
          return;
        }
        if (!rootFolderJson.path) return;
        const updated = await fileManager.updateFileNodeViewsFromPath({
          dirPath: rootFolderJson.path,
          existing: rootFolderJson,
          nodeId,
          nodePath,
        });
        updateRootFolderJson(updated);
      } catch {
        // Silent: view tracking should not block file viewing.
      }
    })();
  }, [
    selectedNode,
    activeTab?.moduleType,
    cognitiveNotesRoot,
    cognitiveNotesDirectoryHandle,
    cognitiveNotesFolderPath,
    rootFolderJson,
    rootDirectoryHandle,
    fileManager,
    cognitiveNotesManager,
    updateCognitiveNotesRoot,
    updateRootFolderJson,
  ]);

  useEffect(() => {
    const requestId = ++filePreviewRequestRef.current;

    const resetPreview = (status: PreviewState["status"]) => {
      setPreview({ status, content: "", isMarkdown: false });
    };

    const target = resolveSmartpadTarget(selectedNode);
    if (!selectedNode || !target.path) {
      resetPreview("idle");
      return;
    }

    const isCognitiveNotes = activeTab?.moduleType === "cognitiveNotes";
    const nodePath = target.path;
    const extensionValue =
      target.isAssociated
        ? normalizeExtension(nodePath.split(".").pop())
        : normalizeExtension((selectedNode?.data as any)?.extension) ||
          normalizeExtension(nodePath.split(".").pop());
    const isMarkdown = isMarkdownExtension(extensionValue);
    const extensionEligible = isTextExtension(extensionValue) || isMarkdown;
    const contentEligible = extensionEligible;

    if (!nodePath) {
      resetPreview("ineligible");
      return;
    }

    const load = async () => {
      setPreview({ status: "loading", content: "", isMarkdown });

      try {
        if (isCognitiveNotes && cognitiveNotesDirectoryHandle) {
          const file = await fileManager.getFileFromHandle({
            rootHandle: cognitiveNotesDirectoryHandle,
            relPath: nodePath,
          });
          const mimeType = file.type ?? "";
          const eligible =
            contentEligible || isMarkdown || extensionEligible || isTextMime(mimeType);
          if (!eligible) {
            resetPreview("ineligible");
            return;
          }
          const content = await file.text();
          if (filePreviewRequestRef.current !== requestId) return;
          setPreview({
            status: content ? "ready" : "empty",
            content,
            isMarkdown,
          });
          return;
        }

        if (!isCognitiveNotes && rootDirectoryHandle) {
          const file = await fileManager.getFileFromHandle({
            rootHandle: rootDirectoryHandle,
            relPath: nodePath,
          });
          const mimeType = file.type ?? "";
          const eligible =
            contentEligible || isMarkdown || extensionEligible || isTextMime(mimeType);
          if (!eligible) {
            resetPreview("ineligible");
            return;
          }
          const content = await file.text();
          if (filePreviewRequestRef.current !== requestId) return;
          setPreview({
            status: content ? "ready" : "empty",
            content,
            isMarkdown,
          });
          return;
        }

        if (!contentEligible) {
          resetPreview("ineligible");
          return;
        }

        const resolvePath = () => {
          if (!isCognitiveNotes) return nodePath;
          if (isAbsolutePath(nodePath)) return nodePath;
          const basePath =
            cognitiveNotesFolderPath ??
            cognitiveNotesRoot?.path ??
            "";
          return basePath ? joinPath(basePath, nodePath) : nodePath;
        };
        const content = await fileManager.readTextFileFromPath(resolvePath());
        if (filePreviewRequestRef.current !== requestId) return;
        setPreview({
          status: content ? "ready" : "empty",
          content,
          isMarkdown,
        });
      } catch (error) {
        console.error("[SmartPad] Failed to load file content:", error);
        if (filePreviewRequestRef.current !== requestId) return;
        resetPreview("error");
      }
    };

    void load();
  }, [
    selectedNode,
    rootDirectoryHandle,
    cognitiveNotesDirectoryHandle,
    cognitiveNotesFolderPath,
    cognitiveNotesRoot?.path,
    activeTab?.moduleType,
    fileManager,
  ]);

  useEffect(() => {
    if (preview.status !== "ready" && preview.status !== "empty") return;
    editableContentRef.current = preview.content;
    lastSavedContentRef.current = preview.content;
    setIsContentEmpty(!preview.content);
    setDirty(false);
    setSaveStatus("idle");
    if (contentEditableRef.current) {
      contentEditableRef.current.textContent = preview.content;
    }
    if (previewEditableRef.current && isPreview) {
      previewEditableRef.current.innerHTML = marked.parse(preview.content) as string;
    }
  }, [preview.content, preview.status]);

  useEffect(() => {
    if (isPreview) {
      if (previewEditableRef.current) {
        previewEditableRef.current.innerHTML = marked.parse(
          editableContentRef.current
        ) as string;
      }
      return;
    }
    if (contentEditableRef.current) {
      contentEditableRef.current.textContent = editableContentRef.current;
    }
  }, [isPreview]);

  const commitSave = async () => {
    const target = resolveSmartpadTarget(selectedNode);
    if (!selectedNode || !target.path || !dirty) return;
    if (preview.status !== "ready" && preview.status !== "empty") return;

    const nodePath = target.path;
    if (!nodePath) return;

    const currentContent = editableContentRef.current;
    if (currentContent === lastSavedContentRef.current) {
      setDirty(false);
      setSaveStatus("idle");
      return;
    }

    // Save selection state and focus state before save
    const editorElement = contentEditableRef.current;
    const selection = window.getSelection();
    wasFocusedRef.current = document.activeElement === editorElement;
    
    if (wasFocusedRef.current && editorElement && selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(editorElement);
      preCaretRange.setEnd(range.startContainer, range.startOffset);
      const start = preCaretRange.toString().length;
      const end = start + range.toString().length;
      savedSelectionRef.current = { start, end };
    } else {
      savedSelectionRef.current = null;
    }

    const nodeId = selectedNode?.id ?? null;
    const isCognitiveNotes = activeTab?.moduleType === "cognitiveNotes";
    const hasDirectoryHandle = isCognitiveNotes
      ? !!cognitiveNotesDirectoryHandle
      : !!rootDirectoryHandle;
    const hasPath = isCognitiveNotes
      ? !!(
          (cognitiveNotesFolderPath && cognitiveNotesFolderPath.trim()) ||
          (cognitiveNotesRoot?.path && cognitiveNotesRoot.path.trim())
        )
      : !!(rootFolderJson?.path && rootFolderJson.path.trim() !== "");

    if (!hasDirectoryHandle && !hasPath) {
      setSaveStatus("error");
      return;
    }

    try {
      setSaveStatus("saving");

      // Write file content
      if (hasDirectoryHandle) {
        await fileManager.writeTextFileFromHandle({
          rootHandle: isCognitiveNotes
            ? cognitiveNotesDirectoryHandle!
            : rootDirectoryHandle!,
          relPath: nodePath,
          content: currentContent,
        });
      } else {
        const resolvePath = () => {
          if (!isCognitiveNotes) return nodePath;
          if (isAbsolutePath(nodePath)) return nodePath;
          const basePath =
            cognitiveNotesFolderPath ??
            cognitiveNotesRoot?.path ??
            "";
          return basePath ? joinPath(basePath, nodePath) : nodePath;
        };
        await fileManager.writeTextFileFromPath(resolvePath(), currentContent);
      }

      // Update node timestamps in index when applicable
      if (target.isAssociated && target.isFlowchart) {
        const nextUpdatedOn = new Date().toISOString();
        if (isCognitiveNotes && cognitiveNotesRoot) {
          const nextNodes = (cognitiveNotesRoot.flowchart_nodes ?? []).map(
            (node: any) =>
              node?.id === nodeId ? { ...node, updated_on: nextUpdatedOn } : node
          );
          updateCognitiveNotesRoot({
            ...cognitiveNotesRoot,
            flowchart_nodes: nextNodes,
          });
        } else if (!isCognitiveNotes && rootFolderJson) {
          const nextNodes = (rootFolderJson.flowchart_nodes ?? []).map((node: any) =>
            node?.id === nodeId ? { ...node, updated_on: nextUpdatedOn } : node
          );
          updateRootFolderJson({
            ...rootFolderJson,
            flowchart_nodes: nextNodes,
          });
        }
      } else if (!isCognitiveNotes && rootFolderJson) {
        const updatedRoot = hasDirectoryHandle
          ? await fileManager.updateFileNodeTimestampFromHandle({
              dirHandle: rootDirectoryHandle!,
              existing: rootFolderJson,
              nodeId,
              nodePath,
            })
          : await fileManager.updateFileNodeTimestampFromPath({
              dirPath: rootFolderJson.path,
              existing: rootFolderJson,
              nodeId,
              nodePath,
            });
        setRoot(hasDirectoryHandle ? rootDirectoryHandle : null, updatedRoot);
      }

      lastSavedContentRef.current = currentContent;
      setDirty(false);
      setSaveStatus("saved");

      // Restore focus and selection after save completes
      // Use requestAnimationFrame to ensure DOM is ready after state updates
      if (wasFocusedRef.current && savedSelectionRef.current && !isPreview) {
        requestAnimationFrame(() => {
          const editorElement = contentEditableRef.current;
          if (!editorElement || isPreview) return;

          // Restore focus
          editorElement.focus();

          // Restore selection
          const { start, end } = savedSelectionRef.current!;
          try {
            const range = document.createRange();
            const selection = window.getSelection();
            if (!selection) return;

            let charCount = 0;
            let startNode: globalThis.Node | null = null;
            let startOffset = 0;
            let endNode: globalThis.Node | null = null;
            let endOffset = 0;

            const walker = document.createTreeWalker(
              editorElement,
              NodeFilter.SHOW_TEXT,
              null
            );

            let textNode: globalThis.Node | null;
            while ((textNode = walker.nextNode() as globalThis.Node | null)) {
              const nodeLength = (textNode as Text).textContent?.length ?? 0;
              
              if (!startNode && charCount + nodeLength >= start) {
                startNode = textNode;
                startOffset = start - charCount;
              }
              
              if (charCount + nodeLength >= end) {
                endNode = textNode;
                endOffset = end - charCount;
                break;
              }
              
              charCount += nodeLength;
            }

            // Fallback: if we couldn't find nodes, use the editor element
            if (!startNode) {
              startNode = editorElement as globalThis.Node;
              startOffset = Math.min(start, editorElement.textContent?.length ?? 0);
            }
            if (!endNode) {
              endNode = editorElement as globalThis.Node;
              endOffset = Math.min(end, editorElement.textContent?.length ?? 0);
            }

            if (startNode && endNode) {
              range.setStart(startNode as globalThis.Node, startOffset);
              range.setEnd(endNode as globalThis.Node, endOffset);
              selection.removeAllRanges();
              selection.addRange(range);
            }
          } catch (err) {
            // If selection restoration fails, just ensure focus is restored
            console.warn("[SmartPad] Failed to restore selection:", err);
          }
        });
      }
    } catch (error) {
      console.error("[SmartPad] Failed to save file content:", error);
      setSaveStatus("error");
    }
  };

  // Debounced auto-save: 5 seconds after user stops typing
  useAutoSave(
    () => {
      void commitSave();
    },
    5000,
    [contentVersion, selectedNode?.id, dirty],
    dirty && (preview.status === "ready" || preview.status === "empty")
  );

  if (preview.status === "idle") {
    return null;
  }

  return (
    <div
      style={{
        borderRadius: "var(--radius-md)",
        border: "var(--border-width) solid var(--border)",
        background: "var(--surface-2)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        flex: 1,
      }}
    >
      <div
        style={{
          padding: "8px 10px",
          borderBottom: "var(--border-width) solid var(--border)",
          background: "var(--surface-1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          aria-pressed={isPreview}
          aria-label={
            isPreview
              ? uiText.smartPad.previewToggleCode
              : uiText.smartPad.previewToggleShow
          }
          title={
            isPreview
              ? uiText.smartPad.previewToggleCode
              : uiText.smartPad.previewToggleShow
          }
          onClick={() => {
            setIsPreview((prev) => !prev);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: "var(--radius-sm)",
            border: "var(--border-width) solid var(--border)",
            background: isPreview ? "var(--surface-1)" : "var(--surface-2)",
            color: "var(--text)",
            cursor: "pointer",
          }}
        >
          {isPreview ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
        </button>
      </div>
      <div
        style={{
          padding: "10px",
          overflow: "auto",
          fontSize: "0.85rem",
          lineHeight: 1.4,
          flex: 1,
          minHeight: 0,
        }}
      >
        {preview.status === "loading" && (
          <div>{uiText.statusMessages.loading}</div>
        )}
        {preview.status === "error" && (
          <div>{uiText.placeholders.fileContentUnavailable}</div>
        )}
        {preview.status === "ineligible" && (
          <div>{uiText.placeholders.fileContentNotText}</div>
        )}
        {(preview.status === "ready" || preview.status === "empty") && (
          <>
            {isContentEmpty && (
              <div
                style={{
                  marginBottom: "var(--space-2)",
                  fontSize: "0.8rem",
                  opacity: 0.6,
                }}
              >
                {uiText.placeholders.fileContentEmpty}
              </div>
            )}
            {isPreview && (
              <style>
                {`
                  .pm-smartpad-preview h1,
                  .pm-smartpad-preview h2,
                  .pm-smartpad-preview h3,
                  .pm-smartpad-preview h4,
                  .pm-smartpad-preview h5,
                  .pm-smartpad-preview h6,
                  .pm-smartpad-preview p {
                    margin: 0 0 6px 0;
                  }
                  .pm-smartpad-preview h1:last-child,
                  .pm-smartpad-preview h2:last-child,
                  .pm-smartpad-preview h3:last-child,
                  .pm-smartpad-preview h4:last-child,
                  .pm-smartpad-preview h5:last-child,
                  .pm-smartpad-preview h6:last-child,
                  .pm-smartpad-preview p:last-child {
                    margin-bottom: 0;
                  }
                `}
              </style>
            )}
            {isPreview ? (
              <div
                ref={previewEditableRef}
                style={{
                  minHeight: 60,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  lineHeight: 1.2,
                  outline: "none",
                  cursor: "default",
                }}
                className="pm-smartpad-preview"
              />
            ) : (
              <div
                ref={contentEditableRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(event) => {
                  const target = event.currentTarget;
                  const nextValue = target.innerText;
                  applyEditorChange(nextValue);
                }}
                onPaste={(event) => {
                  if (isPreview) return;
                  const editor = contentEditableRef.current;
                  if (!editor) return;

                  const html = event.clipboardData?.getData("text/html") ?? "";
                  const text = event.clipboardData?.getData("text/plain") ?? "";
                  if (!html && !text) return;

                  event.preventDefault();
                  const markdown = html ? htmlToMarkdownPreserveSpacing(html) : text;
                  insertTextAtSelection(editor, markdown);
                  const updated = getEditorPlainText(editor);
                  applyEditorChange(updated);
                }}
                style={{
                  minHeight: 120,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily:
                    "var(--font-family-mono, ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace)",
                  outline: "none",
                  cursor: "text",
                }}
              />
            )}
          </>
        )}
      </div>
      <div
        style={{
          padding: "8px 10px",
          borderTop: "var(--border-width) solid var(--border)",
          background: "var(--surface-1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          minHeight: "15px",
        }}
      >
        {saveStatus === "saving" && (
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-secondary)",
              opacity: 0.7,
            }}
          >
            Saving...
          </div>
        )}
        {saveStatus === "saved" && (
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--success-color, #22c55e)",
              opacity: 0.8,
            }}
          >
            Saved
          </div>
        )}
        {saveStatus === "error" && (
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--error-color, #ef4444)",
              opacity: 0.8,
            }}
          >
            Save failed
          </div>
        )}
      </div>
    </div>
  );
}
