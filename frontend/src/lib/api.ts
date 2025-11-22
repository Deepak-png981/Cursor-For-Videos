const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export interface Project {
  id: string;
  user_prompt: string;
  status: string;
  target_duration: number;
  final_video_url?: string;
}

export interface Scene {
  id: string;
  project_id: string;
  index: number;
  title: string;
  description: string;
  status: "planned" | "code_generating" | "rendering" | "ready" | "error" | "generating_assets";
  progress_message?: string;
  code?: string;
  video_url?: string;
  thumbnail_url?: string;
}

export async function createProject(prompt: string): Promise<{ project_id: string }> {
  const res = await fetch(`${API_BASE_URL}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error("Failed to create project");
  return res.json();
}

export async function getProject(projectId: string): Promise<{ project: Project; scenes: Scene[] }> {
  const res = await fetch(`${API_BASE_URL}/projects/${projectId}`);
  if (!res.ok) throw new Error("Failed to fetch project");
  return res.json();
}




