#!/usr/bin/env python3
"""
Admin API Pre-indexing Script
=============================

This script helps administrators pre-index APIs for the cost-sharing cache workflow.
Run this script to index popular APIs that users can then access for fractional costs.

Usage:
    python admin_preindex_apis.py
    python admin_preindex_apis.py --api agno
    python admin_preindex_apis.py --priority high
"""

import asyncio
import logging
import sys
import argparse
from pathlib import Path

# Add backend to Python path
sys.path.append(str(Path(__file__).parent / "backend"))

from app.core.api_indexing_cache import get_cache_service
from app.knowledge.api_gallery import get_api_gallery, APIPriority

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

async def preindex_single_api(api_name: str, force_reindex: bool = False):
    """Pre-index a single API"""
    logger.info(f"🔧 Starting pre-indexing for API: {api_name}")
    
    cache_service = get_cache_service()
    gallery = get_api_gallery()
    
    # Get API details
    api = gallery.get_api(api_name)
    if not api:
        logger.error(f"❌ API '{api_name}' not found in gallery")
        available_apis = [api.name for api in gallery.get_all_apis()]
        logger.info(f"📚 Available APIs: {', '.join(available_apis)}")
        return False
    
    logger.info(f"📚 Pre-indexing {api.display_name}...")
    logger.info(f"🔗 Documentation URLs: {len(api.documentation_urls)} URLs")
    logger.info(f"🏷️  Category: {api.category.value}")
    logger.info(f"⭐ Priority: {api.priority.name}")
    
    try:
        success, cache_entry = await cache_service.admin_pre_index_api(
            api_name, 
            force_reindex=force_reindex
        )
        
        if success:
            logger.info(f"✅ Pre-indexing successful!")
            logger.info(f"💰 Original cost: ${cache_entry.original_indexing_cost:.4f}")
            logger.info(f"💵 Fractional cost for users: ${cache_entry.fractional_cost:.2f}")
            logger.info(f"📊 URLs indexed: {cache_entry.total_urls_indexed}")
            logger.info(f"🔤 Tokens used: {cache_entry.tokens_used}")
            logger.info(f"🗂️  Cache key: {cache_entry.cache_key}")
            return True
        else:
            logger.error(f"❌ Pre-indexing failed for {api_name}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error pre-indexing {api_name}: {str(e)}")
        return False

async def preindex_by_priority(priority: APIPriority):
    """Pre-index all APIs of a specific priority level"""
    logger.info(f"🔧 Pre-indexing all {priority.name} priority APIs")
    
    gallery = get_api_gallery()
    apis = gallery.get_apis_by_priority(priority)
    
    if not apis:
        logger.warning(f"⚠️  No APIs found with {priority.name} priority")
        return
    
    logger.info(f"📚 Found {len(apis)} APIs with {priority.name} priority:")
    for api in apis:
        logger.info(f"  - {api.name} ({api.display_name})")
    
    results = []
    for api in apis:
        logger.info(f"\n{'='*60}")
        success = await preindex_single_api(api.name)
        results.append((api.name, success))
    
    # Summary
    logger.info(f"\n{'='*60}")
    logger.info(f"📊 Pre-indexing Summary for {priority.name} Priority APIs:")
    successful = sum(1 for _, success in results if success)
    total = len(results)
    
    for api_name, success in results:
        status = "✅ SUCCESS" if success else "❌ FAILED"
        logger.info(f"  {api_name}: {status}")
    
    logger.info(f"📈 Overall: {successful}/{total} APIs successfully pre-indexed")

async def preindex_all_high_priority():
    """Pre-index all critical and high priority APIs"""
    logger.info("🔧 Pre-indexing all CRITICAL and HIGH priority APIs")
    
    # First index critical APIs
    await preindex_by_priority(APIPriority.CRITICAL)
    
    # Then index high priority APIs
    await preindex_by_priority(APIPriority.HIGH)

async def show_api_gallery():
    """Show all available APIs in the gallery"""
    logger.info("📚 API Gallery Overview")
    
    gallery = get_api_gallery()
    all_apis = gallery.get_all_apis()
    
    if not all_apis:
        logger.warning("⚠️  No APIs found in gallery")
        return
    
    # Group by priority
    by_priority = {}
    for api in all_apis:
        priority = api.priority.name
        if priority not in by_priority:
            by_priority[priority] = []
        by_priority[priority].append(api)
    
    for priority in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
        if priority in by_priority:
            logger.info(f"\n🏷️  {priority} Priority APIs:")
            for api in by_priority[priority]:
                logger.info(f"  📄 {api.name} - {api.display_name}")
                logger.info(f"     Category: {api.category.value}")
                logger.info(f"     URLs: {len(api.documentation_urls)}")
                logger.info(f"     Tags: {', '.join(api.tags)}")

async def show_cache_status():
    """Show current cache status for all APIs"""
    logger.info("🗂️  API Cache Status Overview")
    
    cache_service = get_cache_service()
    gallery = get_api_gallery()
    
    all_apis = gallery.get_all_apis()
    
    logger.info(f"\n📊 Cache Status for {len(all_apis)} APIs:")
    for api in all_apis:
        status = cache_service.get_cache_status(api.name)
        status_emoji = {
            "not_cached": "⚪",
            "indexing": "🟡", 
            "cached": "🟢",
            "failed": "🔴",
            "expired": "🟠"
        }.get(status.value, "❓")
        
        logger.info(f"  {status_emoji} {api.name} - {status.value}")

async def main():
    """Main function to handle command line arguments and run pre-indexing"""
    parser = argparse.ArgumentParser(description="Admin API Pre-indexing Tool")
    parser.add_argument("--api", help="Pre-index a specific API by name")
    parser.add_argument("--priority", choices=["critical", "high", "medium", "low"], 
                       help="Pre-index all APIs of specified priority")
    parser.add_argument("--all-high", action="store_true", 
                       help="Pre-index all critical and high priority APIs")
    parser.add_argument("--force", action="store_true", 
                       help="Force re-indexing even if already cached")
    parser.add_argument("--list", action="store_true", 
                       help="List all available APIs in the gallery")
    parser.add_argument("--status", action="store_true", 
                       help="Show cache status for all APIs")
    
    args = parser.parse_args()
    
    logger.info("🚀 Admin API Pre-indexing Tool Started")
    
    try:
        if args.list:
            await show_api_gallery()
        elif args.status:
            await show_cache_status()
        elif args.api:
            await preindex_single_api(args.api, force_reindex=args.force)
        elif args.priority:
            priority_map = {
                "critical": APIPriority.CRITICAL,
                "high": APIPriority.HIGH,
                "medium": APIPriority.MEDIUM,
                "low": APIPriority.LOW
            }
            await preindex_by_priority(priority_map[args.priority])
        elif args.all_high:
            await preindex_all_high_priority()
        else:
            # Default: show help and current status
            logger.info("ℹ️  No specific action specified. Showing API gallery and cache status:")
            await show_api_gallery()
            await show_cache_status()
            logger.info("\n💡 Usage examples:")
            logger.info("  python admin_preindex_apis.py --list")
            logger.info("  python admin_preindex_apis.py --api agno")
            logger.info("  python admin_preindex_apis.py --priority high")
            logger.info("  python admin_preindex_apis.py --all-high")
            logger.info("  python admin_preindex_apis.py --status")
            
    except Exception as e:
        logger.error(f"❌ Error running admin pre-indexing: {str(e)}")
        return 1
    
    logger.info("🏁 Admin API Pre-indexing Tool Completed")
    return 0

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
