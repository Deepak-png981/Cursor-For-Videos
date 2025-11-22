"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useProjectStore } from '@/lib/store';
import { Play, Pause, SkipForward, SkipBack, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

export default function VideoPlayer() {
  const { scenes } = useProjectStore();
  const sortedScenes = [...scenes].sort((a, b) => a.index - b.index);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [globalTime, setGlobalTime] = useState(0);
  const [durationMap, setDurationMap] = useState<Record<string, number>>({});
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update duration map when scenes load or metadata changes
  const onLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>, sceneId: string) => {
      const duration = e.currentTarget.duration;
      if (duration && !isNaN(duration)) {
          setDurationMap(prev => ({ ...prev, [sceneId]: duration }));
      }
  };

  // Helper to get best available duration
  const getDuration = (scene: any) => {
      if (durationMap[scene.id]) return durationMap[scene.id];
      return scene.duration || 10;
  };

  // Compute total duration reactively based on scenes and durationMap
  const totalDuration = useMemo(() => {
      const getDurationLocal = (scene: any) => {
          if (durationMap[scene.id]) return durationMap[scene.id];
          return scene.duration || 10;
      };
      return sortedScenes.reduce((acc, s) => acc + (s.status === 'ready' ? getDurationLocal(s) : 0), 0);
  }, [sortedScenes, durationMap]);
  
  // Derived state: Which scene is active at globalTime?
  const getActiveSceneInfo = (time: number) => {
      let accumulated = 0;
      for (const scene of sortedScenes) {
          if (scene.status !== 'ready') continue;
          const duration = getDuration(scene);
          if (time < accumulated + duration) {
              return { scene, localTime: time - accumulated, startTime: accumulated };
          }
          accumulated += duration;
      }
      // Fallback to last ready scene end
      return { scene: null, localTime: 0, startTime: accumulated };
  };

  const { scene: currentScene, localTime, startTime: currentSceneStartTime } = getActiveSceneInfo(globalTime);
  
  const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:8000";

  // Sync Video Element with Global State
  useEffect(() => {
      if (videoRef.current && currentScene && currentScene.video_url) {
          const video = videoRef.current;
          
          const currentSrc = video.getAttribute('src');
          const newSrc = `${API_BASE}${currentScene.video_url}`;
          
          if (currentSrc !== newSrc) {
              video.src = newSrc;
              video.load();
              video.currentTime = localTime;
              if (isPlaying) video.play().catch(() => {});
          } else {
              // If source is same, just sync time if desynced significantly
              if (Math.abs(video.currentTime - localTime) > 0.5) {
                  video.currentTime = localTime;
              }
          }
      }
  }, [currentScene, localTime, isPlaying, API_BASE]); // Add API_BASE dependency

  // Handle Time Update from Video
  const handleTimeUpdate = () => {
      if (videoRef.current && currentScene) {
          const newGlobalTime = currentSceneStartTime + videoRef.current.currentTime;
          if (Math.abs(newGlobalTime - globalTime) > 0.1) {
             setGlobalTime(newGlobalTime);
          }
      }
  };

  const handleEnded = () => {
      if (currentScene) {
          const duration = getDuration(currentScene);
          const nextGlobal = currentSceneStartTime + duration + 0.1; // nudge into next
          if (nextGlobal < totalDuration) {
              setGlobalTime(nextGlobal);
          } else {
              setIsPlaying(false);
              setGlobalTime(totalDuration);
          }
      }
  };

  const togglePlay = () => {
      if (totalDuration === 0) return;
      
      if (videoRef.current) {
          if (isPlaying) {
              videoRef.current.pause();
              setIsPlaying(false);
          } else {
              if (globalTime >= totalDuration) {
                  setGlobalTime(0);
              }
              videoRef.current.play().catch(() => {});
              setIsPlaying(true);
          }
      }
  };

  const handleSeek = (value: number[]) => {
      setGlobalTime(value[0]);
      // Determine new scene is handled by render logic + effect
  };

  const toggleFullscreen = () => {
      if (!containerRef.current) return;
      if (!document.fullscreenElement) {
          containerRef.current.requestFullscreen();
          setIsFullscreen(true);
      } else {
          document.exitFullscreen();
          setIsFullscreen(false);
      }
  };

  const formatTime = (time: number) => {
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
      <div ref={containerRef} className={`flex flex-col gap-2 ${isFullscreen ? 'bg-black p-10 h-screen justify-center' : ''}`}>
          <div className={`relative w-full bg-black rounded-lg overflow-hidden flex items-center justify-center ${isFullscreen ? 'flex-1' : 'aspect-video'}`}>
              {currentScene ? (
                  <video
                      ref={videoRef}
                      className="w-full h-full object-contain"
                      onTimeUpdate={handleTimeUpdate}
                      onEnded={handleEnded}
                      onLoadedMetadata={(e) => onLoadedMetadata(e, currentScene.id)}
                      controls={false}
                      onClick={togglePlay}
                  />
              ) : (
                  <div className="text-white text-sm text-center px-4">
                      {sortedScenes.length > 0 ? "Waiting for renders..." : "No scenes"}
                  </div>
              )}
          </div>
          
          <div className={`flex flex-col gap-2 ${isFullscreen ? 'bg-gray-900/80 p-4 rounded-lg text-white absolute bottom-10 left-10 right-10' : 'p-2 bg-muted/50 rounded-md border'}`}>
              {/* Global Seekbar */}
              <div className="flex items-center gap-3 text-xs font-mono">
                  <span>{formatTime(globalTime)}</span>
                  <Slider 
                      value={[globalTime]} 
                      max={totalDuration || 100} 
                      step={0.1}
                      onValueChange={handleSeek}
                      className="flex-1 cursor-pointer"
                  />
                  <span>{formatTime(totalDuration)}</span>
              </div>

              <div className="flex items-center justify-between">
                  <div className={`text-sm font-medium truncate max-w-[200px] ${isFullscreen ? 'text-white' : ''}`}>
                      {currentScene ? `Scene ${currentScene.index + 1}: ${currentScene.title}` : "Loading..."}
                  </div>
                  
                  <div className="flex gap-2 items-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setGlobalTime(Math.max(0, globalTime - 5))}>
                          <SkipBack className="w-4 h-4" />
                      </Button>
                      
                      <Button onClick={togglePlay} size="icon" className="h-8 w-8" disabled={totalDuration === 0}>
                          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </Button>
                      
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setGlobalTime(Math.min(totalDuration, globalTime + 5))}>
                          <SkipForward className="w-4 h-4" />
                      </Button>

                      <div className="w-px h-4 bg-gray-300 mx-1" />

                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleFullscreen}>
                          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                      </Button>
                  </div>
              </div>
          </div>
      </div>
  );
}
