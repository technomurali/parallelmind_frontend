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
import { FiFolder, FiSettings } from 'react-icons/fi';

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
  const rootFolderJson = useMindMapStore((s) => s.rootFolderJson);
  const setRoot = useMindMapStore((s) => s.setRoot);
  const toggleSettings = useMindMapStore((s) => s.toggleSettings);

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
   * If root-folder.json already exists in the selected directory, it is loaded (not overwritten).
   * root-folder.json is only created the first time (when missing).
   */
  const onSelectRootFolder = async () => {
    const selection = await fileManager.pickRootDirectory();
    if (!selection) return; // Silent cancel - user closed picker

    // If a root already exists and the user picked a different folder, confirm replacement.
    if (rootDirectoryHandle || rootFolderJson?.path) {
      let isSame = false;
      if (typeof selection === 'string') {
        isSame = rootFolderJson?.path === selection;
      } else if (rootDirectoryHandle) {
        try {
          if (typeof rootDirectoryHandle.isSameEntry === 'function') {
            isSame = await rootDirectoryHandle.isSameEntry(selection);
          }
        } catch {
          // If comparison fails, treat as different and require confirmation.
          isSame = false;
        }
      }

      if (!isSame) {
        const ok = window.confirm(uiText.alerts.confirmReplaceRootFolder);
        if (!ok) return;
      }
    }

    if (typeof selection === 'string') {
      const { root } = await fileManager.loadOrCreateRootFolderJsonFromPath(selection);
      setRoot(null, root);
      return;
    }

    const { root } = await fileManager.loadOrCreateRootFolderJson(selection);
    setRoot(selection, root);
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

        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <button
            type="button"
            onClick={onSelectRootFolder}
            aria-label={
              rootDirectoryHandle || rootFolderJson?.path
                ? uiText.tooltips.changeRootFolder
                : uiText.tooltips.selectRootFolder
            }
            title={
              rootDirectoryHandle || rootFolderJson?.path
                ? uiText.tooltips.changeRootFolder
                : uiText.tooltips.selectRootFolder
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 'var(--control-size-sm)',
              width: 'var(--control-size-sm)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'transparent',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            <FiFolder style={{ fontSize: 'var(--icon-size-md)' }} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={toggleSettings}
            aria-label={uiText.tooltips.toggleSettings}
            title={uiText.tooltips.toggleSettings}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 'var(--control-size-sm)',
              width: 'var(--control-size-sm)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'transparent',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            <FiSettings style={{ fontSize: 'var(--icon-size-md)' }} aria-hidden="true" />
          </button>
        </div>
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