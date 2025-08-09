"""
🔥 AGNO-NATIVE STREAMING IMPLEMENTATION 
This is the clean, framework-aware streaming method that should replace the complex one.
"""

def generate_application_streaming_clean(self, tenant_id: str, user_request: str, knowledge_sources: list[str] = None, session_id: str = None, user_id: str = "1", model: str = "kimi-k2"):
    """Generate application using AGNO's native streaming - following the framework's patterns"""
    
    try:
        # Initialize conversation state
        conversation_state = {
            "start_time": datetime.now(),
            "current_phase": "initializing",
            "files_created": [],
            "tools_used": []
        }
        
        # Initial greeting
        yield {"type": "conversation", "content": {"message": f"Starting work on your request: **{user_request}**"}}
        
        # Set up AGNO agent (same as before)
        await self._initialize_knowledge(knowledge_sources, session_id, tenant_id, user_id)
        
        # Generate output directory and agent setup (same as before)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_dir = f"generated_apps/kiff_app_{timestamp}"
        os.makedirs(output_dir, exist_ok=True)
        
        yield {"type": "conversation", "content": {"message": f"Created workspace directory: `{output_dir.split('/')[-1]}`"}}
        
        # Create AGNO agent
        available_models = get_tradeforge_models()
        selected_llm = available_models.get(model, llm_agentic)
        
        agent = Agent(
            model=selected_llm,
            knowledge=self.knowledge_base,
            search_knowledge=True,
            tools=[FileTools(), self._create_todo_tracker(), ThinkingTools(add_instructions=True)],
            show_tool_calls=True,
            stream_intermediate_steps=True,
            instructions=[
                "You are a production-grade AI engineer that uses knowledge and tools to build the requested prompt.",
                "Save all files to the specific directory provided in the prompt.",
                "Be conversational and explain each step as you work through the project.",
                "IMPORTANT: When using save_file, use the exact format: save_file(file_name='path/file.ext', contents='your content'). The parameters are 'file_name' and 'contents'."
            ]
        )
        
        yield {"type": "conversation", "content": {"message": f"Using **{model}** model for generation. AI agent ready!"}}
        
        # Enhanced prompt
        prompt = f"""Create a complete, deployable application for: {user_request}

IMPORTANT REQUIREMENTS:
1. Save all files to the {output_dir}/ directory
2. Create a complete application structure
3. Include a Dockerfile for deployment
4. Add proper error handling and best practices

IMPORTANT: As you work, explain what you're doing and why. Think of this as a conversation where you're walking the user through your development process.

Generate a complete application with Docker configuration for easy deployment."""
        
        # 🔥 AGNO-NATIVE STREAMING: Mirror AGNO's natural event flow
        response_content = ""
        
        # Stream events EXACTLY as AGNO provides them - no batching, no delays
        for event in agent.run(prompt, stream=True, stream_intermediate_steps=True):
            if hasattr(event, 'event'):
                event_type = event.event
                
                # 🚀 RunStarted 
                if event_type == "RunStarted":
                    yield {"type": "conversation", "content": {"message": "🚀 Beginning analysis and implementation..."}}
                
                # 📝 RunResponseContent - Real-time word-by-word streaming
                elif event_type == "RunResponseContent":
                    if hasattr(event, 'content') and event.content:
                        content_piece = str(event.content)
                        response_content += content_piece
                        # Stream each piece immediately (like AGNO test showed)
                        yield {"type": "conversation", "content": {"message": content_piece}}
                
                # 🛠️ ToolCallStarted - Immediate tool feedback  
                elif event_type == "ToolCallStarted":
                    tool_name = getattr(event.tool, 'tool_name', 'Unknown Tool')
                    tool_args = getattr(event.tool, 'tool_args', {})
                    conversation_state["tools_used"].append(tool_name)
                    
                    if tool_name == "save_file":
                        file_name = tool_args.get('file_name', 'file')
                        yield {"type": "conversation", "content": {"message": f"💾 Creating **{file_name.split('/')[-1]}**..."}}
                    elif tool_name == "search_knowledge":
                        yield {"type": "conversation", "content": {"message": "🔍 Searching knowledge base..."}}
                    elif "todo" in tool_name.lower():
                        yield {"type": "conversation", "content": {"message": "📋 Updating project plan..."}}
                    else:
                        yield {"type": "conversation", "content": {"message": f"🔧 Using **{tool_name}**..."}}
                
                # ✅ ToolCallCompleted - Immediate results with file creation
                elif event_type == "ToolCallCompleted":
                    tool_name = getattr(event.tool, 'tool_name', 'Unknown Tool')
                    tool_args = getattr(event.tool, 'tool_args', {})
                    
                    if tool_name == "save_file":
                        file_path = tool_args.get('file_name', '')
                        file_content = tool_args.get('contents', '')
                        file_name = file_path.split('/')[-1] if file_path else 'file'
                        
                        conversation_state["files_created"].append(file_name)
                        
                        # Immediate conversational feedback
                        yield {"type": "conversation", "content": {"message": f"✅ **{file_name}** created successfully"}}
                        
                        # IMMEDIATE file_created event for frontend files panel
                        if file_path and file_content:
                            yield {
                                "type": "file_created", 
                                "content": {
                                    "message": f"File created: {file_name}",
                                    "file_path": file_path,
                                    "file_content": file_content
                                }
                            }
                    else:
                        yield {"type": "conversation", "content": {"message": f"✅ **{tool_name}** completed"}}
                
                # 🧠 Reasoning events
                elif event_type == "ReasoningStarted":
                    yield {"type": "conversation", "content": {"message": "🤔 Analyzing requirements..."}}
                elif event_type == "ReasoningCompleted":
                    yield {"type": "conversation", "content": {"message": "💡 Analysis complete! Implementing solution..."}}
                elif event_type == "ReasoningStep":
                    if hasattr(event, 'content') and event.content:
                        reasoning_text = str(event.content)
                        if any(keyword in reasoning_text.lower() for keyword in ['create', 'implement', 'design']):
                            preview = reasoning_text[:100] + "..." if len(reasoning_text) > 100 else reasoning_text
                            yield {"type": "conversation", "content": {"message": f"💭 {preview}"}}
                
                # 🏁 RunCompleted
                elif event_type == "RunCompleted":
                    elapsed_time = datetime.now() - conversation_state["start_time"]
                    files_count = len(conversation_state["files_created"])
                    
                    yield {"type": "conversation", "content": {"message": f"🎉 **Application completed!** Created {files_count} files in {elapsed_time.seconds} seconds"}}
                    
                    # Real-time session metrics using AGNO's native capabilities
                    if hasattr(agent, 'session_metrics') and agent.session_metrics:
                        session_metrics = agent.session_metrics
                        total_tokens = getattr(session_metrics, 'total_tokens', 0)
                        yield {"type": "conversation", "content": {"message": f"📊 **Resource usage**: {total_tokens} tokens consumed"}}
        
        # Final completion
        yield {"type": "conversation", "content": {"message": "✨ Application ready for deployment!"}}
        
        # Set up final app info
        app_info = {
            "name": f"Generated App {timestamp}",
            "description": user_request,
            "framework": "Multiple",
            "files": conversation_state["files_created"],
            "directory": output_dir
        }
        
        yield {"type": "completed", "content": {
            "id": f"kiff_app_{timestamp}",
            "response": response_content,
            "app_info": app_info
        }}
        
    except Exception as e:
        logger.error(f"❌ AGNO streaming generation failed: {e}")
        yield {"type": "conversation", "content": {"message": f"❌ Error: {str(e)}"}}
        yield {"type": "error", "content": {"message": f"Generation failed: {str(e)}", "error": str(e)}}