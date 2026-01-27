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
  leafSiblingGap?: number;
  minSiblingGap?: number;
  levelHorizontalGaps?: number[];
};

export type MindMapComposeResult = {
  nodes: Node[];
  edges: Edge[];
  warnings: string[];
};

type NormalizedKind = "folder" | "file" | "unknown";

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "svg",
]);

type NodeInfo = {
  id: string;
  depth: number;
  kind: NormalizedKind;
  renderType:
    | "rootFolder"
    | "file"
    | "shieldFile"
    | "outputFile"
    | "polaroidImage"
    | "fullImageNode";
  data: Record<string, unknown>;
  children: string[];
  parentId: string | null;
  name: string;
};

const DEFAULT_NODE_SIZE = 200;
const DEFAULT_VERTICAL_GAP = 80;
const DEFAULT_HORIZONTAL_GAP_RATIO = 1.4;
const DEFAULT_LEAF_SIBLING_GAP = 30;
const DEFAULT_MIN_SIBLING_GAP = 30;

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
  const rowGapCandidate =
    typeof options.levelSpacing === "number" &&
    Number.isFinite(options.levelSpacing)
      ? options.levelSpacing
      : DEFAULT_VERTICAL_GAP;
  // Enforce a minimum 30px vertical gap between rows.
  const rowGap = Math.max(DEFAULT_VERTICAL_GAP, rowGapCandidate);
  const columnGap =
    typeof options.siblingSpacing === "number" &&
    Number.isFinite(options.siblingSpacing)
      ? options.siblingSpacing
      : Math.round(nodeSize * DEFAULT_HORIZONTAL_GAP_RATIO);
  // Fixed 30px gap for last-level (leaf) siblings per hierarchy rule.
  const leafSiblingGap = DEFAULT_LEAF_SIBLING_GAP;
  const levelHorizontalGaps = Array.isArray(options.levelHorizontalGaps)
    ? options.levelHorizontalGaps
    : [];
  const minSiblingGap =
    typeof options.minSiblingGap === "number" &&
    Number.isFinite(options.minSiblingGap)
      ? Math.max(DEFAULT_MIN_SIBLING_GAP, options.minSiblingGap)
      : DEFAULT_MIN_SIBLING_GAP;

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
    const extension =
      typeof (node as any)?.extension === "string"
        ? (node as any).extension.toLowerCase()
        : "";
    const isImageFile = kind === "file" && IMAGE_EXTENSIONS.has(extension);
    const nodeVariant =
      typeof (node as any)?.node_variant === "string" ? (node as any).node_variant : "";
    const isShieldVariant = nodeVariant === "shieldFile";
    const isOutputVariant = nodeVariant === "outputShield";

    if (kind === "unknown") {
      warnings.push(
        `Skipped node "${nodeName ?? id}" because type is not file/folder.`
      );
      return null;
    }

    const data = normalizeNodeData(node, kind);
    if (isImageFile) {
      data.type = "fullImageNode";
      data.node_type = "fullImageNode";
    }
    const info: NodeInfo = {
      id,
      depth,
      kind,
      renderType:
        kind === "folder"
          ? "rootFolder"
          : isImageFile
          ? "fullImageNode"
        : isShieldVariant
        ? "shieldFile"
        : isOutputVariant
        ? "outputFile"
        : "file",
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
    renderType: "rootFolder",
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

  const nodes: Node[] = [];
  const positionedById = new Map<string, { x: number; y: number }>();
  const subtreeWidthById = new Map<string, number>();

  const getSortedChildren = (info: NodeInfo): NodeInfo[] => {
    const children = info.children
      .map((id) => nodesById.get(id))
      .filter(Boolean) as NodeInfo[];
    children.sort(compareNodes);
    return children;
  };

  const isLeafNode = (info: NodeInfo): boolean => info.children.length === 0;

  const isLastButOneNode = (info: NodeInfo): boolean => {
    if (info.children.length === 0) return false;
    const childInfos = getSortedChildren(info);
    return childInfos.length > 0 && childInfos.every(isLeafNode);
  };

  const getLevelGapForDepth = (depth: number): number => {
    if (depth <= 0) return columnGap;
    const idx = depth - 1;
    const candidate = levelHorizontalGaps[idx];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
    return columnGap;
  };

  const canTightenLastButOneGap = (gap: number): boolean => {
    /**
     * Last-but-one gap check (leaf safety):
     * The leaf clusters of adjacent parent siblings are separated by the
     * inter-parent gap. To keep leaf nodes from overlapping, that gap must
     * stay >= minSiblingGap (30px default).
     */
    return gap >= minSiblingGap;
  };

  const getTightenedLastButOneGap = (startGap: number): number => {
    /**
     * Decrease parent gap toward 30px in 5px steps.
     * Stop once the leaf-level separation would remain non-overlapping.
     */
    const initialGap = Math.max(minSiblingGap, startGap);
    for (let gap = initialGap; gap >= minSiblingGap; gap -= 5) {
      if (canTightenLastButOneGap(gap)) return gap;
    }
    return minSiblingGap;
  };

  const getSiblingGapForParent = (parent: NodeInfo, children: NodeInfo[]): number => {
    /**
     * Gap logic for last-level nodes:
     * - If a parent's children are all leaf nodes (last level),
     *   use a fixed 30px gap to keep file siblings readable.
     * - Otherwise, use the standard column gap for subtree separation.
     *
     * Gap logic for last-but-one nodes:
     * - If siblings are all parents of leaf nodes, reduce spacing as much as
     *   possible while keeping a non-overlap minimum gap.
     */
    const childDepth = parent.depth + 1;
    const baseGap = Math.max(minSiblingGap, getLevelGapForDepth(childDepth));
    if (children.length === 0) return baseGap;
    const allLeaves = children.every(isLeafNode);
    if (allLeaves) {
      return Math.max(minSiblingGap, leafSiblingGap);
    }
    const allLastButOne = children.every(isLastButOneNode);
    if (allLastButOne) {
      return getTightenedLastButOneGap(baseGap);
    }
    return baseGap;
  };

  const computeSubtreeWidth = (info: NodeInfo): number => {
    if (subtreeWidthById.has(info.id)) {
      return subtreeWidthById.get(info.id)!;
    }
    const children = getSortedChildren(info);
    if (children.length === 0) {
      subtreeWidthById.set(info.id, nodeSize);
      return nodeSize;
    }
    const childWidths = children.map((child) => computeSubtreeWidth(child));
    const siblingGap = getSiblingGapForParent(info, children);
    const childrenSpan =
      childWidths.reduce((sum, width) => sum + width, 0) +
      siblingGap * (children.length - 1);
    const width = Math.max(nodeSize, childrenSpan);
    subtreeWidthById.set(info.id, width);
    return width;
  };

  const placeSubtree = (info: NodeInfo, leftX: number) => {
    const width = subtreeWidthById.get(info.id) ?? nodeSize;
    const x = leftX + width / 2;
    const y = rootPosition.y + info.depth * (nodeSize + rowGap);
    positionedById.set(info.id, { x, y });

    const children = getSortedChildren(info);
    if (children.length === 0) return;
    const childWidths = children.map((child) =>
      subtreeWidthById.get(child.id) ?? nodeSize
    );
    const siblingGap = getSiblingGapForParent(info, children);
    const childrenSpan =
      childWidths.reduce((sum, w) => sum + w, 0) +
      siblingGap * (children.length - 1);
    let cursorX = leftX + (width - childrenSpan) / 2;
    children.forEach((child, index) => {
      const childWidth = childWidths[index] ?? nodeSize;
      placeSubtree(child, cursorX);
      cursorX += childWidth + siblingGap;
    });
  };

  const rootInfoForLayout = nodesById.get(rootNodeId);
  if (rootInfoForLayout) {
    const rootWidth = computeSubtreeWidth(rootInfoForLayout);
    placeSubtree(rootInfoForLayout, rootPosition.x - rootWidth / 2);
  }

  nodesById.forEach((info) => {
    const pos =
      positionedById.get(info.id) ??
      ({
        x: rootPosition.x,
        y: rootPosition.y + info.depth * (nodeSize + rowGap),
      } as { x: number; y: number });
    nodes.push({
      id: info.id,
      type: info.renderType,
      position: pos,
      data: info.data,
    });
  });

  return { nodes, edges, warnings };
};
