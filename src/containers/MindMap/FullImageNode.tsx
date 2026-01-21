/**
 * FullImageNode.tsx
 *
 * ReactFlow custom node component for displaying a full-image frame.
 * Visual style: thin uniform frame (3px) with no caption area.
 */

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { Handle, NodeResizer, Position, type NodeProps } from "reactflow";
import { FileManager } from "../../data/fileManager";
import { selectActiveTab, useMindMapStore } from "../../store/mindMapStore";

const FILE_NODE_BASE_WIDTH = 125;
const DEFAULT_IMAGE_WIDTH_RATIO = 0.8;
const MAX_IMAGE_WIDTH = Math.round(FILE_NODE_BASE_WIDTH * DEFAULT_IMAGE_WIDTH_RATIO);
const FRAME_PADDING = 3;

const isDirectImageSource = (value: string) =>
  value.startsWith("data:") ||
  value.startsWith("blob:") ||
  value.startsWith("http://") ||
  value.startsWith("https://");

const getImageMimeType = (pathValue: string) => {
  const extension = (pathValue.split(".").pop() ?? "").toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "gif") return "image/gif";
  if (extension === "webp") return "image/webp";
  if (extension === "bmp") return "image/bmp";
  if (extension === "svg") return "image/svg+xml";
  return "application/octet-stream";
};

const getFullImageSize = (width: number, height: number) => {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const scale = Math.min(1, MAX_IMAGE_WIDTH / safeWidth);
  const imageWidth = Math.round(safeWidth * scale);
  const imageHeight = Math.round(safeHeight * scale);
  return {
    w: imageWidth + FRAME_PADDING * 2,
    h: imageHeight + FRAME_PADDING * 2,
    imageWidth,
    imageHeight,
  };
};

