"""
AGNO-Native Groq LLM Service
Real AI agent generation using AGNO framework with GroqChat model
"""

import os
import logging
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime
import json

from agno.agent import Agent
from agno.models.groq import Groq
from agno.tools.python import PythonTools
from agno.storage.sqlite import SqliteStorage

from app.core.config import settings
# Legacy trading_agent_factory import removed - functionality replaced with AGNO-native implementation

logger = logging.getLogger(__name__)

class GroqLLMService:
    """
    AGNO-native Groq LLM service for real AI agent generation
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # Check for GROQ API key
        if not settings.GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY is required for AGNO-native Groq integration. Please set it in your .env file.")
        
        # Available models for different tasks
        self.models = {
            "fast": "llama3-8b-8192",      # Fast responses, good for simple tasks
            "balanced": "mixtral-8x7b-32768",  # Balanced performance and quality
            "advanced": "llama3-70b-8192",     # Best quality for complex tasks
        }
        
        # Initialize app generation factory for kiff system
        # AGNO-native agent creation for API documentation extraction and app generation
        self.agent_factory = None  # Using direct AGNO patterns for kiff
        
        # Create AGNO agent for code generation
        self.code_generator_agent = Agent(
            name="Kiff App Code Generator",
            model=Groq(
                id=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
                api_key=settings.GROQ_API_KEY
            ),
            tools=[PythonTools()],
            storage=SqliteStorage(table_name="agent_sessions", db_file="tmp/agents.db"),
            instructions=[
                "You are an expert application code generator using AGNO framework patterns.",
                "Generate complete, production-ready Python applications based on API documentation.",
                "Always use AGNO framework components: Agent, tools, storage.",
                "Include proper error handling, logging, and documentation.",
                "Use real API integrations (Binance, risk management, technical analysis).",
                "Never use mock data or placeholder implementations."
            ],
            markdown=True,
            show_tool_calls=True
        )
    
    async def generate_application(self, prompt: str, app_type: str = "web_app", 
                                 complexity: str = "intermediate") -> dict:
        """
        Generate a complete application using AGNO-native patterns with real Groq API calls
        """
        try:
            # Build comprehensive prompt for application generation
            generation_prompt = f"""
Generate a complete Python application using AGNO framework patterns for the following request:

**User Request:** {prompt}
**App Type:** {app_type}
**Complexity Level:** {complexity}

**Requirements:**
1. Use AGNO Agent class with GroqChat model
2. Include real API integrations based on user request
3. Add proper data processing and analysis tools
4. Include error handling and logging
5. Make it production-ready with proper configuration
6. Add comprehensive documentation and usage examples

**Code Structure:**
- Import necessary AGNO components
- Define trading agent with proper tools and configuration
- Include main execution logic
- Add proper error handling and logging
- Provide usage examples

