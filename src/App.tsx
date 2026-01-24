/**
 * App.tsx
 * 
 * Root application component.
 * Renders the main application layout with three panels:
 * - LeftPanel: Folder tree and file management
 * - MindMap: Central canvas for mind map visualization
 * - RightPanel: Node details and editor
 * 
 * Also includes inline styles for resize handles used for panel resizing.
 */

import { useEffect, useRef } from 'react'
import './App.css'
import LeftPanel from './containers/LeftPanel'
import MindMap from './containers/MindMap'
import RightPanel from './containers/RightPanel'
import { uiText } from './constants/uiText'
import { GlobalHeaderBar } from './components/GlobalHeaderBar'
import Settings from './containers/Settings'
import { selectActiveTab, useMindMapStore } from './store/mindMapStore'
import { reconcileBookmarksOnStartup } from './utils/bookmarksManager'

/**
 * Main App component
 * 
 * Provides the root layout structure and accessibility labels.
 * The resize handle styles are defined inline for component-specific styling.
 */
function App() {
  const settingsOpen = useMindMapStore((s) => s.settingsOpen)
  const theme = useMindMapStore((s) => s.settings.theme)
  const settings = useMindMapStore((s) => s.settings)
  const undo = useMindMapStore((s) => s.undo)
  const redo = useMindMapStore((s) => s.redo)
  const deleteSelectedEdge = useMindMapStore((s) => s.deleteSelectedEdge)
  const selectedNodeId = useMindMapStore(
    (s) => selectActiveTab(s)?.selectedNodeId ?? null
  )
  const appWrapperRef = useRef<HTMLDivElement | null>(null)
  const isDesktopMode =
    typeof (window as any).__TAURI_INTERNALS__ !== 'undefined'
  const appModeLabel = isDesktopMode
    ? uiText.appFooter.desktopMode
    : uiText.appFooter.browserMode

  useEffect(() => {
    // Drive the global theme via CSS variables in `src/styles/theme.css`.
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    ;(globalThis as any).__PM_APP_MODE__ = isDesktopMode
      ? 'desktop'
      : 'browser'
  }, [isDesktopMode])

  useEffect(() => {
    if (!isDesktopMode) return
    void (async () => {
      const result = await reconcileBookmarksOnStartup({ settings })
      if (result.updated) {
        window.dispatchEvent(new CustomEvent('pm-bookmarks-updated'))
      }
    })()
  }, [isDesktopMode, settings])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'F11') return
      event.preventDefault()
      if (document.fullscreenElement) {
        void document.exitFullscreen?.()
        return
      }
      const target = appWrapperRef.current ?? document.documentElement
      void target.requestFullscreen?.()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useEffect(() => {
    const isTextInput = (el: Element | null): boolean => {
      if (!el) return false
      if (el instanceof HTMLInputElement) return true
      if (el instanceof HTMLTextAreaElement) return true
      if ((el as HTMLElement).isContentEditable) return true
      return false
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey) return
      if (isTextInput(document.activeElement)) return
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
        return
      }
      if (event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
      }
    }

    const onDeleteKey = (event: KeyboardEvent) => {
      if (isTextInput(document.activeElement)) return
      if (event.key === 'Delete') {
        if (selectedNodeId) {
          window.dispatchEvent(new CustomEvent('pm-request-delete-selected-node'))
          return
        }
        deleteSelectedEdge()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keydown', onDeleteKey)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keydown', onDeleteKey)
    }
  }, [undo, redo, deleteSelectedEdge, selectedNodeId])

  return (
    <>
      {/* Inline styles for panel resize handles */}
      <style>{`
        .pm-resize-handle {
          position: absolute;
          top: 0;
          bottom: 0;
          width: var(--space-2);
          cursor: col-resize;
          background: transparent;
          z-index: 10;
        }
        .pm-resize-handle--right { right: 0; }
        .pm-resize-handle--left { left: 0; }

        /* Subtle visual affordance on hover */
        .pm-resize-handle:hover {
          background: var(--border);
        }
      `}</style>

      <div className="pm-app-wrapper" ref={appWrapperRef}>
        <GlobalHeaderBar />
        {settingsOpen ? (
          <div className="pm-app" aria-label={uiText.ariaLabels.workspace}>
            <Settings />
          </div>
        ) : (
          <div className="pm-app" aria-label={uiText.ariaLabels.workspace}>
            <LeftPanel />
            <MindMap />
            <RightPanel />
          </div>
        )}
        <footer className="pm-app-footer" style={{ fontSize: '0.65rem' }}>
          {appModeLabel}
        </footer>
      </div>
    </>
  )
}

export default App