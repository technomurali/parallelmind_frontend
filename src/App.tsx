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
import { FileManager } from './data/fileManager'
import { CognitiveNotesManager } from './extensions/cognitiveNotes/data/cognitiveNotesManager'
import { composeCognitiveNotesGraph } from './extensions/cognitiveNotes/utils/composeCognitiveNotesGraph'

const SESSION_STORAGE_KEY = 'parallelmind.session.v1'

type SessionTabEntry = {
  moduleType: 'parallelmind' | 'cognitiveNotes'
  rootPath: string
  title?: string
  lastViewport?: { x: number; y: number; zoom: number } | null
}

type SessionState = {
  tabs: SessionTabEntry[]
  activeIndex: number
}

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
  const tabs = useMindMapStore((s) => s.tabs)
  const activeTabId = useMindMapStore((s) => s.activeTabId)
  const selectedNodeId = useMindMapStore(
    (s) => selectActiveTab(s)?.selectedNodeId ?? null
  )
  const appWrapperRef = useRef<HTMLDivElement | null>(null)
  const sessionRestoreRef = useRef(false)
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
    if (sessionRestoreRef.current) return
    sessionRestoreRef.current = true
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) {
      sessionRestoreRef.current = false
      return
    }
    let parsed: SessionState | null = null
    try {
      parsed = JSON.parse(raw) as SessionState
    } catch {
      parsed = null
    }
    if (!parsed || !Array.isArray(parsed.tabs) || parsed.tabs.length === 0) {
      sessionRestoreRef.current = false
      return
    }

    const store = useMindMapStore.getState()
    const isEmptyTab = (tab: typeof store.tabs[number]) => {
      const nodesEmpty = (tab.nodes ?? []).length === 0
      const edgesEmpty = (tab.edges ?? []).length === 0
      return (
        tab.moduleType === null &&
        nodesEmpty &&
        edgesEmpty &&
        tab.rootFolderJson == null &&
        tab.cognitiveNotesRoot == null
      )
    }
    if (!store.tabs.every(isEmptyTab)) {
      sessionRestoreRef.current = false
      return
    }

    const fileManager = new FileManager()
    const cognitiveNotesManager = new CognitiveNotesManager()
    const entries = parsed.tabs.filter(
      (entry) =>
        entry &&
        (entry.moduleType === 'parallelmind' ||
          entry.moduleType === 'cognitiveNotes') &&
        typeof entry.rootPath === 'string' &&
        entry.rootPath.trim()
    )
    if (entries.length === 0) {
      sessionRestoreRef.current = false
      return
    }

    void (async () => {
      const createdTabIds: string[] = []
      for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i]
        const tabId = i === 0 ? store.activeTabId : store.createTab()
        if (!tabId) continue
        store.setActiveTab(tabId)
        if (entry.moduleType === 'parallelmind') {
          try {
            const result = await fileManager.loadOrCreateRootFolderJsonFromPath(
              entry.rootPath
            )
            store.setRoot(null, result.root)
            store.selectNode('00')
            if (entry.lastViewport) {
              store.setLastViewport(entry.lastViewport)
              store.setShouldFitView(false)
            }
          } catch {
            continue
          }
        } else {
          try {
            const result =
              await cognitiveNotesManager.loadOrCreateCognitiveNotesJsonFromPath(
                entry.rootPath
              )
            store.setTabTitle(tabId, result.root.name ?? 'Cognitive Notes')
            store.setTabModule(tabId, 'cognitiveNotes')
            store.setCognitiveNotesRoot(result.root)
            store.setCognitiveNotesSource(null, entry.rootPath)
            const { nodes, edges, rootNodeId } = composeCognitiveNotesGraph(
              result.root,
              {
                nodeSize: settings.appearance.nodeSize,
                columns: settings.appearance.gridColumns,
                columnGap: settings.appearance.gridColumnGap,
                rowGap: settings.appearance.gridRowGap,
              }
            )
            store.setNodes(nodes)
            store.setEdges(edges)
            store.selectNode(rootNodeId)
            if (entry.lastViewport) {
              store.setLastViewport(entry.lastViewport)
              store.setShouldFitView(false)
            } else {
              store.setShouldFitView(true)
            }
          } catch {
            continue
          }
        }
        createdTabIds.push(tabId)
      }
      const activeIndex =
        typeof parsed.activeIndex === 'number' ? parsed.activeIndex : 0
      const targetId = createdTabIds[activeIndex] ?? createdTabIds[0]
      if (targetId) store.setActiveTab(targetId)
      sessionRestoreRef.current = false
    })()
  }, [isDesktopMode, settings])

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
    if (!isDesktopMode) return
    if (sessionRestoreRef.current) return
    const tabEntries: SessionTabEntry[] = []
    const activeIndex = tabs.findIndex((tab) => tab.id === activeTabId)
    for (const tab of tabs) {
      if (tab.moduleType === 'parallelmind' && tab.rootFolderJson?.path) {
        tabEntries.push({
          moduleType: 'parallelmind',
          rootPath: tab.rootFolderJson.path,
          title: tab.title,
          lastViewport: tab.lastViewport ?? null,
        })
      } else if (
        tab.moduleType === 'cognitiveNotes' &&
        tab.cognitiveNotesRoot?.path
      ) {
        tabEntries.push({
          moduleType: 'cognitiveNotes',
          rootPath: tab.cognitiveNotesRoot.path,
          title: tab.title,
          lastViewport: tab.lastViewport ?? null,
        })
      }
    }
    const payload: SessionState = {
      tabs: tabEntries,
      activeIndex: activeIndex >= 0 ? activeIndex : 0,
    }
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // ignore persistence errors
    }
  }, [isDesktopMode, tabs, activeTabId])

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