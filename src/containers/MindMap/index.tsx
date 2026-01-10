/**
 * MindMap/index.tsx
 * 
 * Main MindMap container component.
 * Renders the central ReactFlow canvas for visualizing the mind map structure.
 * 
 * Features:
 * - Displays nodes and edges from the global store
 * - Automatically centers root folder node when selected
 * - Supports custom node types (currently RootFolderNode)
 * - Provides accessibility labels for screen readers
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, { type Node, type ReactFlowInstance } from 'reactflow';
import 'reactflow/dist/style.css';
import { uiText } from '../../constants/uiText';
import { useMindMapStore } from '../../store/mindMapStore';
import RootFolderNode from './RootFolderNode';

/**
 * MindMap component
 * 
 * Main container for the mind map visualization canvas.
 * When a root folder is selected, it creates a single root node at the
 * viewport center and enables inline editing.
 */
export default function MindMap() {
  const nodes = useMindMapStore((s) => s.nodes);
  const edges = useMindMapStore((s) => s.edges);
  const setNodes = useMindMapStore((s) => s.setNodes);
  const rootFolderJson = useMindMapStore((s) => s.rootFolderJson);
  const setInlineEditNodeId = useMindMapStore((s) => s.setInlineEditNodeId);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [rf, setRf] = useState<ReactFlowInstance | null>(null);
  const nodeTypes = useMemo(() => ({ rootFolder: RootFolderNode }), []);

  /**
   * Effect: Create/replace root node when root folder is selected
   * 
   * When a root folder is selected, this effect:
   * 1. Calculates the center of the viewport
   * 2. Converts screen coordinates to flow coordinates
   * 3. Creates a single root node at that position
   * 4. Enables inline editing for the root node
   * 
   * Only one root node is allowed at a time (enforced by setNodes([rootNode])).
   */
  useEffect(() => {
    if (!rootFolderJson || !rf) return;
    const el = wrapperRef.current;
    const rect = el?.getBoundingClientRect();
    const centerClient = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    const pos = rf.screenToFlowPosition(centerClient);
    const rootNode: Node = {
      id: '00',
      type: 'rootFolder',
      position: pos,
      data: rootFolderJson,
    };

    // Enforce single root node only (replace any existing root)
    setNodes([rootNode]);
    setInlineEditNodeId('00');
  }, [rf, rootFolderJson, setInlineEditNodeId, setNodes]);

  return (
    <main className="pm-center" aria-label={uiText.ariaLabels.mindMapCanvas}>
      <div className="pm-canvas" ref={wrapperRef}>
        <ReactFlow nodes={nodes} edges={edges} fitView nodeTypes={nodeTypes} onInit={setRf}>
        </ReactFlow>
      </div>
    </main>
  );
}