import asyncio
from app.workflow.tasks import _run_graph_async
import uuid

async def run():
    res = await _run_graph_async(
        "bb782935-24b6-4d75-b8d1-b243d942f13a", 
        "e3a15ef9-59ef-4245-b721-8fc894084b16", 
        "Welcome to the AI content studio. This is a simple test script.",
        node="generate_storyboard"
    )
    print(res)

asyncio.run(run())
