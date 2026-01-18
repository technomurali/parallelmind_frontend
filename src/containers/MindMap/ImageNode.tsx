/**
 * ImageNode.tsx
 *
 * ReactFlow custom node component for displaying an image-style node.
 * Visual style: Rounded outer frame with a solid inner rectangle.
 */

import { useMemo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { FileManager } from "../../data/fileManager";
import { selectActiveTab, useMindMapStore } from "../../store/mindMapStore";

const OUTER_PATH =
  "M 20 10 H 380 A 10 10 0 0 1 390 20 V 488 A 10 10 0 0 1 376 497 H 20 " +
  "A 10 10 0 0 1 9 486 V 20 A 10 10 0 0 1 20 10 Z";
const INNER_PATH = "M 42 51 H 364 V 418 H 40 Z";

export default function ImageNode({
  id,
  data,
  selected,
  dragging,
  xPos,
  yPos,
}: NodeProps<any>) {
  const settings = useMindMapStore((s) => s.settings);
  const activeTab = useMindMapStore(selectActiveTab);
  const updateNodeData = useMindMapStore((s) => s.updateNodeData);
  const updateRootFolderJson = useMindMapStore((s) => s.updateRootFolderJson);
  const rootFolderJson = activeTab?.rootFolderJson ?? null;
  const rootDirectoryHandle = activeTab?.rootDirectoryHandle ?? null;
  const fileManager = useMemo(() => new FileManager(), []);

  const stroke = selected ? "var(--primary-color)" : "var(--border)";
  const strokeWidth = selected ? 6 : 4;

  const baseNodeSize = settings.appearance.nodeSize;
  const storedSize =
    typeof (data as any)?.node_size === "number" &&
    Number.isFinite((data as any)?.node_size)
      ? (data as any).node_size
      : baseNodeSize;
  const minSize = 10;
  const stepSize = Math.max(1, Math.round(baseNodeSize * 0.1));
  const clampedSize = Math.max(minSize, storedSize);
  const sizeScale = clampedSize / baseNodeSize;

  const wrapperWidth = Math.round(125 * sizeScale);
  const svgHeight = Math.round(160 * sizeScale);
  const viewBoxWidth = 400;
  const viewBoxHeight = 507;
  const toSvgPx = (y: number) =>
    Math.round((y / viewBoxHeight) * svgHeight);
  const topHandleTop = toSvgPx(10) - Math.round(strokeWidth / 2) - 4;

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

  const snapOffsetX =
    dragging && typeof xPos === "number" ? Math.round(xPos) - xPos : 0;
  const snapOffsetY =
    dragging && typeof yPos === "number" ? Math.round(yPos) - yPos : 0;

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
      console.error("[ImageNode] Persist node size failed:", err);
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
        style={{
          width: wrapperWidth,
          minWidth: wrapperWidth,
          maxWidth: wrapperWidth,
          background: "transparent",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "flex-start",
          position: "relative",
          padding: 0,
          boxSizing: "border-box",
          gap: "6px",
          transition: dragging ? "none" : "border-color 0.15s ease",
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
            viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
            preserveAspectRatio="xMidYMid meet"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-hidden="true"
            shapeRendering={dragging ? "crispEdges" : "geometricPrecision"}
            style={{ display: "block" }}
          >
            <path
              d={OUTER_PATH}
              fill="#ffffff"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path d={INNER_PATH} fill="#000000" />
          </svg>

          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: Math.max(6, Math.round(16 * sizeScale)),
                right: Math.max(4, Math.round(10 * sizeScale)),
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
                  width: Math.max(8, Math.round(12 * sizeScale)),
                  height: Math.max(8, Math.round(12 * sizeScale)),
                  borderRadius: 0,
                  border: "none",
                  background: "transparent",
                  color: "var(--text)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  fontSize: `${Math.max(6, Math.round(8 * sizeScale))}px`,
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
                  width: Math.max(8, Math.round(12 * sizeScale)),
                  height: Math.max(8, Math.round(12 * sizeScale)),
                  borderRadius: 0,
                  border: "none",
                  background: "transparent",
                  color: "var(--text)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  fontSize: `${Math.max(6, Math.round(8 * sizeScale))}px`,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
                onMouseDown={(event) => event.stopPropagation()}
              >
                -
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
