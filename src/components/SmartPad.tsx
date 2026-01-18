import { useEffect, useMemo, useRef, useState } from "react";
import type { Node } from "reactflow";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { marked } from "marked";
import { uiText } from "../constants/uiText";
import { FileManager } from "../data/fileManager";

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

const isFileNode = (node: Node | null): boolean =>
  !!node &&
  ((node?.data as any)?.node_type === "file" ||
    (node?.data as any)?.type === "file" ||
    node?.type === "file");

export default function SmartPad({
  selectedNode,
  rootDirectoryHandle,
}: SmartPadProps) {
  const fileManager = useMemo(() => new FileManager(), []);
  const filePreviewRequestRef = useRef(0);
  const contentEditableRef = useRef<HTMLDivElement | null>(null);
  const previewEditableRef = useRef<HTMLDivElement | null>(null);
  const [preview, setPreview] = useState<PreviewState>({
    status: "idle",
    content: "",
    isMarkdown: false,
  });
  const editableContentRef = useRef("");
  const [isContentEmpty, setIsContentEmpty] = useState(true);
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    const requestId = ++filePreviewRequestRef.current;

    const resetPreview = (status: PreviewState["status"]) => {
      setPreview({ status, content: "", isMarkdown: false });
    };

    if (!selectedNode || !isFileNode(selectedNode)) {
      resetPreview("idle");
      return;
    }

    const nodePath =
      typeof (selectedNode?.data as any)?.path === "string"
        ? ((selectedNode?.data as any)?.path as string).trim()
        : "";
    const extensionValue =
      normalizeExtension((selectedNode?.data as any)?.extension) ||
      normalizeExtension(nodePath.split(".").pop());
    const isMarkdown = isMarkdownExtension(extensionValue);
    const extensionEligible = isTextExtension(extensionValue) || isMarkdown;

    if (!nodePath) {
      resetPreview("ineligible");
      return;
    }

    const load = async () => {
      setPreview({ status: "loading", content: "", isMarkdown });

      try {
        if (rootDirectoryHandle) {
          const file = await fileManager.getFileFromHandle({
            rootHandle: rootDirectoryHandle,
            relPath: nodePath,
          });
          const mimeType = file.type ?? "";
          const eligible =
            isMarkdown || extensionEligible || isTextMime(mimeType);
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

        if (!extensionEligible) {
          resetPreview("ineligible");
          return;
        }

        const content = await fileManager.readTextFileFromPath(nodePath);
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
  }, [selectedNode, rootDirectoryHandle, fileManager]);

  useEffect(() => {
    if (preview.status !== "ready" && preview.status !== "empty") return;
    editableContentRef.current = preview.content;
    setIsContentEmpty(!preview.content);
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

  if (preview.status === "idle" || preview.status === "ineligible") {
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
                  editableContentRef.current = nextValue;
                  setIsContentEmpty(!nextValue);
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
          minHeight: "15px",
        }}
        aria-hidden="true"
      />
    </div>
  );
}
