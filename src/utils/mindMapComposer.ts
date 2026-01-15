/**
 * mindMapComposer.ts
 *
 * Transforms the root folder JSON structure into ReactFlow nodes and edges.
 * This is intentionally isolated so the composition logic can evolve without
 * leaking into UI components.
 */

import type { Edge, Node } from "reactflow";
import type {
  IndexNode,
  RootFolderJson,
  IndexFolderNode,
} from "../data/fileManager";

export type MindMapComposeOptions = {
  rootNodeId?: string;
  rootPosition?: { x: number; y: number };
  nodeSize?: number;
  levelSpacing?: number;
  siblingSpacing?: number;
};

export type MindMapComposeResult = {
  nodes: Node[];
  edges: Edge[];
  warnings: string[];
};

type NormalizedKind = "folder" | "file" | "unknown";

type NodeInfo = {
  id: string;
  depth: number;
  kind: NormalizedKind;
  data: Record<string, unknown>;
  children: string[];
  parentId: string | null;
  name: string;
};

const DEFAULT_NODE_SIZE = 200;
const DEFAULT_VERTICAL_GAP = 30;
const DEFAULT_HORIZONTAL_GAP_RATIO = 1.4;

const normalizeTypeKind = (typeValue: unknown): NormalizedKind => {
  if (typeof typeValue !== "string") return "unknown";
  const lower = typeValue.toLowerCase();
  if (lower.includes("folder")) return "folder";
  if (lower.includes("file")) return "file";
  return "unknown";
};

const sanitizeForId = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
};

const createSyntheticNodeId = (
  parentId: string,
  index: number,
  name: string | null
): string => {
  const suffix = sanitizeForId(name ?? "");
  return `${parentId}_child_${index}_${suffix || "node"}`;
};

/**
 * Compose a ReactFlow graph from the root folder JSON.
 *
 * Layout strategy:
 * - X is based on depth (levelSpacing).
 * - Y is derived from a tidy tree layout:
 *   leaf nodes take the next available row; parents center above children.
 */
