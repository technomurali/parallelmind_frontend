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
import { useEffect, useMemo, useRef, useState } from 'react';
import { uiText } from '../../constants/uiText';
import { FileManager } from '../../data/fileManager';
import { useAutoSave } from '../../hooks/useAutoSave';

/**
 * RightPanel component
 * 
 * Renders the right sidebar with node details and editor.
 * Handles panel resizing via mouse drag on the left resize handle.
 */
export default function RightPanel() {
  const rightPanelWidth = useMindMapStore((s) => s.rightPanelWidth);
  const setRightPanelWidth = useMindMapStore((s) => s.setRightPanelWidth);
  const selectedNodeId = useMindMapStore((s) => s.selectedNodeId);
  const nodes = useMindMapStore((s) => s.nodes);
  const updateNodeData = useMindMapStore((s) => s.updateNodeData);
  const rootDirectoryHandle = useMindMapStore((s) => s.rootDirectoryHandle);
  const rootFolderJson = useMindMapStore((s) => s.rootFolderJson);

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

  const fileManager = useMemo(() => new FileManager(), []);

  // Draft state lives only in this container to satisfy "single container rule".
  const [draft, setDraft] = useState({ name: '', title: '', description: '' });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [dirty, setDirty] = useState(false);

  // Pull selected node data from the centralized store and hydrate the editor when selection changes.
  useEffect(() => {
    if (!selectedNodeId) {
      setDraft({ name: '', title: '', description: '' });
      setSaveStatus('idle');
      setDirty(false);
      return;
    }

    const node = (nodes ?? []).find((n: any) => n?.id === selectedNodeId);
    const data = (node?.data ?? {}) as any;

    // Hydrate draft without triggering "Saving..." state.
    setDraft({
      name: typeof data.name === 'string' ? data.name : '',
      title: typeof data.title === 'string' ? data.title : '',
      description: typeof data.description === 'string' ? data.description : '',
    });
    setSaveStatus('idle');
    setDirty(false);
  }, [nodes, selectedNodeId]);

  // Save callback: updates in-memory state and persists only when we already have a persistence mechanism.
  const commitSave = async () => {
    if (!dirty || !selectedNodeId) return;

    // Always update in-memory node data (the UI is driven from centralized state).
    updateNodeData(selectedNodeId, {
      name: draft.name,
      title: draft.title,
      description: draft.description,
    });

    // Persist to root-folder.json only for the root node (existing mechanism).
    if (selectedNodeId === '00' && rootDirectoryHandle) {
      await fileManager.writeRootFolderJson(rootDirectoryHandle, {
        id: 0,
        node_id: '00',
        level_id: 0,
        name: draft.name,
        title: draft.title,
        description: draft.description,
        // Preserve existing children (depth logic is out of scope, but we must not wipe it).
        children: rootFolderJson?.children ?? [],
      });
    }

    setDirty(false);
    setSaveStatus('saved');
  };

  // Debounced auto-save: "Saving..." while debounce is active, "Saved" after commit.
  useAutoSave(
    () => {
      void commitSave();
    },
    3000,
    [draft.name, draft.title, draft.description, selectedNodeId, dirty],
    dirty,
  );

  const onFieldChange =
    (field: 'name' | 'title' | 'description') =>
    (value: string) => {
      setDraft((d) => ({ ...d, [field]: value }));
      // Only show "Saving..." when the user has actually made edits.
      setDirty(true);
      setSaveStatus('saving');
    };

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
          {!selectedNodeId ? (
            <div className="pm-placeholder">{uiText.placeholders.nodeDetails}</div>
          ) : (
            <div
              aria-label={uiText.ariaLabels.nodeEditor}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
                height: '100%',
                // Ensure the details container spans the full inner width of the panel.
                width: '100%',
                minWidth: 0,
              }}
            >
              <div style={{ display: 'grid', gap: 'var(--space-2)', width: '100%', minWidth: 0 }}>
                <label style={{ display: 'grid', gap: 'var(--space-2)' }}>
                  <div style={{ fontWeight: 600 }}>{uiText.fields.nodeDetails.name}</div>
                  <input
                    value={draft.name}
                    onChange={(e) => onFieldChange('name')(e.target.value)}
                    placeholder={uiText.placeholders.nodeName}
                    aria-label={uiText.fields.nodeDetails.name}
                    style={{
                      width: '100%',
                      minWidth: 0,
                      boxSizing: 'border-box',
                      borderRadius: 'var(--radius-md)',
                      border: 'var(--border-width) solid var(--border)',
                      padding: 'var(--space-2)',
                      background: 'var(--surface-1)',
                      color: 'var(--text)',
                      fontFamily: 'var(--font-family)',
                    }}
                  />
                </label>

                <label style={{ display: 'grid', gap: 'var(--space-2)' }}>
                  <div style={{ fontWeight: 600 }}>{uiText.fields.nodeDetails.title}</div>
                  <input
                    value={draft.title}
                    onChange={(e) => onFieldChange('title')(e.target.value)}
                    placeholder={uiText.placeholders.nodeTitle}
                    aria-label={uiText.fields.nodeDetails.title}
                    style={{
                      width: '100%',
                      minWidth: 0,
                      boxSizing: 'border-box',
                      borderRadius: 'var(--radius-md)',
                      border: 'var(--border-width) solid var(--border)',
                      padding: 'var(--space-2)',
                      background: 'var(--surface-1)',
                      color: 'var(--text)',
                      fontFamily: 'var(--font-family)',
                    }}
                  />
                </label>

                <label style={{ display: 'grid', gap: 'var(--space-2)' }}>
                  <div style={{ fontWeight: 600 }}>{uiText.fields.nodeDetails.description}</div>
                  <textarea
                    value={draft.description}
                    onChange={(e) => onFieldChange('description')(e.target.value)}
                    placeholder={uiText.placeholders.nodeDescription}
                    aria-label={uiText.fields.nodeDetails.description}
                    rows={6}
                    style={{
                      width: '100%',
                      minWidth: 0,
                      boxSizing: 'border-box',
                      resize: 'vertical',
                      borderRadius: 'var(--radius-md)',
                      border: 'var(--border-width) solid var(--border)',
                      padding: 'var(--space-2)',
                      background: 'var(--surface-1)',
                      color: 'var(--text)',
                      fontFamily: 'var(--font-family)',
                    }}
                  />
                </label>
              </div>

              {/* Save status is always visible at the bottom of the container. */}
              <div
                style={{
                  marginTop: 'auto',
                  opacity: 0.9,
                  // Ensure status text is small like normal body text (not header-like).
                  fontSize: '0.75em',
                  fontWeight: 'normal',
                }}
              >
                {saveStatus === 'saving'
                  ? uiText.statusMessages.saving
                  : saveStatus === 'saved'
                    ? uiText.statusMessages.saved
                    : uiText.statusMessages.idle}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="pm-panel__collapsed" aria-hidden="true" />
      )}
    </aside>
  );
}