"""
Billing Token Consumption Service
=================================

Service layer for managing token consumption within billing cycles.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_, update
from sqlalchemy.orm import selectinload

from app.models.billing_models import BillingCycle, TokenConsumption, TokenConsumptionSummary
from app.core.token_tracker import TokenUsage

logger = logging.getLogger(__name__)

class BillingTokenService:
    """Service for managing token consumption within billing cycles"""
    
    @staticmethod
    async def ensure_active_billing_cycle(
        db: AsyncSession, 
        tenant_id: str, 
        user_id: str, 
        plan_type: str = 'free'
    ) -> BillingCycle:
        """Ensure there's an active billing cycle for the user"""
        
        # Check for existing active cycle
        result = await db.execute(
            select(BillingCycle).where(
                BillingCycle.tenant_id == tenant_id,
                BillingCycle.user_id == user_id,
                BillingCycle.is_active == True,
                BillingCycle.cycle_start <= datetime.utcnow(),
                BillingCycle.cycle_end >= datetime.utcnow()
            ).order_by(desc(BillingCycle.cycle_start))
        )
        
        cycle = result.scalar_one_or_none()
        
        if not cycle:
            # Create new monthly cycle
            cycle = BillingCycle.create_monthly_cycle(tenant_id, user_id, plan_type)
            db.add(cycle)
            await db.commit()
            await db.refresh(cycle)
            
            # Also create the summary record
            summary = TokenConsumptionSummary(
                tenant_id=tenant_id,
                user_id=user_id,
                billing_cycle_id=cycle.id
            )
            db.add(summary)
            await db.commit()
            
            logger.info(f"✅ Created new billing cycle for {tenant_id}:{user_id}")
        
        return cycle
    
    @staticmethod
    async def record_token_consumption(
        db: AsyncSession,
        tenant_id: str,
        user_id: str,
        session_id: Optional[str],
        token_usage: TokenUsage,
        operation_type: str = 'generation',
        operation_id: Optional[str] = None,
        model_name: Optional[str] = None,
        provider: str = 'groq',
        extra_data: Optional[Dict[str, Any]] = None
    ) -> TokenConsumption:
        """Record token consumption for the current billing cycle"""
        
        # Ensure active billing cycle exists
        cycle = await BillingTokenService.ensure_active_billing_cycle(
            db, tenant_id, user_id
        )
        
        # Create consumption record
        consumption = TokenConsumption(
            tenant_id=tenant_id,
            user_id=user_id,
            session_id=session_id,
            billing_cycle_id=cycle.id,
            input_tokens=token_usage.input_tokens,
            output_tokens=token_usage.output_tokens,
            total_tokens=token_usage.total_tokens,
            cached_tokens=token_usage.cached_tokens,
            reasoning_tokens=token_usage.reasoning_tokens,
            audio_tokens=token_usage.audio_tokens,
            cache_write_tokens=token_usage.cache_write_tokens,
            cache_read_tokens=token_usage.cache_read_tokens,
            operation_type=operation_type,
            operation_id=operation_id,
            model_name=model_name,
            provider=provider,
            extra_data=extra_data
        )
        
        db.add(consumption)
        await db.commit()
        await db.refresh(consumption)
        
        # Update the summary
        await BillingTokenService.update_consumption_summary(db, cycle.id)
        
        logger.info(f"📊 Recorded {token_usage.format_display()} for {tenant_id}:{user_id} ({operation_type})")
        
        return consumption
    
    @staticmethod
    async def update_consumption_summary(db: AsyncSession, billing_cycle_id: int):
        """Update the aggregated summary for a billing cycle"""
        
        # Get all consumptions for this cycle
        result = await db.execute(
            select(TokenConsumption).where(
                TokenConsumption.billing_cycle_id == billing_cycle_id
            )
        )
        consumptions = result.scalars().all()
        
        # Calculate aggregated totals
        totals = {
            'total_input_tokens': sum(c.input_tokens for c in consumptions),
            'total_output_tokens': sum(c.output_tokens for c in consumptions),
            'total_tokens': sum(c.total_tokens for c in consumptions),
            'total_cached_tokens': sum(c.cached_tokens for c in consumptions),
            'total_reasoning_tokens': sum(c.reasoning_tokens for c in consumptions),
            'total_audio_tokens': sum(c.audio_tokens for c in consumptions),
            'total_cache_write_tokens': sum(c.cache_write_tokens for c in consumptions),
            'total_cache_read_tokens': sum(c.cache_read_tokens for c in consumptions),
        }
        
        # Calculate operation breakdowns
        operation_totals = {
            'generation_tokens': sum(c.total_tokens for c in consumptions if c.operation_type == 'generation'),
            'chat_tokens': sum(c.total_tokens for c in consumptions if c.operation_type == 'chat'),
            'api_indexing_tokens': sum(c.total_tokens for c in consumptions if c.operation_type == 'api_indexing'),
            'other_tokens': sum(c.total_tokens for c in consumptions if c.operation_type not in ['generation', 'chat', 'api_indexing']),
        }
        
        # Calculate provider breakdowns
        provider_totals = {
            'groq_tokens': sum(c.total_tokens for c in consumptions if c.provider == 'groq'),
            'openai_tokens': sum(c.total_tokens for c in consumptions if c.provider == 'openai'),
            'other_provider_tokens': sum(c.total_tokens for c in consumptions if c.provider not in ['groq', 'openai']),
        }
        
        # Update the summary
        await db.execute(
            update(TokenConsumptionSummary).where(
                TokenConsumptionSummary.billing_cycle_id == billing_cycle_id
            ).values(
                **totals,
                **operation_totals,
                **provider_totals,
                last_updated=datetime.utcnow()
            )
        )
        
        await db.commit()
    
    @staticmethod
    async def get_current_cycle_summary(
        db: AsyncSession, 
        tenant_id: str, 
        user_id: str
    ) -> Optional[TokenConsumptionSummary]:
        """Get token consumption summary for current billing cycle"""
        
        # Get current active cycle
        cycle_result = await db.execute(
            select(BillingCycle).where(
                BillingCycle.tenant_id == tenant_id,
                BillingCycle.user_id == user_id,
                BillingCycle.is_active == True,
                BillingCycle.cycle_start <= datetime.utcnow(),
                BillingCycle.cycle_end >= datetime.utcnow()
            )
        )
        
        cycle = cycle_result.scalar_one_or_none()
        if not cycle:
            return None
        
        # Get summary for this cycle
        summary_result = await db.execute(
            select(TokenConsumptionSummary).where(
                TokenConsumptionSummary.billing_cycle_id == cycle.id
            )
        )
        
        return summary_result.scalar_one_or_none()
    
    @staticmethod
    async def get_consumption_history(
        db: AsyncSession,
        tenant_id: str,
        user_id: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get token consumption history across billing cycles"""
        
        # Get recent billing cycles with summaries
        result = await db.execute(
            select(BillingCycle, TokenConsumptionSummary).join(
                TokenConsumptionSummary,
                BillingCycle.id == TokenConsumptionSummary.billing_cycle_id,
                isouter=True
            ).where(
                BillingCycle.tenant_id == tenant_id,
                BillingCycle.user_id == user_id
            ).order_by(desc(BillingCycle.cycle_start)).limit(limit)
        )
        
        history = []
        for cycle, summary in result:
            history_item = {
                'cycle_id': cycle.id,
                'cycle_start': cycle.cycle_start.isoformat(),
                'cycle_end': cycle.cycle_end.isoformat(),
                'cycle_type': cycle.cycle_type,
                'plan_type': cycle.plan_type,
                'is_active': cycle.is_active,
                'is_completed': cycle.is_completed,
                'consumption': summary.to_dict() if summary else {
                    'total_tokens': 0,
                    'formatted_total': '0 tokens'
                }
            }
            history.append(history_item)
        
        return history
    
    @staticmethod
    async def get_tenant_consumption_overview(
        db: AsyncSession,
        tenant_id: str,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get token consumption overview for all users in a tenant (admin view)"""
        
        # Get current cycles and their summaries for all users in tenant
        result = await db.execute(
            select(BillingCycle, TokenConsumptionSummary).join(
                TokenConsumptionSummary,
                BillingCycle.id == TokenConsumptionSummary.billing_cycle_id,
                isouter=True
            ).where(
                BillingCycle.tenant_id == tenant_id,
                BillingCycle.is_active == True
            ).order_by(desc(TokenConsumptionSummary.total_tokens)).limit(limit)
        )
        
        overview = []
        for cycle, summary in result:
            overview_item = {
                'user_id': cycle.user_id,
                'cycle_id': cycle.id,
                'cycle_start': cycle.cycle_start.isoformat(),
                'cycle_end': cycle.cycle_end.isoformat(),
                'plan_type': cycle.plan_type,
                'consumption': summary.to_dict() if summary else {
                    'total_tokens': 0,
                    'formatted_total': '0 tokens'
                }
            }
            overview.append(overview_item)
        
        return overview