Generate the complete, runnable Python code:
"""
            
            # Use AGNO agent to generate the trading bot code
            response = self.code_generator_agent.run(generation_prompt)
            
            if not response or not response.content:
                raise Exception("Failed to generate agent code - empty response from AGNO agent")
            
            generated_code = response.content
            
            # Extract agent metadata from generated code
            agent_config = self._extract_agent_metadata(generated_code)
            
            return {
                "success": True,
                "agent": agent_config,
                "generated_code": generated_code,
                "model_used": self.models.get(complexity, "llama-3.3-70b-versatile"),
                "tokens_used": response.metrics.get("input_tokens", 0) + response.metrics.get("output_tokens", 0) if hasattr(response, 'metrics') else 0,
                "generation_time": response.metrics.get("time_to_first_token", 0) if hasattr(response, 'metrics') else 0,
                "fallback_used": False
            }
            
        except Exception as e:
            self.logger.error(f"Error generating trading agent with AGNO: {e}")
            # Return error instead of fallback to ensure we fix the real integration
            return {
                "success": False,
                "error": str(e),
                "message": "AGNO-native agent generation failed. Please check GROQ_API_KEY configuration.",
                "fallback_used": False
            }
    
    def _extract_agent_metadata(self, generated_code: str) -> Dict[str, Any]:
        """Extract agent metadata from generated code"""
        try:
            # Simple extraction of agent information from code comments or docstrings
            lines = generated_code.split('\n')
            metadata = {
                "name": "Generated Trading Agent",
                "description": "AI-generated trading agent",
                "strategy_type": "custom",
                "tools": ["binance_tools", "technical_analysis", "risk_management"]
            }
            
            # Look for agent name in class definition
            for line in lines:
                if "class " in line and "Agent" in line:
                    class_name = line.split("class ")[1].split("(")[0].strip()
                    metadata["name"] = class_name
                    break
            
            # Look for description in docstrings
            in_docstring = False
            docstring_lines = []
            for line in lines:
                if '"""' in line:
                    if in_docstring:
                        break
                    in_docstring = True
                    docstring_lines.append(line.replace('"""', '').strip())
                elif in_docstring:
                    docstring_lines.append(line.strip())
            
            if docstring_lines:
                metadata["description"] = " ".join(docstring_lines).strip()
            
            return metadata
            
        except Exception as e:
            self.logger.warning(f"Could not extract metadata from generated code: {e}")
            return {
                "name": "Generated Trading Agent",
                "description": "AI-generated trading agent",
                "strategy_type": "custom",
                "tools": ["binance_tools", "technical_analysis", "risk_management"]
            }
    
    async def explain_agent_strategy(self, agent_code: str) -> str:
        """Generate human-readable explanation of agent strategy using AGNO"""
        try:
            explanation_prompt = f"""
Analyze the following trading agent code and provide a clear, human-readable explanation of the strategy:

```python
{agent_code}
```

Provide an explanation that covers:
1. **Strategy Overview**: What type of trading strategy this is
2. **Entry Signals**: When the agent decides to enter trades
3. **Exit Signals**: When the agent decides to exit trades
4. **Risk Management**: How the agent manages risk and position sizing
5. **Technical Indicators**: What indicators are used and how
6. **Expected Performance**: What market conditions this strategy works best in

Make the explanation accessible to both technical and non-technical users.
"""
            
            response = self.code_generator_agent.run(explanation_prompt)
            return response.content if response and response.content else "Unable to generate strategy explanation."
            
        except Exception as e:
            self.logger.error(f"Error explaining agent strategy: {e}")
            return f"Error generating explanation: {str(e)}"
    
    def get_service_status(self) -> Dict[str, Any]:
        """Get current service status and configuration"""
        return {
            "service": "AGNO-Native Groq LLM Service",
            "status": "operational",
            "groq_api_configured": bool(settings.GROQ_API_KEY),
            "available_models": list(self.models.keys()),
            "default_model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
            "agno_integration": "native",
            "fallback_mode": False
        }
    
    def _build_system_prompt(self) -> str:
        """Build comprehensive system prompt for AGNO-native trading agent generation"""
        return """You are an expert trading algorithm developer specializing in AGNO (Agentic Graph Neural Operations) framework version 1.7.6.

Your task is to generate complete, production-ready trading agents using AGNO patterns. You must follow these requirements:

## AGNO 1.7.6 Patterns:
1. Use @tool decorators for all trading functions
2. Implement proper agent lifecycle with setup/teardown
3. Use AGNO's built-in risk management and position sizing
4. Follow AGNO's error handling and logging patterns
5. Implement proper state management and persistence

## Trading Agent Structure:
```python
from agno import Agent, tool
from agno.trading import TradingAgent, Position, Order
from datetime import datetime
import pandas as pd

class GeneratedTradingAgent(TradingAgent):
    def __init__(self, config: dict):
        super().__init__(config)
        self.strategy_params = config.get('strategy_params', {})
    
    @tool
    async def analyze_market(self, symbol: str) -> dict:
        # Market analysis logic
        pass
    
    @tool
    async def generate_signals(self, market_data: pd.DataFrame) -> dict:
        # Signal generation logic
        pass
    
    @tool
    async def execute_trade(self, signal: dict) -> Order:
        # Trade execution logic
        pass
    
    async def run_strategy(self):
        # Main strategy loop
        pass
```

## Required Components:
1. Market data analysis with technical indicators
2. Signal generation with entry/exit logic
3. Risk management with position sizing
4. Trade execution with order management
5. Performance tracking and logging

## Output Format:
Return a JSON object with:
- name: Agent name
- description: Strategy description
- code: Complete Python code
- parameters: Configuration parameters
- tools: Required AGNO tools
- risk_settings: Risk management configuration

Generate professional, well-documented, and thoroughly tested trading agents."""

    def _build_user_prompt(self, user_prompt: str, strategy_type: str) -> str:
        """Build user-specific prompt with strategy requirements"""
        strategy_guidance = {
            "momentum": "Focus on trend-following indicators like MACD, RSI, and moving averages. Implement momentum-based entry/exit signals.",
            "mean_reversion": "Use Bollinger Bands, RSI oversold/overbought levels, and statistical arbitrage techniques.",
            "breakout": "Implement support/resistance level detection, volume analysis, and breakout confirmation signals.",
            "arbitrage": "Focus on price discrepancies across exchanges, statistical arbitrage, and pairs trading strategies.",
            "scalping": "High-frequency trading with tight spreads, quick entries/exits, and minimal market exposure.",
            "swing": "Medium-term position holding with technical analysis, pattern recognition, and trend continuation."
        }
        
        guidance = strategy_guidance.get(strategy_type, "Implement a balanced trading strategy with proper risk management.")
        
        return f"""Create a {strategy_type} trading agent based on this request:

USER REQUEST: {user_prompt}

STRATEGY TYPE: {strategy_type}
GUIDANCE: {guidance}

Requirements:
1. Generate complete AGNO 1.7.6 compatible code
2. Include proper error handling and logging
3. Implement comprehensive risk management
4. Add detailed comments and documentation
5. Use appropriate technical indicators for {strategy_type} strategy
6. Include testing and validation capabilities
7. Ensure production-ready code quality

The agent should be immediately deployable in a live trading environment with proper safeguards."""

    async def _call_groq_api(self, system_prompt: str, user_prompt: str, model: str) -> str:
        """Make API call to Groq with proper error handling and retries"""
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "max_tokens": self.config.max_tokens,
            "temperature": self.config.temperature,
            "stream": False
        }
        
        start_time = datetime.utcnow()
        
        async with httpx.AsyncClient(timeout=self.config.timeout) as client:
            try:
                response = await client.post(
                    f"{self.config.base_url}/chat/completions",
                    headers=headers,
                    json=payload
                )
                response.raise_for_status()
                
                result = response.json()
                
                if "choices" not in result or not result["choices"]:
                    raise Exception("No response choices returned from Groq API")
                
                content = result["choices"][0]["message"]["content"]
                
                # Log usage statistics
                usage = result.get("usage", {})
                generation_time = (datetime.utcnow() - start_time).total_seconds()
                
                self.logger.info(f"Groq API call successful - Model: {model}, "
                               f"Tokens: {usage.get('total_tokens', 0)}, "
                               f"Time: {generation_time:.2f}s")
                
                return content
                
            except httpx.TimeoutException:
                self.logger.error("Groq API timeout")
                raise Exception("API request timed out")
            except httpx.HTTPStatusError as e:
                self.logger.error(f"Groq API HTTP error: {e.response.status_code} - {e.response.text}")
                raise Exception(f"API request failed: {e.response.status_code}")
            except Exception as e:
                self.logger.error(f"Groq API error: {e}")
                raise
    
    async def _parse_agent_code(self, generated_content: str) -> Dict[str, Any]:
        """Parse and validate generated agent code"""
        try:
            # Try to extract JSON configuration if present
            if "```json" in generated_content:
                json_start = generated_content.find("```json") + 7
                json_end = generated_content.find("```", json_start)
                json_content = generated_content[json_start:json_end].strip()
                
                try:
                    config = json.loads(json_content)
                except json.JSONDecodeError:
                    config = {}
            else:
                config = {}
            
            # Extract Python code
            if "```python" in generated_content:
                code_start = generated_content.find("```python") + 9
                code_end = generated_content.find("```", code_start)
                code_content = generated_content[code_start:code_end].strip()
            else:
                # If no code blocks, assume entire content is code
                code_content = generated_content
            
            # Validate code syntax
            try:
                compile(code_content, '<generated>', 'exec')
            except SyntaxError as e:
                self.logger.warning(f"Generated code has syntax errors: {e}")
                # Try to fix common issues or use fallback
                code_content = self._fix_common_syntax_issues(code_content)
            
            return {
                "name": config.get("name", "Generated Trading Agent"),
                "description": config.get("description", "AI-generated trading strategy"),
                "code": code_content,
                "parameters": config.get("parameters", {}),
                "tools": config.get("tools", ["binance_tools", "technical_analysis", "risk_management"]),
                "risk_settings": config.get("risk_settings", {
                    "max_position_size": 0.02,  # 2% of portfolio
                    "stop_loss": 0.05,          # 5% stop loss
                    "take_profit": 0.10         # 10% take profit
                })
            }
            
        except Exception as e:
            self.logger.error(f"Error parsing generated code: {e}")
            return {
                "name": "Generated Trading Agent",
                "description": "AI-generated trading strategy",
                "code": generated_content,
                "parameters": {},
                "tools": ["binance_tools", "technical_analysis", "risk_management"],
                "risk_settings": {
                    "max_position_size": 0.02,
                    "stop_loss": 0.05,
                    "take_profit": 0.10
                }
            }
    
    def _fix_common_syntax_issues(self, code: str) -> str:
        """Fix common syntax issues in generated code"""
        # Remove common markdown artifacts
        code = code.replace("```python", "").replace("```", "")
        
        # Fix indentation issues
        lines = code.split('\n')
        fixed_lines = []
        
        for line in lines:
            # Skip empty lines
            if not line.strip():
                fixed_lines.append(line)
                continue
            
            # Ensure proper indentation (convert tabs to spaces)
            line = line.expandtabs(4)
            fixed_lines.append(line)
        
        return '\n'.join(fixed_lines)
    
    async def _fallback_agent_generation(self, prompt: str, strategy_type: str) -> Dict[str, Any]:
        """Fallback to template-based agent generation when Groq API is unavailable"""
        self.logger.info("Using fallback agent generation")
        
        try:
            # Use the existing agent factory with enhanced templates
            agent = await self.agent_factory.create_trading_agent(
                name=f"Template {strategy_type.title()} Agent",
                description=f"Template-based {strategy_type} trading strategy: {prompt}",
                strategy_type=strategy_type,
                tools=["binance_tools", "technical_analysis", "risk_management"],
                parameters={
                    "user_prompt": prompt,
                    "generated_by": "fallback_template",
                    "timestamp": datetime.utcnow().isoformat()
                }
            )
            
            return {
                "success": True,
                "agent": agent,
                "generated_code": agent.get("code", ""),
                "model_used": "fallback_template",
                "tokens_used": 0,
                "generation_time": 0,
                "fallback": True
            }
            
        except Exception as e:
            self.logger.error(f"Error in fallback agent generation: {e}")
            raise Exception("Both Groq API and fallback generation failed")
    
    async def optimize_agent_prompt(self, agent_performance: Dict[str, Any], 
                                  original_prompt: str) -> str:
        """Use LLM to optimize agent prompts based on performance feedback"""
        if self.fallback_mode:
            return original_prompt
        
        try:
            system_prompt = """You are an expert trading strategy optimizer. 
            Analyze the performance data and suggest improvements to the original trading strategy prompt."""
            
            user_prompt = f"""
            Original Prompt: {original_prompt}
            
            Performance Data:
            - Total Return: {agent_performance.get('total_return', 0):.2%}
            - Sharpe Ratio: {agent_performance.get('sharpe_ratio', 0):.2f}
            - Max Drawdown: {agent_performance.get('max_drawdown', 0):.2%}
            - Win Rate: {agent_performance.get('win_rate', 0):.2%}
            - Total Trades: {agent_performance.get('total_trades', 0)}
            
            Suggest an improved prompt that addresses the performance issues and enhances the strategy.
            """
            
            optimized_prompt = await self._call_groq_api(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                model=self.models["balanced"]
            )
            
            return optimized_prompt.strip()
            
        except Exception as e:
            self.logger.error(f"Error optimizing agent prompt: {e}")
            return original_prompt
    
    async def explain_agent_strategy(self, agent_code: str) -> str:
        """Generate human-readable explanation of agent strategy"""
        if self.fallback_mode:
            return "Agent strategy explanation not available in fallback mode."
        
        try:
            system_prompt = """You are an expert trading strategy analyst. 
            Explain trading strategies in clear, non-technical language that any investor can understand."""
            
            user_prompt = f"""
            Analyze this trading agent code and provide a clear explanation:
            
            {agent_code[:2000]}  # Limit code length for API
            
            Explain:
            1. What trading strategy this implements
            2. How it makes buy/sell decisions
            3. What risk management it uses
            4. What market conditions it works best in
            5. Potential strengths and weaknesses
            
            Keep the explanation accessible to non-programmers.
            """
            
            explanation = await self._call_groq_api(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                model=self.models["fast"]
            )
            
            return explanation.strip()
            
        except Exception as e:
            self.logger.error(f"Error explaining agent strategy: {e}")
            return "Unable to generate strategy explanation."
    
    def get_service_status(self) -> Dict[str, Any]:
        """Get current service status and configuration"""
        return {
            "service": "GroqLLMService",
            "status": "active" if not self.fallback_mode else "fallback",
            "api_key_configured": bool(self.config.api_key),
            "model": self.config.model,
            "available_models": list(self.models.keys()),
            "max_tokens": self.config.max_tokens,
            "temperature": self.config.temperature,
            "fallback_mode": self.fallback_mode
        }

# Global service instance
groq_llm_service = GroqLLMService()
