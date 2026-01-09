import ReactFlow, { Background } from 'reactflow';
import 'reactflow/dist/style.css';
import { uiText } from '../../constants/uiText';

// Main MindMap container component
export default function MindMap() {
  return (
    <main className="pm-center" aria-label={uiText.ariaLabels.mindMapCanvas}>
      <div className="pm-canvas">
        <ReactFlow nodes={[]} edges={[]} fitView>
          <Background />
        </ReactFlow>
      </div>
    </main>
  );
}