export const composeMindMapGraphFromRoot = (
  root: RootFolderJson,
  options: MindMapComposeOptions = {}
): MindMapComposeResult => {
  const warnings: string[] = [];
  const nodesById = new Map<string, NodeInfo>();
  const edges: Edge[] = [];
  const edgeIds = new Set<string>();

  const rootNodeId = options.rootNodeId ?? "00";
  const rootPosition = options.rootPosition ?? { x: 0, y: 0 };
  const nodeSize =
    typeof options.nodeSize === "number" && Number.isFinite(options.nodeSize)
      ? options.nodeSize
      : DEFAULT_NODE_SIZE;
  const rowGap =
    typeof options.levelSpacing === "number" &&
    Number.isFinite(options.levelSpacing)
      ? options.levelSpacing
      : DEFAULT_VERTICAL_GAP;
  const columnGap =
    typeof options.siblingSpacing === "number" &&
    Number.isFinite(options.siblingSpacing)
      ? options.siblingSpacing
      : Math.round(nodeSize * DEFAULT_HORIZONTAL_GAP_RATIO);

  const registerNode = (info: NodeInfo) => {
    if (nodesById.has(info.id)) {
      warnings.push(`Duplicate node id "${info.id}" skipped.`);
      return;
    }
    nodesById.set(info.id, info);
  };

  const pushEdge = (source: string, target: string) => {
    const edgeId = `e_${source}_${target}`;
    if (edgeIds.has(edgeId)) return;
    edgeIds.add(edgeId);
    edges.push({ id: edgeId, source, target, type: "default" });
  };

  const normalizeNodeData = (
    node: IndexNode | RootFolderJson,
    kind: NormalizedKind
  ): Record<string, unknown> => {
    return {
      ...(node as any),
      name: typeof (node as any)?.name === "string" ? (node as any).name : "",
      purpose:
        typeof (node as any)?.purpose === "string"
          ? (node as any).purpose
          : "",
      node_type: kind === "unknown" ? "" : kind,
    };
  };

  const collectNodes = (
    node: IndexNode,
    parentId: string,
    depth: number,
    index: number
  ): string | null => {
    const rawId =
      typeof (node as any)?.id === "string" && (node as any).id.trim()
        ? (node as any).id.trim()
        : "";
    const nodeName =
      typeof (node as any)?.name === "string" ? (node as any).name : null;
    const id = rawId || createSyntheticNodeId(parentId, index, nodeName);
    const kind = normalizeTypeKind((node as any)?.type);
    const nameValue = typeof nodeName === "string" ? nodeName.trim() : "";

    if (kind === "unknown") {
      warnings.push(
        `Skipped node "${nodeName ?? id}" because type is not file/folder.`
      );
      return null;
    }

    const data = normalizeNodeData(node, kind);
    const info: NodeInfo = {
      id,
      depth,
      kind,
      data,
      children: [],
      parentId,
      name: nameValue,
    };
    registerNode(info);

    const childNodes = Array.isArray((node as IndexFolderNode).child)
      ? (node as IndexFolderNode).child
      : [];
    if (childNodes.length > 0 && kind !== "folder") {
      warnings.push(
        `Node "${nodeName ?? id}" has children but is not a folder.`
      );
    }

    childNodes.forEach((child, childIndex) => {
      const childId = collectNodes(child, id, depth + 1, childIndex);
      if (!childId) return;
      info.children.push(childId);
      if (childId !== id) pushEdge(id, childId);
    });

    return id;
  };

  // Root node is always the entry point.
  const rootKind = normalizeTypeKind(root.type);
  const normalizedRootKind = rootKind === "unknown" ? "folder" : rootKind;
  const rootInfo: NodeInfo = {
    id: rootNodeId,
    depth: 0,
    kind: normalizedRootKind,
    data: normalizeNodeData(root, normalizedRootKind),
    children: [],
    parentId: null,
    name: typeof root.name === "string" ? root.name.trim() : "",
  };
  registerNode(rootInfo);

  const rootChildren = Array.isArray(root.child) ? root.child : [];
  rootChildren.forEach((child, childIndex) => {
    const childId = collectNodes(child, rootNodeId, 1, childIndex);
    if (!childId) return;
    rootInfo.children.push(childId);
    if (childId !== rootNodeId) pushEdge(rootNodeId, childId);
  });

  const compareNodes = (a: NodeInfo, b: NodeInfo): number => {
    // Files first, then folders. Each group sorted alphabetically.
    if (a.kind !== b.kind) {
      if (a.kind === "file") return -1;
      if (b.kind === "file") return 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  };

  const getChildExtents = (count: number) => {
    if (count <= 1) {
      return { left: 0, right: 0, width: 0 };
    }
    if (count % 2 === 0) {
      const extent = (count / 2 - 0.5) * columnGap;
      return { left: extent, right: extent, width: extent * 2 };
    }
    const leftExtent = ((count - 2) / 2) * columnGap;
    const rightExtent = (count / 2) * columnGap;
    return { left: leftExtent, right: rightExtent, width: leftExtent + rightExtent };
  };

  const getOffsetsForCount = (count: number): number[] => {
    if (count <= 1) return [0];
    const offsets: number[] = [];
    if (count % 2 === 0) {
      const start = -(count / 2 - 0.5);
      for (let i = 0; i < count; i += 1) {
        offsets.push(start + i);
      }
      return offsets;
    }
    // Odd: symmetric pairs + extra node at the far right.
    const evenPart = count - 1;
    const start = -(evenPart / 2 - 0.5);
    for (let i = 0; i < evenPart; i += 1) {
      offsets.push(start + i);
    }
    offsets.push(evenPart / 2 + 0.5);
    return offsets;
  };

  // Build rows by depth using stable parent ordering (folders A-Z, then files A-Z).
  const rowOrder: string[][] = [];
  rowOrder[0] = [rootNodeId];
  let depth = 0;
  while (rowOrder[depth] && rowOrder[depth].length > 0) {
    const nextRow: string[] = [];
    const parents = rowOrder[depth]
      .map((id) => nodesById.get(id))
      .filter(Boolean) as NodeInfo[];
    for (const parent of parents) {
      const children = parent.children
        .map((id) => nodesById.get(id))
        .filter(Boolean) as NodeInfo[];
      children.sort(compareNodes);
      nextRow.push(...children.map((child) => child.id));
    }
    if (nextRow.length > 0) rowOrder[depth + 1] = nextRow;
    depth += 1;
  }

  const nodes: Node[] = [];
  const positionedById = new Map<string, { x: number; y: number }>();

  rowOrder.forEach((row, rowIndex) => {
    if (row.length === 0) return;
    const rowY = rootPosition.y + rowIndex * (nodeSize + rowGap);

    const infos = row
      .map((id) => nodesById.get(id))
      .filter(Boolean) as NodeInfo[];

    const hasPresetPositions = row.every((id) => positionedById.has(id));

    if (!hasPresetPositions) {
      const footprints = infos.map((info) => {
        const childCount = info.children.length;
        const extents = getChildExtents(childCount);
        const clusterWidth = Math.max(nodeSize, extents.width);
        return { id: info.id, width: clusterWidth };
      });

      // Sequential placement with spacing sized by child clusters to reduce overlap.
      const xPositions: number[] = [];
      let cursorX = 0;
      footprints.forEach((item, index) => {
        if (index === 0) {
          xPositions.push(0);
          cursorX = 0;
          return;
        }
        const prev = footprints[index - 1];
        const gap = (prev.width + item.width) / 2 + columnGap;
        cursorX += gap;
        xPositions.push(cursorX);
      });

      // Center the row around the root X.
      const minX = Math.min(...xPositions);
      const maxX = Math.max(...xPositions);
      const rowCenter = (minX + maxX) / 2;
      const rowShift = rootPosition.x - rowCenter;

      infos.forEach((info, index) => {
        const x = xPositions[index] + rowShift;
        positionedById.set(info.id, { x, y: rowY });
      });
    }

    infos.forEach((info) => {
      const pos = positionedById.get(info.id) ?? { x: rootPosition.x, y: rowY };
      nodes.push({
        id: info.id,
        type: info.kind === "folder" ? "rootFolder" : "file",
        position: pos,
        data: info.data,
      });
    });

    // Place children in the next row centered around each parent.
    const nextRow = rowOrder[rowIndex + 1];
    if (!nextRow) return;
    const childrenInOrder = nextRow
      .map((id) => nodesById.get(id))
      .filter(Boolean) as NodeInfo[];
    const childrenByParent = new Map<string, NodeInfo[]>();
    childrenInOrder.forEach((child) => {
      if (!child.parentId) return;
      if (!childrenByParent.has(child.parentId)) {
        childrenByParent.set(child.parentId, []);
      }
      childrenByParent.get(child.parentId)!.push(child);
    });

    for (const parent of infos) {
      const parentPos = positionedById.get(parent.id);
      if (!parentPos) continue;
      const children = childrenByParent.get(parent.id) ?? [];
      if (children.length === 0) continue;
      children.sort(compareNodes);

      const offsets = getOffsetsForCount(children.length);
      children.forEach((child, idx) => {
        const offset = offsets[idx] ?? 0;
        const x = parentPos.x + offset * columnGap;
        const existing = positionedById.get(child.id);
        if (existing) return;
        positionedById.set(child.id, {
          x,
          y: rowY + nodeSize + rowGap,
        });
      });
    }
  });

  // Apply computed child positions (if any) to nodes that were already emitted.
  nodes.forEach((node) => {
    const pos = positionedById.get(node.id);
    if (pos) node.position = pos;
  });

  return { nodes, edges, warnings };
};
