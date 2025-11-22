"use client";

import { useMemo, useEffect, useCallback } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  Node, 
  Edge, 
  Handle, 
  Position,
  useReactFlow,
  useNodesState,
  useEdgesState,
  NodeDragHandler,
  ConnectionLineType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useProjectStore } from '@/lib/store';
import { Scene } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, PlayCircle, GripVertical, Image as ImageIcon } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  'planned': 'Planned',
  'generating_assets': 'Creating Assets',
  'code_generating': 'Writing Script',
  'rendering': 'Animating',
  'ready': 'Ready',
  'error': 'Failed',
};

const STATUS_COLORS: Record<string, string> = {
  'planned': 'border-gray-200',
  'generating_assets': 'border-purple-400',
  'code_generating': 'border-amber-400',
  'rendering': 'border-blue-400',
  'ready': 'border-green-500',
  'error': 'border-red-500',
};

// Custom Node for Scene
const SceneNode = ({ data }: { data: Scene }) => {
  return (
    <Card className={`w-72 shadow-lg border-2 transition-all duration-300 group backdrop-blur-sm bg-white/90 hover:scale-[1.02] ${STATUS_COLORS[data.status] || 'border-gray-200'}`}>
      <CardHeader className="p-3 pb-2 bg-gradient-to-b from-transparent to-gray-50/50">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 overflow-hidden">
             <GripVertical className="w-4 h-4 text-gray-400 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity" />
             <CardTitle className="text-sm font-semibold truncate max-w-[160px]" title={data.title}>{data.title}</CardTitle>
          </div>
          <div className="flex gap-1">
            {data.status === 'generating_assets' && <ImageIcon className="w-3 h-3 animate-pulse text-purple-500" />}
            {data.status === 'code_generating' && <Loader2 className="w-3 h-3 animate-spin text-amber-500" />}
            {data.status === 'rendering' && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
            {data.status === 'ready' && <CheckCircle className="w-3 h-3 text-green-500" />}
            {data.status === 'error' && <XCircle className="w-3 h-3 text-red-500" />}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 text-xs text-gray-600">
        <p className="line-clamp-3 mb-3 leading-relaxed">{data.description}</p>
        <div className="flex justify-between items-center pt-2 border-t border-gray-100">
           <span className="px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-gray-100 text-gray-600">
             {STATUS_LABELS[data.status] || data.status}
           </span>
           {data.video_url && <PlayCircle className="w-5 h-5 text-green-600 hover:text-green-700 cursor-pointer transition-colors"/>}
        </div>
      </CardContent>
      <Handle type="target" position={Position.Left} className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white" />
    </Card>
  );
};

const nodeTypes = { scene: SceneNode };

export default function WorkflowVisualizer() {
  const { scenes, project, setScenes } = useProjectStore();
  const { fitView } = useReactFlow();
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Sync Store -> Graph
  useEffect(() => {
    if (!scenes.length) return;

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Start Node (Hero Style)
    newNodes.push({
      id: 'start',
      type: 'input',
      data: { label: 'Concept' },
      position: { x: 0, y: 0 },
      draggable: false,
      style: { 
        background: 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)', 
        color: '#fff', 
        border: 'none', 
        borderRadius: '12px', 
        padding: '12px 24px',
        fontWeight: 'bold',
        fontSize: '14px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      }
    });

    let previousNodeId = 'start';
    const sortedScenes = [...scenes].sort((a, b) => a.index - b.index);
    
    // Curved Layout
    // We can use a slight sine wave or just horizontal for clarity. 
    // Let's stick to horizontal but with nice spacing.
    
    sortedScenes.forEach((scene, i) => {
      newNodes.push({
        id: scene.id,
        type: 'scene',
        data: scene,
        position: { x: 250 + (i * 350), y: i % 2 === 0 ? 0 : 50 }, // Slight staggered layout for visual interest
        draggable: true,
      });

      newEdges.push({
        id: `e-${previousNodeId}-${scene.id}`,
        source: previousNodeId,
        target: scene.id,
        animated: ['code_generating', 'rendering', 'generating_assets'].includes(scene.status),
        style: { stroke: '#9ca3af', strokeWidth: 2 },
        type: 'smoothstep', // Smoothstep looks cleaner for "pipeline" view than bezier often
      });

      previousNodeId = scene.id;
    });

    setNodes(newNodes);
    setEdges(newEdges);
    
    // Initial Fit
    if (nodes.length === 0) {
        setTimeout(() => fitView({ padding: 0.5, duration: 1000, maxZoom: 1.2 }), 100);
    }
  }, [scenes, fitView, setNodes, setEdges]);

  const onNodeDragStop: NodeDragHandler = useCallback(async (_event, node) => {
    if (node.type !== 'scene') return;

    const newX = node.position.x;
    // 350 is the gap
    let newIndex = Math.round((newX - 250) / 350);
    newIndex = Math.max(0, Math.min(newIndex, scenes.length - 1));

    const currentScene = scenes.find(s => s.id === node.id);
    if (!currentScene || currentScene.index === newIndex) return;

    const updatedScenes = [...scenes];
    const oldIndex = currentScene.index;
    
    const [movedScene] = updatedScenes.splice(oldIndex, 1);
    updatedScenes.splice(newIndex, 0, movedScene);
    
    const reindexedScenes = updatedScenes.map((s, idx) => ({ ...s, index: idx }));
    setScenes(reindexedScenes);

    try {
        const sceneIds = reindexedScenes.map(s => s.id);
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${project?.id}/reorder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sceneIds)
        });
    } catch (error) {
        console.error("Failed to reorder scenes:", error);
    }

  }, [scenes, project?.id, setScenes]);

  return (
    <div className="h-full w-full min-h-[500px] bg-slate-50" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
        nodesDraggable={true}
        nodesConnectable={false}
        minZoom={0.5}
        maxZoom={1.5}
      >
        <Background gap={25} size={1} color="#cbd5e1" variant="dots" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
