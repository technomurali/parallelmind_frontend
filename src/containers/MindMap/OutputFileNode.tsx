/**
 * OutputFileNode.tsx
 *
 * Custom node component that renders a rotated (180deg) shield-styled file node.
 * Displays Name (top box) and Purpose (below).
 */
import { useMemo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { FileManager } from "../../data/fileManager";
import { selectActiveTab, useMindMapStore } from "../../store/mindMapStore";
import { getNodeFillColor } from "../../utils/nodeFillColors";

export default function OutputFileNode({
  id,
  data,
  selected,
  dragging,
  xPos,
  yPos,
}: NodeProps<any>) {
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

  const nodeName =
    typeof (data as any)?.name === "string" && (data as any).name.trim()
      ? (data as any).name.trim()
      : null;
  const nodePurpose =
    typeof (data as any)?.purpose === "string" && (data as any).purpose.trim()
      ? (data as any).purpose.trim()
      : null;
  const displayPurpose =
    typeof nodePurpose === "string" && nodePurpose.length > 250
      ? `${nodePurpose.slice(0, 250)}...`
      : nodePurpose;

  const stroke = selected ? "var(--primary-color)" : "var(--border)";
  const strokeWidth = selected ? 6 : 4;
  const levelValue =
    typeof (data as any)?.level === "number" ? (data as any).level : 0;
  const customNodeColor =
    typeof (data as any)?.node_color === "string" &&
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test((data as any).node_color.trim())
      ? (data as any).node_color.trim()
      : null;
  const fillColor = isCognitiveNotes
    ? customNodeColor ?? "var(--surface-2)"
    : getNodeFillColor(settings, levelValue, "var(--surface-2)", {
        variant: "file",
      });
  const fillOpacity = 0.98;
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

  const handleWidth = 12;
  const handleHeight = 6;
  const sideHandleWidth = handleHeight;
  const sideHandleHeight = handleWidth;
  const handleBaseStyle: React.CSSProperties = {
    width: handleWidth,
    height: handleHeight,
    background: "var(--border)",
    border: "none",
    opacity: 1,
    zIndex: 3,
  };
  const svgHeight = Math.round(150 * sizeScale);

  // Shield path geometry in viewBox coordinates (0..200)
  const VB_W = 200;
  const VB_H = 224;
  const SHIELD_LEFT = 29;
  const SHIELD_RIGHT = 170;
  const SHIELD_CENTER_X = 100;
  const TOP_BOX_TOP = 11;
  const TOP_BOX_BOTTOM = 63;
  const BODY_BOTTOM = 185;
  const TIP_Y = 224;
  const SIDE_HANDLE_Y = (TOP_BOX_BOTTOM + BODY_BOTTOM) / 2;
  // OutputFileNode: use a pre-rotated path (avoid SVG transform + clipPath glitches).
  // Rotation is 180deg around (100, 112) => x' = 200 - x, y' = 224 - y.
  const OUTPUT_SHIELD_PATH =
    "M 171 213 H 30 V 161 H 171 Z " +
    "M 171 161 V 39 L 99 0 L 30 39 V 161";

  // Map original geometry into "inverted" coordinates for overlays/handles.
  const INV_TIP_Y = VB_H - TIP_Y; // 0
  const INV_TOP_BOX_TOP = VB_H - TOP_BOX_BOTTOM; // 161
  const INV_TOP_BOX_BOTTOM = VB_H - TOP_BOX_TOP; // 213
  const INV_BODY_TOP = VB_H - BODY_BOTTOM; // 39
  const INV_BODY_BOTTOM = VB_H - TOP_BOX_BOTTOM; // 161
  const INV_SIDE_HANDLE_Y = VB_H - SIDE_HANDLE_Y; // 100

  // Small tweak point for future micro-adjustments (kept proportional).
  const purposeShiftPx = Math.round(0 * sizeScale);

  const pctX = (x: number) => `${(x / VB_W) * 100}%`;
  const pctY = (y: number) => `${(y / VB_H) * 100}%`;

  const yToPx = (y: number) => Math.round((y / VB_H) * svgHeight);
  // Important: avoid negative handle coordinates (ReactFlow can attach edges away from the visible handle).
  const topHandleTop = `${Math.max(
    0,
    yToPx(INV_TIP_Y) - Math.round(handleHeight / 2)
  )}px`;
  const bottomHandleTop = `${Math.max(
    0,
    yToPx(INV_TOP_BOX_BOTTOM) - Math.round(handleHeight / 2)
  )}px`;
  const handleRightOffset = Math.round(6 * sizeScale);
  const sideHandleTop = `${Math.max(
    0,
    yToPx(INV_SIDE_HANDLE_Y) - Math.round(sideHandleHeight / 2)
  )}px`;
  const leftHandleLeft = `calc(${pctX(SHIELD_LEFT)} - ${Math.round(sideHandleWidth / 2)}px)`;
  const rightHandleLeft = `calc(${pctX(SHIELD_RIGHT)} - ${Math.round(sideHandleWidth / 2)}px)`;
  const centerHandleLeft = `calc(${pctX(SHIELD_CENTER_X)} - ${Math.round(handleWidth / 2)}px + ${handleRightOffset}px)`;
  const clipId = useMemo(() => {
    const safe = String(id ?? "").replace(/[^a-zA-Z0-9_-]/g, "");
    return `output-shield-clip-${safe || "node"}`;
  }, [id]);

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
        await fileManager.writeRootFolderJsonFromPath(rootFolderJson.path, nextRoot);
      }
    } catch (err) {
      console.error("[OutputFileNode] Persist node size failed:", err);
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
        transform:
          snapOffsetX !== 0 || snapOffsetY !== 0
            ? `translate(${snapOffsetX}px, ${snapOffsetY}px)`
            : undefined,
      }}
    >
      <div
        style={{
          width: Math.round(250 * sizeScale),
          minWidth: Math.round(250 * sizeScale),
          maxWidth: Math.round(250 * sizeScale),
          background: "transparent",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "flex-start",
          position: "relative",
          padding: 0,
          boxSizing: "border-box",
          gap: "6px",
          transition: dragging
            ? "none"
            : "border-color 0.15s ease, box-shadow 0.15s ease",
        }}
        aria-hidden="true"
      >
        <Handle
          type="target"
          position={Position.Top}
          id="target-top"
          style={{
            ...handleBaseStyle,
            left: centerHandleLeft,
            top: topHandleTop,
            borderRadius: "9px 9px 0 0",
            transition: dragging ? "none" : "top 180ms ease-in-out",
          }}
        />
        <Handle
          type="target"
          position={Position.Left}
          id="target-left"
          style={{
            ...handleBaseStyle,
            width: sideHandleWidth,
            height: sideHandleHeight,
            left: leftHandleLeft,
            top: sideHandleTop,
            borderRadius: "9px 0 0 9px",
            transition: dragging ? "none" : "top 180ms ease-in-out",
          }}
        />
        <Handle
          type="source"
          position={Position.Left}
          id="source-left"
          style={{
            ...handleBaseStyle,
            width: sideHandleWidth,
            height: sideHandleHeight,
            left: leftHandleLeft,
            top: sideHandleTop,
            borderRadius: "9px 0 0 9px",
            transition: dragging ? "none" : "top 180ms ease-in-out",
          }}
        />
        <Handle
          type="target"
          position={Position.Right}
          id="target-right"
          style={{
            ...handleBaseStyle,
            width: sideHandleWidth,
            height: sideHandleHeight,
            left: rightHandleLeft,
            top: sideHandleTop,
            borderRadius: "0 9px 9px 0",
            transition: dragging ? "none" : "top 180ms ease-in-out",
          }}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="source-right"
          style={{
            ...handleBaseStyle,
            width: sideHandleWidth,
            height: sideHandleHeight,
            left: rightHandleLeft,
            top: sideHandleTop,
            borderRadius: "0 9px 9px 0",
            transition: dragging ? "none" : "top 180ms ease-in-out",
          }}
        />
        <Handle
          type="target"
          position={Position.Bottom}
          id="target-bottom"
          style={{
            ...handleBaseStyle,
            left: centerHandleLeft,
            top: bottomHandleTop,
            borderRadius: "0 0 9px 9px",
            transition: dragging ? "none" : "top 180ms ease-in-out",
          }}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="source-bottom"
          style={{
            ...handleBaseStyle,
            left: centerHandleLeft,
            top: bottomHandleTop,
            borderRadius: "0 0 9px 9px",
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
            viewBox="0 0 200 224"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-hidden="true"
            shapeRendering={dragging ? "crispEdges" : "geometricPrecision"}
            style={{ display: "block" }}
          >
            <defs>
              <clipPath id={clipId}>
                <path d={OUTPUT_SHIELD_PATH} />
              </clipPath>
            </defs>
            <path
              d={OUTPUT_SHIELD_PATH}
              fill={fillColor}
              fillOpacity={fillOpacity}
              stroke="none"
            />
            <path
              d={OUTPUT_SHIELD_PATH}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
              clipPath={`url(#${clipId})`}
            />
          </svg>
          {/* File Name: inside the inverted bottom box */}
          <div
            style={{
              position: "absolute",
              left: pctX(SHIELD_LEFT),
              right: `calc(100% - ${pctX(SHIELD_RIGHT)})`,
              top: pctY(INV_TOP_BOX_TOP),
              height: `calc(${pctY(INV_TOP_BOX_BOTTOM)} - ${pctY(INV_TOP_BOX_TOP)})`,
              // Keep "File Name" fully left; reserve space on the RIGHT for +/- controls.
              paddingLeft: Math.max(4, Math.round(6 * sizeScale)),
              paddingRight: Math.max(30, Math.round(38 * sizeScale)),
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "center",
              gap: Math.max(1, Math.round(2 * sizeScale)),
              color: nodeTextColor,
              pointerEvents: "none",
              textAlign: "left",
            }}
          >
            <div
              style={{
                fontSize: `${Math.max(6, Math.round(7 * sizeScale))}px`,
                fontWeight: 400,
                letterSpacing: "0.02em",
                opacity: 0.85,
                lineHeight: 1.1,
              }}
            >
              File Name
            </div>
            <div
              style={{
                fontWeight: 700,
                fontSize: `${Math.max(7, Math.round(9 * sizeScale))}px`,
                lineHeight: "1.2",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {nodeName ?? "(no name)"}
            </div>
          </div>

          {/* +/- controls: ALSO inside top box */}
          <div
            style={{
              position: "absolute",
              right: `calc(100% - ${pctX(SHIELD_RIGHT)})`,
              top: pctY(INV_TOP_BOX_TOP),
              height: `calc(${pctY(INV_TOP_BOX_BOTTOM)} - ${pctY(INV_TOP_BOX_TOP)})`,
              display: "flex",
              alignItems: "center",
              gap: Math.max(2, Math.round(4 * sizeScale)),
              paddingRight: Math.max(3, Math.round(5 * sizeScale)),
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
                width: Math.max(10, Math.round(14 * sizeScale)),
                height: Math.max(10, Math.round(14 * sizeScale)),
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "transparent",
                color: nodeTextColor,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                fontSize: `${Math.max(8, Math.round(10 * sizeScale))}px`,
                fontWeight: 800,
                lineHeight: 1,
              }}
              onMouseDown={(event) => event.stopPropagation()}
              aria-label="Increase node size"
              title="Increase node size"
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
                width: Math.max(10, Math.round(14 * sizeScale)),
                height: Math.max(10, Math.round(14 * sizeScale)),
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "transparent",
                color: nodeTextColor,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                fontSize: `${Math.max(8, Math.round(10 * sizeScale))}px`,
                fontWeight: 800,
                lineHeight: 1,
              }}
              onMouseDown={(event) => event.stopPropagation()}
              aria-label="Decrease node size"
              title="Decrease node size"
            >
              -
            </button>
          </div>

          {/* Purpose: inside the inverted body region (between tip and bottom box) */}
          <div
            style={{
              position: "absolute",
              left: pctX(SHIELD_LEFT),
              right: `calc(100% - ${pctX(SHIELD_RIGHT)})`,
              top: `calc(${pctY(INV_BODY_TOP)} + ${purposeShiftPx}px)`,
              maxHeight: isExpanded
                ? `calc(${pctY(INV_BODY_BOTTOM)} - ${pctY(INV_BODY_TOP)})`
                : "0px",
              overflow: "hidden",
              transition: dragging ? "none" : "opacity 180ms ease, max-height 180ms ease",
              padding: `${Math.max(4, Math.round(6 * sizeScale))}px`,
              paddingTop: Math.max(4, Math.round(6 * sizeScale)),
              color: nodeTextColor,
              opacity: isExpanded ? 0.95 : 0,
              pointerEvents: "none",
              display: "flex",
              flexDirection: "column",
              gap: `${Math.max(1, Math.round(3 * sizeScale))}px`,
            }}
          >
            <div
              style={{
                fontSize: `${Math.max(6, Math.round(7 * sizeScale))}px`,
                fontWeight: 400,
                letterSpacing: "0.02em",
                opacity: 0.85,
                lineHeight: 1.1,
              }}
            >
              Purpose
            </div>
            <div
              style={{
                fontSize: `${Math.max(7, Math.round(9 * sizeScale))}px`,
                lineHeight: "1.25",
                wordBreak: "break-word",
                overflowWrap: "break-word",
                whiteSpace: "pre-wrap",
              }}
            >
              {displayPurpose ?? ""}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

