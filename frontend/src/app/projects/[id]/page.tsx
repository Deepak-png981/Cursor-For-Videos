"use client";

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getProject } from '@/lib/api';
import { useProjectStore } from '@/lib/store';
import { useProjectSocket } from '@/hooks/use-project-socket';
// Use the wrapper to provide ReactFlow context
import WorkflowVisualizer from '@/components/WorkflowVisualizerWrapper';
import VideoPlayer from '@/components/VideoPlayer';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  creating: 'Initializing',
  planning: 'Planning Scenes',
  generating_scenes: 'Generating Scenes',
  ready: 'Ready',
  error: 'Error',
};

export default function ProjectWorkspace() {
  const params = useParams();
  const projectId = params.id as string;
  const { setProject, setScenes, project, scenes } = useProjectStore();
  
  // Connect Socket
  useProjectSocket(projectId);

  // Initial Fetch
  useEffect(() => {
    if (projectId) {
      getProject(projectId).then(data => {
        setProject(data.project);
        setScenes(data.scenes);
      });
    }
  }, [projectId, setProject, setScenes]);

  if (!project) {
      return (
          <div className="flex h-screen w-full items-center justify-center flex-col gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-muted-foreground animate-pulse">Loading Project Workspace...</p>
          </div>
      );
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <header className="border-b p-4 flex justify-between items-center bg-card shadow-sm z-10">
        <div className="space-y-1">
           <h1 className="font-bold text-xl tracking-tight flex items-center gap-2">
             Video Project
             <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-mono">
                {projectId.slice(-6)}
             </span>
           </h1>
           <p className="text-sm text-muted-foreground truncate max-w-md" title={project.user_prompt}>
             {project.user_prompt}
           </p>
        </div>
        <div className="flex items-center gap-3">
            {project.status !== 'ready' && project.status !== 'error' && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {STATUS_LABELS[project.status] || "Processing..."}
                </div>
            )}
            <Badge variant={project.status === 'ready' ? 'default' : project.status === 'error' ? 'destructive' : 'secondary'}>
                {STATUS_LABELS[project.status] || project.status}
            </Badge>
        </div>
      </header>
      
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Visualizer */}
        <div className="w-2/3 border-r relative bg-gray-50/30">
             <div className="absolute top-4 left-4 z-10 bg-background/90 p-2 px-3 rounded-md shadow-sm border backdrop-blur-sm">
                 <h2 className="font-semibold text-sm flex items-center gap-2">
                    Workflow Visualization
                 </h2>
             </div>
             <WorkflowVisualizer />
        </div>
        
        {/* Right Panel: Player & List */}
        <div className="w-1/3 bg-card p-0 border-l flex flex-col h-full">
            <div className="p-4 border-b bg-card z-10">
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                    Preview
                </h2>
                <VideoPlayer />
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                <h2 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wider">Scenes Timeline</h2>
                <div className="space-y-2 relative">
                    {/* Connector Line */}
                    <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200 -z-10" />
                    
                    {scenes.sort((a,b) => a.index - b.index).map((s) => (
                        <div key={s.id} className="relative pl-10 py-1 group">
                            {/* Dot */}
                            <div className={`absolute left-[11px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm z-10 transition-colors ${
                                s.status === 'ready' ? 'bg-green-500' : 
                                s.status === 'error' ? 'bg-red-500' : 
                                s.status === 'rendering' || s.status === 'code_generating' || s.status === 'generating_assets'
                                  ? 'bg-blue-500 animate-pulse'
                                  : 'bg-gray-300'
                            }`} />
                            
                            <div className="text-sm p-3 bg-white border rounded-lg shadow-sm hover:shadow-md transition-all group-hover:border-blue-200">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-medium truncate text-foreground">{s.index + 1}. {s.title}</span>
                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 uppercase">
                                        {s.status === 'rendering' ? 'Generating' : s.status}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                                {(s.status === 'rendering' || s.status === 'generating_assets') && s.progress_message && (
                                    <div className="mt-2 text-[10px] text-blue-600 animate-pulse font-medium bg-blue-50 px-2 py-1 rounded">
                                        {s.progress_message}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
