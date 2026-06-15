"""
LangGraph state machine for the AI Content Studio.
"""

from typing import Literal

from langgraph.graph import StateGraph, START, END
import structlog

from app.workflow.state import PipelineGraphState
from app.workflow.nodes import generate_storyboard, generate_voice, generate_avatar_video

logger = structlog.get_logger("workflow.graph")


def _route_after_storyboard(state: PipelineGraphState) -> Literal["generate_voice", "wait_for_user"]:
    """Routing logic after storyboard generation."""
    if state.get("error_message"):
        # We should handle fallback here if configured, for now just pause
        return "wait_for_user"
    return "wait_for_user"  # Wait for human approval of storyboard


def _route_after_voice(state: PipelineGraphState) -> Literal["generate_avatar_video", "wait_for_user"]:
    if state.get("error_message"):
        return "wait_for_user"
    return "wait_for_user"


# Wait node that does nothing, just pauses execution for Human-in-the-loop
def wait_for_user(state: PipelineGraphState) -> dict:
    return {"current_node": "wait_for_user"}


workflow = StateGraph(PipelineGraphState)

# Add Nodes
workflow.add_node("generate_storyboard", generate_storyboard)
workflow.add_node("generate_voice", generate_voice)
workflow.add_node("generate_avatar_video", generate_avatar_video)
workflow.add_node("wait_for_user", wait_for_user)

# Add Edges
workflow.add_edge(START, "generate_storyboard")

# Conditional Routing
workflow.add_conditional_edges("generate_storyboard", _route_after_storyboard)
workflow.add_conditional_edges("generate_voice", _route_after_voice)

# Edges from wait_for_user are controlled externally when resuming the thread
# For example, we resume to "generate_voice" after approving storyboard.
# This means the graph will be invoked with a specific start point or we use interrupt
workflow.add_edge("generate_avatar_video", END)

# In Phase 3, we compile with a checkpointer in the task logic.
# For now, we compile the graph so it can be exported.
graph = workflow.compile()
