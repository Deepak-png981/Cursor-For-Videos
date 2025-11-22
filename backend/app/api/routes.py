from fastapi import APIRouter, WebSocket, WebSocketDisconnect, BackgroundTasks, HTTPException, Body
from ..db.models import Project, ProjectStatus
from ..db.database import get_database
from ..graph.workflow import app as graph_app
from ..services.socket_manager import manager
from ..db.models import PyObjectId
from bson import ObjectId
from typing import List

router = APIRouter()

async def run_graph(project_id: str, prompt: str):
    initial_state = {
        "project_id": project_id,
        "user_prompt": prompt,
        "scenes": [],
        "status": "creating",
        "error": None
    }
    
    # We can subscribe to graph events if we want granular updates here, 
    # or just let nodes update DB and we can poll or nodes broadcast.
    # Better: Nodes broadcast via manager. 
    # Since nodes are in a different module, we might need to inject manager or import it there.
    # For now, let's just run it.
    async for event in graph_app.astream(initial_state):
        # We can broadcast intermediate state if needed
        # event contains the update from the node
        pass
        
    await manager.broadcast({"type": "project_complete", "project_id": project_id}, project_id)

@router.post("/projects")
async def create_project(payload: dict, background_tasks: BackgroundTasks):
    prompt = payload.get("prompt")
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")
        
    db = await get_database()
    new_project = Project(user_prompt=prompt)
    project_dump = new_project.model_dump(by_alias=True)
    if project_dump.get("_id") is None:
        del project_dump["_id"]
    result = await db.projects.insert_one(project_dump)
    project_id = str(result.inserted_id)
    
    background_tasks.add_task(run_graph, project_id, prompt)
    
    return {"project_id": project_id, "status": "created"}

@router.get("/projects/{project_id}")
async def get_project(project_id: str):
    db = await get_database()
    try:
        project = await db.projects.find_one({"_id": project_id})
        if not project:
             # Try ObjectId if stored as ObjectId
            project = await db.projects.find_one({"_id": ObjectId(project_id)})
            
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
            
        scenes = await db.scenes.find({"project_id": project_id}).to_list(length=100)
        
        # Convert _id to string
        if "_id" in project:
            project["id"] = str(project["_id"])
            del project["_id"]
            
        for s in scenes:
            if "_id" in s:
                s["id"] = str(s["_id"])
                del s["_id"]
        
        return {"project": project, "scenes": scenes}
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/projects/{project_id}/reorder")
async def reorder_scenes(project_id: str, scene_ids: List[str] = Body(...)):
    db = await get_database()
    try:
        # Validate project exists
        project = await db.projects.find_one({"_id": ObjectId(project_id)})
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Update indices for each scene
        for index, scene_id in enumerate(scene_ids):
            await db.scenes.update_one(
                {"_id": ObjectId(scene_id), "project_id": project_id},
                {"$set": {"index": index}}
            )
            
        # Fetch updated scenes to broadcast
        updated_scenes = await db.scenes.find({"project_id": project_id}).to_list(length=100)
        for s in updated_scenes:
            if "_id" in s:
                s["id"] = str(s["_id"])
                del s["_id"]
                
        # Broadcast update
        await manager.broadcast({
            "type": "scenes_reordered",
            "scenes": updated_scenes
        }, project_id)
        
        return {"status": "success", "scenes": updated_scenes}
        
    except Exception as e:
        print(f"Reorder error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.websocket("/ws/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: str):
    await manager.connect(websocket, project_id)
    try:
        while True:
            data = await websocket.receive_text()
            # We can handle incoming messages (chat) here
            # await manager.broadcast({"message": data}, project_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, project_id)
