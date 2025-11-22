import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useProjectStore } from '../lib/store';

// Since we used FastAPI Websocket (native), not socket.io, we should use native WebSocket or socket.io adapter.
// The backend code uses `websocket_endpoint` which is a raw WebSocket.
// So I should use `WebSocket` API, not `socket.io-client`.
// Or I can use `react-use-websocket` but native is fine.

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/api/ws";

export function useProjectSocket(projectId: string | null) {
  const { updateScene, setScenes, setProject } = useProjectStore();

  useEffect(() => {
    if (!projectId) return;

    const ws = new WebSocket(`${WS_BASE_URL}/${projectId}`);

    ws.onopen = () => {
      console.log("Connected to WebSocket");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("WS Message:", data);

        switch (data.type) {
          case "scenes_planned":
             // Backend sends "scenes" which are Scene objects
             // We need to map them if keys differ, but they look compatible
             // The backend sends: { "scene_id", "project_id", "index", "title", "description", "status" }
             // Frontend Scene expects: { id, ... }
             // Check backend nodes.py: it sends `scene_specs` with `scene_id`.
             // I should map `scene_id` to `id`.
             const scenes = data.scenes.map((s: any) => ({
               ...s,
               id: s.scene_id, 
             }));
             setScenes(scenes);
             break;
             
          case "scene_update":
             // { scene_id, status, code?, video_url? }
             updateScene(data.scene_id, {
               status: data.status,
               code: data.code,
               video_url: data.video_url
             });
             break;
             
          case "project_complete":
             // Optional: Refetch project or just notify
             break;
        }
      } catch (err) {
        console.error("Error parsing WS message", err);
      }
    };

    ws.onclose = () => {
      console.log("Disconnected from WebSocket");
    };

    return () => {
      ws.close();
    };
  }, [projectId, updateScene, setScenes]);
}

