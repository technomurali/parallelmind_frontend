/**
 * FileNode.tsx
 *
 * ReactFlow custom node component for displaying a file node in the mind map.
 * Visual style: SVG document outline with a rounded tab.
 * Still shows Name + Purpose.
 */

import { Handle, Position, type NodeProps } from "reactflow";

export default function FileNode({
  data,
  selected,
  dragging,
  xPos,
  yPos,
}: NodeProps<any>) {

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

  const stroke = selected ? "var(--primary-color)" : "var(--border)";
  const strokeWidth = selected ? 6 : 4;
  const fillColor = "var(--surface-2)";
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
  const svgHeight = 150;
  const pathTopY = 60;
  const pathBottomY = 475;
  const toSvgPx = (y: number) =>
    Math.round(((y - viewBoxMinY) / viewBoxHeight) * svgHeight);
  const topHandleTop = toSvgPx(pathTopY) - Math.round(strokeWidth / 2) + 2;
  const bottomHandleTop =
    toSvgPx(pathBottomY) - handleHeight + Math.round(strokeWidth / 2) - 3;
  const detailedPathD =
    "M 80 60 H 150 C 165 60 175 40 200 40 C 225 40 235 60 250 60 H 320 V 120 H 80 Z M 80 120 V 420 H 320 V 120 Z";
  const simplifiedPathD =
    "M 80 60 H 150 L 175 40 H 225 L 250 60 H 320 V 420 H 80 Z";
  const snapOffsetX =
    dragging && typeof xPos === "number" ? Math.round(xPos) - xPos : 0;
  const snapOffsetY =
    dragging && typeof yPos === "number" ? Math.round(yPos) - yPos : 0;

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
        transform:
          snapOffsetX !== 0 || snapOffsetY !== 0
            ? `translate(${snapOffsetX}px, ${snapOffsetY}px)`
            : undefined,
      }}
    >
      <div
        title={tooltipText}
        style={{
          width: 130,
          minWidth: 130,
          maxWidth: 130,
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
          }}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="source-bottom"
          style={{
            ...handleBaseStyle,
            left: "50%",
            top: bottomHandleTop,
            transform: "translate(-50%, 0)",
            borderRadius: "0 0 9px 9px",
          }}
        />
        {/* Document/file SVG shape */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: 150,
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
          }}
        >
          <svg
            width="100%"
            height="100%"
            viewBox="80 20 240 420"
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
            />
          </svg>

          {/* Inner content */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: "8px",
              paddingTop: "16px",
              paddingRight: 20, // leave space under the fold
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
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

            <div
              style={{
                fontWeight: 700,
                fontSize: "7px",
                lineHeight: "1.2",
                wordBreak: "break-word",
                overflowWrap: "break-word",
                whiteSpace: "pre-wrap",
              }}
            >
              {nodeName ?? "(no name)"}
            </div>

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
  );
}

