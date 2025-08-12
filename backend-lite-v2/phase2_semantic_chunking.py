#!/usr/bin/env python3
"""
Phase 2: Semantic chunking for all 11 successful APIs
Processes all extracted URLs with semantic chunking strategy
"""

import json
import requests
import time
from typing import Dict, List

# Backend URL
BACKEND_URL = "https://rfn5agrmiw.eu-west-3.awsapprunner.com"

# 11 successful APIs with their URL counts
SUCCESSFUL_APIS = [
    {"name": "supabase", "urls": 1921, "priority": "high"},
    {"name": "openai", "urls": 571, "priority": "high"}, 
    {"name": "rasa", "urls": 212, "priority": "medium"},
    {"name": "deepgram", "urls": 189, "priority": "medium"},
    {"name": "cohere", "urls": 134, "priority": "medium"},
    {"name": "anthropic", "urls": 97, "priority": "medium"},
    {"name": "synthesia", "urls": 96, "priority": "medium"},
    {"name": "together", "urls": 90, "priority": "low"},
    {"name": "murf", "urls": 24, "priority": "low"},
    {"name": "clipdrop", "urls": 16, "priority": "low"},
    {"name": "luma", "urls": 3, "priority": "low"}
]

def load_urls_for_api(api_name: str) -> List[str]:
    """Load URLs from the extraction results"""
    try:
        with open(f'/Users/caroco/Gabo-Dev/kiff-dev/backend-lite-v2/api_urls_extraction/{api_name}_urls.json', 'r') as f:
            data = json.load(f)
            return data.get('urls', [])
    except Exception as e:
        print(f"❌ Error loading URLs for {api_name}: {e}")
        return []

def chunk_urls_batch(api_name: str, urls: List[str], batch_size: int = 10) -> Dict:
    """Process URLs in batches using semantic chunking"""
    total_chunks = 0
    total_tokens = 0
    batch_count = 0
    
    print(f"🔄 Processing {len(urls)} URLs for {api_name} in batches of {batch_size}")
    
    for i in range(0, len(urls), batch_size):
        batch = urls[i:i + batch_size]
        batch_count += 1
        
        try:
            # Semantic chunking request
            payload = {
                "urls": batch,
                "mode": "fast",
                "strategy": "semantic", 
                "embedder": "sentence-transformers",
                "chunk_size": 1200,
                "chunk_overlap": 150,
                "include_metadata": True,
                "semantic_params": {
                    "threshold": 0.55
                }
            }
            
            headers = {
                "Content-Type": "application/json",
                "X-Tenant-ID": "4485db48-71b7-47b0-8128-c6dca5be352d"
            }
            
            print(f"  📦 Batch {batch_count}: Processing {len(batch)} URLs...")
            
            response = requests.post(
                f"{BACKEND_URL}/api/extract/preview",
                json=payload,
                headers=headers,
                timeout=300  # 5 minute timeout per batch
            )
            
            if response.status_code == 200:
                result = response.json()
                batch_chunks = result.get('totals', {}).get('chunks', 0)
                batch_tokens = result.get('totals', {}).get('tokens_est', 0)
                
                total_chunks += batch_chunks
                total_tokens += batch_tokens
                
                print(f"  ✅ Batch {batch_count}: {batch_chunks} chunks, {batch_tokens:,} tokens")
                
                # Small delay between batches
                time.sleep(2)
                
            else:
                print(f"  ❌ Batch {batch_count} failed: {response.status_code} - {response.text}")
                
        except Exception as e:
            print(f"  ❌ Batch {batch_count} error: {e}")
            
    return {
        "api_name": api_name,
        "total_urls": len(urls),
        "total_chunks": total_chunks,
        "total_tokens": total_tokens,
        "batches_processed": batch_count
    }

def main():
    print("🚀 Starting Phase 2: Semantic Chunking for 11 APIs")
    print("=" * 60)
    
    results = []
    start_time = time.time()
    
    for api_info in SUCCESSFUL_APIS:
        api_name = api_info["name"]
        expected_urls = api_info["urls"]
        priority = api_info["priority"]
        
        print(f"\n📚 Processing {api_name.upper()} ({priority} priority)")
        print(f"Expected URLs: {expected_urls:,}")
        
        # Load URLs
        urls = load_urls_for_api(api_name)
        
        if not urls:
            print(f"⚠️  No URLs found for {api_name}")
            continue
            
        if len(urls) != expected_urls:
            print(f"⚠️  URL count mismatch: found {len(urls)}, expected {expected_urls}")
        
        # Determine batch size based on priority and URL count
        if priority == "high":
            batch_size = 5  # Smaller batches for large APIs
        elif priority == "medium":
            batch_size = 8
        else:
            batch_size = 10
            
        # Process the API
        api_start = time.time()
        result = chunk_urls_batch(api_name, urls, batch_size)
        api_duration = time.time() - api_start
        
        result["duration_minutes"] = round(api_duration / 60, 2)
        results.append(result)
        
        print(f"✅ {api_name.upper()} completed in {result['duration_minutes']} minutes")
        print(f"   📊 {result['total_chunks']:,} total chunks, {result['total_tokens']:,} total tokens")
        
    # Final summary
    total_duration = time.time() - start_time
    total_urls = sum(r['total_urls'] for r in results)
    total_chunks = sum(r['total_chunks'] for r in results)
    total_tokens = sum(r['total_tokens'] for r in results)
    
    print("\n" + "=" * 60)
    print("🎉 PHASE 2 COMPLETE!")
    print(f"⏱️  Total time: {total_duration / 60:.1f} minutes")
    print(f"🔗 Total URLs processed: {total_urls:,}")
    print(f"📄 Total chunks created: {total_chunks:,}")
    print(f"🔤 Total tokens estimated: {total_tokens:,}")
    
    # Save results
    with open('/Users/caroco/Gabo-Dev/kiff-dev/backend-lite-v2/api_urls_extraction/phase2_results.json', 'w') as f:
        json.dump({
            "summary": {
                "total_apis": len(results),
                "total_urls": total_urls,
                "total_chunks": total_chunks,
                "total_tokens": total_tokens,
                "duration_minutes": round(total_duration / 60, 2)
            },
            "per_api_results": results,
            "completed_at": time.strftime("%Y-%m-%d %H:%M:%S")
        }, f, indent=2)
    
    print("📁 Results saved to phase2_results.json")

if __name__ == "__main__":
    main()