from fastapi import WebSocket
from typing import Dict, List
import json
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    """WebSocket connection manager for real-time communication"""
    
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        """Connect a new WebSocket client"""
        await websocket.accept()
        
        if client_id not in self.active_connections:
            self.active_connections[client_id] = []
        
        self.active_connections[client_id].append(websocket)
        logger.info(f"WebSocket connected: {client_id}")
    
    def disconnect(self, websocket: WebSocket, client_id: str):
        """Disconnect a WebSocket client"""
        if client_id in self.active_connections:
            if websocket in self.active_connections[client_id]:
                self.active_connections[client_id].remove(websocket)
            
            # Clean up empty lists
            if not self.active_connections[client_id]:
                del self.active_connections[client_id]
        
        logger.info(f"WebSocket disconnected: {client_id}")
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        """Send a message to a specific WebSocket connection"""
        try:
            await websocket.send_text(message)
        except Exception as e:
            logger.error(f"Error sending WebSocket message: {e}")
    
    async def broadcast_to_client(self, message: str, client_id: str):
        """Broadcast a message to all connections for a specific client"""
        if client_id in self.active_connections:
            disconnected = []
            
            for connection in self.active_connections[client_id]:
                try:
                    await connection.send_text(message)
                except Exception as e:
                    logger.error(f"Error broadcasting to {client_id}: {e}")
                    disconnected.append(connection)
            
            # Remove disconnected connections
            for connection in disconnected:
                self.disconnect(connection, client_id)
    
    async def broadcast_to_all(self, message: str):
        """Broadcast a message to all connected clients"""
        for client_id in list(self.active_connections.keys()):
            await self.broadcast_to_client(message, client_id)
    
    def get_connection_count(self) -> int:
        """Get total number of active connections"""
        return sum(len(connections) for connections in self.active_connections.values())
    
    def get_client_connections(self, client_id: str) -> int:
        """Get number of connections for a specific client"""
        return len(self.active_connections.get(client_id, []))
