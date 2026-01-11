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

import './App.css'
import LeftPanel from './containers/LeftPanel'
import MindMap from './containers/MindMap'
import RightPanel from './containers/RightPanel'
import { uiText } from './constants/uiText'

/**
 * Main App component
 * 
 * Provides the root layout structure and accessibility labels.
 * The resize handle styles are defined inline for component-specific styling.
 */
function App() {
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

      <div className="pm-app-wrapper">
        <div className="pm-app" aria-label={uiText.ariaLabels.workspace}>
          <LeftPanel />
          <MindMap />
          <RightPanel />
        </div>
        <footer className="pm-app-footer"></footer>
      </div>
    </>
  )
}

export default App