import './App.css'
import LeftPanel from './containers/LeftPanel'
import MindMap from './containers/MindMap'
import RightPanel from './containers/RightPanel'
import { uiText } from './constants/uiText'

function App() {
  return (
    <>
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

        /* subtle visual affordance */
        .pm-resize-handle:hover {
          background: var(--border);
        }
      `}</style>

      <div className="pm-app" aria-label={uiText.ariaLabels.workspace}>
        <LeftPanel />
        <MindMap />
        <RightPanel />
      </div>
    </>
  )
}

export default App