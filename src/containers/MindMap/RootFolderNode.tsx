/**
 * RootFolderNode.tsx
 *
 * ReactFlow custom node component for displaying the root folder in the mind map.
 * Renders a circular folder icon with a layered "multi-folder" visual effect.
 *
 * This node represents the root directory selected by the user and serves as
 * the entry point for the folder structure visualization.
 */

import type { ReactNode } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { RootFolderJson } from "../../data/fileManager";
import { useMindMapStore } from "../../store/mindMapStore";

type SvgFolderNodeProps = {
  width: number;
  height: number;
  isMinimized: boolean;
  tooltipText?: string;
  selected: boolean;
  children: ReactNode;
};

const SvgFolderNode = ({
  width,
  height,
  isMinimized,
  tooltipText,
  selected,
  children,
}: SvgFolderNodeProps) => {
  // Content area height in SVG coordinates (viewBox units).
  const contentHeight = isMinimized ? 110 : 230;

  const stroke = selected ? "var(--primary-color)" : "var(--border)";
  const strokeWidth = selected ? 6 : 4;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 512 384"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
      style={{
        display: "block",
        overflow: "visible",
        color: "var(--text)",
      }}
    >
      {/* Tooltip */}
      <title>{tooltipText}</title>

      {/* Node Shape */}
      <path
        d="
          M 96 332
          H 440
          A 32 32 0 0 0 472 300
          V 128
          A 32 32 0 0 0 440 96
          H 282
          C 270 96 262 92 256 82
          L 244 48
          C 236 34 222 24 204 24
          H 146
          C 128 24 116 34 108 48
          L 98 68
          C 94 76 88 80 78 80
          H 80
          A 28 28 0 0 0 52 108
          V 300
          A 28 28 0 0 0 80 332
          H 96
          Z
        "
        fill="var(--surface-2)"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* HTML Content */}
      <foreignObject x="90" y="110" width="300" height={contentHeight}>
        {/* foreignObject wrapper div: lays out the node inner UI */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
            padding: "8px",
            boxSizing: "border-box",
            height: "100%",
            position: "relative",
            fontFamily: "var(--font-family)",
            fontSize: "14px",
            color: "var(--text)",
          }}
        >
          {children}
        </div>
      </foreignObject>
    </svg>
  );
};

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

  // Build tooltip with name and purpose on separate lines, wrapped to ~8 words/line.
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
    if (typeof data?.name === "string" && data.name.trim()) {
      parts.push(wrapWords(data.name, 8));
    }
    const purpose =
      typeof (data as any)?.purpose === "string" && (data as any).purpose.trim()
        ? (data as any).purpose
        : typeof (data as any)?.description === "string" &&
          (data as any).description.trim()
        ? (data as any).description
        : null;
    if (purpose) {
      parts.push(wrapWords(purpose, 8));
    }
    return parts.length > 0 ? parts.join("\n") : undefined;
  })();

  // Visual size (CSS px) for the SVG node.
  const svgWidth = 200;
  const svgHeight = 150;

  return (
    <>
      {/* Outer wrapper div: transparent container that centers the node content and provides space for connection handles */}
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
      {/* Main SVG node: folder outline + foreignObject content */}
      <SvgFolderNode
        width={svgWidth}
        height={svgHeight}
        isMinimized={isMinimized}
        tooltipText={tooltipText}
        selected={selected}
      >
        {/* Minimize/Maximize button */}
        <button
          type="button"
          onClick={toggleMinimize}
          aria-label={isMinimized ? "Maximize node" : "Minimize node"}
          title={isMinimized ? "Maximize" : "Minimize"}
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            width: 18,
            height: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            color: "var(--text)",
            cursor: "pointer",
            opacity: 0.8,
            borderRadius: "var(--radius-sm)",
            padding: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "1";
            e.currentTarget.style.background = "var(--surface-1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "0.8";
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

        {isMinimized ? (
          // Minimized view div: shows only the node name when collapsed
          <div style={{ fontWeight: 700, fontSize: "14px", lineHeight: "1.2" }}>
            {nodeName ?? ""}
          </div>
        ) : (
          <>
            {/* Name section container */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {/* Name label div */}
              <div style={{ opacity: 0.75, fontWeight: 600, fontSize: "12px" }}>
                Name
              </div>
              {/* Name value div */}
              <div style={{ fontWeight: 800, fontSize: "16px", lineHeight: "1.1" }}>
                {nodeName ?? ""}
              </div>
            </div>

            {/* Purpose section container */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {/* Purpose label div */}
              <div style={{ opacity: 0.75, fontWeight: 600, fontSize: "12px" }}>
                Purpose
              </div>
              {/* Purpose value div */}
              <div style={{ fontSize: "13px", lineHeight: "1.25" }}>
                {nodePurpose ?? ""}
              </div>
            </div>
          </>
        )}
      </SvgFolderNode>
      </div>
    </>
  );
}
