"use client";

import { ReactFlowProvider } from 'reactflow';
import WorkflowVisualizerContent from './WorkflowVisualizer';

export default function WorkflowVisualizer() {
  return (
    <ReactFlowProvider>
      <WorkflowVisualizerContent />
    </ReactFlowProvider>
  );
}

