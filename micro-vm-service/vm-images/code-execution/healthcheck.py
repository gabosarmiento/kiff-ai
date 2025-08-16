#!/usr/bin/env python3
"""
Health check script for code execution VM
"""

import sys
import subprocess
import os

def check_python():
    """Check if Python is working"""
    try:
        result = subprocess.run([sys.executable, "-c", "print('Python OK')"], 
                              capture_output=True, text=True, timeout=5)
        return result.returncode == 0
    except:
        return False

def check_node():
    """Check if Node.js is working"""
    try:
        result = subprocess.run(["node", "-e", "console.log('Node OK')"], 
                              capture_output=True, text=True, timeout=5)
        return result.returncode == 0
    except:
        return False

def check_filesystem():
    """Check if filesystem is accessible"""
    try:
        test_file = "/workspace/.health_check"
        with open(test_file, "w") as f:
            f.write("test")
        os.remove(test_file)
        return True
    except:
        return False

def main():
    """Run all health checks"""
    checks = [
        ("Python", check_python),
        ("Node.js", check_node),
        ("Filesystem", check_filesystem)
    ]
    
    all_passed = True
    for name, check_func in checks:
        if check_func():
            print(f"✓ {name} health check passed")
        else:
            print(f"✗ {name} health check failed")
            all_passed = False
    
    if all_passed:
        print("All health checks passed")
        sys.exit(0)
    else:
        print("Some health checks failed")
        sys.exit(1)

if __name__ == "__main__":
    main()