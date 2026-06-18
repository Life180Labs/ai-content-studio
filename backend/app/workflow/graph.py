"""
LangGraph state machine for the AI Content Studio.
"""

from typing import Literal

from langgraph.graph import StateGraph, START, END
import structlog

from app.workflow.state import PipelineGraphState
from app.workflow.nodes import generate_storyboard, generate_assets

logger = structlog.get_logger("workflow.graph")

def _route_start(state: PipelineGraphState) -> str:
    """Route from START to the requested node."""
    node = state.get("current_node")
    if node in ["generate_storyboard", "generate_assets"]:
        return node
    return "generate_storyboard"

def _route_after_storyboard(state: PipelineGraphState) -> Literal["generate_assets", "wait_for_user"]:
    """Routing logic after storyboard generation."""
    if state.get("error_message"):
        return "wait_for_user"
    return "wait_for_user"  # Wait for human approval of storyboard

def _route_after_assets(state: PipelineGraphState) -> Literal["wait_for_user"]:
    return "wait_for_user"


# Wait node that does nothing, just pauses execution for Human-in-the-loop
def wait_for_user(state: PipelineGraphState) -> dict:
    return {"current_node": "wait_for_user"}


workflow = StateGraph(PipelineGraphState)

# Add Nodes
workflow.add_node("generate_storyboard", generate_storyboard)
workflow.add_node("generate_assets", generate_assets)
workflow.add_node("wait_for_user", wait_for_user)

# Conditional Routing from START
workflow.add_conditional_edges(START, _route_start)

# Conditional Routing
workflow.add_conditional_edges("generate_storyboard", _route_after_storyboard)
workflow.add_edge("generate_assets", END)

# In Phase 3, we compile with a checkpointer in the task logic.
# For now, we compile the graph so it can be exported.
graph = workflow.compile()
