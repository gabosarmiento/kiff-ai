"""
AGNO Conversational Generator Service
====================================

Leverages AGNO's native streaming events to create a conversational experience.
"""

import logging
from datetime import datetime
from typing import Dict, Any, AsyncGenerator

# AGNO imports
from agno.agent import Agent
from agno.tools.file import FileTools
from agno.tools.thinking import ThinkingTools

# Local imports
from app.config.llm_providers import llm_agentic

logger = logging.getLogger(__name__)

class AGNOConversationalGenerator:
    """AGNO agent that provides natural conversational streaming"""
    
    async def generate_with_conversation(self, user_request: str) -> AsyncGenerator[Dict[str, Any], None]:
        """Generate application with natural conversational streaming"""
        
        try:
            # Initial greeting
            yield {
                "type": "conversation", 
                "content": {"message": f"👋 Hi! I'm going to help you with: **{user_request}**"}
            }
            
            yield {
                "type": "conversation", 
                "content": {"message": "Let me start working on this step by step, and I'll explain everything I'm doing."}
            }
            
            # Create AGNO agent with proper streaming
            agent = Agent(
                model=llm_agentic,
                tools=[FileTools(), ThinkingTools(add_instructions=True)],
                show_tool_calls=True,
                stream_intermediate_steps=True,
                instructions=[
                    "You are a helpful AI assistant that explains your work step by step.",
                    "When using save_file, use format: save_file(file_name='path/file.ext', contents='your content')",
                    "Be clear about what you're doing and why."
                ]
            )
            
            # Create output directory
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_dir = f"generated_apps/kiff_app_{timestamp}"
            
            prompt = f"""Complete this task: {user_request}

If you need to save files, save them to directory: {output_dir}/

Explain what you're doing as you work through this task."""
            
            # Track conversation state
            current_content = ""
            files_created = []
            current_phase = "starting"
            
            # Stream AGNO events and convert to conversational messages
            for event in agent.run(prompt, stream=True, stream_intermediate_steps=True):
                
                if hasattr(event, 'event'):
                    event_type = event.event
                    
                    if event_type == "RunStarted":
                        current_phase = "thinking"
                        yield {
                            "type": "conversation",
                            "content": {"message": "🚀 Starting to work on your request..."}
                        }
                    
                    elif event_type == "ToolCallStarted":
                        tool_name = getattr(event.tool, 'tool_name', 'unknown')
                        current_phase = f"using_{tool_name}"
                        
                        # Contextual messages based on tool
                        if tool_name == "think":
                            yield {
                                "type": "conversation",
                                "content": {"message": "🤔 Let me think through this carefully..."}
                            }
                        elif tool_name == "save_file":
                            yield {
                                "type": "conversation", 
                                "content": {"message": "✍️ Writing a file for the project..."}
                            }
                        elif tool_name == "read_file":
                            yield {
                                "type": "conversation",
                                "content": {"message": "👀 Reading an existing file..."}
                            }
                        elif tool_name == "list_files":
                            yield {
                                "type": "conversation",
                                "content": {"message": "📁 Checking what files we have..."}
                            }
                        else:
                            yield {
                                "type": "conversation",
                                "content": {"message": f"🔧 Using {tool_name}..."}
                            }
                    
                    elif event_type == "ToolCallCompleted":
                        tool_name = getattr(event.tool, 'tool_name', 'unknown')
                        result = getattr(event, 'result', '')
                        
                        if tool_name == "save_file" and result and "Saved:" in str(result):
                            # Extract filename from result
                            file_path = str(result).split("Saved:")[-1].strip()
                            file_name = file_path.split('/')[-1] if '/' in file_path else file_path
                            files_created.append(file_name)
                            
                            yield {
                                "type": "conversation",
                                "content": {"message": f"💾 Created **{file_name}**"}
                            }
                        elif tool_name == "think":
                            yield {
                                "type": "conversation",
                                "content": {"message": "✨ Got a clear plan - let me implement it!"}
                            }
                        else:
                            yield {
                                "type": "conversation",
                                "content": {"message": f"✅ Finished with {tool_name}"}
                            }
                    
                    elif event_type == "ReasoningStarted":
                        current_phase = "reasoning"
                        yield {
                            "type": "conversation",
                            "content": {"message": "💭 Analyzing the best approach..."}
                        }
                    
                    elif event_type == "ReasoningStep":
                        # Only show key reasoning insights to avoid noise
                        if hasattr(event, 'content') and event.content:
                            reasoning = str(event.content)
                            # Show interesting insights
                            if any(word in reasoning.lower() for word in ['create', 'implement', 'structure', 'approach', 'design']):
                                preview = reasoning[:100] + "..." if len(reasoning) > 100 else reasoning
                                yield {
                                    "type": "conversation",
                                    "content": {"message": f"💡 {preview}"}
                                }
                    
                    elif event_type == "ReasoningCompleted":
                        current_phase = "implementing"
                        yield {
                            "type": "conversation",
                            "content": {"message": "✨ I've got a clear plan now. Let me start implementing..."}
                        }
                    
                    elif event_type == "RunResponseContent":
                        # Accumulate content but only show meaningful chunks
                        if hasattr(event, 'content') and event.content:
                            chunk = str(event.content)
                            current_content += chunk
                            
                            # Show substantial content updates (like paragraphs)
                            if len(chunk) > 30 and any(char in chunk for char in ['.', '!', '?', ':']):
                                yield {
                                    "type": "conversation",
                                    "content": {"message": f"📝 {chunk.strip()}"}
                                }
                    
                    elif event_type == "RunCompleted":
                        current_phase = "completed"
                        
                        # Final summary
                        if files_created:
                            file_list = ", ".join(files_created[:3])
                            more_files = f" and {len(files_created) - 3} more" if len(files_created) > 3 else ""
                            yield {
                                "type": "conversation",
                                "content": {"message": f"🎉 **Task completed!** Created: {file_list}{more_files}"}
                            }
                        else:
                            yield {
                                "type": "conversation", 
                                "content": {"message": "🎉 **Task completed successfully!**"}
                            }
                        
                        yield {
                            "type": "conversation",
                            "content": {"message": "🚀 Everything is ready to use!"}
                        }
                        
                        # Final completion event
                        yield {
                            "type": "completed",
                            "content": {
                                "message": "✅ Task completed successfully!",
                                "files_created": files_created,
                                "output_dir": output_dir,
                                "response": current_content
                            }
                        }
                
                # Handle direct content events
                elif hasattr(event, 'content'):
                    content = str(event.content)
                    current_content += content
                    
                    # Show meaningful content
                    if len(content) > 20:
                        yield {
                            "type": "conversation",
                            "content": {"message": content}
                        }
        
        except Exception as e:
            logger.error(f"❌ Conversational generation failed: {e}")
            yield {
                "type": "conversation", 
                "content": {"message": f"😔 Sorry, I encountered an error: {str(e)}"}
            }
            yield {
                "type": "error",
                "content": {"message": f"❌ Generation failed: {str(e)}", "error": str(e)}
            }

# Global instance
agno_conversational_generator = AGNOConversationalGenerator()