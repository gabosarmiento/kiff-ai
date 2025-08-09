#!/bin/bash

# Database Cleanup Script for kiff Transformation
# Usage: ./scripts/cleanup_db.sh [--dry-run] [--confirm]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 kiff Database Cleanup${NC}"
echo "=================================="

# Check if we're in the backend directory
if [ ! -f "app/main.py" ]; then
    echo -e "${RED}❌ Please run this script from the backend directory${NC}"
    exit 1
fi

# Check if virtual environment is activated
if [ -z "$VIRTUAL_ENV" ] && [ ! -f "poetry.lock" ]; then
    echo -e "${YELLOW}⚠️  Warning: No virtual environment detected${NC}"
    echo "Consider activating your virtual environment first:"
    echo "  source venv/bin/activate  # or"
    echo "  poetry shell"
    echo ""
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    echo "Please create a .env file with database configuration"
    exit 1
fi

# Run the Python cleanup script
echo -e "${GREEN}🔄 Running database cleanup script...${NC}"
python scripts/cleanup_database_for_kiff.py "$@"

echo -e "${GREEN}✅ Database cleanup script completed${NC}"
