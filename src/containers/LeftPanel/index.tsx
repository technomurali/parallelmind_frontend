import { TreeView } from '../../components/TreeView';
import { useMindMapStore } from '../../store/mindMapStore';
import { useEffect, useRef } from 'react';
import { uiText } from '../../constants/uiText';

// LeftPanel container (Folder Tree)
export default function LeftPanel() {
  const leftPanelWidth = useMindMapStore((s) => s.leftPanelWidth);
  const setLeftPanelWidth = useMindMapStore((s) => s.setLeftPanelWidth);

  const dragRef = useRef<{
    startX: number;
    startWidth: number;
    raf: number | null;
    latestX: number;
    dragging: boolean;
  } | null>(null);

  const MIN_WIDTH = 56;
  const MAX_WIDTH = 400;
  const isReduced = leftPanelWidth <= MIN_WIDTH;

  const onResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    dragRef.current = {
      startX: e.clientX,
      startWidth: leftPanelWidth,
      raf: null,
      latestX: e.clientX,
      dragging: true,
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d?.dragging) return;

      d.latestX = e.clientX;
      if (d.raf != null) return;

      d.raf = window.requestAnimationFrame(() => {
        const dd = dragRef.current;
        if (!dd?.dragging) return;

        const dx = dd.latestX - dd.startX;
        const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, dd.startWidth + dx));
        setLeftPanelWidth(next);
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
  }, [setLeftPanelWidth]);

  return (
    <aside
      className="pm-panel pm-panel--left"
      aria-label={uiText.ariaLabels.leftSidebar}
      style={{
        position: 'relative',
        width: leftPanelWidth,
        minWidth: leftPanelWidth,
        maxWidth: leftPanelWidth,
        flex: '0 0 auto',
      }}
    >
      <div className="pm-panel__header">
        {!isReduced && <div className="pm-panel__title">{uiText.panels.files}</div>}
      </div>

      {!isReduced ? (
        <div className="pm-panel__content">
          <TreeView />
        </div>
      ) : (
        <div className="pm-panel__collapsed" aria-hidden="true" />
      )}

      <div
        className="pm-resize-handle pm-resize-handle--right"
        role="separator"
        aria-label={uiText.tooltips.resizeLeftSidebar}
        title={uiText.tooltips.resizeLeftSidebar}
        onMouseDown={onResizeMouseDown}
      />
    </aside>
  );
}