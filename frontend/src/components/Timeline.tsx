"use client";

import { Scene } from '@/lib/api';

interface TimelineProps {
  scenes: Scene[];
  currentSceneId?: string;
  onSceneClick: (index: number) => void;
}

export default function Timeline({ scenes, currentSceneId, onSceneClick }: TimelineProps) {
  const sortedScenes = [...scenes].sort((a, b) => a.index - b.index);
  const totalScenes = sortedScenes.length;

  return (
    <div className="flex w-full h-2 bg-gray-200 rounded-full overflow-hidden cursor-pointer mt-2">
      {sortedScenes.map((scene, index) => {
        const isReady = scene.status === 'ready';
        const isError = scene.status === 'error';
        const isActive = scene.id === currentSceneId;
        
        let color = 'bg-gray-300';
        if (isReady) color = 'bg-green-500';
        if (isError) color = 'bg-red-500';
        if (isActive) color = 'bg-blue-600'; // Highlight active

        return (
          <div
            key={scene.id}
            className={`h-full transition-all hover:opacity-80 ${color} ${isActive ? 'opacity-100 ring-2 ring-blue-300 z-10' : 'opacity-70'}`}
            style={{ width: `${100 / totalScenes}%` }}
            onClick={() => onSceneClick(index)}
            title={`Scene ${index + 1}: ${scene.title}`}
          />
        );
      })}
    </div>
  );
}

