import { useEffect, useMemo, useRef, useState } from "react";
import type { Node } from "reactflow";
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
  const picklistRef = useRef<HTMLDivElement | null>(null);
  const contentEditableRef = useRef<HTMLDivElement | null>(null);
  const [preview, setPreview] = useState<PreviewState>({
    status: "idle",
    content: "",
    isMarkdown: false,
  });
  const editableContentRef = useRef("");
  const [isContentEmpty, setIsContentEmpty] = useState(true);
  const [picklistOpen, setPicklistOpen] = useState(false);

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
    if (!picklistOpen) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (picklistRef.current && target && picklistRef.current.contains(target)) {
        return;
      }
      setPicklistOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPicklistOpen(false);
      }
    };

    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [picklistOpen]);

  useEffect(() => {
    if (preview.status !== "ready" && preview.status !== "empty") return;
    editableContentRef.current = preview.content;
    setIsContentEmpty(!preview.content);
    if (contentEditableRef.current) {
      contentEditableRef.current.textContent = preview.content;
    }
  }, [preview.content, preview.status]);

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
        <div
          ref={picklistRef}
          style={{
            position: "relative",
            display: "inline-flex",
          }}
        >
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={picklistOpen}
            aria-label={uiText.smartPad.picklistAriaLabel}
            onClick={() => setPicklistOpen((prev) => !prev)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 8px",
              borderRadius: "var(--radius-sm)",
              border: "var(--border-width) solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--text)",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: 600,
              fontFamily: "var(--font-family)",
            }}
          >
            <span>{uiText.smartPad.picklistDefault}</span>
            <span aria-hidden="true">v</span>
          </button>
          {picklistOpen && (
            <div
              role="listbox"
              aria-label={uiText.smartPad.picklistAriaLabel}
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 6px)",
                minWidth: 160,
                borderRadius: "var(--radius-md)",
                border: "var(--border-width) solid var(--border)",
                background: "var(--surface-1)",
                color: "var(--text)",
                boxShadow: "0 10px 24px rgba(0,0,0,0.2)",
                padding: "6px",
                zIndex: 10,
              }}
            >
              {uiText.smartPad.picklistOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={option === uiText.smartPad.picklistDefault}
                  onClick={() => setPicklistOpen(false)}
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
                    fontSize: "0.9rem",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "var(--surface-2)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "transparent";
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
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
