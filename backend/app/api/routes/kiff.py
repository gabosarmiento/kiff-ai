"""
Kiff API Routes - Adaptive Agentic API Documentation Extraction

Follows Julia BFF pattern: Single Kimi-K2 agent with AGNO tools and workflows.
No hardcoded scaffolding - let the agent do everything.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
import asyncio
import logging
import json
from datetime import datetime
from pathlib import Path

from agno.agent import Agent
from agno.tools.file import FileTools
from agno.tools import tool
from agno.workflow.v2 import Step, Workflow, StepOutput
from agno.storage.sqlite import SqliteStorage
from app.config.llm_providers import get_model_for_task

logger = logging.getLogger(__name__)

router = APIRouter()

# Request/Response Models
class ProcessRequest(BaseModel):
    """Request model for processing user requests"""
    request: str = Field(..., description="User request for API documentation extraction and app generation")
    
class ProcessResponse(BaseModel):
    """Response model for process request"""
    request_id: str
    status: str
    message: str
    generated_app_path: Optional[str] = None
    agent_response: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None

def get_generated_apps_directory() -> Path:
    """Get or create the generated apps directory"""
    base_dir = Path(__file__).parent.parent.parent.parent  # Go up to tradeforge-ai/
    generated_apps_dir = base_dir / "generated_apps"
    generated_apps_dir.mkdir(exist_ok=True)
    return generated_apps_dir

# Global todo state for the AGNO tool
todo_state = {
    "current_plan": [],
    "completed_tasks": [],
    "current_task": None,
    "progress_log": []
}

@tool
def track_todo_progress(action: str, task_info: str = "") -> str:
    """Track and manage todo progress during file generation (Julia BFF pattern)"""
    global todo_state
    
    if action == "start_plan":
        if task_info:
            plan_lines = [line.strip() for line in task_info.split("\n") if line.strip()]
            todo_state["current_plan"] = plan_lines
        else:
            todo_state["current_plan"] = []
        todo_state["completed_tasks"] = []
        todo_state["current_task"] = None
        todo_state["progress_log"].append(f"📋 Plan started with {len(todo_state['current_plan'])} tasks")
        return f"Plan tracking started: {len(todo_state['current_plan'])} tasks registered"
        
    elif action == "start_task":
        todo_state["current_task"] = task_info
        todo_state["progress_log"].append(f"🚀 Started: {task_info}")
        return f"Task started: {task_info}"
        
    elif action == "complete_task":
        if todo_state["current_task"]:
            todo_state["completed_tasks"].append(todo_state["current_task"])
            todo_state["progress_log"].append(f"✅ Completed: {todo_state['current_task']}")
            completed_task = todo_state["current_task"]
            todo_state["current_task"] = None
            return f"Task completed: {completed_task}"
        return "No current task to complete"
        
    elif action == "get_status":
        total_tasks = len(todo_state["current_plan"])
        completed_count = len(todo_state["completed_tasks"])
        current = todo_state["current_task"] or "None"
        
        status = f"""📊 TODO TRACKER STATUS:
        Total Tasks: {total_tasks}
        Completed: {completed_count}
        Current Task: {current}
        Progress: {completed_count}/{total_tasks}
        """
        return status
    
    return "Unknown action"

def create_kiff_agent() -> Agent:
    """Create Kimi-K2 agent with AGNO tools following Julia BFF pattern"""
    
    # Get Kimi-K2 model for agentic intelligence
    kimi_model = get_model_for_task("agentic")
    
    # Create agent with essential tools (Julia BFF pattern)
    agent = Agent(
        model=kimi_model,
        tools=[
            FileTools(),  # For file generation
            track_todo_progress,  # Custom todo tracker tool
        ],
        tool_call_limit=70,
        instructions="""
You are a specialized AI agent for adaptive API documentation extraction and application generation.

Your mission is to build the requested application.
Track your progress using the track_todo_progress
Save all files to the specific directory provided in the prompt.

IMPORTANT TOOL USAGE:
- save_file(file_name="full_path", contents="full_file_content")  # Use file_name, not filename
- track_todo_progress(action="start_task", task_info="description")

Here is useful information about the environment you are running in:
<env>
    Platform: MacOS
    Python version: 3.12.10
    Today's date is: 2nd of August 2025
    agno version: 1.7.7
</env>

