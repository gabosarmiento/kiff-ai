"""
Token Tracking API Routes
========================

Real-time token consumption tracking API with WebSocket support
"""

import asyncio
import json
import logging
from typing import Dict, List, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from app.core.token_tracker import get_token_tracker, cleanup_tracker, get_tenant_usage, TokenUsage
from app.middleware.tenant_middleware import get_current_tenant

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/token-tracking", tags=["token-tracking"])

# WebSocket connection manager for token updates
class TokenWebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, session_key: str):
        await websocket.accept()
        if session_key not in self.active_connections:
            self.active_connections[session_key] = []
        self.active_connections[session_key].append(websocket)
        logger.info(f"WebSocket connected for session: {session_key}")
    
    def disconnect(self, websocket: WebSocket, session_key: str):
        if session_key in self.active_connections:
            if websocket in self.active_connections[session_key]:
                self.active_connections[session_key].remove(websocket)
            if not self.active_connections[session_key]:
                del self.active_connections[session_key]
        logger.info(f"WebSocket disconnected for session: {session_key}")
    
    async def broadcast_usage(self, session_key: str, usage: TokenUsage):
        """Broadcast token usage update to all connected clients for this session"""
        if session_key in self.active_connections:
            message = json.dumps({
                "type": "token_update",
                "data": usage.to_dict(),
                "timestamp": asyncio.get_event_loop().time()
            })
            
            # Remove disconnected websockets
            disconnected = []
            for websocket in self.active_connections[session_key]:
                try:
                    await websocket.send_text(message)
                except:
                    disconnected.append(websocket)
            
            # Clean up disconnected websockets
            for ws in disconnected:
                self.disconnect(ws, session_key)

# Global WebSocket manager
ws_manager = TokenWebSocketManager()

@router.websocket("/ws/{tenant_id}/{user_id}/{session_id}")
async def websocket_token_tracking(
    websocket: WebSocket,
    tenant_id: str,
    user_id: str,
    session_id: str
):
    """WebSocket endpoint for real-time token tracking updates"""
    session_key = f"{tenant_id}:{user_id}:{session_id}"
    
    await ws_manager.connect(websocket, session_key)
    
    # Get or create token tracker and add WebSocket callback
    tracker = get_token_tracker(tenant_id, user_id, session_id)
    
    def token_callback(usage: TokenUsage):
        """Callback to broadcast token updates via WebSocket"""
        asyncio.create_task(ws_manager.broadcast_usage(session_key, usage))
    
    tracker.add_callback(token_callback)
    
    try:
        # Send current usage immediately
        current_usage = tracker.get_current_usage()
        await websocket.send_text(json.dumps({
            "type": "token_update",
            "data": current_usage.to_dict(),
            "timestamp": asyncio.get_event_loop().time()
        }))
        
        # Keep connection alive and handle client messages
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle different message types
                if message.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
                elif message.get("type") == "reset_tokens":
                    tracker.reset()
                    
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"WebSocket error: {e}")
                break
                
    except WebSocketDisconnect:
        pass
    finally:
        # Clean up
        tracker.remove_callback(token_callback)
        ws_manager.disconnect(websocket, session_key)

@router.get("/usage/{tenant_id}/{user_id}/{session_id}")
async def get_token_usage(
    tenant_id: str,
    user_id: str,
    session_id: str
):
    """Get current token usage for a session"""
    try:
        tracker = get_token_tracker(tenant_id, user_id, session_id)
        usage = tracker.get_current_usage()
        
        return JSONResponse(content={
            "success": True,
            "data": usage.to_dict(),
            "session_id": session_id
        })
        
    except Exception as e:
        logger.error(f"Error getting token usage: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reset/{tenant_id}/{user_id}/{session_id}")
async def reset_token_usage(
    tenant_id: str,
    user_id: str,
    session_id: str
):
    """Reset token usage for a session"""
    try:
        tracker = get_token_tracker(tenant_id, user_id, session_id)
        tracker.reset()
        
        return JSONResponse(content={
            "success": True,
            "message": "Token usage reset successfully",
            "session_id": session_id
        })
        
    except Exception as e:
        logger.error(f"Error resetting token usage: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/session/{tenant_id}/{user_id}/{session_id}")
async def cleanup_token_session(
    tenant_id: str,
    user_id: str,
    session_id: str
):
    """Clean up token tracking session"""
    try:
        cleanup_tracker(tenant_id, user_id, session_id)
        
        return JSONResponse(content={
            "success": True,
            "message": "Token tracking session cleaned up",
            "session_id": session_id
        })
        
    except Exception as e:
        logger.error(f"Error cleaning up session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tenant/{tenant_id}")
async def get_tenant_token_usage(tenant_id: str):
    """Get aggregated token usage for a tenant"""
    try:
        usage = get_tenant_usage(tenant_id)
        
        return JSONResponse(content={
            "success": True,
            "data": {
                "tenant_id": tenant_id,
                "usage": usage.to_dict()
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting tenant usage: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.websocket("/ws/tenant/{tenant_id}")
async def websocket_tenant_token_tracking(websocket: WebSocket, tenant_id: str):
    """WebSocket endpoint for real-time tenant-level token tracking"""
    session_key = f"tenant:{tenant_id}"
    
    await ws_manager.connect(websocket, session_key)
    
    # Send initial tenant usage
    try:
        current_usage = get_tenant_usage(tenant_id)
        await websocket.send_text(json.dumps({
            "type": "tenant_token_update",
            "data": current_usage.to_dict(),
            "tenant_id": tenant_id,
            "timestamp": asyncio.get_event_loop().time()
        }))
    except Exception as e:
        logger.error(f"Error sending initial tenant usage: {e}")
    
    try:
        # Keep connection alive and send periodic updates
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                if message.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
                elif message.get("type") == "get_tenant_usage":
                    usage = get_tenant_usage(tenant_id)
                    await websocket.send_text(json.dumps({
                        "type": "tenant_token_update",
                        "data": usage.to_dict(),
                        "tenant_id": tenant_id,
                        "timestamp": asyncio.get_event_loop().time()
                    }))
                    
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"Tenant WebSocket error: {e}")
                break
                
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(websocket, session_key)

@router.get("/sessions")
async def get_active_sessions():
    """Get list of active token tracking sessions (admin only)"""
    try:
        from app.core.token_tracker import _active_trackers, _tenant_usage
        
        sessions = []
        for tracker_key, tracker in _active_trackers.items():
            usage = tracker.get_current_usage()
            sessions.append({
                "session_key": tracker_key,
                "tenant_id": tracker.tenant_id,
                "user_id": tracker.user_id,
                "session_id": tracker.session_id,
                "usage": usage.to_dict(),
                "is_active": tracker.is_active
            })
        
        # Also include tenant aggregates
        tenant_aggregates = []
        for tenant_id, usage in _tenant_usage.items():
            tenant_aggregates.append({
                "tenant_id": tenant_id,
                "usage": usage.to_dict()
            })
        
        return JSONResponse(content={
            "success": True,
            "data": {
                "active_sessions": len(sessions),
                "sessions": sessions,
                "tenant_aggregates": tenant_aggregates
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting active sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))