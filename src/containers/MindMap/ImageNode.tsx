/**
 * ImageNode.tsx
 *
 * ReactFlow custom node component for displaying a polaroid-style image.
 * Visual style: white frame, drop shadow, caption area.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { NodeProps } from "reactflow";
import { useMindMapStore } from "../../store/mindMapStore";

const MAX_IMAGE_WIDTH = 280;
const FRAME_PADDING = 12;
const CAPTION_GAP = 12;
const CAPTION_HEIGHT = 28;

const getPolaroidSize = (width: number, height: number) => {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const scale = Math.min(1, MAX_IMAGE_WIDTH / safeWidth);
  const imageWidth = Math.round(safeWidth * scale);
  const imageHeight = Math.round(safeHeight * scale);
  return {
    w: imageWidth + FRAME_PADDING * 2,
    h: imageHeight + FRAME_PADDING * 2 + CAPTION_GAP + CAPTION_HEIGHT,
    imageWidth,
    imageHeight,
  };
};

export default function ImageNode({
  id,
  data,
  selected,
  dragging,
}: NodeProps<any>) {
  const updateNodeData = useMindMapStore((s) => s.updateNodeData);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const imageSrc =
    typeof (data as any)?.imageSrc === "string" ? (data as any).imageSrc : "";
  const caption =
    typeof (data as any)?.caption === "string" ? (data as any).caption : "";
  const storedWidth =
    typeof (data as any)?.nodeWidth === "number" ? (data as any).nodeWidth : 0;
  const storedHeight =
    typeof (data as any)?.nodeHeight === "number" ? (data as any).nodeHeight : 0;

  const defaultSize = useMemo(() => {
    if (storedWidth > 0 && storedHeight > 0) {
      return { w: storedWidth, h: storedHeight };
    }
    return { w: 220, h: 260 };
  }, [storedWidth, storedHeight]);

  const [size, setSize] = useState(defaultSize);

  useEffect(() => {
    if (!imageSrc) return;

    const applySize = (next: {
      w: number;
      h: number;
      imageWidth: number;
      imageHeight: number;
    }) => {
      setSize((prev) =>
        prev.w === next.w && prev.h === next.h ? prev : { w: next.w, h: next.h }
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
      applySize(getPolaroidSize(imageWidth, imageHeight));
      return;
    }

    const img = imgRef.current;
    if (!img) return;
    const onLoad = () => {
      applySize(getPolaroidSize(img.naturalWidth, img.naturalHeight));
    };
    img.addEventListener("load", onLoad);
    return () => {
      img.removeEventListener("load", onLoad);
    };
  }, [data, id, imageSrc, updateNodeData]);

  const imageAreaHeight = Math.max(
    0,
    size.h - (FRAME_PADDING * 2 + CAPTION_GAP + CAPTION_HEIGHT)
  );

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
        gap: CAPTION_GAP,
        alignItems: "center",
        justifyContent: "flex-start",
        boxSizing: "border-box",
        border: selected ? "2px solid var(--primary-color)" : "1px solid #e2e2e2",
        transition: dragging ? "none" : "box-shadow 0.2s ease, border 0.2s ease",
      }}
    >
      {imageSrc ? (
        <img
          ref={imgRef}
          src={imageSrc}
          alt=""
          style={{
            width: "100%",
            height: "auto",
            maxHeight: imageAreaHeight,
            objectFit: "contain",
            display: "block",
            borderRadius: 4,
            background: "#000000",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: imageAreaHeight,
            borderRadius: 4,
            background: "linear-gradient(135deg, #f0f0f0, #e6e6e6)",
            color: "#666666",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: 8,
          }}
        >
          Paste an image
        </div>
      )}
      <div
        style={{
          minHeight: CAPTION_HEIGHT,
          width: "100%",
          textAlign: "center",
          fontSize: 12,
          color: "#444444",
          letterSpacing: "0.2px",
        }}
      >
        {caption || " "}
      </div>
    </div>
  );
}
