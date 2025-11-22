from typing import List, TypedDict, Optional, Annotated
import operator

class SceneState(TypedDict, total=False):
    scene_id: str
    project_id: str
    index: int
    title: str
    description: str
    visual_plan: Optional[str]
    voiceover: Optional[str]
    image_prompt: Optional[str]
    video_url: Optional[str]
    target_duration_seconds: Optional[float]
    status: str
    retry_count: int
    last_error: Optional[str]

class SceneUpdate(TypedDict):
    scene_id: str
    status: str
    video_url: Optional[str]

class ProjectState(TypedDict):
    project_id: str
    user_prompt: str
    scenes: List[SceneState] 
    completed_scenes: Annotated[List[SceneUpdate], operator.add]
    status: str
    error: Optional[str]