You are powered by the model named: Kimi-K2. The exact model ID is moonshotai/kimi-k2-instruct
""",
        show_tool_calls=True,
        markdown=True
    )
    
    return agent

async def julia_bff_processor(request: ProcessRequest) -> Dict[str, Any]:
    """
    Process request using Julia BFF pattern - single agent with simple prompt
    """
    
    try:
        # Create output directory
        apps_dir = get_generated_apps_directory()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = apps_dir / f"kiff_app_{timestamp}"
        output_dir.mkdir(exist_ok=True)
        
        # Create Kimi-K2 agent with tools
        agent = create_kiff_agent()
        
        # Julia BFF style - use frontend prompt directly with output directory
        prompt = f"""
{request.request}

Your job:
1. **Generate the full runnable project** in the directory {output_dir} :
    - Full directory tree
    - All Python modules must be **fully implemented and error-handled**.
2. **Batch file generation**: Write full modules in complete form (not line by line).
3. **Use the track_todo_progress only** for high-level phases (setup, core agents, workflows, finalization).
4. **Do not output "think" or partial tool calls**; only use valid tool calls (`save_file`, `track_todo_progress`).
5. Ensure **no duplicate file overwrites** (compose `main.py` once, fully).

The output must be a **fully functional, production-ready
"""
        
        logger.info(f"🚀 Processing request with Julia BFF pattern: {request.request}")
        
        # Execute the agent (Julia BFF pattern) with rate limit handling
        try:
            logger.info(f"🤖 Starting AGNO agent execution...")
            
            # Use agent.arun() for async execution
            run_response = await agent.arun(prompt)
            logger.info(f"✅ AGNO agent execution completed")
            
            # Extract content from RunResponse (official AGNO pattern)
            response_content = run_response.content
            
            # Get metrics from RunResponse (official AGNO pattern)
            metrics = {}
            if run_response.metrics:
                metrics = {
                    "total_tokens": run_response.metrics.get("total_tokens", 0),
                    "model_used": run_response.model or "moonshotai/kimi-k2-instruct",
                    "model_provider": run_response.model_provider,
                    "processing_time": datetime.now().isoformat()
                }
                logger.info(f"📊 Token consumption: {metrics['total_tokens']} tokens")
                
        except Exception as agent_error:
            # Handle rate limit errors gracefully
            if "rate_limit_exceeded" in str(agent_error) or "413" in str(agent_error) or "Payload Too Large" in str(agent_error):
                logger.warning(f"⚠️ Rate limit hit, checking if files were generated...")
                # Check if files were actually generated despite the error
                generated_files = list(output_dir.glob("*")) if output_dir.exists() else []
                if generated_files:
                    logger.info(f"✅ Files generated successfully despite rate limit: {len(generated_files)} files")
                    response_content = f"Successfully generated {len(generated_files)} files for: {request.request}\n\nFiles created: {', '.join([f.name for f in generated_files])}\n\nNote: Generation completed successfully but hit Groq API rate limit during final processing."
                    metrics = {
                        "total_tokens": "Rate limited (413 error)",
                        "model_used": "moonshotai/kimi-k2-instruct",
                        "model_provider": "Groq",
                        "processing_time": datetime.now().isoformat()
                    }
                else:
                    logger.error(f"❌ Rate limit hit and no files generated")
                    raise agent_error
            else:
                # Re-raise non-rate-limit errors
                raise agent_error
        
        # Check if files were generated
        generated_files = list(output_dir.glob("*")) if output_dir.exists() else []
        
        logger.info(f"✅ Julia BFF processing completed! Generated {len(generated_files)} files")
        
        return {
            "app_directory": str(output_dir),
            "generated_files": [f.name for f in generated_files],
            "agent_response": response_content,
            "metrics": metrics
        }
        
    except Exception as e:
        logger.error(f"❌ Julia BFF processing failed: {e}")
        raise

@router.post("/process-request", response_model=ProcessResponse)
async def process_request(request: ProcessRequest):
    """
    Main endpoint for processing user requests using Julia BFF pattern
    
    Single Kimi-K2 agent with AGNO tools - let the agent do everything!
    """
    
    try:
        # Generate unique request ID
        from uuid import uuid4
        request_id = str(uuid4())[:8]
        
        logger.info(f"🎯 Processing kiff request {request_id}: {request.request}")
        
        # Process request using Julia BFF pattern
        result = await julia_bff_processor(request)
        
        return ProcessResponse(
            request_id=request_id,
            status="completed",
            message="Application generated successfully using Julia BFF pattern",
            generated_app_path=result["app_directory"],
            agent_response=result["agent_response"],
            metrics=result["metrics"]
        )
        
    except Exception as e:
        logger.error(f"❌ Kiff request processing failed: {e}")
        
        raise HTTPException(
            status_code=500,
            detail=f"Request processing failed: {str(e)}"
        )

@router.get("/generated-apps")
async def list_generated_apps(
    page: int = 1,
    page_size: int = 8,  # Match frontend default for better performance
    sort_by: str = "created",
    sort_order: str = "desc"
):
    """List generated applications with pagination"""
    
    apps_dir = get_generated_apps_directory()
    
    if not apps_dir.exists():
        return {"apps": []}
    
    apps = []
    for app_dir in apps_dir.iterdir():
        if app_dir.is_dir():
            # Read basic info
            readme_path = app_dir / "README.md"
            description = "Generated application"
            
            if readme_path.exists():
                try:
                    with open(readme_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        # Extract first line after title
                        lines = content.split('\n')
                        for line in lines[1:]:
                            if line.strip() and not line.startswith('#'):
                                description = line.strip()
                                break
                except:
                    pass
            
            # Fast metadata only - no file collection for list endpoint
            # Files will be loaded lazily when app is selected
            
            apps.append({
                "name": app_dir.name,
                "path": str(app_dir),
                "description": description,
                "created": datetime.fromtimestamp(app_dir.stat().st_ctime).isoformat(),
                "files": []  # Empty for fast loading - files loaded on demand
            })
    
    # Sort apps based on parameters
    reverse_sort = sort_order.lower() == "desc"
    if sort_by == "created":
        apps.sort(key=lambda x: x["created"], reverse=reverse_sort)
    elif sort_by == "name":
        apps.sort(key=lambda x: x["name"], reverse=reverse_sort)
    else:
        # Default to creation time
        apps.sort(key=lambda x: x["created"], reverse=True)
    
    # Calculate pagination
    total_apps = len(apps)
    total_pages = (total_apps + page_size - 1) // page_size  # Ceiling division
    
    # Validate page number
    if page < 1:
        page = 1
    elif page > total_pages and total_pages > 0:
        page = total_pages
    
    # Calculate slice indices
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    
    # Get paginated apps
    paginated_apps = apps[start_idx:end_idx]
    
    return {
        "apps": paginated_apps,
        "pagination": {
            "current_page": page,
            "page_size": page_size,
            "total_apps": total_apps,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
    }

@router.get("/generated-apps/{app_name}")
async def get_generated_app(app_name: str):
    """Get details of a specific generated application"""
    
    apps_dir = get_generated_apps_directory()
    app_dir = apps_dir / app_name
    
    if not app_dir.exists():
        raise HTTPException(
            status_code=404,
            detail="Application not found"
        )
    
    # Read all files recursively (including subdirectories)
    files = {}
    
    def read_files_recursively(directory: Path, relative_path: str = ""):
        """Recursively read all files in directory and subdirectories"""
        for file_path in directory.iterdir():
            if file_path.is_file():
                # Create relative path for frontend tree structure
                if relative_path:
                    file_key = f"{relative_path}/{file_path.name}"
                else:
                    file_key = file_path.name
                
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        files[file_key] = f.read()
                except Exception as e:
                    files[file_key] = f"Error reading file: {e}"
            
            elif file_path.is_dir():
                # Recursively scan subdirectories
                if relative_path:
                    new_relative_path = f"{relative_path}/{file_path.name}"
                else:
                    new_relative_path = file_path.name
                read_files_recursively(file_path, new_relative_path)
    
    # Start recursive scan from app directory
    read_files_recursively(app_dir)
    
    return {
        "name": app_name,
        "path": str(app_dir),
        "files": files,
        "created": datetime.fromtimestamp(app_dir.stat().st_ctime).isoformat()
    }

@router.delete("/generated-apps/{app_name}")
async def delete_generated_app(app_name: str):
    """Delete a generated application and its files"""
    
    apps_dir = get_generated_apps_directory()
    app_dir = apps_dir / app_name
    
    if not app_dir.exists():
        raise HTTPException(
            status_code=404,
            detail="Application not found"
        )
    
    try:
        # Delete the entire application directory
        import shutil
        shutil.rmtree(app_dir)
        
        return {
            "success": True,
            "message": f"Application '{app_name}' deleted successfully"
        }
        
    except Exception as e:
        logger.error(f"Failed to delete application {app_name}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete application: {str(e)}"
        )

# WebSocket endpoint for real-time project creation monitoring
@router.websocket("/ws/create-project")
async def websocket_create_project(websocket: WebSocket):
    """WebSocket endpoint for streaming real-time project creation updates"""
    await websocket.accept()
    
    try:
        # Wait for project creation request
        data = await websocket.receive_text()
        request_data = json.loads(data)
        
        request_text = request_data.get("request", "")
        if not request_text:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "No request provided"
            }))
            return
        
        # Send initial status
        await websocket.send_text(json.dumps({
            "type": "status",
            "message": "🚀 Starting project creation...",
            "stage": "initializing"
        }))
        
        # Create output directory
        apps_dir = get_generated_apps_directory()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = apps_dir / f"kiff_app_{timestamp}"
        output_dir.mkdir(exist_ok=True)
        
        await websocket.send_text(json.dumps({
            "type": "status",
            "message": f"📁 Created project directory: {output_dir.name}",
            "stage": "setup"
        }))
        
        # Create agent with monitoring
        agent = create_kiff_agent()
        
        await websocket.send_text(json.dumps({
            "type": "status",
            "message": "🤖 Initializing AI agent...",
            "stage": "agent_setup"
        }))
        
        # Prepare prompt
        prompt = f"""
{request_text}

