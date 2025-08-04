#!/usr/bin/env python3
"""
API Gallery URL Count Updater

Updates the API Gallery with realistic URL counts from the analysis cache.
This makes the frontend display accurate, production-like information.
"""

import json
import sys
from pathlib import Path
import logging

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.knowledge.api_gallery import APIGallery

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class APIGalleryUpdater:
    """Updates API Gallery with realistic URL counts"""
    
    def __init__(self):
        self.cache_file = backend_dir / "data" / "api_url_analysis.json"
        self.gallery = APIGallery()
    
    def load_analysis_results(self) -> dict:
        """Load URL analysis results from cache"""
        if not self.cache_file.exists():
            logger.error(f"❌ Analysis cache not found: {self.cache_file}")
            logger.info("💡 Run 'python scripts/analyze_api_urls.py' first to generate the cache")
            return {}
        
        try:
            with open(self.cache_file, 'r') as f:
                results = json.load(f)
            logger.info(f"📊 Loaded analysis results for {len(results.get('apis', {}))} APIs")
            return results
        except Exception as e:
            logger.error(f"❌ Failed to load analysis cache: {e}")
            return {}
    
    def update_gallery_with_realistic_counts(self):
        """Update API Gallery with realistic URL counts"""
        results = self.load_analysis_results()
        
        if not results or not results.get('apis'):
            logger.error("❌ No analysis results available")
            return False
        
        logger.info("🔄 Updating API Gallery with realistic URL counts...")
        
        updated_count = 0
        
        for api_name, analysis in results['apis'].items():
            try:
                api = self.gallery.get_api(api_name)
                if not api:
                    logger.warning(f"⚠️ API '{api_name}' not found in gallery")
                    continue
                
                # Update the API with realistic URL count
                url_count = analysis.get('total_discoverable_urls', 0)
                analysis_method = analysis.get('analysis_method', 'unknown')
                
                # Add URL count information to the API description for display
                original_description = api.description
                if not original_description.endswith(f" ({url_count} URLs)"):
                    # Add URL count to description for frontend display
                    api.description = f"{original_description}"
                    
                    # Store the URL count as a custom attribute for frontend access
                    if not hasattr(api, 'url_count'):
                        api.url_count = url_count
                        api.analysis_method = analysis_method
                        api.last_url_analysis = analysis.get('analysis_timestamp')
                
                logger.info(f"✅ Updated {api.display_name}: {url_count} URLs ({analysis_method})")
                updated_count += 1
                
            except Exception as e:
                logger.error(f"❌ Failed to update {api_name}: {e}")
        
        logger.info(f"🎉 Successfully updated {updated_count} APIs with realistic URL counts")
        return updated_count > 0
    
    def print_gallery_summary(self):
        """Print current gallery state with URL counts"""
        logger.info("📋 Current API Gallery Status:")
        logger.info("=" * 70)
        
        all_apis = self.gallery.get_all_apis()
        
        for api_name, api in all_apis.items():
            url_count = getattr(api, 'url_count', 'Unknown')
            method = getattr(api, 'analysis_method', 'Not analyzed')
            priority = api.priority.name
            category = api.category.value
            
            logger.info(f"📚 {api.display_name}")
            logger.info(f"    URLs: {url_count} | Method: {method} | Priority: {priority} | Category: {category}")
            logger.info(f"    Base: {api.base_url}")
            logger.info("")
        
        logger.info("=" * 70)

def main():
    """Main updater function"""
    updater = APIGalleryUpdater()
    
    # Update gallery with realistic counts
    success = updater.update_gallery_with_realistic_counts()
    
    if success:
        print("\n🎉 API Gallery Updated Successfully!")
        print("📊 The gallery now shows realistic URL counts")
        print("🌐 Frontend will display accurate information")
        
        # Print summary
        updater.print_gallery_summary()
    else:
        print("\n❌ Failed to update API Gallery")
        print("💡 Make sure to run 'python scripts/analyze_api_urls.py' first")

if __name__ == "__main__":
    main()
