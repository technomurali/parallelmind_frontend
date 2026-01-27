/**
 * nodeTypes.ts
 * 
 * Types for nodes, edges, folder levels, etc.
 * Centralized TypeScript type definitions for the entire mind map application.
 * Ensures type safety across components and utilities.
 */

/**
 * Base node data structure
 * Represents the core information for any node in the mind map.
 */
export interface NodeData {
  id: string;
  label: string;
  type: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Position coordinates for a node in the visual map
 */
export interface NodePosition {
  x: number;
  y: number;
}

/**
 * Mind map node with position information
 * Extends NodeData with visual positioning for ReactFlow.
 */
export interface MindMapNode extends NodeData {
  position: NodePosition;
}

/**
 * Edge connection between nodes
 * Represents relationships and connections in the mind map.
 */
export interface Edge {
  id: string;
  source: string; // Source node ID
  target: string; // Target node ID
  type?: string; // Edge type (e.g., 'default', 'smoothstep')
  label?: string; // Optional edge label
}

/**
 * Folder level type
 * Represents the depth level in the folder hierarchy.
 */
export type FolderLevel = number; // 0 = root, 1 = first level, etc.

/**
 * Node type enumeration
 * Defines the different types of nodes in the mind map.
 */
export type NodeType = 'file' | 'shieldFile' | 'outputFile' | 'folder' | 'note' | 'task' | 'link';

/**
 * Extended node data with folder level information
 */
export interface FolderNode extends NodeData {
  type: 'folder';
  level: FolderLevel;
  children: string[]; // Array of child node IDs
  color?: string; // Color assigned based on level
}

/**
 * File node with content information
 */
export interface FileNode extends NodeData {
  type: 'file';
  level: FolderLevel;
  content: string;
  color?: string; // Color assigned based on level
}