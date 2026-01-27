/**
 * flowchartnode.tsx
 *
 * ReactFlow custom nodes for flowchart shapes.
 * Shapes are rendered via SVG path definitions.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { FiExternalLink, FiPause, FiPlay, FiVolume2, FiVolumeX } from "react-icons/fi";
import { Handle, Position, type NodeProps } from "reactflow";
import { selectActiveTab, useMindMapStore } from "../../store/mindMapStore";
import { loadYouTubeIframeAPI, parseYouTubeVideoId } from "../../utils/youtube";

export type FlowchartNodeType =
  | "flowchart.roundRect"
  | "flowchart.rect"
  | "flowchart.triangle"
  | "flowchart.decision"
  | "flowchart.circle"
  | "flowchart.parallelogram"
  | "flowchart.youtube";

export type FlowchartNodeRecord = {
  id: string;
  type: FlowchartNodeType;
  name: string;
  purpose: string;
  created_on: string;
  updated_on: string;
  youtube_url?: string;
  youtube_video_id?: string;
  yt_settings?: YoutubeSettings;
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
  {
    type: "flowchart.youtube",
    label: "YouTube Player",
    purpose: "Embed a video player with controls.",
    viewBox: { width: 260, height: 210 },
    path:
      "M 20 14 H 240 A 12 12 0 0 1 252 26 V 184 " +
      "A 12 12 0 0 1 240 196 H 20 A 12 12 0 0 1 8 184 V 26 " +
      "A 12 12 0 0 1 20 14 Z",
  },
];

const FLOWCHART_TYPE_SET = new Set(
  FLOWCHART_NODE_DEFINITIONS.map((item) => item.type)
);

export const isFlowchartNodeType = (value: unknown): value is FlowchartNodeType =>
  typeof value === "string" && FLOWCHART_TYPE_SET.has(value as FlowchartNodeType);

export const getFlowchartDefinition = (type: FlowchartNodeType) =>
  FLOWCHART_NODE_DEFINITIONS.find((item) => item.type === type) ?? null;

const isValidHexColor = (value: unknown) =>
  typeof value === "string" &&
  /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());

const buildHandleStyle = (
  width: number,
  height: number,
  borderRadius: string
): React.CSSProperties => ({
  width,
  height,
  background: "var(--border)",
  border: "none",
  borderRadius,
  opacity: 1,
  zIndex: 4,
});

type YoutubeSettings = {
  startSeconds: number;
  endSeconds: number;
  loop: boolean;
  mute: boolean;
  controls: boolean;
};

const DEFAULT_YT_SETTINGS: YoutubeSettings = {
  startSeconds: 0,
  endSeconds: 0,
  loop: false,
  mute: false,
  controls: true,
};

const normalizeYoutubeSettings = (value: unknown): YoutubeSettings => {
  if (!value || typeof value !== "object") return { ...DEFAULT_YT_SETTINGS };
  const settings = value as Partial<YoutubeSettings>;
  const startSeconds =
    typeof settings.startSeconds === "number" && Number.isFinite(settings.startSeconds)
      ? Math.max(0, settings.startSeconds)
      : DEFAULT_YT_SETTINGS.startSeconds;
  const endSeconds =
    typeof settings.endSeconds === "number" && Number.isFinite(settings.endSeconds)
      ? Math.max(0, settings.endSeconds)
      : DEFAULT_YT_SETTINGS.endSeconds;
  return {
    startSeconds,
    endSeconds,
    loop: !!settings.loop,
    mute: !!settings.mute,
    controls:
      typeof settings.controls === "boolean"
        ? settings.controls
        : DEFAULT_YT_SETTINGS.controls,
  };
};

const formatSeconds = (value: number) => {
  const clamped = Number.isFinite(value) ? Math.max(0, value) : 0;
  const minutes = Math.floor(clamped / 60);
  const seconds = Math.floor(clamped % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const FlowchartNodeBase = (
  props: NodeProps<any> & { definition: (typeof FLOWCHART_NODE_DEFINITIONS)[number] }
) => {
  const { data, selected, definition, id } = props;
  const settings = useMindMapStore((s) => s.settings);
  const activeTab = useMindMapStore(selectActiveTab);
  const isCognitiveNotes = activeTab?.moduleType === "cognitiveNotes";
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
  const customNodeColor = isValidHexColor((data as any)?.node_color)
    ? String((data as any).node_color).trim()
    : null;
  const fillColor =
    isCognitiveNotes && customNodeColor ? customNodeColor : "var(--surface-2)";

  const handleWidth = 12;
  const handleHeight = 6;
  const sideHandleWidth = handleHeight;
  const sideHandleHeight = handleWidth;
  const topHandleStyle = buildHandleStyle(handleWidth, handleHeight, "9px 9px 0 0");
  const bottomHandleStyle = buildHandleStyle(handleWidth, handleHeight, "0 0 9px 9px");
  const leftHandleStyle = buildHandleStyle(sideHandleWidth, sideHandleHeight, "9px 0 0 9px");
  const rightHandleStyle = buildHandleStyle(sideHandleWidth, sideHandleHeight, "0 9px 9px 0");
  const viewScale = Math.min(
    svgWidth / viewBoxWidth,
    svgHeight / viewBoxHeight
  );
  const viewOffsetX = (svgWidth - viewBoxWidth * viewScale) / 2;
  const viewOffsetY = (svgHeight - viewBoxHeight * viewScale) / 2;
  const toHandlePxX = (x: number) =>
    Math.round(viewOffsetX + x * viewScale);
  const toHandlePxY = (y: number) =>
    Math.round(viewOffsetY + y * viewScale);
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
  const clipId = useMemo(() => {
    const safe = String(id ?? "").replace(/[^a-zA-Z0-9_-]/g, "");
    return `flow-clip-${safe || "node"}`;
  }, [id]);

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
            ...topHandleStyle,
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
            ...bottomHandleStyle,
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
            ...leftHandleStyle,
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
            ...rightHandleStyle,
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
          <defs>
            <clipPath id={clipId}>
              <path d={definition.path} />
            </clipPath>
          </defs>
          <path
            d={definition.path}
            fill={fillColor}
            fillOpacity={0.98}
            stroke="none"
          />
          <path
            d={definition.path}
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
              inset: Math.max(2, Math.round(2 * sizeScale)),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "12px",
              gap: "4px",
              pointerEvents: "none",
              lineHeight: 1.2,
            }}
          >
          <div
            style={{
              fontWeight: 700,
              fontSize: `${Math.max(5, Math.round(7 * sizeScale))}px`,
              lineHeight: 1.2,
            }}
          >
            {displayName}
          </div>
          {isExpanded && purposeValue ? (
            <div
              style={{
                fontSize: `${Math.max(5, Math.round(7 * sizeScale))}px`,
                opacity: 0.85,
                lineHeight: 1.25,
              }}
            >
              {purposeValue}
            </div>
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

export const FlowchartYoutubeNode = (props: NodeProps<any>) => {
  const { data, selected, id } = props;
  const definition = getFlowchartDefinition("flowchart.youtube");
  const settings = useMindMapStore((s) => s.settings);
  const activeTab = useMindMapStore(selectActiveTab);
  const isCognitiveNotes = activeTab?.moduleType === "cognitiveNotes";
  const areNodesCollapsed = activeTab?.areNodesCollapsed ?? false;
  const isExpanded = !areNodesCollapsed;
  if (!definition) return null;

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
  const svgWidth = Math.round(definition.viewBox.width * sizeScale);
  const svgHeight = Math.round(definition.viewBox.height * sizeScale);
  const viewBoxWidth = definition.viewBox.width;
  const viewBoxHeight = definition.viewBox.height;
  const stroke = selected ? "var(--primary-color)" : "var(--border)";
  const strokeWidth = selected ? 6 : 4;
  const customNodeColor = isValidHexColor((data as any)?.node_color)
    ? String((data as any).node_color).trim()
    : null;
  const fillColor =
    isCognitiveNotes && customNodeColor ? customNodeColor : "var(--surface-2)";

  const handleWidth = 12;
  const handleHeight = 6;
  const sideHandleWidth = handleHeight;
  const sideHandleHeight = handleWidth;
  const topHandleStyle = buildHandleStyle(handleWidth, handleHeight, "9px 9px 0 0");
  const bottomHandleStyle = buildHandleStyle(handleWidth, handleHeight, "0 0 9px 9px");
  const leftHandleStyle = buildHandleStyle(sideHandleWidth, sideHandleHeight, "9px 0 0 9px");
  const rightHandleStyle = buildHandleStyle(sideHandleWidth, sideHandleHeight, "0 9px 9px 0");
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
  const clipId = useMemo(() => {
    const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, "_");
    return `yt-clip-${safeId || "node"}`;
  }, [id]);

  const nameValue =
    typeof (data as any)?.name === "string" ? (data as any).name.trim() : "";
  const purposeValue =
    typeof (data as any)?.purpose === "string"
      ? (data as any).purpose.trim()
      : "";
  const youtubeUrl =
    typeof (data as any)?.youtube_url === "string"
      ? (data as any).youtube_url.trim()
      : "";
  const storedVideoId =
    typeof (data as any)?.youtube_video_id === "string"
      ? (data as any).youtube_video_id.trim()
      : "";
  const videoId = storedVideoId || parseYouTubeVideoId(youtubeUrl) || "";
  const ytSettings = normalizeYoutubeSettings((data as any)?.yt_settings);

  const thumbnailUrl = videoId
    ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    : "";

  const containerId = useMemo(() => {
    const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, "_");
    return `yt_player_${safeId}`;
  }, [id]);

  const playerRef = useRef<any>(null);
  const [playerState, setPlayerState] = useState<
    "idle" | "ready" | "playing" | "paused" | "ended" | "error"
  >("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(ytSettings.mute);
  const [playerVisible, setPlayerVisible] = useState(false);

  const playerStateLabel =
    playerState === "playing"
      ? "Playing"
      : playerState === "paused"
      ? "Paused"
      : playerState === "ended"
      ? "Ended"
      : playerState === "error"
      ? "Error"
      : "Ready";

  useEffect(() => {
    setIsMuted(ytSettings.mute);
  }, [ytSettings.mute]);

  useEffect(() => {
    if (!playerRef.current || !videoId) return;
    try {
      if (typeof playerRef.current.cueVideoById === "function") {
        playerRef.current.cueVideoById({
          videoId,
          startSeconds: ytSettings.startSeconds || 0,
          endSeconds: ytSettings.endSeconds || undefined,
        });
        setPlayerState("ready");
        setPlayerVisible(false);
      }
    } catch {
      // Ignore cue errors; player may not be ready yet.
    }
  }, [videoId, ytSettings.startSeconds, ytSettings.endSeconds]);

  useEffect(() => {
    if (!playerRef.current) return;
    if (isMuted) {
      playerRef.current.mute?.();
    } else {
      playerRef.current.unMute?.();
    }
  }, [isMuted]);

  useEffect(() => {
    if (!playerRef.current) return;
    const tick = () => {
      try {
        const nextDuration = playerRef.current.getDuration?.() ?? 0;
        const nextTime = playerRef.current.getCurrentTime?.() ?? 0;
        setDuration(Number.isFinite(nextDuration) ? nextDuration : 0);
        setCurrentTime(Number.isFinite(nextTime) ? nextTime : 0);
      } catch {
        // Ignore polling errors.
      }
    };
    if (playerState === "playing" || playerState === "paused") {
      const handle = window.setInterval(tick, 500);
      tick();
      return () => window.clearInterval(handle);
    }
    return undefined;
  }, [playerState]);

  useEffect(() => {
    return () => {
      if (playerRef.current && typeof playerRef.current.destroy === "function") {
        playerRef.current.destroy();
      }
      playerRef.current = null;
    };
  }, []);

  const ensurePlayer = async () => {
    if (!videoId) {
      setPlayerState("error");
      return null;
    }
    if (playerRef.current) return playerRef.current;
    try {
      const YT = await loadYouTubeIframeAPI();
      const PlayerConstructor = YT?.Player;
      if (!PlayerConstructor) throw new Error("YT API unavailable");
      return await new Promise<any>((resolve) => {
        const player = new PlayerConstructor(containerId, {
          height: "100%",
          width: "100%",
          videoId,
          playerVars: {
            autoplay: 1,
            controls: ytSettings.controls ? 1 : 0,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            start: ytSettings.startSeconds || undefined,
            end: ytSettings.endSeconds || undefined,
            loop: ytSettings.loop ? 1 : 0,
            playlist: ytSettings.loop ? videoId : undefined,
          },
          events: {
            onReady: () => {
              playerRef.current = player;
              if (ytSettings.mute) player.mute?.();
              setPlayerState("ready");
              resolve(player);
            },
            onStateChange: (event: any) => {
              const state = event?.data;
              if (state === 1) {
                setPlayerState("playing");
                setPlayerVisible(true);
              } else if (state === 2) {
                setPlayerState("paused");
              } else if (state === 0) {
                setPlayerState("ended");
                setPlayerVisible(false);
              } else if (state === 5) {
                setPlayerState("ready");
              }
            },
            onError: () => {
              setPlayerState("error");
            },
          },
        });
        playerRef.current = player;
        setPlayerVisible(true);
      });
    } catch {
      setPlayerState("error");
      return null;
    }
  };

  const onTogglePlayback = async (event: React.MouseEvent) => {
    event.stopPropagation();
    const player = playerRef.current ?? (await ensurePlayer());
    if (!player) return;
    if (playerState === "playing") {
      player.pauseVideo?.();
      setPlayerState("paused");
      return;
    }
    player.playVideo?.();
    setPlayerState("playing");
    setPlayerVisible(true);
  };

  const onToggleMute = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsMuted((prev) => !prev);
  };

  const onSeekChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value);
    setCurrentTime(next);
    if (playerRef.current && Number.isFinite(next)) {
      playerRef.current.seekTo?.(next, true);
    }
  };

  const onOpenVideo = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!videoId) return;
    const url = youtubeUrl || `https://www.youtube.com/watch?v=${videoId}`;
    window.open(url, "_blank", "noopener,noreferrer");
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
            ...topHandleStyle,
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
            ...bottomHandleStyle,
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
            ...leftHandleStyle,
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
            ...rightHandleStyle,
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
          <defs>
            <clipPath id={clipId}>
              <path d={definition.path} />
            </clipPath>
          </defs>
          <path
            d={definition.path}
            fill={fillColor}
            fillOpacity={0.98}
            stroke="none"
          />
          <path
            d={definition.path}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
            clipPath={`url(#${clipId})`}
          />
        </svg>
        <div
          className="nodrag"
          onMouseDown={(event) => event.stopPropagation()}
          style={{
            position: "absolute",
            inset: Math.max(12, Math.round(14 * sizeScale)),
            display: "flex",
            flexDirection: "column",
            gap: Math.max(6, Math.round(6 * sizeScale)),
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: "#ff3d3d",
                }}
              />
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: Math.max(5, Math.round(7 * sizeScale)),
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "70%",
                  }}
                >
                  {nameValue || "YouTube Player"}
                </div>
            </div>
            <span
              style={{
                fontSize: Math.max(8, Math.round(9 * sizeScale)),
                padding: "2px 6px",
                borderRadius: 999,
                background: "rgba(0,0,0,0.2)",
                color: nodeTextColor,
                opacity: 0.85,
              }}
            >
              {playerStateLabel}
            </span>
          </div>

          {!isExpanded ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: 0.8,
                fontSize: Math.max(9, Math.round(9 * sizeScale)),
              }}
            >
              {purposeValue || "Collapsed view"}
            </div>
          ) : (
            <>
              <div
                style={{
                  position: "relative",
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                  height: Math.max(60, Math.round(72 * sizeScale)),
                  background: "var(--surface-1)",
                }}
              >
                {thumbnailUrl ? (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backgroundImage: `url(${thumbnailUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      filter: playerVisible ? "brightness(0.4)" : "none",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: Math.max(9, Math.round(9 * sizeScale)),
                      opacity: 0.7,
                    }}
                  >
                    Paste a YouTube link
                  </div>
                )}
                <div
                  id={containerId}
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: playerVisible ? "block" : "none",
                  }}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 6,
                  fontSize: Math.max(8, Math.round(9 * sizeScale)),
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={onTogglePlayback}
                      disabled={!videoId}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--surface-1)",
                        color: "inherit",
                        cursor: videoId ? "pointer" : "not-allowed",
                      }}
                    >
                      {playerState === "playing" ? <FiPause /> : <FiPlay />}
                    </button>
                    <button
                      type="button"
                      onClick={onToggleMute}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--surface-1)",
                        color: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      {isMuted ? <FiVolumeX /> : <FiVolume2 />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenVideo}
                    disabled={!videoId}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      borderRadius: 999,
                      border: "1px solid var(--border)",
                      background: "var(--surface-1)",
                      padding: "4px 10px",
                      color: "inherit",
                      fontSize: "0.75rem",
                      cursor: videoId ? "pointer" : "not-allowed",
                    }}
                  >
                    <FiExternalLink />
                    Open
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.1}
                    value={Math.min(currentTime, duration || 0)}
                    onChange={onSeekChange}
                    disabled={!duration}
                    style={{ width: "100%" }}
                  />
                  <span style={{ opacity: 0.75 }}>
                    {formatSeconds(currentTime)} / {formatSeconds(duration)}
                  </span>
                </div>
              </div>

              {purposeValue ? (
                <div
                  style={{
                    fontSize: Math.max(5, Math.round(7 * sizeScale)),
                    opacity: 0.75,
                    lineHeight: 1.25,
                  }}
                >
                  {purposeValue}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
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
