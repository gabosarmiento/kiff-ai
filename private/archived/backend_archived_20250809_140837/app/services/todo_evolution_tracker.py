"""
Enhanced Todo Evolution Tracker for Knowledge-Driven Development
==============================================================

This tracker supports project evolution, not just creation-to-finish workflows.
It integrates with the knowledge system to provide intelligent task management
based on API documentation and project analysis.
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import json
import uuid

from agno.tools import Tool
from agno.agent import Agent
from agno.models.groq import Groq

from app.services.knowledge_driven_tools import KnowledgeRAG, APIPatternAnalyzer, ProjectAnalyzer
from app.core.config import settings

logger = logging.getLogger(__name__)


class TaskStatus(Enum):
    """Task status types"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"
    EVOLVED = "evolved"  # Task evolved into something else
    DEPRECATED = "deprecated"  # No longer needed


class TaskPriority(Enum):
    """Task priority levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TaskType(Enum):
    """Types of development tasks"""
    FEATURE = "feature"
    BUG_FIX = "bug_fix"
    INTEGRATION = "integration"
    REFACTOR = "refactor"
    DOCUMENTATION = "documentation"
    TESTING = "testing"
    DEPLOYMENT = "deployment"
    RESEARCH = "research"


@dataclass
class KnowledgeContext:
    """Knowledge context for a task"""
    api_domains: List[str] = field(default_factory=list)
    documentation_refs: List[str] = field(default_factory=list)
    implementation_patterns: List[str] = field(default_factory=list)
    dependencies: List[str] = field(default_factory=list)
    best_practices: List[str] = field(default_factory=list)


@dataclass
class TaskEvolution:
    """Represents how a task has evolved"""
    original_task_id: str
    evolution_reason: str
    evolution_timestamp: datetime
    knowledge_insights: List[str] = field(default_factory=list)
    api_changes: List[str] = field(default_factory=list)


@dataclass
class DevelopmentTask:
    """Enhanced development task with knowledge integration"""
    id: str
    title: str
    description: str
    task_type: TaskType
    status: TaskStatus
    priority: TaskPriority
    
    # Knowledge-driven fields
    knowledge_context: KnowledgeContext
    api_requirements: List[str] = field(default_factory=list)
    implementation_guidance: Dict[str, Any] = field(default_factory=dict)
    
    # Evolution tracking
    parent_task_id: Optional[str] = None
    evolution_history: List[TaskEvolution] = field(default_factory=list)
    
    # Metadata
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    estimated_hours: Optional[int] = None
    actual_hours: Optional[int] = None
    
    # Project context
    project_path: Optional[str] = None
    affected_files: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert task to dictionary for JSON serialization"""
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "task_type": self.task_type.value,
            "status": self.status.value,
            "priority": self.priority.value,
            "knowledge_context": {
                "api_domains": self.knowledge_context.api_domains,
                "documentation_refs": self.knowledge_context.documentation_refs,
                "implementation_patterns": self.knowledge_context.implementation_patterns,
                "dependencies": self.knowledge_context.dependencies,
                "best_practices": self.knowledge_context.best_practices
            },
            "api_requirements": self.api_requirements,
            "implementation_guidance": self.implementation_guidance,
            "parent_task_id": self.parent_task_id,
            "evolution_history": [
                {
                    "original_task_id": evo.original_task_id,
                    "evolution_reason": evo.evolution_reason,
                    "evolution_timestamp": evo.evolution_timestamp.isoformat(),
                    "knowledge_insights": evo.knowledge_insights,
                    "api_changes": evo.api_changes
                }
                for evo in self.evolution_history
            ],
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "estimated_hours": self.estimated_hours,
            "actual_hours": self.actual_hours,
            "project_path": self.project_path,
            "affected_files": self.affected_files
        }