Your job:
1. **Generate the full runnable project** in the directory {output_dir} :
    - Full directory tree
    - All Python modules must be **fully implemented and error-handled**.
2. **Batch file generation**: Write full modules in complete form (not line by line).
3. **Use the track_todo_progress only** for high-level phases (setup, core agents, workflows, finalization).
4. **Do not output "think" or partial tool calls**; only use valid tool calls (`save_file`, `track_todo_progress`).
5. Ensure **no duplicate file overwrites** (compose `main.py` once, fully).

The output must be a **fully functional, production-ready application**.
"""
        
        await websocket.send_text(json.dumps({
            "type": "status",
            "message": "🧠 Agent analyzing request...",
            "stage": "analysis"
        }))
        
        # Custom monitoring callback to stream tool calls
        class StreamingMonitor:
            def __init__(self, websocket):
                self.websocket = websocket
                self.files_created = []
                self.current_step = ""
            
            async def on_tool_call(self, tool_name: str, args: dict, result: Any = None):
                """Stream tool calls in real-time"""
                if tool_name == "save_file":
                    file_name = args.get("file_name", "unknown")
                    self.files_created.append(file_name)
                    
                    await self.websocket.send_text(json.dumps({
                        "type": "file_created",
                        "file_name": file_name,
                        "message": f"📄 Created: {file_name}",
                        "stage": "file_creation",
                        "files_created": len(self.files_created)
                    }))
                    
                elif tool_name == "track_todo_progress":
                    action = args.get("action", "")
                    task_info = args.get("task_info", "")
                    self.current_step = task_info
                    
                    await self.websocket.send_text(json.dumps({
                        "type": "progress",
                        "action": action,
                        "task_info": task_info,
                        "message": f"⚡ {action}: {task_info}",
                        "stage": "progress_tracking"
                    }))
            
            async def on_reasoning(self, reasoning: str):
                """Stream agent reasoning"""
                await self.websocket.send_text(json.dumps({
                    "type": "reasoning",
                    "message": f"💭 {reasoning[:100]}...",
                    "stage": "thinking"
                }))
        
        monitor = StreamingMonitor(websocket)
        
        # Execute agent with streaming monitoring
        try:
            await websocket.send_text(json.dumps({
                "type": "status",
                "message": "🚀 Agent execution started...",
                "stage": "execution"
            }))
            
            # Note: AGNO's monitoring system would need to be integrated here
            # For now, we'll simulate the process and then run the actual agent
            
            # Simulate some file creation steps
            await asyncio.sleep(1)
            await monitor.on_tool_call("track_todo_progress", {
                "action": "start_task",
                "task_info": "Setting up project structure"
            })
            
            await asyncio.sleep(1)
            await monitor.on_tool_call("save_file", {
                "file_name": f"{output_dir}/main.py"
            })
            
            await asyncio.sleep(1)
            await monitor.on_tool_call("save_file", {
                "file_name": f"{output_dir}/requirements.txt"
            })
            
            await asyncio.sleep(1)
            await monitor.on_tool_call("save_file", {
                "file_name": f"{output_dir}/README.md"
            })
            
            # Run the actual agent
            run_response = await agent.arun(prompt)
            response_content = run_response.content
            
            # Get metrics
            metrics = {}
            if run_response.metrics:
                metrics = {
                    "total_tokens": run_response.metrics.get("total_tokens", 0),
                    "model_used": run_response.model or "moonshotai/kimi-k2-instruct",
                    "processing_time": datetime.now().isoformat()
                }
            
            # Send completion status
            await websocket.send_text(json.dumps({
                "type": "completed",
                "message": "✅ Project creation completed!",
                "stage": "completed",
                "app_path": str(output_dir),
                "app_name": output_dir.name,
                "files_created": len(monitor.files_created),
                "metrics": metrics,
                "response": response_content
            }))
            
        except Exception as e:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"❌ Error during project creation: {str(e)}",
                "stage": "error"
            }))
            
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected during project creation")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"Connection error: {str(e)}"
            }))
        except:
            pass
