from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.output_parsers import JsonOutputParser
from langgraph.types import Send
from bson import ObjectId

from ..db.database import get_database
from ..db.models import Scene, SceneStatus
from ..services.socket_manager import manager
from ..services.video_service import video_service
from ..core.prompts import SCENE_PLANNING_PROMPT
from ..core.config import get_settings
from .state import ProjectState, SceneState

settings = get_settings()

planning_llm = ChatOpenAI(model="gpt-4o", api_key=settings.OPENAI_API_KEY)

async def plan_scenes(state: ProjectState):
    print("Planning scenes...")
    db = await get_database()
    project_id = state["project_id"]
    prompt = state["user_prompt"]
    
    try:
        project = await db.projects.find_one({"_id": ObjectId(project_id)})
    except Exception:
        project = None
    
    target_duration = (project or {}).get("target_duration", 60)
    
    messages = [
        SystemMessage(content=SCENE_PLANNING_PROMPT),
        HumanMessage(content=prompt)
    ]
    
    response = await planning_llm.ainvoke(messages)
    parser = JsonOutputParser()
    try:
        scenes_data = parser.parse(response.content)
    except:
        print("Failed to parse JSON, using dummy scene")
        scenes_data = [{"title": "Scene 1", "description": prompt, "visual_plan": "Show text", "voiceover": "Hello"}]

    num_scenes = max(len(scenes_data), 1)
    per_scene_duration = float(target_duration) / float(num_scenes)

    # Save scenes to DB
    scene_specs = []
    for i, s in enumerate(scenes_data):
        new_scene = Scene(
            project_id=project_id,
            index=i,
            title=s["title"],
            description=s.get("description", s.get("visual_plan", "Scene")),
            status=SceneStatus.PLANNED,
            duration=per_scene_duration,
        )
        scene_dump = new_scene.model_dump(by_alias=True)
        if scene_dump.get("_id") is None:
            del scene_dump["_id"]
        result = await db.scenes.insert_one(scene_dump)
        
        scene_specs.append({
            "scene_id": str(result.inserted_id),
            "project_id": project_id,
            "index": i,
            "title": s["title"],
            "description": s.get("description", ""),
            "visual_plan": s.get("visual_plan", ""),
            "voiceover": s.get("voiceover"),
            "target_duration_seconds": per_scene_duration,
            "status": "planned",
            "retry_count": 0,
            "last_error": None
        })
    
    await manager.broadcast({
        "type": "scenes_planned",
        "scenes": scene_specs
    }, project_id)
    
    return {"scenes": scene_specs, "completed_scenes": []}

async def generate_and_render_scene(state: SceneState):
    scene_id = state["scene_id"]
    project_id = state["project_id"]
    index = state["index"]
    title = state.get("title", f"Scene {state['index'] + 1}")
    description = state.get("description", "")
    visual_plan = state.get("visual_plan", description)
    voiceover = state.get("voiceover")
    target_duration_seconds = state.get("target_duration_seconds")
    retry_count = state.get("retry_count", 0)
    last_error = state.get("last_error")
    
    print(f"Processing scene {scene_id} (Attempt {retry_count + 1})...")
    
    status = SceneStatus.ERROR
    video_url = None
    error_message = None

    # Define progress callback
    async def on_progress(msg: str):
        await manager.broadcast({
            "type": "scene_update",
            "scene_id": scene_id,
            "status": "rendering",
            "progress_message": msg,
        }, project_id)

    try:
        if target_duration_seconds is None:
            db = await get_database()
            try:
                project = await db.projects.find_one({"_id": ObjectId(project_id)})
            except Exception:
                project = None
            target_duration = (project or {}).get("target_duration", 60)
            scene_count = await db.scenes.count_documents({"project_id": project_id}) or 1
            target_duration_seconds = float(target_duration) / float(scene_count)
        
        db = await get_database()
        await db.scenes.update_one(
            {"_id": ObjectId(scene_id)},
            {"$set": {"status": SceneStatus.RENDERING}}
        )
        
        await on_progress("Starting generation...")
        
        video_url = await video_service.generate_video(
            project_id=project_id,
            scene_index=index,
            title=title,
            description=description,
            visual_plan=visual_plan,
            voiceover=voiceover,
            target_duration_seconds=target_duration_seconds,
            on_progress=on_progress
        )
        status = SceneStatus.READY

    except Exception as e:
        print(f"Video generation failed: {e}")
        error_message = str(e)
        status = SceneStatus.ERROR

    if status == SceneStatus.ERROR and retry_count < 2:
        print(f"Retrying scene {scene_id}...")
        return Send("generate_and_render_scene", {
            **state,
            "retry_count": retry_count + 1,
            "last_error": error_message,
            "target_duration_seconds": target_duration_seconds,
        })

    db = await get_database()
    await db.scenes.update_one(
        {"_id": ObjectId(scene_id)},
        {"$set": {"video_url": video_url, "status": status, "duration": target_duration_seconds}}
    )
    
    await manager.broadcast({
        "type": "scene_update",
        "scene_id": scene_id,
        "status": status,
        "video_url": video_url
    }, project_id)
    
    return {
        "completed_scenes": [{
            "scene_id": scene_id,
            "status": status,
            "video_url": video_url
        }]
    }

def continue_to_scenes(state: ProjectState):
    return [Send("generate_and_render_scene", s) for s in state["scenes"]]
