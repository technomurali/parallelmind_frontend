import type { Edge, Node } from "reactflow";
import type {
  CognitiveNotesJson,
  CognitiveNotesFileNode,
  CognitiveNotesRelation,
} from "../data/cognitiveNotesManager";

export type CognitiveNotesComposeOptions = {
  rootPosition?: { x: number; y: number };
  nodeSize?: number;
  columns?: number;
  columnGap?: number;
  rowGap?: number;
};

export type CognitiveNotesComposeResult = {
  nodes: Node[];
  edges: Edge[];
  rootNodeId: string;
};

const DEFAULT_NODE_SIZE = 200;
const DEFAULT_COLUMNS = 4;
const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "svg",
]);

const isValidHexColor = (value: unknown) =>
  typeof value === "string" &&
  /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());

const normalizeRootId = (root: CognitiveNotesJson): string => {
  if (typeof root?.id === "string" && root.id.trim()) return root.id.trim();
  return `cn_root_${Date.now()}`;
};

const buildRootNode = (
  root: CognitiveNotesJson,
  rootNodeId: string,
  position: { x: number; y: number }
): Node => {
  return {
    id: rootNodeId,
    type: "rootFolder",
    position,
    data: {
      ...root,
      name: typeof root.name === "string" ? root.name : "Cognitive Notes",
      level: 0,
      node_color:
        typeof root.node_colors?.[rootNodeId] === "string"
          ? root.node_colors[rootNodeId]
          : undefined,
    },
  };
};

const buildNoteNode = (
  root: CognitiveNotesJson,
  note: CognitiveNotesFileNode,
  position: { x: number; y: number },
  renderType: "file" | "shieldFile" | "outputFile" | "fullImageNode"
): Node => {
  return {
    id: note.id,
    type: renderType,
    position,
    data: {
      ...note,
      name: typeof note.name === "string" ? note.name : "",
      purpose: typeof note.purpose === "string" ? note.purpose : "",
      level: 1,
      node_color:
        typeof root.node_colors?.[note.id] === "string"
          ? root.node_colors[note.id]
          : undefined,
    },
  };
};

const getDefaultHandle = (nodeType: string, kind: "source" | "target") => {
  if (nodeType === "rootFolder") {
    return kind === "source" ? "source-bottom" : "target-top";
  }
  return kind === "source" ? "source-right" : "target-left";
};

const normalizeHandle = (
  handle: unknown,
  nodeType: string,
  kind: "source" | "target"
): string => {
  if (typeof handle === "string" && handle.trim()) return handle;
  return getDefaultHandle(nodeType, kind);
};

const collectEdgesFromRelations = (
  nodes: CognitiveNotesFileNode[],
  nodeTypeById: Map<string, string>
): Edge[] => {
  const edges: Edge[] = [];
  const seen = new Set<string>();
  nodes.forEach((node) => {
    const relations = Array.isArray(node.related_nodes)
      ? (node.related_nodes as CognitiveNotesRelation[])
      : [];
    relations.forEach((rel) => {
      if (!rel || typeof rel !== "object") return;
      if (!rel.edge_id || !rel.target_id) return;
      if (seen.has(rel.edge_id)) return;
      seen.add(rel.edge_id);
      const sourceType = nodeTypeById.get(node.id) ?? "file";
      const targetType = nodeTypeById.get(rel.target_id) ?? "file";
      const sourceHandle = normalizeHandle(rel.source_handle, sourceType, "source");
      const targetHandle = normalizeHandle(rel.target_handle, targetType, "target");
      edges.push({
        id: rel.edge_id,
        source: node.id,
        target: rel.target_id,
        type: "default",
        sourceHandle,
        targetHandle,
        data: { purpose: rel.purpose ?? "" },
      });
    });
  });
  return edges;
};

