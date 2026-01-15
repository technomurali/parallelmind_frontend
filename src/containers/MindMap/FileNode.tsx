/**
 * FileNode.tsx
 *
 * ReactFlow custom node component for displaying a file node in the mind map.
 * Visual style: SVG document outline with a rounded tab.
 * Still shows Name + Purpose.
 */

import { useState } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { useMindMapStore } from "../../store/mindMapStore";
import { getNodeFillColor } from "../../utils/nodeFillColors";

export default function FileNode({
  data,
  selected,
  dragging,
  xPos,
  yPos,
}: NodeProps<any>) {
  const settings = useMindMapStore((s) => s.settings);
  const [isExpanded, setIsExpanded] = useState(true);

  const nodeName =
    typeof (data as any)?.name === "string" && (data as any).name.trim()
      ? (data as any).name.trim()
      : null;
  const nodePurpose =
    typeof (data as any)?.purpose === "string" && (data as any).purpose.trim()
      ? (data as any).purpose.trim()
      : null;


  const stroke = selected ? "var(--primary-color)" : "var(--border)";
  const strokeWidth = selected ? 6 : 4;
  const levelValue =
    typeof (data as any)?.level === "number" ? (data as any).level : 0;
  const fillColor = getNodeFillColor(
    settings,
    levelValue,
    "var(--surface-2)",
    { variant: "file" }
  );
  const fillOpacity = 0.98;
  const handleWidth = 12;
  const handleHeight = 6;
  const handleBaseStyle: React.CSSProperties = {
    width: handleWidth,
    height: handleHeight,
    background: "var(--border)",
    border: "none",
    opacity: 1,
    zIndex: 3,
  };
  const viewBoxMinY = 55;
  const viewBoxHeight = 420;
  const svgHeight = 130;
  const pathTopY = 60;
  const expandedPathBottomY = 420;
  const collapsedPathBottomY = 120;
  const bodyTopY = 120;
  const bodyBottomY = isExpanded ? expandedPathBottomY : collapsedPathBottomY;
  const bodyCornerRadius = Math.max(
    0,
    Math.min(12, (bodyBottomY - bodyTopY) / 2)
  );
  const toSvgPx = (y: number) =>
    Math.round(((y - viewBoxMinY) / viewBoxHeight) * svgHeight);
  const topHandleTop = toSvgPx(pathTopY) - Math.round(strokeWidth / 2) + 2;
  const buildDetailedPathD = (bottomY: number, radius: number) =>
    `M 80 60 H 150 C 165 60 175 40 200 40 C 225 40 235 60 250 60 H 320 V ${bodyTopY} H 80 Z ` +
    `M 80 ${bodyTopY} V ${bottomY - radius} A ${radius} ${radius} 0 0 0 ${
      80 + radius
    } ${bottomY} H ${320 - radius} A ${radius} ${radius} 0 0 0 320 ${
      bottomY - radius
    } V ${bodyTopY} Z`;
  const buildSimplifiedPathD = (bottomY: number, radius: number) =>
    `M 80 60 H 150 L 175 40 H 225 L 250 60 H 320 V ${bodyTopY} H 80 Z ` +
    `M 80 ${bodyTopY} V ${bottomY - radius} A ${radius} ${radius} 0 0 0 ${
      80 + radius
    } ${bottomY} H ${320 - radius} A ${radius} ${radius} 0 0 0 320 ${
      bottomY - radius
    } V ${bodyTopY} Z`;
  const detailedPathD = buildDetailedPathD(bodyBottomY, bodyCornerRadius);
  const simplifiedPathD = buildSimplifiedPathD(bodyBottomY, bodyCornerRadius);
  const snapOffsetX =
    dragging && typeof xPos === "number" ? Math.round(xPos) - xPos : 0;
  const snapOffsetY =
    dragging && typeof yPos === "number" ? Math.round(yPos) - yPos : 0;

  return (
    <div
      role="button"
      aria-label="Toggle file node size"
      onClick={() => setIsExpanded((prev) => !prev)}
      style={{
        background: "transparent",
        border: "none",
        borderRadius: "var(--radius-md)",
        color: "var(--text)",
        padding: 0,
        display: "grid",
        justifyItems: "center",
        transform:
          snapOffsetX !== 0 || snapOffsetY !== 0
            ? `translate(${snapOffsetX}px, ${snapOffsetY}px)`
            : undefined,
      }}
    >
      {/* Root container: Clickable wrapper for the entire file node that handles expand/collapse toggle and integer pixel snapping during drag */}
      {/* Node content wrapper: Fixed-width container (130px) that holds the SVG shape and handles, with relative positioning for handle placement */}
      <div
        style={{
          width: 125,
          minWidth: 125,
          maxWidth: 125,
          background: "transparent",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "flex-start",
          position: "relative",
          padding: 0,
          boxSizing: "border-box",
          gap: "6px",
          transition: dragging ? "none" : "border-color 0.15s ease, box-shadow 0.15s ease",
        }}
        aria-hidden="true"
      >
        <Handle
          type="target"
          position={Position.Top}
          id="target-top"
          style={{
            ...handleBaseStyle,
            left: "50%",
            top: topHandleTop,
            transform: "translate(-50%, 0)",
            borderRadius: "9px 9px 0 0",
            transition: dragging ? "none" : "top 180ms ease-in-out",
          }}
        />
        {/* SVG shape container: Wrapper for the document/file SVG path that provides the visual outline and clips overflow */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: svgHeight,
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
          }}
        >
          <svg
            width="100%"
            height="100%"
            viewBox="80 20 240 410"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-hidden="true"
            shapeRendering={dragging ? "crispEdges" : "geometricPrecision"}
            style={{ display: "block" }}
          >
            <path
              d={dragging ? simplifiedPathD : detailedPathD}
              fill={fillColor}
              fillOpacity={fillOpacity}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{ transition: dragging ? "none" : "d 180ms ease-in-out" }}
            />
          </svg>

          {/* Inner content container: Absolute positioned overlay that displays text content (File Name and Purpose) on top of the SVG shape */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: "8px",
              paddingTop: "13px",
              paddingRight: 20, // leave space under the fold
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {/* File Name label: Displays the "File Name" header text in small, non-bold font */}
            <div
              style={{
                fontSize: "5px",
                fontWeight: 400,
                letterSpacing: "0.02em",
                opacity: 0.85,
              }}
            >
              File Name
            </div>

            {/* File Name value: Displays the actual file name in bold, larger font with word wrapping support */}
            <div
              style={{
                fontWeight: 700,
                fontSize: "7px",
                lineHeight: "1.2",
                wordBreak: "break-word",
                overflowWrap: "break-word",
                whiteSpace: "pre-wrap",
                marginBottom: "2px",
              }}
            >
              {nodeName ?? "(no name)"}
            </div>

            {/* Purpose section wrapper: Collapsible container that shows/hides the Purpose section based on expand/collapse state with smooth animation */}
            <div
              style={{
                opacity: isExpanded ? 1 : 0,
                maxHeight: isExpanded ? "200px" : "0px",
                overflow: "hidden",
                transition: dragging
                  ? "none"
                  : "opacity 180ms ease, max-height 180ms ease",
              }}
            >
              {/* Purpose label: Displays the "Purpose" header text in small, non-bold font */}
              <div
                style={{
                  fontSize: "5px",
                  fontWeight: 400,
                  letterSpacing: "0.02em",
                  opacity: 0.85,
                  marginTop: "3px",
                }}
              >
                Purpose
              </div>
              {/* Purpose value: Displays the actual purpose text with word wrapping support and slight vertical offset */}
              <div
                style={{
                  fontSize: "7px",
                  lineHeight: "1.25",
                  wordBreak: "break-word",
                  overflowWrap: "break-word",
                  whiteSpace: "pre-wrap",
                  opacity: 0.95,
                  position: "relative",
                  top: "3px",
                }}
              >
                {nodePurpose ?? ""}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

