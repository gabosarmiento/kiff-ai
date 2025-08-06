#!/usr/bin/env python3
"""
Simple Admin API Pre-indexing Script
====================================

Run this script from the backend directory with virtual environment activated:
    cd backend
    source venv/bin/activate
    python admin_preindex.py
"""

import asyncio
import logging
import sys
from pathlib import Path

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

async def main():
    """Main function to run API pre-indexing"""
    logger.info("🚀 Starting Admin API Pre-indexing")
    
    try:
        # Import after setting up path
        from app.core.api_indexing_cache import get_cache_service
        from app.knowledge.api_gallery import get_api_gallery, APIPriority
        
        logger.info("✅ Successfully imported services")
        
        # Get services
        cache_service = get_cache_service()
        gallery = get_api_gallery()
        
        # Show available APIs
        logger.info("📚 Available APIs in Gallery:")
        all_apis = gallery.get_all_apis()
        
        for api_name, api in all_apis.items():
            try:
                logger.info(f"Processing API: {api_name}")
                status = cache_service.get_cache_status(api.name)
                # Handle both enum and dict status responses
                status_value = status.value if hasattr(status, 'value') else status
                status_emoji = {
                    "not_cached": "⚪",
                    "indexing": "🟡", 
                    "cached": "🟢",
                    "failed": "🔴",
                    "expired": "🟠"
                }.get(status_value, "❓")
                
                # Safe access to priority and documentation_urls
                priority_name = getattr(api.priority, 'name', str(api.priority)) if hasattr(api, 'priority') else 'UNKNOWN'
                doc_count = len(api.documentation_urls) if hasattr(api, 'documentation_urls') and api.documentation_urls else 0
                
                logger.info(f"  {status_emoji} {api.name} - {api.display_name} ({priority_name})")
                logger.info(f"     📄 {doc_count} URLs")
            except Exception as e:
                logger.error(f"Error processing API {api_name}: {e}")
                logger.error(f"API object type: {type(api)}")
                logger.error(f"API object: {api}")
        
        # Pre-index critical APIs first
        logger.info("\n🔧 Pre-indexing CRITICAL priority APIs...")
        critical_apis = gallery.get_apis_by_priority(APIPriority.CRITICAL)
        
        for api_name, api in critical_apis.items():
            logger.info(f"\n{'='*50}")
            logger.info(f"📚 Pre-indexing {api.display_name} ({api.name})")
            
            try:
                success, cache_entry = await cache_service.admin_pre_index_api(api.name)
                
                if success:
                    logger.info(f"✅ Successfully pre-indexed {api.name}!")
                    logger.info(f"💰 Original cost: ${cache_entry.original_indexing_cost:.4f}")
                    logger.info(f"💵 User fractional cost: ${cache_entry.fractional_cost:.2f}")
                    logger.info(f"📊 URLs indexed: {cache_entry.total_urls_indexed}")
                    logger.info(f"🔤 Tokens used: {cache_entry.tokens_used}")
                else:
                    logger.error(f"❌ Failed to pre-index {api.name}")
                    
            except Exception as e:
                logger.error(f"❌ Error pre-indexing {api.name}: {str(e)}")
        
        # Pre-index high priority APIs
        logger.info("\n🔧 Pre-indexing HIGH priority APIs...")
        high_apis = gallery.get_apis_by_priority(APIPriority.HIGH)
        
        for api_name, api in high_apis.items():
            logger.info(f"\n{'='*50}")
            logger.info(f"📚 Pre-indexing {api.display_name} ({api.name})")
            
            try:
                success, cache_entry = await cache_service.admin_pre_index_api(api.name)
                
                if success:
                    logger.info(f"✅ Successfully pre-indexed {api.name}!")
                    logger.info(f"💰 Original cost: ${cache_entry.original_indexing_cost:.4f}")
                    logger.info(f"💵 User fractional cost: ${cache_entry.fractional_cost:.2f}")
                    logger.info(f"📊 URLs indexed: {cache_entry.total_urls_indexed}")
                    logger.info(f"🔤 Tokens used: {cache_entry.tokens_used}")
                else:
                    logger.error(f"❌ Failed to pre-index {api.name}")
                    
            except Exception as e:
                logger.error(f"❌ Error pre-indexing {api.name}: {str(e)}")
        
        logger.info(f"\n{'='*50}")
        logger.info("🏁 Admin API Pre-indexing Completed!")
        
        # Show final status
        logger.info("\n📊 Final Cache Status:")
        for api_name, api in all_apis.items():
            try:
                # Get status from cache entries instead of cache service to avoid dict issues
                cache_entry = cache_service.cache_entries.get(api.name)
                if cache_entry:
                    status_value = cache_entry.status.value if hasattr(cache_entry.status, 'value') else str(cache_entry.status)
                else:
                    status_value = "not_cached"
                    
                status_emoji = {
                    "not_cached": "⚪",
                    "indexing": "🟡", 
                    "cached": "🟢",
                    "failed": "🔴",
                    "expired": "🟠"
                }.get(status_value, "❓")
                
                logger.info(f"  {status_emoji} {api.name} - {api.display_name}")
            except Exception as e:
                logger.warning(f"Could not get status for {api.name}: {e}")
        
    except ImportError as e:
        logger.error(f"❌ Import error: {str(e)}")
        logger.error("Make sure you're running from backend directory with venv activated")
        return 1
    except Exception as e:
        logger.error(f"❌ Unexpected error: {str(e)}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
