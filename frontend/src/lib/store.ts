import { create } from 'zustand';
import { Project, Scene } from './api';

interface ProjectState {
  project: Project | null;
  scenes: Scene[];
  isLoading: boolean;
  setProject: (project: Project) => void;
  setScenes: (scenes: Scene[]) => void;
  updateScene: (sceneId: string, update: Partial<Scene>) => void;
  addScenes: (newScenes: Scene[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  project: null,
  scenes: [],
  isLoading: false,
  setProject: (project) => set({ project }),
  setScenes: (scenes) => set({ scenes }),
  updateScene: (sceneId, update) =>
    set((state) => ({
      scenes: state.scenes.map((s) =>
        s.id === sceneId ? { ...s, ...update } : s
      ),
    })),
  addScenes: (newScenes) =>
    set((state) => ({
      scenes: [...state.scenes, ...newScenes],
    })),
  setLoading: (loading) => set({ isLoading: loading }),
}));



