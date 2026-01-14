/**
 * FileNode.tsx
 *
 * ReactFlow custom node component for displaying a file node in the mind map.
 * Visual style: "document/file" outline with a folded corner (like the provided sample).
 * Still shows Name + Purpose and supports minimize + connection handles.
 */

import type { NodeProps } from "reactflow";
import { useMindMapStore } from "../../store/mindMapStore";

export default function FileNode({ id, data, selected }: NodeProps<any>) {
  const updateNodeData = useMindMapStore((s) => s.updateNodeData);

  const isMinimized = (data as any)?.isMinimized === true;

  const toggleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateNodeData(id, { isMinimized: !isMinimized });
  };

  const nodeName =
    typeof (data as any)?.name === "string" && (data as any).name.trim()
      ? (data as any).name.trim()
      : null;
  const nodePurpose =
    typeof (data as any)?.purpose === "string" && (data as any).purpose.trim()
      ? (data as any).purpose.trim()
      : null;

  const tooltipText = (() => {
    const wrapWords = (text: string, wordsPerLine: number): string => {
      const words = text.trim().split(/\s+/);
      const lines: string[] = [];
      for (let i = 0; i < words.length; i += wordsPerLine) {
        lines.push(words.slice(i, i + wordsPerLine).join(" "));
      }
      return lines.join("\n");
    };

    const parts: string[] = [];
    if (nodeName) parts.push(wrapWords(nodeName, 8));
    if (nodePurpose) parts.push(wrapWords(nodePurpose, 8));
    return parts.length > 0 ? parts.join("\n") : undefined;
  })();

  const borderStyle = selected
    ? {
        borderWidth: "2px",
        borderStyle: "solid",
        borderColor: "var(--primary-color)",
        boxShadow: "0 0 0 2px rgba(100, 108, 255, 0.2)",
      }
    : {
        border: "var(--border-width) solid var(--border)",
      };

  return (
    <div
      style={{
        background: "transparent",
        border: "none",
        borderRadius: "var(--radius-md)",
        color: "var(--text)",
        padding: 0,
        display: "grid",
        justifyItems: "center",
      }}
    >
      <div
        title={tooltipText}
        style={{
          width: 80,
          minWidth: 80,
          maxWidth: 80,
          borderRadius: "var(--radius-md)",
          ...borderStyle,
          background: "transparent",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "flex-start",
          position: "relative",
          padding: 0,
          boxSizing: "border-box",
          gap: "6px",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        }}
        aria-hidden="true"
      >
        <button
          type="button"
          onClick={toggleMinimize}
          aria-label={isMinimized ? "Maximize node" : "Minimize node"}
          title={isMinimized ? "Maximize" : "Minimize"}
          style={{
            position: "absolute",
            top: "6px",
            right: "6px",
            width: "16px",
            height: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            color: "var(--pm-file-node-control, var(--text))",
            cursor: "pointer",
            opacity: 0.6,
            borderRadius: "var(--radius-sm)",
            padding: 0,
            zIndex: 2,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "1";
            e.currentTarget.style.background = "var(--surface-1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "0.6";
            e.currentTarget.style.background = "transparent";
          }}
        >
          {isMinimized ? (
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 2 L2 6 L8 6 Z" />
            </svg>
          ) : (
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 8 L2 4 L8 4 Z" />
            </svg>
          )}
        </button>

        {/* Document/file shape (outline + folded corner) */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: isMinimized ? 60 : 100,
            borderRadius: "var(--radius-md)",
            background: "var(--surface-2)",
            overflow: "hidden",
          }}
        >
          {/* Folded corner */}
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 18,
              height: 18,
              background: "var(--surface-1)",
              borderLeft: "var(--border-width) solid var(--border)",
              borderBottom: "var(--border-width) solid var(--border)",
              clipPath: "polygon(0 0, 100% 0, 100% 100%)",
              opacity: 0.95,
            }}
          />

          {/* Inner content */}
          <div
            style={{
              padding: "8px",
              paddingRight: 20, // leave space under the fold
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div
              style={{
                fontSize: "8px",
                fontWeight: 700,
                letterSpacing: "0.02em",
                opacity: 0.85,
              }}
            >
              FILE
            </div>

            <div
              style={{
                fontWeight: 700,
                fontSize: "9px",
                lineHeight: "1.2",
                wordBreak: "break-word",
                overflowWrap: "break-word",
                whiteSpace: "pre-wrap",
              }}
            >
              {nodeName ?? "(no name)"}
            </div>

            {!isMinimized && (
              <>
                <div
                  style={{
                    height: 1,
                    background: "var(--border)",
                    opacity: 0.6,
                    margin: "2px 0",
                  }}
                />
                <div
                  style={{
                    fontSize: "8px",
                    lineHeight: "1.25",
                    wordBreak: "break-word",
                    overflowWrap: "break-word",
                    whiteSpace: "pre-wrap",
                    opacity: 0.95,
                  }}
                >
                  {nodePurpose ?? ""}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

