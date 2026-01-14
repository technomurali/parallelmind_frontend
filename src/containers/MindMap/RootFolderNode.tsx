/**
 * RootFolderNode.tsx
 *
 * ReactFlow custom node component for displaying the root folder in the mind map.
 * Renders a circular folder icon with a layered "multi-folder" visual effect.
 *
 * This node represents the root directory selected by the user and serves as
 * the entry point for the folder structure visualization.
 */

import { useState, type ReactNode } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { RootFolderJson } from "../../data/fileManager";
import { useMindMapStore } from "../../store/mindMapStore";

type SvgFolderNodeProps = {
  width: number;
  height: number;
  tooltipText?: string;
  selected: boolean;
  contentFontSize: number;
  contentPadding: number;
  contentGap: number;
  isExpanded: boolean;
  children: ReactNode;
};

const SvgFolderNode = ({
  width,
  height,
  tooltipText,
  selected,
  contentFontSize,
  contentPadding,
  contentGap,
  isExpanded,
  children,
}: SvgFolderNodeProps) => {
  // Content area height in SVG coordinates (viewBox units).
  const contentHeight = 230;
  const expandedPathD = `
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
  `;

  const collapsedPathD = `
    M 96 172
    H 440
    A 32 32 0 0 0 472 140
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
    V 140
    A 28 28 0 0 0 80 172
    H 96
    Z
  `;

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
        d={isExpanded ? expandedPathD : collapsedPathD}
        fill="var(--surface-2)"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: "d 180ms ease-in-out" }}
      />

      {/* HTML Content */}
      <foreignObject x="90" y="110" width="350" height={contentHeight}>
        {/* foreignObject wrapper div: lays out the node inner UI */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: `${contentGap}px`,
            padding: `${contentPadding}px`,
            boxSizing: "border-box",
            height: "100%",
            position: "relative",
            fontFamily: "var(--font-family)",
            fontSize: `${contentFontSize}px`,
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
  data,
  selected,
}: NodeProps<RootFolderJson>) {
  const settings = useMindMapStore((s) => s.settings);
  const [isExpanded, setIsExpanded] = useState(true);

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

  // Handle placement: align to the SVG folder outline (not the SVG bounds).
  // The folder path's x/y extents were authored in the `SvgFolderNode` viewBox (0..512 x 0..384).
  //
  // Important: the folder "tab/bump" is on the left, so the TOP handle should not share the
  // same x-center as the bottom handle (which is centered on the overall folder body).
  const viewBoxWidth = 512;
  const viewBoxHeight = 384;
  const outlineTopY = 24;
  const outlineBottomY = 332;

  // These x positions are derived from the path:
  // - Tab top segment runs roughly from x=146..204 => center ~175
  // - Bottom body runs roughly from x=96..440 => center ~268
  const topHandleX = 175;
  const bottomHandleX = 268;

  const topHandleLeft = `${(topHandleX / viewBoxWidth) * 100}%`;
  const bottomHandleLeft = `${(bottomHandleX / viewBoxWidth) * 100}%`;
  const topHandleY = (outlineTopY / viewBoxHeight) * svgHeight;
  const collapsedBottomY = 172;
  const bottomHandleY =
    (isExpanded ? outlineBottomY : collapsedBottomY) / viewBoxHeight * svgHeight;

  // Convert intended screen px into SVG user units so text renders at the desired size
  // after the SVG is scaled down by its viewBox.
  const svgScale = svgWidth / viewBoxWidth;
  const toSvgPx = (px: number) => px / svgScale;
  const headerFontSize =
    settings.appearance.nodeHeaderFontSize ??
    settings.appearance.nodeBodyFontSize ??
    14;
  const bodyFontSize = settings.appearance.nodeBodyFontSize ?? 18;

  // User-requested: 50% of current size.
  const handleSize = 6;
  const handleStyleBase: React.CSSProperties = {
    width: handleSize,
    height: handleSize,
    borderRadius: "50%",
    // User-requested: always gray (no selection/primary tint).
    background: "transparent",
    border: "2px solid var(--border)",
    opacity: 1,
    transform: "translate(-50%, -50%)",
    zIndex: 5,
  };

  return (
    <div
      role="button"
      aria-label="Toggle folder node size"
      onClick={() => setIsExpanded((prev) => !prev)}
      style={{
        background: "transparent",
        border: "none",
        borderRadius: "var(--radius-md)",
        color: "var(--text)",
        padding: 0,
        display: "grid",
        justifyItems: "center",
        position: "relative",
      }}
    >
      {/* Handles: exactly top-center (bump) + bottom-center (as in the screenshot). */}
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        style={{
          ...handleStyleBase,
          left: topHandleLeft,
          top: topHandleY,
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        style={{
          ...handleStyleBase,
          left: bottomHandleLeft,
          top: bottomHandleY,
        }}
      />

      {/* Main SVG node: folder outline + foreignObject content */}
      <SvgFolderNode
        width={svgWidth}
        height={svgHeight}
        tooltipText={tooltipText}
        selected={selected}
        contentFontSize={toSvgPx(bodyFontSize)}
        contentPadding={toSvgPx(0.5)}
        contentGap={toSvgPx(4)}
        isExpanded={isExpanded}
      >
        {/* Name section container */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {/* Name label div */}
          <div
            style={{
              opacity: 0.75,
              fontWeight: 600,
              fontSize: `${toSvgPx(headerFontSize)}px`,
            }}
          >
            Name
          </div>
          {/* Name value div */}
          <div
            style={{
              fontWeight: 800,
              fontSize: `${toSvgPx(bodyFontSize)}px`,
              lineHeight: "1.8",
            }}
          >
            {nodeName ?? ""}
          </div>
        </div>

        {isExpanded && (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {/* Purpose label div */}
            <div
              style={{
                opacity: 0.75,
                fontWeight: 600,
                fontSize: `${toSvgPx(headerFontSize)}px`,
              }}
            >
              Purpose
            </div>
            {/* Purpose value div */}
            <div
              style={{
                fontSize: `${toSvgPx(bodyFontSize)}px`,
                lineHeight: "1.25",
              }}
            >
              {nodePurpose ?? ""}
            </div>
          </div>
        )}
      </SvgFolderNode>
    </div>
  );
}
