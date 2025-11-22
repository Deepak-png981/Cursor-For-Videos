from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.output_parsers import JsonOutputParser
from langgraph.types import Send
from bson import ObjectId

from ..db.database import get_database
from ..db.models import Project, Scene, SceneStatus
from ..services.manim import manim_service
from ..services.socket_manager import manager
from ..services.image_gen import image_service
from ..core.prompts import MANIM_SYSTEM_PROMPT, SCENE_PLANNING_PROMPT
from ..core.config import get_settings
from .state import ProjectState, SceneState

settings = get_settings()

# Planning LLM - Uses smarter model for better creativity
planning_llm = ChatOpenAI(model="gpt-4o", api_key=settings.OPENAI_API_KEY)
# Coding LLM - Uses faster/standard model (gpt-4o is good for code too)
coding_llm = ChatOpenAI(model="gpt-4o", api_key=settings.OPENAI_API_KEY)

async def plan_scenes(state: ProjectState):
    print("Planning scenes...")
    db = await get_database()
    project_id = state["project_id"]
    prompt = state["user_prompt"]
    
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
        scenes_data = [{"title": "Scene 1", "description": prompt, "visual_plan": "Show text", "voiceover": "Hello", "image_prompt": None}]

    # Save scenes to DB
    scene_specs = []
    for i, s in enumerate(scenes_data):
        new_scene = Scene(
            project_id=project_id,
            index=i,
            title=s["title"],
            description=s.get("description", s.get("visual_plan", "Scene")),
            status=SceneStatus.PLANNED
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
            "image_prompt": s.get("image_prompt"),
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
    visual_plan = state.get("visual_plan", state.get("description", ""))
    image_prompt = state.get("image_prompt")
    retry_count = state.get("retry_count", 0)
    last_error = state.get("last_error")
    
    print(f"Processing scene {scene_id} (Attempt {retry_count + 1})...")
    
    # 1. Generate Image (if needed and not already generated)
    image_path = state.get("image_path") # Check if passed from previous retry or if we need to gen
    
    if image_prompt and not image_path and retry_count == 0:
        print(f"Generating image for scene {scene_id}...")
        await manager.broadcast({
            "type": "scene_update",
            "scene_id": scene_id,
            "status": "generating_assets" # Custom status for UI if we want
        }, project_id)
        
        image_path = await image_service.generate_image(image_prompt, project_id)
    
    # 2. Generate Code
    await manager.broadcast({
        "type": "scene_update",
        "scene_id": scene_id,
        "status": "code_generating"
    }, project_id)
    
    messages = [
        SystemMessage(content=MANIM_SYSTEM_PROMPT.format(
            visual_plan=visual_plan,
            image_path=image_path or "None"
        )),
        HumanMessage(content="Generate the Manim code for this scene.")
    ]
    
    if last_error:
        # Provide specific feedback based on error type
        error_feedback = f"Previous attempt failed with error: {last_error}\n"
        if "NameError" in last_error:
            error_feedback += "Fix: You used an undefined variable or color. Use standard Manim colors (RED, BLUE, etc.) and imports.\n"
        elif "AttributeError" in last_error:
            error_feedback += "Fix: You used a method that does not exist. Check Manim CE documentation standards.\n"
        elif "TypeError" in last_error:
            error_feedback += "Fix: Check your function arguments. Don't animate non-Mobjects.\n"
            
        messages.append(HumanMessage(content=error_feedback + "Please fix the code."))

    status = SceneStatus.ERROR
    video_url = None
    code = state.get("code")
    error_message = None

    try:
        response = await coding_llm.ainvoke(messages)
        code = response.content.replace("```python", "").replace("```", "").strip()
        
        db = await get_database()
        await db.scenes.update_one(
            {"_id": ObjectId(scene_id)},
            {"$set": {"code": code, "status": SceneStatus.CODE_GENERATING}}
        )
        
        print(f"Rendering scene {scene_id}...")
        
        await manager.broadcast({
            "type": "scene_update",
            "scene_id": scene_id,
            "status": "rendering",
            "code": code
        }, project_id)
        video_url = await manim_service.render_scene(code, f"scene_{state['index']}", project_id)
        status = SceneStatus.READY

    except Exception as e:
        print(f"Render failed: {e}")
        error_message = str(e)
        status = SceneStatus.ERROR

    if status == SceneStatus.ERROR and retry_count < 2:
        print(f"Retrying scene {scene_id}...")
        return Send("generate_and_render_scene", {
            **state,
            "image_path": image_path,
            "retry_count": retry_count + 1,
            "last_error": error_message,
            "code": code
        })

    db = await get_database()
    await db.scenes.update_one(
        {"_id": ObjectId(scene_id)},
        {"$set": {"video_url": video_url, "status": status}}
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
