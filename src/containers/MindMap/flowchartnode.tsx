/**
 * flowchartnode.tsx
 *
 * ReactFlow custom nodes for flowchart shapes.
 * Shapes are rendered via SVG path definitions.
 */

import { Handle, Position, type NodeProps } from "reactflow";
import { selectActiveTab, useMindMapStore } from "../../store/mindMapStore";

export type FlowchartNodeType =
  | "flowchart.roundRect"
  | "flowchart.rect"
  | "flowchart.triangle"
  | "flowchart.decision"
  | "flowchart.circle"
  | "flowchart.parallelogram";

export type FlowchartNodeRecord = {
  id: string;
  type: FlowchartNodeType;
  name: string;
  purpose: string;
  created_on: string;
  updated_on: string;
};

export const FLOWCHART_NODE_DEFINITIONS: {
  type: FlowchartNodeType;
  label: string;
  purpose: string;
  viewBox: { width: number; height: number };
  path: string;
}[] = [
  {
    type: "flowchart.roundRect",
    label: "Rounded Rectangle",
    purpose: "Start or end of a flow.",
    viewBox: { width: 200, height: 120 },
    path:
      "M 30 10 H 170 A 20 20 0 0 1 190 30 V 90 " +
      "A 20 20 0 0 1 170 110 H 30 A 20 20 0 0 1 10 90 V 30 " +
      "A 20 20 0 0 1 30 10 Z",
  },
  {
    type: "flowchart.rect",
    label: "Rectangle",
    purpose: "Process or action step.",
    viewBox: { width: 200, height: 120 },
    path: "M 10 10 H 190 V 110 H 10 Z",
  },
  {
    type: "flowchart.triangle",
    label: "Triangle",
    purpose: "Directional or merge indicator.",
    viewBox: { width: 200, height: 120 },
    path: "M 100 10 L 190 110 H 10 Z",
  },
  {
    type: "flowchart.decision",
    label: "Decision",
    purpose: "Branching decision point.",
    viewBox: { width: 200, height: 120 },
    path: "M 100 10 L 190 60 L 100 110 L 10 60 Z",
  },
  {
    type: "flowchart.circle",
    label: "Circle",
    purpose: "Connector or pause point.",
    viewBox: { width: 200, height: 200 },
    path: "M 100 10 A 90 90 0 1 1 99.9 10 Z",
  },
  {
    type: "flowchart.parallelogram",
    label: "Parallelogram",
    purpose: "Input or output.",
    viewBox: { width: 200, height: 120 },
    path: "M 40 10 H 190 L 160 110 H 10 Z",
  },
];

const FLOWCHART_TYPE_SET = new Set(
  FLOWCHART_NODE_DEFINITIONS.map((item) => item.type)
);

export const isFlowchartNodeType = (value: unknown): value is FlowchartNodeType =>
  typeof value === "string" && FLOWCHART_TYPE_SET.has(value as FlowchartNodeType);

export const getFlowchartDefinition = (type: FlowchartNodeType) =>
  FLOWCHART_NODE_DEFINITIONS.find((item) => item.type === type) ?? null;

const buildHandleStyle = (diameter: number): React.CSSProperties => ({
  width: diameter,
  height: diameter,
  background: "var(--border)",
  border: "none",
  borderRadius: 999,
  opacity: 1,
  zIndex: 4,
});

