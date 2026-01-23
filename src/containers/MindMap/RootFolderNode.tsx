/**
 * RootFolderNode.tsx
 *
 * ReactFlow custom node component for displaying the root folder in the mind map.
 * Renders a circular folder icon with a layered "multi-folder" visual effect.
 *
 * This node represents the root directory selected by the user and serves as
 * the entry point for the folder structure visualization.
 */

import { type ReactNode, useMemo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { FileManager, type RootFolderJson, type IndexNode } from "../../data/fileManager";
import { selectActiveTab, useMindMapStore } from "../../store/mindMapStore";
import { getNodeFillColor } from "../../utils/nodeFillColors";

type SvgFolderNodeProps = {
  width: number;
  height: number;
  selected: boolean;
  fillColor: string;
  textColor: string;
  contentFontSize: number;
  contentPadding: number;
  contentGap: number;
  isExpanded: boolean;
  children: ReactNode;
};

const SvgFolderNode = ({
  width,
  height,
  selected,
  fillColor,
  textColor,
  contentFontSize,
  contentPadding,
  contentGap,
  isExpanded,
  children,
}: SvgFolderNodeProps) => {
  // Content area height in SVG coordinates (viewBox units).
  const contentHeight = isExpanded ? 300 : 140;
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
        color: textColor,
      }}
    >
      {/* Node Shape */}
      <path
        d={isExpanded ? expandedPathD : collapsedPathD}
        fill={fillColor}
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
            paddingBottom: `${contentPadding + 12}px`,
            boxSizing: "border-box",
            position: "relative",
            fontFamily: "var(--font-family)",
            fontSize: `${contentFontSize}px`,
            color: textColor,
            overflow: "visible",
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
  const settings = useMindMapStore((s) => s.settings);
  const activeTab = useMindMapStore(selectActiveTab);
  const isCognitiveNotes = activeTab?.moduleType === "cognitiveNotes";
  const updateNodeData = useMindMapStore((s) => s.updateNodeData);
  const updateRootFolderJson = useMindMapStore((s) => s.updateRootFolderJson);
  const areNodesCollapsed = activeTab?.areNodesCollapsed ?? false;
  const rootFolderJson = activeTab?.rootFolderJson ?? null;
  const rootDirectoryHandle = activeTab?.rootDirectoryHandle ?? null;
  const isExpanded = !areNodesCollapsed;
  const fileManager = useMemo(() => new FileManager(), []);
  const nodeTextColor =
    settings.appearance.nodeFontColor === "black" ? "#000000" : "#ffffff";

  // Check if this specific folder tree is collapsed
  const isTreeCollapsed = (data as any)?.isTreeCollapsed === true;

  // Count children for this folder node
  const childrenCount = useMemo(() => {
    if (!rootFolderJson) return 0;
    const findNodeAndCount = (
      node: RootFolderJson | IndexNode,
      targetId: string
    ): number => {
      if ((node as any).id === targetId) {
        const children = Array.isArray((node as any).child)
          ? ((node as any).child as IndexNode[])
          : [];
        const countRecursive = (n: IndexNode): number => {
          const directChildren = Array.isArray((n as any).child)
            ? ((n as any).child as IndexNode[])
            : [];
          return (
            directChildren.length +
            directChildren.reduce((sum, child) => sum + countRecursive(child), 0)
          );
        };
        return children.reduce((sum, child) => sum + 1 + countRecursive(child), 0);
      }
      const children = Array.isArray((node as any).child)
        ? ((node as any).child as IndexNode[])
        : [];
      for (const child of children) {
        const count = findNodeAndCount(child, targetId);
        if (count >= 0) return count;
      }
      return -1;
    };
    return findNodeAndCount(rootFolderJson, id);
  }, [rootFolderJson, id]);

  const hasChildren = childrenCount > 0;
  // Only show icon when tree is explicitly collapsed (true) and has children
  const showCollapsedIcon = isTreeCollapsed === true && hasChildren;

  const levelValue =
    typeof (data as any)?.level === "number" ? (data as any).level : 0;
  const fillColor = isCognitiveNotes
    ? "var(--surface-2)"
    : getNodeFillColor(settings, levelValue, "var(--surface-2)");

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
  const displayPurpose =
    typeof nodePurpose === "string" && nodePurpose.length > 250
      ? `${nodePurpose.slice(0, 250)}...`
      : nodePurpose;


  // Visual size (CSS px) for the SVG node.
  const baseNodeSize = settings.appearance.nodeSize;
  const storedSize =
    typeof (data as any)?.node_size === "number" &&
    Number.isFinite((data as any).node_size)
      ? (data as any).node_size
      : baseNodeSize;
  const minSize = 10;
  const stepSize = Math.max(1, Math.round(baseNodeSize * 0.1));
  const clampedSize = Math.max(minSize, storedSize);
  const sizeScale = clampedSize / baseNodeSize;

  const svgWidth = Math.round(200 * sizeScale);
  const svgHeight = Math.round(150 * sizeScale);

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
  const collapsedBottomY = 172;
  const handleWidth = 12;
  const handleHeight = 6;
  const handleStrokeWidth = selected ? 6 : 4;
  const toHandlePx = (y: number) =>
    Math.round((y / viewBoxHeight) * svgHeight);
  const topHandleTop =
    toHandlePx(outlineTopY) - Math.round(handleStrokeWidth / 2) - 3;
  const bottomHandleTop =
    toHandlePx(isExpanded ? outlineBottomY : collapsedBottomY) -
    handleHeight +
    Math.round(handleStrokeWidth / 2) +
    3;

  // Convert intended screen px into SVG user units so text renders at the desired size
  // after the SVG is scaled down by its viewBox.
  const svgScale = svgWidth / viewBoxWidth;
  const toSvgPx = (px: number) => px / svgScale;
  const headerFontSize =
    settings.appearance.nodeHeaderFontSize ??
    settings.appearance.nodeBodyFontSize ??
    14;
  const bodyFontSize = settings.appearance.nodeBodyFontSize ?? 18;

  const handleStyleBase: React.CSSProperties = {
    width: handleWidth,
    height: handleHeight,
    background: "var(--border)",
    border: "none",
    opacity: 1,
    zIndex: 5,
  };

  const persistNodeSize = async (nextSize: number) => {
    if (!rootFolderJson) return;
    const nextMap = {
      ...(rootFolderJson.node_size ?? {}),
    } as Record<string, number>;
    if (nextSize === baseNodeSize) {
      delete nextMap[id];
    } else {
      nextMap[id] = nextSize;
    }
    const nextRoot = {
      ...rootFolderJson,
      node_size: nextMap,
    };
    updateRootFolderJson(nextRoot);
    try {
      if (rootDirectoryHandle) {
        await fileManager.writeRootFolderJson(rootDirectoryHandle, nextRoot);
      } else if (rootFolderJson.path) {
        await fileManager.writeRootFolderJsonFromPath(
          rootFolderJson.path,
          nextRoot
        );
      }
    } catch (err) {
      console.error("[RootFolderNode] Persist node size failed:", err);
    }
  };

  const applyNodeSizeDelta = (delta: number) => {
    const nextSize = Math.max(minSize, clampedSize + delta);
    updateNodeData(id, { node_size: nextSize });
    void persistNodeSize(nextSize);
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
          left: bottomHandleLeft,
          top: bottomHandleTop,
          transform: "translate(-50%, 0)",
          borderRadius: "0 0 9px 9px",
        }}
      />

      {/* Main SVG node: folder outline + foreignObject content */}
      <SvgFolderNode
        width={svgWidth}
        height={svgHeight}
        selected={selected}
        fillColor={fillColor}
        textColor={nodeTextColor}
        contentFontSize={toSvgPx(bodyFontSize)}
        contentPadding={toSvgPx(0.5)}
        contentGap={toSvgPx(4)}
        isExpanded={isExpanded}
      >
        <div
          style={{
            position: "absolute",
            top: Math.max(4, Math.round(6 * sizeScale)),
            right: Math.max(0, Math.round(6 * sizeScale) - 8),
            display: "flex",
            gap: Math.max(2, Math.round(4 * sizeScale)),
            zIndex: 6,
            pointerEvents: "auto",
          }}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              applyNodeSizeDelta(stepSize);
            }}
            style={{
              width: Math.max(18, Math.round(22 * sizeScale)),
              height: Math.max(18, Math.round(22 * sizeScale)),
              borderRadius: 0,
              border: "none",
              background: "transparent",
            color: nodeTextColor,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              fontSize: `${Math.max(13, Math.round(16 * sizeScale))}px`,
              fontWeight: 700,
              lineHeight: 1,
            }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            +
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              applyNodeSizeDelta(-stepSize);
            }}
            style={{
              width: Math.max(18, Math.round(22 * sizeScale)),
              height: Math.max(18, Math.round(22 * sizeScale)),
              borderRadius: 0,
              border: "none",
              background: "transparent",
            color: nodeTextColor,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              fontSize: `${Math.max(13, Math.round(16 * sizeScale))}px`,
              fontWeight: 700,
              lineHeight: 1,
            }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            -
          </button>
        </div>
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
            Folder Name
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
              {displayPurpose ?? ""}
            </div>
          </div>
        )}
        {/* Collapsed tree icon overlay */}
        {showCollapsedIcon && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: `${toSvgPx(4)}px`,
              pointerEvents: "none",
              zIndex: 1,
            }}
            aria-hidden="true"
          >
            <svg
              width={toSvgPx(35)}
              height={toSvgPx(20)}
              viewBox="0 0 24 16"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                opacity: 0.25,
              }}
            >
              {/* Top chevron */}
              <path
                d="M 2 4 L 12 12 L 22 4"
                stroke="#000000"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              {/* Bottom chevron */}
              <path
                d="M 2 8 L 12 16 L 22 8"
                stroke="#000000"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </div>
        )}
      </SvgFolderNode>
    </div>
  );
}
