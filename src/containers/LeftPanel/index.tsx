/**
 * LeftPanel/index.tsx
 * 
 * Left panel container component for folder tree and file management.
 * 
 * Features:
 * - Resizable panel with drag handle
 * - Root folder selection via File System Access API
 * - Collapsible to icon-only view when minimized
 * - TreeView component for displaying folder structure
 * 
 * The panel can be resized between MIN_WIDTH (56px) and MAX_WIDTH (400px).
 * When minimized, it shows only the root folder selection button.
 */

import { TreeView } from '../../components/TreeView';
import { useMindMapStore } from '../../store/mindMapStore';
import { useEffect, useMemo, useRef } from 'react';
import { uiText } from '../../constants/uiText';
import { FileManager } from '../../data/fileManager';
import { FiFolder } from 'react-icons/fi';

/**
 * LeftPanel component
 * 
 * Renders the left sidebar with folder tree and root folder selection.
 * Handles panel resizing via mouse drag on the resize handle.
 */
export default function LeftPanel() {
  const leftPanelWidth = useMindMapStore((s) => s.leftPanelWidth);
  const setLeftPanelWidth = useMindMapStore((s) => s.setLeftPanelWidth);
  const rootDirectoryHandle = useMindMapStore((s) => s.rootDirectoryHandle);
  const setRoot = useMindMapStore((s) => s.setRoot);

  const fileManager = useMemo(() => new FileManager(), []);

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
  const isReduced = leftPanelWidth <= MIN_WIDTH;

  /**
   * Handles root folder selection via File System Access API
   * 
   * If a root folder already exists, prompts user for confirmation before replacing.
   * Creates root-folder.json in the selected directory and updates the store.
   */
  const onSelectRootFolder = async () => {
    // Root replacement confirmation (only when root exists)
    if (rootDirectoryHandle) {
      const ok = window.confirm(uiText.alerts.confirmReplaceRootFolder);
      if (!ok) return;
    }

    const dirHandle = await fileManager.pickRootDirectory();
    if (!dirHandle) return; // Silent cancel - user closed picker

    const root = await fileManager.createRootFolderJson(dirHandle);
    setRoot(dirHandle, root);
  };

  /**
   * Initiates panel resize operation
   * 
   * Captures initial mouse position and panel width, then sets up
   * global mouse move/up listeners for drag tracking.
   */
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

  /**
   * Effect: Handle panel resizing via mouse drag
   * 
   * Uses requestAnimationFrame for smooth resizing performance.
   * Calculates new width based on mouse movement and clamps to MIN/MAX bounds.
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

        <button
          type="button"
          onClick={onSelectRootFolder}
          aria-label={
            rootDirectoryHandle ? uiText.tooltips.changeRootFolder : uiText.tooltips.selectRootFolder
          }
          title={
            rootDirectoryHandle ? uiText.tooltips.changeRootFolder : uiText.tooltips.selectRootFolder
          }
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 'var(--control-size-sm)',
            width: 'var(--control-size-sm)',
            borderRadius: 'var(--radius-md)',
            border: 'var(--border-width) solid var(--border)',
            background: 'transparent',
            color: 'var(--text)',
            cursor: 'pointer',
          }}
        >
          <FiFolder style={{ fontSize: 'var(--icon-size-md)' }} aria-hidden="true" />
        </button>
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