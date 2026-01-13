/**
 * RootFolderNode.tsx
 *
 * ReactFlow custom node component for displaying the root folder in the mind map.
 * Renders a circular folder icon with a layered "multi-folder" visual effect.
 *
 * This node represents the root directory selected by the user and serves as
 * the entry point for the folder structure visualization.
 */

import { Handle, Position, type NodeProps } from "reactflow";
import type { RootFolderJson } from "../../data/fileManager";
import { useMindMapStore } from "../../store/mindMapStore";

/**
 * RootFolderNode component
 *
 * Custom ReactFlow node that displays the root folder with a distinctive
 * layered folder icon design. The node shows a tooltip with the folder name
 * when hovered.
 *
 * Visual selection indication: When selected, the node displays a thicker
 * accent-colored border to provide clear visual feedback without obscuring
 * the node content.
 *
 * @param props - ReactFlow NodeProps containing node id, data, and selected state
 */
export default function RootFolderNode({
  id,
  data,
  selected,
}: NodeProps<RootFolderJson>) {
  const updateNodeData = useMindMapStore((s) => s.updateNodeData);

  // Check if node is minimized (default to false/maximized)
  const isMinimized = (data as any)?.isMinimized === true;

  // Toggle minimize/maximize state
  const toggleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent node selection when clicking button
    updateNodeData(id, { isMinimized: !isMinimized });
  };

  // Extract text content from node data based on display mode.
  const nodeName =
    typeof data?.name === "string" && data.name.trim()
      ? data.name.trim()
      : null;
  const nodePurpose =
    typeof (data as any)?.purpose === "string" &&
    (data as any).purpose.trim()
      ? (data as any).purpose.trim()
      : (typeof (data as any)?.description === "string" &&
        (data as any).description.trim()
          ? (data as any).description.trim()
          : null);

  // Build tooltip with name and purpose on separate lines.
  // Each field wraps to multiple lines with approximately 8 words per line.
  const tooltipText = (() => {
    // Wrap text to approximately 8 words per line, preserving all content.
    const wrapWords = (text: string, wordsPerLine: number): string => {
      const words = text.trim().split(/\s+/);
      const lines: string[] = [];
      for (let i = 0; i < words.length; i += wordsPerLine) {
        lines.push(words.slice(i, i + wordsPerLine).join(" "));
      }
      return lines.join("\n");
    };

    const parts: string[] = [];
    if (typeof data?.name === "string" && data.name.trim()) {
      parts.push(wrapWords(data.name, 8));
    }
    const purpose = typeof (data as any)?.purpose === "string" && (data as any).purpose.trim()
      ? (data as any).purpose
      : (typeof (data as any)?.description === "string" && (data as any).description.trim()
          ? (data as any).description
          : null);
    if (purpose) {
      parts.push(wrapWords(purpose, 8));
    }
    return parts.length > 0 ? parts.join("\n") : undefined;
  })();

  // Selection visual indicator: thicker border with accent color when selected.
  // Uses theme variables to ensure consistency across light/dark themes.
  const borderStyle = selected
    ? {
        // Thicker border (2px) with primary accent color for clear selection indication.
        borderWidth: "2px",
        borderStyle: "solid",
        borderColor: "var(--primary-color)",
        // Subtle box-shadow provides additional depth without being distracting.
        boxShadow: "0 0 0 2px rgba(100, 108, 255, 0.2)",
      }
    : {
        // Default border styling for unselected state.
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
      {/* 
        Connection handles for edges - visible and interactive on all sides.
        Handles allow connections from any direction for flexible node linking.
      */}
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          opacity: 1,
          top: -3,
        }}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="target-right"
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          opacity: 1,
          right: -3,
        }}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="target-bottom"
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          opacity: 1,
          bottom: -3,
        }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        style={{
          width: 3,
          height: 3,
          borderRadius: "50%",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          opacity: 1,
          left: -3,
        }}
      />
      <Handle
        type="source"
        position={Position.Top}
        id="source-top"
        style={{
          width: 3,
          height: 3,
          borderRadius: "50%",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          opacity: 1,
          top: -3,
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        style={{
          width: 3,
          height: 3,
          borderRadius: "50%",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          opacity: 1,
          right: -3,
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        style={{
          width: 3,
          height: 3,
          borderRadius: "50%",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          opacity: 1,
          bottom: -3,
        }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="source-left"
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          opacity: 1,
          left: -3,
        }}
      />
      <div
        title={tooltipText}
        style={{
          width: 100,
          minWidth: 100,
          maxWidth: 100,
          minHeight: isMinimized ? "auto" : 100,
          height: "auto",
          borderRadius: "var(--radius-md)",
          ...borderStyle,
          background: "var(--surface-2)",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "flex-start",
          position: "relative",
          padding: "8px",
          boxSizing: "border-box",
          gap: "6px",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        }}
        aria-hidden="true"
      >
        {/* Details card (only supported node view) */}
        <>
          {/* Minimize/Maximize button */}
          <button
            type="button"
            onClick={toggleMinimize}
            aria-label={isMinimized ? "Maximize node" : "Minimize node"}
            title={isMinimized ? "Maximize" : "Minimize"}
            style={{
              position: "absolute",
              top: "2px",
              right: "2px",
              width: "16px",
              height: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              color: "var(--text)",
              cursor: "pointer",
              opacity: 0.6,
              borderRadius: "var(--radius-sm)",
              padding: 0,
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
              // Up arrow icon: to maximize/expand
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
              // Down arrow icon: to minimize/collapse
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

          {/* When minimized: show only Name */}
          {isMinimized ? (
            <div
              style={{
                fontWeight: 600,
                fontSize: "var(--node-details-header-font-size, 10px)",
                lineHeight: "1.2",
                wordBreak: "break-word",
                overflowWrap: "break-word",
                whiteSpace: "pre-wrap",
                paddingRight: "20px", // Space for minimize/maximize button
              }}
            >
              {nodeName ?? "(no name)"}
            </div>
          ) : (
            <>
              {/* Name section */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                }}
              >
                <div
                  style={{
                    fontSize: "var(--node-details-label-font-size, 10px)",
                    opacity: 0.75,
                    fontWeight: 100,
                  }}
                >
                  Name
                </div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "var(--node-details-header-font-size, 10px)",
                    lineHeight: "1.2",
                    wordBreak: "break-word",
                    overflowWrap: "break-word",
                    whiteSpace: "pre-wrap",
                    paddingRight: "20px", // Space for minimize/maximize button
                  }}
                >
                  {nodeName ?? "(no name)"}
                </div>
              </div>

              {/* Purpose section */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                }}
              >
                <div
                  style={{
                    fontSize: "var(--node-details-label-font-size, 9px)",
                    opacity: 0.75,
                    fontWeight: 600,
                  }}
                >
                  Purpose
                </div>
                <div
                  style={{
                    fontSize: "var(--node-details-content-font-size, 9px)",
                    lineHeight: "1.25",
                    wordBreak: "break-word",
                    overflowWrap: "break-word",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {nodePurpose ?? ""}
                </div>
              </div>
            </>
          )}
        </>
      </div>
    </div>
  );
}