export default function FullImageNode({
  id,
  data,
  selected,
  dragging,
}: NodeProps<any>) {
  const updateNodeData = useMindMapStore((s) => s.updateNodeData);
  const rootDirectoryHandle =
    useMindMapStore(selectActiveTab)?.rootDirectoryHandle ?? null;
  const fileManager = useMemo(() => new FileManager(), []);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const rawImageSource =
    typeof (data as any)?.imageSrc === "string"
      ? (data as any).imageSrc
      : typeof (data as any)?.path === "string"
      ? (data as any).path
      : "";
  const storedWidth =
    typeof (data as any)?.nodeWidth === "number" ? (data as any).nodeWidth : 0;
  const storedHeight =
    typeof (data as any)?.nodeHeight === "number" ? (data as any).nodeHeight : 0;

  const defaultSize = useMemo(() => {
    if (storedWidth > 0 && storedHeight > 0) {
      return {
        w: storedWidth,
        h: storedHeight,
        imageWidth: Math.max(1, storedWidth - FRAME_PADDING * 2),
        imageHeight: Math.max(1, storedHeight - FRAME_PADDING * 2),
      };
    }
    const fallback = getFullImageSize(220, 260);
    return {
      w: fallback.w,
      h: fallback.h,
      imageWidth: fallback.imageWidth,
      imageHeight: fallback.imageHeight,
    };
  }, [storedWidth, storedHeight]);

  const [size, setSize] = useState(defaultSize);
  const [resolvedImageSrc, setResolvedImageSrc] = useState("");

  useEffect(() => {
    const source = (rawImageSource ?? "").trim();
    if (!source) {
      setResolvedImageSrc("");
      return;
    }
    if (isDirectImageSource(source)) {
      setResolvedImageSrc(source);
      return;
    }

    let isActive = true;
    let objectUrl: string | null = null;

    const resolveFromHandle = async () => {
      if (!rootDirectoryHandle) return false;
      try {
        const file = await fileManager.getFileFromHandle({
          rootHandle: rootDirectoryHandle,
          relPath: source,
        });
        objectUrl = URL.createObjectURL(file);
        if (isActive) setResolvedImageSrc(objectUrl);
        return true;
      } catch (err) {
        console.warn("[FullImageNode] Failed to load image from handle:", err);
        return false;
      }
    };

    const resolveFromPath = async () => {
      const isTauri = typeof (window as any).__TAURI_INTERNALS__ !== "undefined";
      if (!isTauri) return false;
      try {
        const { readFile } = await import("@tauri-apps/plugin-fs");
        const bytes = await readFile(source);
        const blob = new Blob([bytes], { type: getImageMimeType(source) });
        objectUrl = URL.createObjectURL(blob);
        if (isActive) setResolvedImageSrc(objectUrl);
        return true;
      } catch (err) {
        console.warn("[FullImageNode] Failed to load image from path:", err);
        return false;
      }
    };

    void (async () => {
      const resolved = await resolveFromHandle();
      if (!resolved) {
        await resolveFromPath();
      }
    })();

    return () => {
      isActive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [fileManager, rawImageSource, rootDirectoryHandle]);

  const imageSrc = resolvedImageSrc;

  useEffect(() => {
    if (!imageSrc) return;

    const applySize = (next: {
      w: number;
      h: number;
      imageWidth: number;
      imageHeight: number;
    }) => {
      setSize((prev) =>
        prev.w === next.w &&
        prev.h === next.h &&
        prev.imageWidth === next.imageWidth &&
        prev.imageHeight === next.imageHeight
          ? prev
          : {
              w: next.w,
              h: next.h,
              imageWidth: next.imageWidth,
              imageHeight: next.imageHeight,
            }
      );
      const needsUpdate =
        (data as any)?.nodeWidth !== next.w ||
        (data as any)?.nodeHeight !== next.h ||
        (data as any)?.imageWidth !== next.imageWidth ||
        (data as any)?.imageHeight !== next.imageHeight;
      if (needsUpdate) {
        updateNodeData(id, {
          nodeWidth: next.w,
          nodeHeight: next.h,
          imageWidth: next.imageWidth,
          imageHeight: next.imageHeight,
        });
      }
    };

    const imageWidth = (data as any)?.imageWidth;
    const imageHeight = (data as any)?.imageHeight;
    if (typeof imageWidth === "number" && typeof imageHeight === "number") {
      applySize(getFullImageSize(imageWidth, imageHeight));
      return;
    }

    const img = imgRef.current;
    if (!img) return;
    const onLoad = () => {
      applySize(getFullImageSize(img.naturalWidth, img.naturalHeight));
    };
    img.addEventListener("load", onLoad);
    return () => {
      img.removeEventListener("load", onLoad);
    };
  }, [data, id, imageSrc, updateNodeData]);

  const imageAreaHeight = Math.max(0, size.imageHeight);
  const handleWidth = 12;
  const handleHeight = 6;
  const handleOffset = Math.round(-handleHeight / 2);
  const handleBaseStyle: CSSProperties = {
    width: handleWidth,
    height: handleHeight,
    background: "var(--border)",
    border: "none",
    opacity: 1,
    zIndex: 3,
  };

  return (
    <div
      role="presentation"
      style={{
        width: size.w,
        height: size.h,
        background: "#ffffff",
        borderRadius: 8,
        padding: FRAME_PADDING,
        boxShadow: selected
          ? "0 10px 28px rgba(30, 111, 246, 0.35)"
          : "0 8px 20px rgba(0,0,0,0.25)",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        border: selected ? "2px solid var(--primary-color)" : "1px solid #e2e2e2",
        transition: dragging ? "none" : "box-shadow 0.2s ease, border 0.2s ease",
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={160}
        onResizeEnd={(_, params) => {
          if (!params) return;
          const nextWidth = Math.max(1, Math.round(params.width));
          const nextHeight = Math.max(1, Math.round(params.height));
          const nextImageWidth = Math.max(1, nextWidth - FRAME_PADDING * 2);
          const nextImageHeight = Math.max(1, nextHeight - FRAME_PADDING * 2);
          setSize({
            w: nextWidth,
            h: nextHeight,
            imageWidth: nextImageWidth,
            imageHeight: nextImageHeight,
          });
          updateNodeData(id, {
            nodeWidth: nextWidth,
            nodeHeight: nextHeight,
            imageWidth: nextImageWidth,
            imageHeight: nextImageHeight,
          });
        }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        style={{
          ...handleBaseStyle,
          top: handleOffset,
          left: "50%",
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
          bottom: handleOffset,
          left: "50%",
          transform: "translate(-50%, 0)",
          borderRadius: "0 0 9px 9px",
        }}
      />
      <div
        style={{
          width: size.imageWidth,
          height: imageAreaHeight,
          borderRadius: 4,
          background: imageSrc
            ? "#000000"
            : "linear-gradient(135deg, #f0f0f0, #e6e6e6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {imageSrc ? (
          <img
            ref={imgRef}
            src={imageSrc}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              color: "#666666",
              fontSize: 12,
              textAlign: "center",
              padding: 8,
            }}
          >
            Paste an image
          </div>
        )}
      </div>
    </div>
  );
}
