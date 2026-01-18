import { useEffect, useMemo, useRef, useState } from "react";
import type { Node } from "reactflow";
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
  const [preview, setPreview] = useState<PreviewState>({
    status: "idle",
    content: "",
    isMarkdown: false,
  });

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

  const markdownHtml = useMemo(() => {
    if (!preview.isMarkdown || !preview.content) return "";
    return marked.parse(preview.content);
  }, [preview.content, preview.isMarkdown]);

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
          fontWeight: 600,
          fontSize: "0.85rem",
          borderBottom: "var(--border-width) solid var(--border)",
          background: "var(--surface-1)",
        }}
      >
        {uiText.fields.nodeDetails.fileContent}
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
        {preview.status === "empty" && (
          <div>{uiText.placeholders.fileContentEmpty}</div>
        )}
        {preview.status === "ready" &&
          (preview.isMarkdown ? (
            <div
              style={{ whiteSpace: "normal" }}
              dangerouslySetInnerHTML={{ __html: markdownHtml }}
            />
          ) : (
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily:
                  "var(--font-family-mono, ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace)",
              }}
            >
              {preview.content}
            </pre>
          ))}
      </div>
    </div>
  );
}
