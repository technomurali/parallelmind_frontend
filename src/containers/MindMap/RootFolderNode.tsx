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
import { uiText } from "../../constants/uiText";

/**
 * RootFolderNode component
 *
 * Custom ReactFlow node that displays the root folder with a distinctive
 * layered folder icon design. The node shows a tooltip with the folder name
 * when hovered.
 *
 * @param props - ReactFlow NodeProps containing node id and RootFolderJson data
 */
export default function RootFolderNode({
  id,
  data,
}: NodeProps<RootFolderJson>) {
  const fileManager = useMemo(() => new FileManager(), []);
  void id;
  void fileManager;

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
        title={
          data.name
            ? `${uiText.tooltips.rootFolderNamePrefix} ${data.name}`
            : undefined
        }
        style={{
          width: "calc(var(--control-size-sm) * 2)",
          height: "calc(var(--control-size-sm) * 2)",
          borderRadius: "9999px",
          border: "var(--border-width) solid var(--border)",
          background: "var(--surface-2)",
          display: "grid",
          placeItems: "center",
          position: "relative",
          padding: "8px",
          boxSizing: "border-box",
        }}
        aria-hidden="true"
      >
        {/* Multi-folder visual effect: layered folder icons for depth */}
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
    </div>
  );
}
