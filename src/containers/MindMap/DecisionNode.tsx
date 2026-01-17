/**
 * DecisionNode.tsx
 *
 * ReactFlow custom node component for displaying a decision node.
 * Visual style: SVG decision shape with editable Name + Purpose.
 */

import { Handle, Position, type NodeProps } from "reactflow";
import { selectActiveTab, useMindMapStore } from "../../store/mindMapStore";
import { getNodeFillColor } from "../../utils/nodeFillColors";

const DECISION_PATH_D =
  "M 80 120 H 360 C 360 126 360 176 360 180 H 80 C 80 173 80 126 80 120 Z " +
  "M 220 90 L 250 120 L 190 120 Z " +
  "M 220 210 L 250 180 L 190 180 Z " +
  "M 50 150 L 80 120 L 80 180 Z " +
  "M 390 150 L 360 120 L 360 180 Z";

export default function DecisionNode({ data, selected }: NodeProps<any>) {
  const settings = useMindMapStore((s) => s.settings);
  const activeTab = useMindMapStore(selectActiveTab);
  const areNodesCollapsed = activeTab?.areNodesCollapsed ?? false;
  const isExpanded = !areNodesCollapsed;

  const nodeName =
    typeof (data as any)?.name === "string" && (data as any).name.trim()
      ? (data as any).name.trim()
      : "Decision";
  const nodePurpose =
    typeof (data as any)?.purpose === "string" && (data as any).purpose.trim()
      ? (data as any).purpose.trim()
      : "";

  const stroke = selected ? "var(--primary-color)" : "var(--border)";
  const levelValue =
    typeof (data as any)?.level === "number" ? (data as any).level : 0;
  const fillColor = getNodeFillColor(
    settings,
    levelValue,
    "var(--surface-2)"
  );
  const fillOpacity = 0.98;

  const baseNodeSize = settings.appearance.nodeSize;
  const storedSize =
    typeof (data as any)?.node_size === "number" &&
    Number.isFinite((data as any).node_size)
      ? (data as any).node_size
      : baseNodeSize;
  const minSize = 10;
  const clampedSize = Math.max(minSize, storedSize);
  const sizeScale = clampedSize / baseNodeSize;

  // SVG sizing: default matches the provided SVG path dimensions.
  const svgWidth = Math.round(340 * sizeScale);
  const svgHeight = Math.round(120 * sizeScale);
  const viewBoxWidth = 440;
  const viewBoxHeight = 300;
  const folderViewBoxWidth = 512;
  const folderSvgWidth = 200 * sizeScale;
  const folderScale = folderSvgWidth / folderViewBoxWidth;
  const decisionScale = svgWidth / viewBoxWidth;
  const baseStrokeWidth = selected ? 6 : 4;
  const strokeWidth =
    decisionScale > 0
      ? baseStrokeWidth * (folderScale / decisionScale)
      : baseStrokeWidth;

  // Handle placement: align to the top/bottom arrow points.
  const handleWidth = 12;
  const handleHeight = 6;
  const handleStyleBase: React.CSSProperties = {
    width: handleWidth,
    height: handleHeight,
    background: "var(--border)",
    border: "none",
    opacity: 1,
    zIndex: 3,
  };
  const toHandlePxY = (y: number) =>
    Math.round((y / viewBoxHeight) * svgHeight);
  const topHandleTop =
    toHandlePxY(90) - Math.round(handleHeight / 2) + 2;
  const bottomHandleTop =
    toHandlePxY(210) - Math.round(handleHeight / 2) - 2;
  const handleLeft = `${(220 / viewBoxWidth) * 100}%`;

  const nameFontSize = Math.max(10, Math.round(12 * sizeScale));
  const purposeFontSize = Math.max(9, Math.round(10 * sizeScale));
  const contentGap = Math.max(2, Math.round(4 * sizeScale));
  const contentPadding = Math.max(6, Math.round(10 * sizeScale));

  return (
    <div
      role="presentation"
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
        style={{
          width: svgWidth,
          minWidth: svgWidth,
          maxWidth: svgWidth,
          height: svgHeight,
          position: "relative",
        }}
        aria-hidden="true"
      >
        <Handle
          type="target"
          position={Position.Top}
          id="target-top"
          style={{
            ...handleStyleBase,
            left: handleLeft,
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
            ...handleStyleBase,
            left: handleLeft,
            top: bottomHandleTop,
            transform: "translate(-50%, 0)",
            borderRadius: "0 0 9px 9px",
          }}
        />
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          preserveAspectRatio="xMidYMid meet"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-hidden="true"
          style={{ display: "block" }}
        >
          <path
            d={DECISION_PATH_D}
            fill={fillColor}
            fillOpacity={fillOpacity}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: `${contentPadding}px`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: contentGap,
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: `${nameFontSize}px`,
              lineHeight: 1.2,
              wordBreak: "break-word",
              overflowWrap: "break-word",
              whiteSpace: "pre-wrap",
            }}
          >
            {nodeName}
          </div>
          {isExpanded && (
            <div
              style={{
                fontSize: `${purposeFontSize}px`,
                lineHeight: 1.25,
                wordBreak: "break-word",
                overflowWrap: "break-word",
                whiteSpace: "pre-wrap",
                opacity: 0.9,
              }}
            >
              {nodePurpose}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
