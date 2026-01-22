import type { Edge, Node } from "reactflow";
import type { CognitiveNotesJson, CognitiveNotesFileNode } from "../data/cognitiveNotesManager";

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
const DEFAULT_COLUMN_GAP = 40;
const DEFAULT_ROW_GAP = 40;

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
    },
  };
};

const buildNoteNode = (
  note: CognitiveNotesFileNode,
  position: { x: number; y: number }
): Node => {
  return {
    id: note.id,
    type: "file",
    position,
    data: {
      ...note,
      name: typeof note.name === "string" ? note.name : "",
      purpose: typeof note.purpose === "string" ? note.purpose : "",
      level: 1,
    },
  };
};

export const composeCognitiveNotesGraph = (
  root: CognitiveNotesJson,
  options: CognitiveNotesComposeOptions = {}
): CognitiveNotesComposeResult => {
  const rootNodeId = normalizeRootId(root);
  const rootPosition = options.rootPosition ?? { x: 0, y: 0 };
  const nodeSize =
    typeof options.nodeSize === "number" && Number.isFinite(options.nodeSize)
      ? options.nodeSize
      : DEFAULT_NODE_SIZE;
  const columns =
    typeof options.columns === "number" && Number.isFinite(options.columns)
      ? Math.max(1, Math.round(options.columns))
      : DEFAULT_COLUMNS;
  const columnGap =
    typeof options.columnGap === "number" && Number.isFinite(options.columnGap)
      ? options.columnGap
      : DEFAULT_COLUMN_GAP;
  const rowGap =
    typeof options.rowGap === "number" && Number.isFinite(options.rowGap)
      ? options.rowGap
      : DEFAULT_ROW_GAP;

  const nodes: Node[] = [buildRootNode(root, rootNodeId, rootPosition)];
  const edges: Edge[] = [];

  const related = Array.isArray(root.related_nodes) ? root.related_nodes : [];
  const spacingX = nodeSize + columnGap;
  const spacingY = nodeSize + rowGap;
  const baseX = rootPosition.x + spacingX;
  const baseY = rootPosition.y;

  related.forEach((note, index) => {
    if (!note || typeof note !== "object") return;
    if (typeof note.id !== "string" || !note.id.trim()) return;
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = baseX + col * spacingX;
    const y = baseY + row * spacingY;
    nodes.push(buildNoteNode(note, { x, y }));
    edges.push({
      id: `e_${rootNodeId}_${note.id}`,
      source: rootNodeId,
      target: note.id,
      type: "default",
    });
  });

  return { nodes, edges, rootNodeId };
};