export const composeCognitiveNotesGraph = (
  root: CognitiveNotesJson,
  options: CognitiveNotesComposeOptions = {}
): CognitiveNotesComposeResult => {
  const rootNodeId = normalizeRootId(root);
  const storedPositions = root?.node_positions ?? {};
  const rootPosition = storedPositions[rootNodeId] ?? options.rootPosition ?? { x: 0, y: 0 };
  const nodeSize =
    typeof options.nodeSize === "number" && Number.isFinite(options.nodeSize)
      ? options.nodeSize
      : DEFAULT_NODE_SIZE;
  const columns =
    typeof options.columns === "number" && Number.isFinite(options.columns)
      ? Math.max(1, Math.round(options.columns))
      : DEFAULT_COLUMNS;
  const columnGap = 10;
  const rowGap = 10;
  const gridLeftPadding = 30;

  const rootPositionTopLeft = {
    x: rootPosition.x + gridLeftPadding,
    y: rootPosition.y,
  };
  const nodes: Node[] = [buildRootNode(root, rootNodeId, rootPositionTopLeft)];
  const edges: Edge[] = [];
  const nodeTypeById = new Map<string, string>();
  nodeTypeById.set(rootNodeId, "rootFolder");
  const edgeIds = new Set<string>();

  const related = Array.isArray(root.child) ? [...root.child] : [];
  const layoutNodes = related.sort((a, b) => {
    const aIndex =
      typeof a.sort_index === "number" && Number.isFinite(a.sort_index)
        ? a.sort_index
        : Number.POSITIVE_INFINITY;
    const bIndex =
      typeof b.sort_index === "number" && Number.isFinite(b.sort_index)
        ? b.sort_index
        : Number.POSITIVE_INFINITY;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return String(a.name ?? "").localeCompare(String(b.name ?? ""));
  });
  const spacingX = nodeSize + columnGap;
  const spacingY = nodeSize + rowGap;
  const baseX = rootPositionTopLeft.x;
  const baseY = rootPositionTopLeft.y + spacingY;

  layoutNodes.forEach((note, index) => {
    if (!note || typeof note !== "object") return;
    if (typeof note.id !== "string" || !note.id.trim()) return;
    const fileName = note.extension
      ? `${note.name}.${note.extension}`
      : note.name;
    if (
      typeof fileName === "string" &&
      (fileName.endsWith("_rootIndex.json") ||
        fileName.endsWith("_cognitiveNotes.json"))
    ) {
      return;
    }
    const extension =
      typeof note.extension === "string" ? note.extension.toLowerCase() : "";
    const nodeVariant =
      typeof (note as any)?.node_variant === "string" ? (note as any).node_variant : "";
    const renderType = IMAGE_EXTENSIONS.has(extension)
      ? "fullImageNode"
      : nodeVariant === "shieldFile"
      ? "shieldFile"
      : nodeVariant === "outputShield"
      ? "outputFile"
      : "file";
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = baseX + col * spacingX;
    const y = baseY + row * spacingY;
    const savedPosition = storedPositions[note.id];
    const position =
      savedPosition && typeof savedPosition === "object"
        ? { x: savedPosition.x, y: savedPosition.y }
        : { x, y };
    nodes.push(buildNoteNode(root, note, position, renderType));
    nodeTypeById.set(note.id, renderType);
  });

  const flowchartNodes = Array.isArray(root.flowchart_nodes)
    ? root.flowchart_nodes
    : [];
  flowchartNodes.forEach((flowNode, index) => {
    if (!flowNode || typeof flowNode !== "object") return;
    if (typeof flowNode.id !== "string" || !flowNode.id.trim()) return;
    if (typeof flowNode.type !== "string" || !flowNode.type.trim()) return;
    const savedPosition = storedPositions[flowNode.id];
    const savedColor = root.node_colors?.[flowNode.id];
    const position =
      savedPosition ??
      ({
        x: baseX + (columns + 1) * spacingX,
        y: baseY + index * spacingY,
      } as { x: number; y: number });
    nodes.push({
      id: flowNode.id,
      type: flowNode.type,
      position,
      data: {
        ...flowNode,
        type: flowNode.type,
        node_type: flowNode.type,
        name: typeof flowNode.name === "string" ? flowNode.name : "",
        purpose: typeof flowNode.purpose === "string" ? flowNode.purpose : "",
        node_color: isValidHexColor(savedColor) ? savedColor : undefined,
      },
    });
    nodeTypeById.set(flowNode.id, flowNode.type);
  });

  const flowchartEdges = Array.isArray(root.flowchart_edges)
    ? root.flowchart_edges
    : [];
  flowchartEdges.forEach((edge) => {
    if (!edge || typeof edge !== "object") return;
    if (!edge.id || !edge.source || !edge.target) return;
    if (!nodeTypeById.has(edge.source) || !nodeTypeById.has(edge.target)) return;
    if (edgeIds.has(edge.id)) return;
    edgeIds.add(edge.id);
    edges.push({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: "default",
      sourceHandle: edge.source_handle,
      targetHandle: edge.target_handle,
      data: { purpose: edge.purpose ?? "" },
    });
  });

  const relationEdges = collectEdgesFromRelations(related, nodeTypeById);
  relationEdges.forEach((edge) => {
    if (edgeIds.has(edge.id)) return;
    edgeIds.add(edge.id);
    edges.push(edge);
  });
  return { nodes, edges, rootNodeId };
};