const FlowchartNodeBase = (
  props: NodeProps<any> & { definition: (typeof FLOWCHART_NODE_DEFINITIONS)[number] }
) => {
  const { data, selected, definition } = props;
  const settings = useMindMapStore((s) => s.settings);
  const activeTab = useMindMapStore(selectActiveTab);
  const areNodesCollapsed = activeTab?.areNodesCollapsed ?? false;
  const isExpanded = !areNodesCollapsed;
  const nodeTextColor =
    settings.appearance.nodeFontColor === "black" ? "#000000" : "#ffffff";
  const baseNodeSize = settings.appearance.nodeSize;
  const storedSize =
    typeof (data as any)?.node_size === "number" &&
    Number.isFinite((data as any).node_size)
      ? (data as any).node_size
      : baseNodeSize;
  const clampedSize = Math.max(10, storedSize);
  const sizeScale = clampedSize / baseNodeSize;

  const svgWidth = Math.round(200 * sizeScale);
  const svgHeight = Math.round(140 * sizeScale);
  const viewBoxWidth = definition.viewBox.width;
  const viewBoxHeight = definition.viewBox.height;
  const stroke = selected ? "var(--primary-color)" : "var(--border)";
  const strokeWidth = selected ? 6 : 4;
  const fillColor = "var(--surface-2)";

  const handleDiameter = 12;
  const handleStyleBase = buildHandleStyle(handleDiameter);
  const toHandlePxX = (x: number) =>
    Math.round((x / viewBoxWidth) * svgWidth);
  const toHandlePxY = (y: number) =>
    Math.round((y / viewBoxHeight) * svgHeight);
  const topHandleLeft = toHandlePxX(viewBoxWidth / 2);
  const topHandleTop = toHandlePxY(10);
  const bottomHandleLeft = toHandlePxX(viewBoxWidth / 2);
  const bottomHandleTop = toHandlePxY(viewBoxHeight - 10);
  const leftHandleLeft = toHandlePxX(10);
  const leftHandleTop = toHandlePxY(viewBoxHeight / 2);
  const rightHandleLeft = toHandlePxX(viewBoxWidth - 10);
  const rightHandleTop = toHandlePxY(viewBoxHeight / 2);

  const nameValue =
    typeof (data as any)?.name === "string" ? (data as any).name.trim() : "";
  const purposeValue =
    typeof (data as any)?.purpose === "string"
      ? (data as any).purpose.trim()
      : "";
  const fallbackLabel = definition.label;
  const displayName = nameValue || fallbackLabel;

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
          position={Position.Bottom}
          id="source-bottom"
          style={{
            ...handleStyleBase,
            left: bottomHandleLeft,
            top: bottomHandleTop,
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
            d={definition.path}
            fill={fillColor}
            fillOpacity={0.98}
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
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "10px",
            gap: "4px",
            pointerEvents: "none",
            lineHeight: 1.2,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>{displayName}</div>
          {isExpanded && purposeValue ? (
            <div style={{ fontSize: "0.75rem", opacity: 0.85 }}>{purposeValue}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export const FlowchartRoundRectNode = (props: NodeProps<any>) => {
  const definition = getFlowchartDefinition("flowchart.roundRect");
  if (!definition) return null;
  return <FlowchartNodeBase {...props} definition={definition} />;
};

export const FlowchartRectNode = (props: NodeProps<any>) => {
  const definition = getFlowchartDefinition("flowchart.rect");
  if (!definition) return null;
  return <FlowchartNodeBase {...props} definition={definition} />;
};

export const FlowchartTriangleNode = (props: NodeProps<any>) => {
  const definition = getFlowchartDefinition("flowchart.triangle");
  if (!definition) return null;
  return <FlowchartNodeBase {...props} definition={definition} />;
};

export const FlowchartDecisionNode = (props: NodeProps<any>) => {
  const definition = getFlowchartDefinition("flowchart.decision");
  if (!definition) return null;
  return <FlowchartNodeBase {...props} definition={definition} />;
};

export const FlowchartCircleNode = (props: NodeProps<any>) => {
  const definition = getFlowchartDefinition("flowchart.circle");
  if (!definition) return null;
  return <FlowchartNodeBase {...props} definition={definition} />;
};

export const FlowchartParallelogramNode = (props: NodeProps<any>) => {
  const definition = getFlowchartDefinition("flowchart.parallelogram");
  if (!definition) return null;
  return <FlowchartNodeBase {...props} definition={definition} />;
};

export const FlowchartNodeIcons = ({
  type,
  size = 22,
}: {
  type: FlowchartNodeType;
  size?: number;
}) => {
  const definition = getFlowchartDefinition(type);
  if (!definition) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${definition.viewBox.width} ${definition.viewBox.height}`}
      role="img"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path
        d={definition.path}
        fill="none"
        stroke="currentColor"
        strokeWidth={8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
};
