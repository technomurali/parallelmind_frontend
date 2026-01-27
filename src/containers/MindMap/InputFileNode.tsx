/**
 * InputFileNode.tsx
 *
 * Custom node component that renders the (input) shield-styled file node.
 * This is the former ShieldFileNode, renamed for clarity in the UI/codebase.
 *
 * Note: Persisted node type remains `shieldFile` / `node_variant: "shieldFile"`.
 */
import { useMemo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { FileManager } from "../../data/fileManager";
import { selectActiveTab, useMindMapStore } from "../../store/mindMapStore";
import { getNodeFillColor } from "../../utils/nodeFillColors";

export default function InputFileNode({
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

  const pctX = (x: number) => `${(x / VB_W) * 100}%`;
  const pctY = (y: number) => `${(y / VB_H) * 100}%`;
  const topHandleTop = `calc(${pctY(TOP_BOX_TOP)} - ${Math.round(
    handleHeight / 2
  )}px)`;
  const bottomHandleTop = `calc(${pctY(TIP_Y)} - ${Math.round(
    handleHeight / 2
  )}px)`;
  const handleRightOffset = Math.round(6 * sizeScale);
  const sideHandleTop = `calc(${pctY(SIDE_HANDLE_Y)} - ${Math.round(
    sideHandleHeight / 2
  )}px)`;
  const leftHandleLeft = `calc(${pctX(SHIELD_LEFT)} - ${Math.round(
    sideHandleWidth / 2
  )}px)`;
  const rightHandleLeft = `calc(${pctX(SHIELD_RIGHT)} - ${Math.round(
    sideHandleWidth / 2
  )}px)`;
  const centerHandleLeft = `calc(${pctX(
    SHIELD_CENTER_X
  )} - ${Math.round(handleWidth / 2)}px + ${handleRightOffset}px)`;
  const clipId = useMemo(() => {
    const safe = String(id ?? "").replace(/[^a-zA-Z0-9_-]/g, "");
    return `input-shield-clip-${safe || "node"}`;
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
      console.error("[InputFileNode] Persist node size failed:", err);
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
                <path d="M 29 11 H 170 V 63 H 29 Z M 29 63 V 185 L 101 224 L 170 185 V 63" />
              </clipPath>
            </defs>
            <path
              d="M 29 11 H 170 V 63 H 29 Z M 29 63 V 185 L 101 224 L 170 185 V 63"
              fill={fillColor}
              fillOpacity={fillOpacity}
              stroke="none"
            />
            <path
              d="M 29 11 H 170 V 63 H 29 Z M 29 63 V 185 L 101 224 L 170 185 V 63"
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
              clipPath={`url(#${clipId})`}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              left: pctX(SHIELD_LEFT),
              right: `calc(100% - ${pctX(SHIELD_RIGHT)})`,
              top: pctY(TOP_BOX_TOP),
              height: `calc(${pctY(TOP_BOX_BOTTOM)} - ${pctY(TOP_BOX_TOP)})`,
              paddingLeft: Math.max(4, Math.round(6 * sizeScale)),
              paddingRight: Math.max(24, Math.round(28 * sizeScale)),
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: Math.max(1, Math.round(2 * sizeScale)),
              color: nodeTextColor,
              pointerEvents: "none",
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

          <div
            style={{
              position: "absolute",
              right: `calc(100% - ${pctX(SHIELD_RIGHT)})`,
              top: pctY(TOP_BOX_TOP),
              height: `calc(${pctY(TOP_BOX_BOTTOM)} - ${pctY(TOP_BOX_TOP)})`,
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

          <div
            style={{
              position: "absolute",
              left: pctX(SHIELD_LEFT),
              right: `calc(100% - ${pctX(SHIELD_RIGHT)})`,
              top: pctY(TOP_BOX_BOTTOM),
              maxHeight: isExpanded
                ? `calc(${pctY(BODY_BOTTOM)} - ${pctY(TOP_BOX_BOTTOM)})`
                : "0px",
              overflow: "hidden",
              transition:
                dragging ? "none" : "opacity 180ms ease, max-height 180ms ease",
              padding: `${Math.max(4, Math.round(6 * sizeScale))}px`,
              paddingTop: Math.max(4, Math.round(6 * sizeScale)),
              color: nodeTextColor,
              opacity: isExpanded ? 0.95 : 0,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                fontSize: `${Math.max(6, Math.round(7 * sizeScale))}px`,
                fontWeight: 400,
                letterSpacing: "0.02em",
                opacity: 0.85,
                lineHeight: 1.1,
                marginTop: `${Math.max(1, Math.round(3 * sizeScale))}px`,
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
                marginTop: `${Math.max(1, Math.round(3 * sizeScale))}px`,
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

