#!/usr/bin/env python3
"""
Update API visibility based on successful URL extraction results.
Only show APIs that have indexed URLs in the frontend.
"""

import json

# List of successful APIs (those with URLs extracted)
SUCCESSFUL_APIS = {
    "OpenAI": 571,
    "Anthropic": 97,
    "Together AI": 90,
    "Cohere": 134,
    "Rasa": 212,
    "Deepgram": 189,
    "Murf AI": 24,
    "Synthesia": 96,
    "Clipdrop": 16,
    "Luma AI": 3,
    "Supabase": 1921
}

def update_visibility():
    # Load current API services
    with open('/Users/caroco/Gabo-Dev/kiff-dev/backend-lite-v2/app/data/api_services.json', 'r') as f:
        api_services = json.load(f)
    
    # Update visibility
    updated_count = 0
    for service in api_services:
        api_name = service['name']
        
        # Set visibility based on whether API has indexed URLs
        should_be_visible = api_name in SUCCESSFUL_APIS
        
        if service.get('is_visible', True) != should_be_visible:
            service['is_visible'] = should_be_visible
            updated_count += 1
            
            if should_be_visible:
                print(f"✅ Enabled {api_name} ({SUCCESSFUL_APIS[api_name]} URLs)")
            else:
                print(f"❌ Disabled {api_name} (no indexed URLs)")
    
    # Save updated API services
    with open('/Users/caroco/Gabo-Dev/kiff-dev/backend-lite-v2/app/data/api_services.json', 'w') as f:
        json.dump(api_services, f, indent=2)
    
    print(f"\n📊 Summary:")
    print(f"- APIs with indexed URLs: {len(SUCCESSFUL_APIS)}")
    print(f"- APIs updated: {updated_count}")
    print(f"- Total URLs available: {sum(SUCCESSFUL_APIS.values())}")

if __name__ == "__main__":
    update_visibility()