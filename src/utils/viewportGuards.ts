import {
  getNodesBounds,
  getViewportForBounds,
  type Node,
  type Viewport,
} from "reactflow";

type Rect = {
  width: number;
  height: number;
};

const EPS = 4; // px tolerance for DPI / float safety

/**
 * Checks if all nodes are fully visible in the current viewport
 * using bounds-based math (safe & fast).
 */
export function areAllNodesVisible(params: {
  nodes: Node[];
  viewport: Viewport;
  canvasRect: Rect;
}): boolean {
  const { nodes, viewport, canvasRect } = params;

  if (!nodes.length) return true;

  const bounds = getNodesBounds(nodes);

  // Project world bounds → screen space
  const left = bounds.x * viewport.zoom + viewport.x;
  const top = bounds.y * viewport.zoom + viewport.y;
  const right = (bounds.x + bounds.width) * viewport.zoom + viewport.x;
  const bottom = (bounds.y + bounds.height) * viewport.zoom + viewport.y;

  return (
    left >= -EPS &&
    top >= -EPS &&
    right <= canvasRect.width + EPS &&
    bottom <= canvasRect.height + EPS
  );
}

/**
 * Returns the exact fit viewport for current nodes.
 */
export function getFitViewport(params: {
  nodes: Node[];
  canvasRect: Rect;
  maxZoom: number;
  padding?: number;
}): Viewport {
  const { nodes, canvasRect, maxZoom, padding = 0.1 } = params;

  const bounds = getNodesBounds(nodes);

  return getViewportForBounds(
    bounds,
    canvasRect.width,
    canvasRect.height,
    padding,
    maxZoom,
    padding
  );
}

/**
 * Guard logic for zoom-out handling.
 * Returns true if zoom-out should be blocked.
 */
export function shouldBlockZoomOut(params: {
  nodes: Node[];
  viewport: Viewport;
  canvasRect: Rect;
  minFitZoom: number;
  isZoomingOut: boolean;
}): boolean {
  const { nodes, viewport, canvasRect, minFitZoom, isZoomingOut } = params;

  if (!isZoomingOut || !nodes.length) return false;

  // Stage 1: already fully visible
  if (
    areAllNodesVisible({
      nodes,
      viewport,
      canvasRect,
    })
  ) {
    return true;
  }

  // Stage 2: past fit zoom
  if (viewport.zoom <= minFitZoom + 0.0001) {
    return true;
  }

  return false;
}
