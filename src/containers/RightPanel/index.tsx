/**
 * RightPanel/index.tsx
 * 
 * Right panel container component for node details and editor.
 * 
 * Features:
 * - Resizable panel with drag handle on the left edge
 * - Collapsible to icon-only view when minimized
 * - Node detail view and editor (placeholder for now)
 * 
 * The panel can be resized between MIN_WIDTH (56px) and MAX_WIDTH (400px).
 * When minimized, it shows only the panel header.
 */

import { useMindMapStore } from '../../store/mindMapStore';
import { useEffect, useRef } from 'react';
import { uiText } from '../../constants/uiText';

/**
 * RightPanel component
 * 
 * Renders the right sidebar with node details and editor.
 * Handles panel resizing via mouse drag on the left resize handle.
 */
export default function RightPanel() {
  const rightPanelWidth = useMindMapStore((s) => s.rightPanelWidth);
  const setRightPanelWidth = useMindMapStore((s) => s.setRightPanelWidth);

  const dragRef = useRef<{
    startX: number;
    startWidth: number;
    raf: number | null;
    latestX: number;
    dragging: boolean;
  } | null>(null);

  // Panel width constraints
  const MIN_WIDTH = 56;
  const MAX_WIDTH = 400;
  const isReduced = rightPanelWidth <= MIN_WIDTH;

  /**
   * Initiates panel resize operation
   * 
   * Captures initial mouse position and panel width, then sets up
   * global mouse move/up listeners for drag tracking.
   * Note: Right panel resizes from its LEFT edge.
   */
  const onResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    dragRef.current = {
      startX: e.clientX,
      startWidth: rightPanelWidth,
      raf: null,
      latestX: e.clientX,
      dragging: true,
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  };

  /**
   * Effect: Handle panel resizing via mouse drag
   * 
   * Uses requestAnimationFrame for smooth resizing performance.
   * Right panel resizes from LEFT edge, so moving mouse right reduces width.
   * Calculates new width and clamps to MIN/MAX bounds.
   */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d?.dragging) return;

      d.latestX = e.clientX;
      if (d.raf != null) return;

      d.raf = window.requestAnimationFrame(() => {
        const dd = dragRef.current;
        if (!dd?.dragging) return;

        // Right panel resizes from its LEFT edge, so moving mouse right reduces width
        const dx = dd.latestX - dd.startX;
        const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, dd.startWidth - dx));
        setRightPanelWidth(next);
        dd.raf = null;
      });
    };

    const onUp = () => {
      const d = dragRef.current;
      if (!d?.dragging) return;
      d.dragging = false;
      if (d.raf != null) {
        window.cancelAnimationFrame(d.raf);
        d.raf = null;
      }
      dragRef.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [setRightPanelWidth]);

  return (
    <aside
      className="pm-panel pm-panel--right"
      aria-label={uiText.ariaLabels.rightSidebar}
      style={{
        position: 'relative',
        width: rightPanelWidth,
        minWidth: rightPanelWidth,
        maxWidth: rightPanelWidth,
        flex: '0 0 auto',
      }}
    >
      <div
        className="pm-resize-handle pm-resize-handle--left"
        role="separator"
        aria-label={uiText.tooltips.resizeRightSidebar}
        title={uiText.tooltips.resizeRightSidebar}
        onMouseDown={onResizeMouseDown}
      />

      <div className="pm-panel__header">
        {!isReduced && <div className="pm-panel__title">{uiText.panels.node}</div>}
      </div>

      {!isReduced ? (
        <div className="pm-panel__content">
          <div className="pm-placeholder">
            {uiText.placeholders.nodeDetails}
          </div>
        </div>
      ) : (
        <div className="pm-panel__collapsed" aria-hidden="true" />
      )}
    </aside>
  );
}