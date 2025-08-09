#!/usr/bin/env python3
"""
Token Tracking Accuracy Test vs LangTrace
=========================================

This script tests our custom token tracking system against LangTrace observability
to validate accuracy and identify any discrepancies in token counting.
"""

import asyncio
import logging
import json
import os
import sys
from datetime import datetime
from typing import Dict, Any, Optional

# Add the app to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.token_tracker import get_token_tracker, TokenUsage
from app.services.agno_application_generator import agno_app_generator
from app.core.langtrace_config import trace_agno_agent, log_agent_interaction, is_langtrace_enabled

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

class TokenTrackingTest:
    """Test suite for comparing token tracking accuracy"""
    
    def __init__(self):
        self.test_tenant_id = "test_tenant_token_accuracy"
        self.test_user_id = "test_user_123"
        self.test_session_id = f"test_session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.results = []
        
    def log_test_result(self, test_name: str, our_tokens: TokenUsage, langtrace_data: Optional[Dict] = None, notes: str = ""):
        """Log test results for comparison"""
        result = {
            "test_name": test_name,
            "timestamp": datetime.now().isoformat(),
            "our_tracking": {
                "input_tokens": our_tokens.input_tokens,
                "output_tokens": our_tokens.output_tokens,
                "total_tokens": our_tokens.total_tokens,
                "cached_tokens": our_tokens.cached_tokens,
                "reasoning_tokens": our_tokens.reasoning_tokens,
                "display": our_tokens.format_display()
            },
            "langtrace_data": langtrace_data,
            "notes": notes
        }
        self.results.append(result)
        
        logger.info(f"📊 TEST RESULT: {test_name}")
        logger.info(f"   Our Tracking: {our_tokens.format_display()} (Input: {our_tokens.input_tokens}, Output: {our_tokens.output_tokens})")
        if langtrace_data:
            logger.info(f"   LangTrace Data: {json.dumps(langtrace_data, indent=2)}")
        if notes:
            logger.info(f"   Notes: {notes}")
    
    @trace_agno_agent("token_accuracy_test_simple")
    async def test_simple_generation(self) -> None:
        """Test token tracking with a simple generation request"""
        logger.info("🧪 Running Simple Generation Test...")
        
        # Get token tracker
        tracker = get_token_tracker(self.test_tenant_id, self.test_user_id, self.test_session_id)
        initial_usage = tracker.get_current_usage()
        
        # Simple generation request
        simple_request = "Create a simple Python script that prints 'Hello World'"
        
        try:
            # Run AGNO generation
            result = await agno_app_generator.generate_application(
                tenant_id=self.test_tenant_id,
                user_request=simple_request,
                session_id=self.test_session_id,
                user_id=self.test_user_id
            )
            
            # Get final usage
            final_usage = tracker.get_current_usage()
            
            # Calculate delta
            delta_usage = TokenUsage(
                input_tokens=final_usage.input_tokens - initial_usage.input_tokens,
                output_tokens=final_usage.output_tokens - initial_usage.output_tokens,
                total_tokens=final_usage.total_tokens - initial_usage.total_tokens,
                cached_tokens=final_usage.cached_tokens - initial_usage.cached_tokens,
                reasoning_tokens=final_usage.reasoning_tokens - initial_usage.reasoning_tokens,
                audio_tokens=final_usage.audio_tokens - initial_usage.audio_tokens,
                cache_write_tokens=final_usage.cache_write_tokens - initial_usage.cache_write_tokens,
                cache_read_tokens=final_usage.cache_read_tokens - initial_usage.cache_read_tokens
            )
            
            self.log_test_result(
                "Simple Generation Test",
                delta_usage,
                langtrace_data={"generation_result_status": result.get("status"), "generation_id": result.get("id")},
                notes=f"Request: '{simple_request}'"
            )
            
        except Exception as e:
            logger.error(f"❌ Simple generation test failed: {e}")
            self.log_test_result(
                "Simple Generation Test",
                TokenUsage(),
                notes=f"FAILED: {str(e)}"
            )
    
    @trace_agno_agent("token_accuracy_test_complex")
    async def test_complex_generation(self) -> None:
        """Test token tracking with a complex generation request"""
        logger.info("🧪 Running Complex Generation Test...")
        
        # Get token tracker
        tracker = get_token_tracker(self.test_tenant_id, self.test_user_id, self.test_session_id)
        initial_usage = tracker.get_current_usage()
        
        # Complex generation request
        complex_request = """Create a full-stack web application with the following features:
        1. React frontend with TypeScript
        2. Node.js backend with Express
        3. MongoDB database integration
        4. User authentication system
        5. REST API with CRUD operations
        6. Docker configuration for deployment
        7. Complete README with setup instructions
        
        The application should be a todo list manager with user accounts."""
        
        try:
            # Run AGNO generation
            result = await agno_app_generator.generate_application(
                tenant_id=self.test_tenant_id,
                user_request=complex_request,
                session_id=self.test_session_id,
                user_id=self.test_user_id
            )
            
            # Get final usage
            final_usage = tracker.get_current_usage()
            
            # Calculate delta
            delta_usage = TokenUsage(
                input_tokens=final_usage.input_tokens - initial_usage.input_tokens,
                output_tokens=final_usage.output_tokens - initial_usage.output_tokens,
                total_tokens=final_usage.total_tokens - initial_usage.total_tokens,
                cached_tokens=final_usage.cached_tokens - initial_usage.cached_tokens,
                reasoning_tokens=final_usage.reasoning_tokens - initial_usage.reasoning_tokens,
                audio_tokens=final_usage.audio_tokens - initial_usage.audio_tokens,
                cache_write_tokens=final_usage.cache_write_tokens - initial_usage.cache_write_tokens,
                cache_read_tokens=final_usage.cache_read_tokens - initial_usage.cache_read_tokens
            )
            
            self.log_test_result(
                "Complex Generation Test",
                delta_usage,
                langtrace_data={"generation_result_status": result.get("status"), "generation_id": result.get("id")},
                notes=f"Complex full-stack application request"
            )
            
        except Exception as e:
            logger.error(f"❌ Complex generation test failed: {e}")
            self.log_test_result(
                "Complex Generation Test",
                TokenUsage(),
                notes=f"FAILED: {str(e)}"
            )
    
    async def test_multiple_requests(self) -> None:
        """Test token accumulation across multiple requests"""
        logger.info("🧪 Running Multiple Requests Test...")
        
        # Get token tracker
        tracker = get_token_tracker(self.test_tenant_id, self.test_user_id, self.test_session_id)
        initial_usage = tracker.get_current_usage()
        
        requests = [
            "Create a Python calculator script",
            "Add error handling to the calculator",
            "Create unit tests for the calculator",
        ]
        
        for i, request in enumerate(requests):
            try:
                logger.info(f"   Running request {i+1}/3: {request}")
                
                result = await agno_app_generator.generate_application(
                    tenant_id=self.test_tenant_id,
                    user_request=request,
                    session_id=f"{self.test_session_id}_multi_{i}",
                    user_id=self.test_user_id
                )
                
                current_usage = tracker.get_current_usage()
                logger.info(f"   After request {i+1}: {current_usage.format_display()}")
                
            except Exception as e:
                logger.error(f"❌ Request {i+1} failed: {e}")
        
        # Get final cumulative usage
        final_usage = tracker.get_current_usage()
        cumulative_delta = TokenUsage(
            input_tokens=final_usage.input_tokens - initial_usage.input_tokens,
            output_tokens=final_usage.output_tokens - initial_usage.output_tokens,
            total_tokens=final_usage.total_tokens - initial_usage.total_tokens,
            cached_tokens=final_usage.cached_tokens - initial_usage.cached_tokens,
            reasoning_tokens=final_usage.reasoning_tokens - initial_usage.reasoning_tokens,
            audio_tokens=final_usage.audio_tokens - initial_usage.audio_tokens,
            cache_write_tokens=final_usage.cache_write_tokens - initial_usage.cache_write_tokens,
            cache_read_tokens=final_usage.cache_read_tokens - initial_usage.cache_read_tokens
        )
        
        self.log_test_result(
            "Multiple Requests Accumulation Test",
            cumulative_delta,
            notes=f"Accumulated tokens across {len(requests)} requests"
        )
    
    def generate_report(self) -> None:
        """Generate comprehensive test report"""
        logger.info("📄 Generating Token Tracking Accuracy Report...")
        
        report = {
            "test_session": {
                "tenant_id": self.test_tenant_id,
                "user_id": self.test_user_id,
                "session_id": self.test_session_id,
                "timestamp": datetime.now().isoformat(),
                "langtrace_enabled": is_langtrace_enabled()
            },
            "test_results": self.results,
            "summary": {
                "total_tests": len(self.results),
                "successful_tests": len([r for r in self.results if not r["notes"].startswith("FAILED")]),
                "failed_tests": len([r for r in self.results if r["notes"].startswith("FAILED")])
            }
        }
        
        # Save report to file
        report_filename = f"token_tracking_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_filename, 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"📊 FINAL REPORT:")
        logger.info(f"   Tests Run: {report['summary']['total_tests']}")
        logger.info(f"   Successful: {report['summary']['successful_tests']}")
        logger.info(f"   Failed: {report['summary']['failed_tests']}")
        logger.info(f"   LangTrace Enabled: {report['test_session']['langtrace_enabled']}")
        logger.info(f"   Report saved to: {report_filename}")
        
        # Print detailed results
        for result in self.results:
            logger.info(f"\n📋 {result['test_name']}:")
            logger.info(f"   Tokens: {result['our_tracking']['display']}")
            logger.info(f"   Input/Output: {result['our_tracking']['input_tokens']}/{result['our_tracking']['output_tokens']}")
            if result['our_tracking']['cached_tokens'] > 0:
                logger.info(f"   Cached: {result['our_tracking']['cached_tokens']}")
            logger.info(f"   Notes: {result['notes']}")


async def main():
    """Run the token tracking accuracy tests"""
    logger.info("🚀 Starting Token Tracking vs LangTrace Accuracy Test")
    logger.info(f"   LangTrace Enabled: {is_langtrace_enabled()}")
    
    if not is_langtrace_enabled():
        logger.warning("⚠️  LangTrace is not enabled. We'll only test our token tracking system.")
    
    # Create test instance
    test = TokenTrackingTest()
    
    # Run tests
    await test.test_simple_generation()
    await test.test_complex_generation()
    await test.test_multiple_requests()
    
    # Generate report
    test.generate_report()
    
    logger.info("✅ Token tracking accuracy test completed!")


if __name__ == "__main__":
    asyncio.run(main())