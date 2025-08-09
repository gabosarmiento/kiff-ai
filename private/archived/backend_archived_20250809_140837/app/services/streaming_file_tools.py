"""
Streaming File Tools for Generate V0
===================================

Custom FileTools wrapper that captures file creation events
and streams them for real-time display in the frontend.
"""

import os
import asyncio
from typing import Dict, List, Any, Optional, Callable
from pathlib import Path
from agno.tools.file import FileTools

class StreamingFileTools:
    """FileTools wrapper that captures and streams file creation events"""
    
    def __init__(self, output_dir: str, on_file_created: Optional[Callable] = None):
        self.file_tools = FileTools()
        self.output_dir = output_dir
        self.on_file_created = on_file_created
        self.created_files = []
    
    def write_file(self, filename: str, content: str) -> str:
        """Write file and capture the event for streaming"""
        
        # Ensure filename is relative to output directory
        if not filename.startswith(self.output_dir):
            full_path = os.path.join(self.output_dir, filename)
        else:
            full_path = filename
            filename = os.path.relpath(full_path, self.output_dir)
        
        # Create directory if needed
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        # Write the file using original FileTools
        result = self.file_tools.write_file(full_path, content)
        
        # Capture file information
        file_info = {
            "name": os.path.basename(filename),
            "path": filename,
            "content": content,
            "language": self._detect_language(filename),
            "size": len(content)
        }
        
        self.created_files.append(file_info)
        
        # Notify callback if provided
        if self.on_file_created:
            try:
                self.on_file_created(file_info)
            except Exception as e:
                print(f"Error in file creation callback: {e}")
        
        return result
    
    def read_file(self, filename: str) -> str:
        """Read file using original FileTools"""
        return self.file_tools.read_file(filename)
    
    def list_files(self, directory: str = ".") -> List[str]:
        """List files using original FileTools"""
        return self.file_tools.list_files(directory)
    
    def _detect_language(self, filename: str) -> str:
        """Detect programming language from filename"""
        ext = Path(filename).suffix.lower()
        language_map = {
            '.py': 'python',
            '.js': 'javascript', 
            '.ts': 'typescript',
            '.html': 'html',
            '.css': 'css',
            '.json': 'json',
            '.md': 'markdown',
            '.txt': 'text',
            '.yml': 'yaml',
            '.yaml': 'yaml',
            '.sh': 'bash',
            '.dockerfile': 'dockerfile'
        }
        return language_map.get(ext, 'text')
    
    def get_created_files(self) -> List[Dict[str, Any]]:
        """Get all files created during this session"""
        return self.created_files.copy()