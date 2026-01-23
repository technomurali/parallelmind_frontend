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
  "M 200 40 L 360 120 L 200 200 L 40 120 Z " +
  "M 108 92 H 282 A 12 12 0 0 1 294 103 V 136 A 12 12 0 0 1 281 144 " +
  "H 107 A 12 12 0 0 1 97 138 V 104 A 12 12 0 0 1 108 92 Z";

export default function DecisionNode({ data, selected }: NodeProps<any>) {
  const settings = useMindMapStore((s) => s.settings);
  const activeTab = useMindMapStore(selectActiveTab);
  const isCognitiveNotes = activeTab?.moduleType === "cognitiveNotes";
  const areNodesCollapsed = activeTab?.areNodesCollapsed ?? false;
  const isExpanded = !areNodesCollapsed;
  const nodeTextColor =
    settings.appearance.nodeFontColor === "black" ? "#000000" : "#ffffff";

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
  const fillColor = isCognitiveNotes
    ? "var(--surface-2)"
    : getNodeFillColor(settings, levelValue, "var(--surface-2)");
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
  const svgWidth = Math.round(360 * sizeScale);
  const svgHeight = Math.round(244 * sizeScale);
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

  const nameFontSize = Math.max(10, Math.round(12 * sizeScale));
  const purposeFontSize = Math.max(9, Math.round(10 * sizeScale));
  const contentGap = Math.max(2, Math.round(4 * sizeScale));
  const contentPadding = Math.max(6, Math.round(10 * sizeScale));
  const toContentPxX = (x: number) =>
    Math.round((x / viewBoxWidth) * svgWidth);
  const toContentPxY = (y: number) =>
    Math.round((y / viewBoxHeight) * svgHeight);
  const nameBandTop = toContentPxY(40);
  const nameBandHeight = Math.max(8, toContentPxY(92) - nameBandTop);
  const sideLabelTop = toContentPxY(120);
  const leftLabelX = toContentPxX(74);
  const rightLabelX = toContentPxX(326);
  const sideLabelFontSize = Math.max(8, Math.round(9 * sizeScale));
  const innerBoxLeft = toContentPxX(108);
  const innerBoxRight = toContentPxX(294);
  const innerBoxTop = toContentPxY(92);
  const innerBoxBottom = toContentPxY(144);
  const innerBoxWidth = Math.max(0, innerBoxRight - innerBoxLeft);
  const innerBoxHeight = Math.max(0, innerBoxBottom - innerBoxTop);
  const handleDiameter = 12;
  const toHandlePxX = (x: number) =>
    Math.round((x / viewBoxWidth) * svgWidth);
  const toHandlePxY = (y: number) =>
    Math.round((y / viewBoxHeight) * svgHeight);
  const topHandleLeft = toHandlePxX(200);
  const topHandleTop = toHandlePxY(40);
  const leftHandleLeft = toHandlePxX(40);
  const leftHandleTop = toHandlePxY(120);
  const rightHandleLeft = toHandlePxX(360);
  const rightHandleTop = toHandlePxY(120);
  const handleStyleBase: React.CSSProperties = {
    width: handleDiameter,
    height: handleDiameter,
    background: "var(--border)",
    border: "none",
    borderRadius: 999,
    opacity: 1,
    zIndex: 4,
  };

  return (
    <div
      role="presentation"
      style={{
        background: "transparent",
        border: "none",
        borderRadius: "var(--radius-md)",
        color: nodeTextColor,
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
            left: topHandleLeft,
            top: topHandleTop,
            transform: "translate(-50%, -50%)",
          }}
        />
        <Handle
          type="source"
          position={Position.Left}
          id="source-left"
          style={{
            ...handleStyleBase,
            left: leftHandleLeft,
            top: leftHandleTop,
            transform: "translate(-50%, -50%)",
          }}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="source-right"
          style={{
            ...handleStyleBase,
            left: rightHandleLeft,
            top: rightHandleTop,
            transform: "translate(-50%, -50%)",
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
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: leftLabelX,
              top: sideLabelTop,
              transform: "translate(-50%, -50%)",
              fontSize: `${sideLabelFontSize}px`,
              fontWeight: 600,
              opacity: 0.85,
            }}
          >
            False
          </div>
          <div
            style={{
              position: "absolute",
              left: rightLabelX,
              top: sideLabelTop,
              transform: "translate(-50%, -50%)",
              fontSize: `${sideLabelFontSize}px`,
              fontWeight: 600,
              opacity: 0.85,
            }}
          >
            True
          </div>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 30,
              top: nameBandTop,
              height: nameBandHeight,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
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
                position: "absolute",
                left: innerBoxLeft,
                top: innerBoxTop,
                width: innerBoxWidth,
                height: innerBoxHeight,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: contentGap,
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
