/**
 * RootFolderNode.tsx
 *
 * ReactFlow custom node component for displaying the root folder in the mind map.
 * Renders a circular folder icon with a layered "multi-folder" visual effect.
 *
 * This node represents the root directory selected by the user and serves as
 * the entry point for the folder structure visualization.
 */

import { useMemo } from "react";
import type { NodeProps } from "reactflow";
import { FileManager, type RootFolderJson } from "../../data/fileManager";
import { FiFolder } from "react-icons/fi";
import { useMindMapStore } from "../../store/mindMapStore";

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
  const fileManager = useMemo(() => new FileManager(), []);
  const nodeDisplayMode = useMindMapStore((s) => s.nodeDisplayMode);
  void id;
  void fileManager;

  // Extract text content from node data based on display mode.
  const nodeTitle =
    typeof data?.title === "string" && data.title.trim() ? data.title : null;
  const nodeName =
    typeof data?.name === "string" && data.name.trim()
      ? data.name.trim()
      : null;

  // Build tooltip with name, title, and description on separate lines.
  // Each field wraps to multiple lines with approximately 8 words per line.
  const tooltipText = (() => {
    // Wrap text to approximately 8 words per line, preserving all content.
    const wrapWords = (text: string, wordsPerLine: number): string => {
      const words = text.trim().split(/\s+/);
      const lines: string[] = [];
      for (let i = 0; i < words.length; i += wordsPerLine) {
        lines.push(words.slice(i, i + wordsPerLine).join(" "));
      }
      return lines.join("\n");
    };

    const parts: string[] = [];
    if (typeof data?.name === "string" && data.name.trim()) {
      parts.push(wrapWords(data.name, 8));
    }
    if (typeof data?.title === "string" && data.title.trim()) {
      parts.push(wrapWords(data.title, 8));
    }
    if (typeof data?.description === "string" && data.description.trim()) {
      parts.push(wrapWords(data.description, 8));
    }
    return parts.length > 0 ? parts.join("\n") : undefined;
  })();

  // Selection visual indicator: thicker border with accent color when selected.
  // Uses theme variables to ensure consistency across light/dark themes.
  const borderStyle = selected
    ? {
        // Thicker border (2px) with primary accent color for clear selection indication.
        borderWidth: "2px",
        borderStyle: "solid",
        borderColor: "var(--primary-color)",
        // Subtle box-shadow provides additional depth without being distracting.
        boxShadow: "0 0 0 2px rgba(100, 108, 255, 0.2)",
      }
    : {
        // Default border styling for unselected state.
        border: "var(--border-width) solid var(--border)",
      };

  return (
    <div
      style={{
        background: "transparent",
        border: "none",
        borderRadius: "9999px",
        color: "var(--text)",
        padding: "var(--space-2)",
        display: "grid",
        justifyItems: "center",
      }}
    >
      <div
        title={tooltipText}
        style={{
          width: "calc(var(--control-size-sm) * 2)",
          minHeight: "calc(var(--control-size-sm) * 2)",
          borderRadius: "9999px",
          // Apply conditional border styling based on selection state.
          ...borderStyle,
          background: "var(--surface-2)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          padding: "8px",
          boxSizing: "border-box",
          // Smooth transition for selection state changes (subtle, non-distracting).
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          // Allow node to grow vertically if text content is shown and needs wrapping.
          ...(nodeDisplayMode !== "icons" && (nodeTitle || nodeName)
            ? { minHeight: "auto", height: "auto" }
            : {}),
        }}
        aria-hidden="true"
      >
        {/* Conditionally render based on display mode: icons, titles, or names */}
        {nodeDisplayMode === "icons" ? (
          /* Multi-folder visual effect: layered folder icons for depth */
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FiFolder
              style={{
                position: "absolute",
                transform: "translate(-2px, -1px)",
                opacity: 0.55,
                fontSize:
                  "calc((var(--control-size-sm) * 2) - 12px - (var(--border-width) * 2))",
              }}
            />
            <FiFolder
              style={{
                fontSize:
                  "calc((var(--control-size-sm) * 2) - 25px - (var(--border-width) * 2))",
              }}
            />
          </div>
        ) : nodeDisplayMode === "titles" && nodeTitle ? (
          /* Title text displayed when titles mode is selected */
          <div
            style={{
              // Text wrapping: ensure title wraps within circular node boundaries.
              width: "100%",
              maxWidth: "100%",
              padding: "0 4px",
              textAlign: "center",
              wordBreak: "break-word",
              overflowWrap: "break-word",
              hyphens: "auto",
              // Typography: fixed 6px font size as specified.
              fontSize: "6px",
              lineHeight: "1.2",
              color: "var(--text)",
              opacity: 0.9,
              // Prevent text from overflowing the circular container.
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              // Ensure text doesn't break layout.
              flexShrink: 1,
              minHeight: 0,
            }}
          >
            {nodeTitle}
          </div>
        ) : nodeDisplayMode === "names" && nodeName ? (
          /* Name text displayed when names mode is selected */
          <div
            style={{
              // Text wrapping: ensure name wraps within circular node boundaries.
              width: "100%",
              maxWidth: "100%",
              padding: "0 4px",
              textAlign: "center",
              wordBreak: "break-word",
              overflowWrap: "break-word",
              hyphens: "auto",
              // Typography: fixed 6px font size as specified.
              fontSize: "6px",
              lineHeight: "1.2",
              color: "var(--text)",
              opacity: 0.9,
              // Prevent text from overflowing the circular container.
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              // Ensure text doesn't break layout.
              flexShrink: 1,
              minHeight: 0,
            }}
          >
            {nodeName}
          </div>
        ) : (
          /* Fallback to icons if no text content available */
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FiFolder
              style={{
                position: "absolute",
                transform: "translate(-2px, -1px)",
                opacity: 0.55,
                fontSize:
                  "calc((var(--control-size-sm) * 2) - 12px - (var(--border-width) * 2))",
              }}
            />
            <FiFolder
              style={{
                fontSize:
                  "calc((var(--control-size-sm) * 2) - 25px - (var(--border-width) * 2))",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
