from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class PyObjectId(str):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not isinstance(v, (str, object)):
             raise ValueError("Invalid ObjectId")
        return str(v)

class ProjectStatus(str, Enum):
    CREATING = "creating"
    PLANNING = "planning"
    GENERATING = "generating"
    RENDERING = "rendering"
    COMBINING = "combining"
    READY = "ready"
    ERROR = "error"

class WorkflowNodeStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETE = "complete"
    ERROR = "error"

class WorkflowNode(BaseModel):
    id: str
    type: str
    label: str
    status: WorkflowNodeStatus = WorkflowNodeStatus.PENDING
    meta: Dict[str, Any] = {}
    position: Dict[str, float] = {"x": 0, "y": 0}

class WorkflowEdge(BaseModel):
    id: str
    source: str
    target: str

class Workflow(BaseModel):
    nodes: List[WorkflowNode] = []
    edges: List[WorkflowEdge] = []

class Project(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    user_prompt: str
    status: ProjectStatus = ProjectStatus.CREATING
    workflow: Workflow = Workflow()
    target_duration: int = 60
    final_video_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda dt: dt.isoformat()}

class SceneStatus(str, Enum):
    PLANNED = "planned"
    CODE_GENERATING = "code_generating"
    RENDERING = "rendering"
    READY = "ready"
    ERROR = "error"

class Scene(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    project_id: str
    index: int
    title: str
    description: str
    status: SceneStatus = SceneStatus.PLANNED
    code: Optional[str] = None
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration: Optional[float] = None
    logs: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class ChatRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"

class ChatMessage(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    project_id: str
    role: ChatRole
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

