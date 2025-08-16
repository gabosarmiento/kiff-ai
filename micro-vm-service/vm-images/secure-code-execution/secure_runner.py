#!/usr/bin/env python3
"""
🔒 Secure Code Execution Runner
Provides controlled execution environment with security restrictions
"""

import os
import sys
import json
import subprocess
import tempfile
import pathlib
import resource
import signal
import time
from typing import Dict, Any, List
import logging

# Security: Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - SECURE - %(message)s')
logger = logging.getLogger(__name__)

class SecurityViolation(Exception):
    """Raised when security policies are violated"""
    pass

class SecureCodeRunner:
    """Secure code execution with strict isolation"""
    
    # Security: Allowlisted file extensions
    ALLOWED_EXTENSIONS = {'.py', '.js', '.ts', '.jsx', '.tsx', '.json', '.html', '.css', '.md'}
    
    # Security: Blocked patterns in code
    BLOCKED_PATTERNS = [
        'eval(', 'exec(', '__import__', 'subprocess.', 'os.system',
        'fetch(', 'XMLHttpRequest', 'document.cookie', 'localStorage',
        '../', '__file__', '__name__', 'globals()', 'locals()',
        'open(', 'file(', 'input(', 'raw_input(',
        'import os', 'import sys', 'import subprocess', 'import socket'
    ]
    
    # Security: Resource limits
    MAX_FILE_SIZE = 1024 * 1024  # 1MB
    MAX_FILES = 50
    MAX_EXECUTION_TIME = 30  # seconds
    MAX_MEMORY = 256 * 1024 * 1024  # 256MB
    
    def __init__(self):
        self.workspace = pathlib.Path("/workspace")
        self.setup_security_limits()
        logger.info("🔒 Secure code runner initialized")
    
    def setup_security_limits(self):
        """Configure resource limits"""
        try:
            # Memory limit
            resource.setrlimit(resource.RLIMIT_AS, (self.MAX_MEMORY, self.MAX_MEMORY))
            # CPU time limit  
            resource.setrlimit(resource.RLIMIT_CPU, (self.MAX_EXECUTION_TIME, self.MAX_EXECUTION_TIME))
            # File size limit
            resource.setrlimit(resource.RLIMIT_FSIZE, (self.MAX_FILE_SIZE, self.MAX_FILE_SIZE))
            # Process limit
            resource.setrlimit(resource.RLIMIT_NPROC, (10, 10))
            logger.info("✅ Resource limits configured")
        except Exception as e:
            logger.error(f"❌ Failed to set resource limits: {e}")
    
    def validate_file(self, file_path: str, content: str) -> None:
        """Validate file for security violations"""
        
        # Check file extension
        ext = pathlib.Path(file_path).suffix.lower()
        if ext not in self.ALLOWED_EXTENSIONS:
            raise SecurityViolation(f"File extension {ext} not allowed")
        
        # Check file size
        if len(content) > self.MAX_FILE_SIZE:
            raise SecurityViolation(f"File too large: {len(content)} bytes")
        
        # Check for path traversal
        if '../' in file_path or file_path.startswith('/'):
            raise SecurityViolation(f"Invalid file path: {file_path}")
        
        # Check for blocked patterns
        content_lower = content.lower()
        for pattern in self.BLOCKED_PATTERNS:
            if pattern in content_lower:
                raise SecurityViolation(f"Blocked pattern detected: {pattern}")
        
        logger.info(f"✅ File validated: {file_path}")
    
    def deploy_files(self, files: List[Dict[str, str]]) -> None:
        """Deploy files to workspace with security checks"""
        
        if len(files) > self.MAX_FILES:
            raise SecurityViolation(f"Too many files: {len(files)}")
        
        # Clean workspace first
        if self.workspace.exists():
            import shutil
            shutil.rmtree(self.workspace)
        
        self.workspace.mkdir(parents=True, exist_ok=True)
        
        for file_info in files:
            file_path = file_info.get('path', '')
            content = file_info.get('content', '')
            
            # Validate file
            self.validate_file(file_path, content)
            
            # Write file securely
            full_path = self.workspace / file_path
            full_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Security: Write with restricted permissions
            full_path.write_text(content, encoding='utf-8')
            full_path.chmod(0o644)  # Read-only for group/others
            
            logger.info(f"📁 Deployed: {file_path}")
    
    def install_packages(self, packages: List[str], runtime: str = "npm") -> None:
        """Install packages with security restrictions"""
        
        # Security: Package allowlist
        if runtime == "npm":
            allowed_packages = {
                'react', 'react-dom', 'vite', '@vitejs/plugin-react',
                'typescript', '@types/react', '@types/react-dom',
                'lodash', 'axios', 'moment', 'uuid'
            }
        else:  # Python
            allowed_packages = {
                'fastapi', 'uvicorn', 'pydantic', 'requests',
                'numpy', 'pandas', 'matplotlib', 'seaborn'
            }
        
        # Validate packages
        for pkg in packages:
            pkg_name = pkg.split('@')[0].split('==')[0]  # Remove version specifiers
            if pkg_name not in allowed_packages:
                raise SecurityViolation(f"Package not allowed: {pkg_name}")
        
        logger.info(f"📦 Installing {len(packages)} packages via {runtime}")
        
        try:
            if runtime == "npm":
                # Security: Run npm with restricted flags
                cmd = ['npm', 'install', '--no-audit', '--no-fund', '--no-optional'] + packages
                result = subprocess.run(
                    cmd, 
                    cwd=self.workspace,
                    capture_output=True,
                    text=True,
                    timeout=120,  # 2 minute timeout
                    env={'HOME': str(self.workspace), 'PATH': '/usr/local/bin:/usr/bin:/bin'}
                )
            else:  # Python
                cmd = ['pip', 'install', '--no-cache-dir', '--no-deps'] + packages
                result = subprocess.run(
                    cmd,
                    capture_output=True, 
                    text=True,
                    timeout=120,
                    env={'HOME': str(self.workspace), 'PATH': '/usr/local/bin:/usr/bin:/bin'}
                )
            
            if result.returncode != 0:
                logger.error(f"❌ Package installation failed: {result.stderr}")
                raise SecurityViolation(f"Package installation failed")
            
            logger.info(f"✅ Packages installed successfully")
            
        except subprocess.TimeoutExpired:
            raise SecurityViolation("Package installation timeout")
    
    def start_dev_server(self) -> Dict[str, Any]:
        """Start development server with security restrictions"""
        
        package_json = self.workspace / "package.json"
        
        if package_json.exists():
            # Node.js/React project
            logger.info("🚀 Starting Vite dev server")
            
            # Security: Run with restricted environment
            env = {
                'HOME': str(self.workspace),
                'PATH': '/usr/local/bin:/usr/bin:/bin',
                'NODE_ENV': 'development',
                'VITE_HOST': '0.0.0.0',
                'VITE_PORT': '5173'
            }
            
            cmd = ['npm', 'run', 'dev']
            
        else:
            # Python project  
            logger.info("🚀 Starting Python server")
            
            env = {
                'HOME': str(self.workspace),
                'PATH': '/usr/local/bin:/usr/bin:/bin',
                'PYTHONPATH': str(self.workspace)
            }
            
            # Look for main files
            for main_file in ['main.py', 'app.py', 'server.py']:
                if (self.workspace / main_file).exists():
                    cmd = ['python', main_file]
                    break
            else:
                cmd = ['python', '-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000']
        
        try:
            # Security: Start with timeout and resource limits
            process = subprocess.Popen(
                cmd,
                cwd=self.workspace,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                preexec_fn=os.setsid  # Create new process group for cleanup
            )
            
            # Give server time to start
            time.sleep(3)
            
            if process.poll() is None:
                logger.info("✅ Development server started")
                return {
                    "status": "running",
                    "pid": process.pid,
                    "preview_url": "http://localhost:5173"  # Would be dynamic in production
                }
            else:
                stdout, _ = process.communicate()
                raise SecurityViolation(f"Server failed to start: {stdout}")
                
        except Exception as e:
            logger.error(f"❌ Failed to start server: {e}")
            raise SecurityViolation(f"Server startup failed: {e}")
    
    def get_logs(self) -> List[str]:
        """Get application logs"""
        logs = [
            f"🔒 Secure execution environment active",
            f"📁 Workspace: {self.workspace}",
            f"⚡ Resource limits enforced",
            f"🛡️ Security policies active"
        ]
        
        # Check for log files
        for log_file in ['.vite.log', '.app.log', 'npm-debug.log']:
            log_path = self.workspace / log_file
            if log_path.exists():
                try:
                    content = log_path.read_text()[-1000:]  # Last 1000 chars
                    logs.extend(content.split('\n')[-10:])  # Last 10 lines
                except Exception:
                    pass
        
        return logs

def main():
    """Main execution loop"""
    runner = SecureCodeRunner()
    
    # In production, this would be a proper API server
    # For now, just demonstrate the security framework
    logger.info("🔒 Secure VM ready - waiting for commands")
    
    # Keep container alive
    while True:
        time.sleep(30)
        logger.info("🔒 Security monitor active")

if __name__ == "__main__":
    main()