class TodoEvolutionTracker(Tool):
    """
    Enhanced todo tracker that supports project evolution and knowledge-driven task management
    """
    
    def __init__(self):
        super().__init__(
            name="TodoEvolutionTracker",
            description="Manage and evolve development tasks with knowledge-driven insights"
        )
        self.tasks: Dict[str, DevelopmentTask] = {}
        self.knowledge_rag = KnowledgeRAG()
        self.project_analyzer = ProjectAnalyzer()
        self.api_pattern_analyzer = APIPatternAnalyzer()
    
    def run(self, action: str, **kwargs) -> Dict[str, Any]:
        """
        Main entry point for todo tracker operations
        
        Actions:
        - create_task: Create a new development task
        - evolve_task: Evolve an existing task based on new insights
        - analyze_project_tasks: Analyze project and suggest tasks
        - update_task: Update task status or details
        - get_tasks: Retrieve tasks with filtering
        - get_knowledge_insights: Get knowledge-driven insights for a task
        """
        
        action_map = {
            "create_task": self._create_task,
            "evolve_task": self._evolve_task,
            "analyze_project_tasks": self._analyze_project_tasks,
            "update_task": self._update_task,
            "get_tasks": self._get_tasks,
            "get_knowledge_insights": self._get_knowledge_insights,
            "suggest_next_tasks": self._suggest_next_tasks
        }
        
        if action not in action_map:
            return {
                "success": False,
                "error": f"Unknown action: {action}",
                "available_actions": list(action_map.keys())
            }
        
        try:
            return action_map[action](**kwargs)
        except Exception as e:
            logger.error(f"TodoEvolutionTracker error in {action}: {e}")
            return {"success": False, "error": str(e)}
    
    def _create_task(self, title: str, description: str, task_type: str = "feature", 
                    priority: str = "medium", project_path: str = None, 
                    api_domains: List[str] = None) -> Dict[str, Any]:
        """Create a new development task with knowledge context"""
        
        task_id = str(uuid.uuid4())
        
        # Get knowledge context if API domains are specified
        knowledge_context = KnowledgeContext()
        implementation_guidance = {}
        
        if api_domains:
            knowledge_context.api_domains = api_domains
            
            # Get implementation guidance for each API domain
            for domain in api_domains:
                rag_result = self.knowledge_rag.run(domain, f"{title} {description}", limit=3)
                if rag_result.get("success"):
                    implementation_guidance[domain] = rag_result["results"]
                    
                    # Extract best practices
                    for result in rag_result["results"]:
                        if "best practice" in result["content"].lower():
                            knowledge_context.best_practices.append(result["content"][:200])
        
        # Analyze project if path provided
        if project_path:
            project_analysis = self.project_analyzer.run(project_path)
            if project_analysis.get("success"):
                # Add suggested integrations as dependencies
                for suggestion in project_analysis.get("integration_suggestions", []):
                    knowledge_context.dependencies.append(suggestion["api"])
        
        task = DevelopmentTask(
            id=task_id,
            title=title,
            description=description,
            task_type=TaskType(task_type),
            status=TaskStatus.PENDING,
            priority=TaskPriority(priority),
            knowledge_context=knowledge_context,
            api_requirements=api_domains or [],
            implementation_guidance=implementation_guidance,
            project_path=project_path
        )
        
        self.tasks[task_id] = task
        
        return {
            "success": True,
            "task_id": task_id,
            "task": task.to_dict(),
            "message": f"Created task '{title}' with knowledge context",
            "knowledge_insights": len(implementation_guidance) > 0
        }
    
    def _evolve_task(self, task_id: str, evolution_reason: str, 
                    new_title: str = None, new_description: str = None,
                    new_api_domains: List[str] = None) -> Dict[str, Any]:
        """Evolve an existing task based on new insights or requirements"""
        
        if task_id not in self.tasks:
            return {"success": False, "error": "Task not found"}
        
        original_task = self.tasks[task_id]
        
        # Create evolution record
        evolution = TaskEvolution(
            original_task_id=task_id,
            evolution_reason=evolution_reason,
            evolution_timestamp=datetime.utcnow()
        )
        
        # Get new knowledge insights if API domains changed
        if new_api_domains:
            for domain in new_api_domains:
                if domain not in original_task.knowledge_context.api_domains:
                    rag_result = self.knowledge_rag.run(
                        domain, 
                        f"{new_title or original_task.title} {new_description or original_task.description}",
                        limit=2
                    )
                    if rag_result.get("success"):
                        evolution.knowledge_insights.extend([
                            f"New {domain} capability: {result['content'][:100]}..."
                            for result in rag_result["results"]
                        ])
                        evolution.api_changes.append(f"Added {domain} integration")
        
        # Update task
        if new_title:
            original_task.title = new_title
        if new_description:
            original_task.description = new_description
        if new_api_domains:
            original_task.knowledge_context.api_domains.extend(new_api_domains)
            original_task.api_requirements.extend(new_api_domains)
        
        original_task.evolution_history.append(evolution)
        original_task.updated_at = datetime.utcnow()
        original_task.status = TaskStatus.EVOLVED
        
        return {
            "success": True,
            "task_id": task_id,
            "evolution": {
                "reason": evolution_reason,
                "knowledge_insights": evolution.knowledge_insights,
                "api_changes": evolution.api_changes
            },
            "updated_task": original_task.to_dict(),
            "message": f"Evolved task '{original_task.title}'"
        }
    
    def _analyze_project_tasks(self, project_path: str) -> Dict[str, Any]:
        """Analyze project and suggest development tasks"""
        
        # Analyze project structure
        project_analysis = self.project_analyzer.run(project_path)
        if not project_analysis.get("success"):
            return project_analysis
        
        # Analyze API patterns
        api_analysis = self.api_pattern_analyzer.run(project_path)
        
        suggested_tasks = []
        
        # Generate tasks based on project analysis
        analysis = project_analysis["analysis"]
        
        # Authentication tasks
        if not analysis.get("has_auth"):
            suggested_tasks.append({
                "title": "Implement User Authentication",
                "description": "Add secure user authentication and authorization system",
                "task_type": "integration",
                "priority": "high",
                "api_domains": ["auth0", "supabase"],
                "estimated_hours": 8
            })
        
        # Payment integration tasks
        if analysis.get("has_api") and analysis.get("has_database"):
            suggested_tasks.append({
                "title": "Add Payment Processing",
                "description": "Integrate payment processing for monetization",
                "task_type": "integration", 
                "priority": "medium",
                "api_domains": ["stripe"],
                "estimated_hours": 12
            })
        
        # API improvement tasks
        if api_analysis.get("success") and api_analysis.get("suggestions"):
            for suggestion in api_analysis["suggestions"]:
                suggested_tasks.append({
                    "title": f"API Improvement: {suggestion}",
                    "description": f"Implement suggested improvement: {suggestion}",
                    "task_type": "refactor",
                    "priority": "medium",
                    "estimated_hours": 4
                })
        
        # Create tasks
        created_tasks = []
        for task_data in suggested_tasks:
            result = self._create_task(
                title=task_data["title"],
                description=task_data["description"],
                task_type=task_data["task_type"],
                priority=task_data["priority"],
                project_path=project_path,
                api_domains=task_data.get("api_domains", [])
            )
            if result.get("success"):
                created_tasks.append(result["task"])
        
        return {
            "success": True,
            "project_path": project_path,
            "project_analysis": analysis,
            "suggested_tasks_count": len(suggested_tasks),
            "created_tasks": created_tasks,
            "message": f"Analyzed project and created {len(created_tasks)} tasks"
        }
    
    def _update_task(self, task_id: str, status: str = None, priority: str = None,
                    estimated_hours: int = None, actual_hours: int = None,
                    affected_files: List[str] = None) -> Dict[str, Any]:
        """Update task details"""
        
        if task_id not in self.tasks:
            return {"success": False, "error": "Task not found"}
        
        task = self.tasks[task_id]
        
        if status:
            task.status = TaskStatus(status)
        if priority:
            task.priority = TaskPriority(priority)
        if estimated_hours is not None:
            task.estimated_hours = estimated_hours
        if actual_hours is not None:
            task.actual_hours = actual_hours
        if affected_files:
            task.affected_files.extend(affected_files)
        
        task.updated_at = datetime.utcnow()
        
        return {
            "success": True,
            "task_id": task_id,
            "updated_task": task.to_dict(),
            "message": f"Updated task '{task.title}'"
        }
    
    def _get_tasks(self, status: str = None, priority: str = None, 
                  task_type: str = None, project_path: str = None) -> Dict[str, Any]:
        """Get tasks with optional filtering"""
        
        filtered_tasks = []
        
        for task in self.tasks.values():
            # Apply filters
            if status and task.status.value != status:
                continue
            if priority and task.priority.value != priority:
                continue
            if task_type and task.task_type.value != task_type:
                continue
            if project_path and task.project_path != project_path:
                continue
            
            filtered_tasks.append(task.to_dict())
        
        # Sort by priority and creation date
        priority_order = {"critical": 4, "high": 3, "medium": 2, "low": 1}
        filtered_tasks.sort(
            key=lambda t: (priority_order.get(t["priority"], 0), t["created_at"]),
            reverse=True
        )
        
        return {
            "success": True,
            "tasks": filtered_tasks,
            "total_count": len(filtered_tasks),
            "filters_applied": {
                "status": status,
                "priority": priority,
                "task_type": task_type,
                "project_path": project_path
            }
        }
    
    def _get_knowledge_insights(self, task_id: str) -> Dict[str, Any]:
        """Get knowledge-driven insights for a specific task"""
        
        if task_id not in self.tasks:
            return {"success": False, "error": "Task not found"}
        
        task = self.tasks[task_id]
        insights = {
            "api_documentation": {},
            "implementation_patterns": [],
            "best_practices": task.knowledge_context.best_practices,
            "dependencies": task.knowledge_context.dependencies,
            "evolution_insights": []
        }
        
        # Get fresh documentation insights
        for domain in task.knowledge_context.api_domains:
            rag_result = self.knowledge_rag.run(domain, task.title, limit=2)
            if rag_result.get("success"):
                insights["api_documentation"][domain] = rag_result["results"]
        
        # Get evolution insights
        for evolution in task.evolution_history:
            insights["evolution_insights"].append({
                "reason": evolution.evolution_reason,
                "timestamp": evolution.evolution_timestamp.isoformat(),
                "knowledge_insights": evolution.knowledge_insights,
                "api_changes": evolution.api_changes
            })
        
        return {
            "success": True,
            "task_id": task_id,
            "task_title": task.title,
            "insights": insights,
            "message": f"Retrieved knowledge insights for '{task.title}'"
        }
    
    def _suggest_next_tasks(self, completed_task_id: str) -> Dict[str, Any]:
        """Suggest next tasks based on a completed task"""
        
        if completed_task_id not in self.tasks:
            return {"success": False, "error": "Task not found"}
        
        completed_task = self.tasks[completed_task_id]
        suggestions = []
        
        # Suggest follow-up tasks based on task type and API domains
        if completed_task.task_type == TaskType.INTEGRATION:
            # Suggest testing and documentation tasks
            suggestions.extend([
                {
                    "title": f"Test {completed_task.title}",
                    "description": f"Write comprehensive tests for {completed_task.title}",
                    "task_type": "testing",
                    "priority": "high"
                },
                {
                    "title": f"Document {completed_task.title}",
                    "description": f"Create documentation for {completed_task.title}",
                    "task_type": "documentation",
                    "priority": "medium"
                }
            ])
        
        # Suggest related API integrations
        for domain in completed_task.knowledge_context.api_domains:
            if domain == "stripe":
                suggestions.append({
                    "title": "Implement Webhook Handling",
                    "description": "Add webhook endpoints for payment events",
                    "task_type": "feature",
                    "priority": "high",
                    "api_domains": ["stripe"]
                })
            elif domain == "openai":
                suggestions.append({
                    "title": "Add Content Moderation",
                    "description": "Implement AI-powered content moderation",
                    "task_type": "feature",
                    "priority": "medium",
                    "api_domains": ["openai"]
                })
        
        return {
            "success": True,
            "completed_task": completed_task.to_dict(),
            "suggested_tasks": suggestions,
            "message": f"Generated {len(suggestions)} follow-up task suggestions"
        }


# Factory function for easy integration
def create_todo_evolution_tracker() -> TodoEvolutionTracker:
    """Create a TodoEvolutionTracker instance"""
    return TodoEvolutionTracker()
