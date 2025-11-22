from langgraph.graph import StateGraph, START, END
from .state import ProjectState, SceneState
from .nodes import plan_scenes, generate_and_render_scene, continue_to_scenes

workflow = StateGraph(ProjectState)

workflow.add_node("plan_scenes", plan_scenes)
workflow.add_node("generate_and_render_scene", generate_and_render_scene)

workflow.add_edge(START, "plan_scenes")

workflow.add_conditional_edges(
    "plan_scenes",
    continue_to_scenes,
    ["generate_and_render_scene"]
)

workflow.add_edge("generate_and_render_scene", END)

app = workflow.compile()

