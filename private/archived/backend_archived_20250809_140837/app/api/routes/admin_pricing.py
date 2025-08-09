"""
Admin Pricing Configuration API
===============================

API endpoints for admins to manage pricing configuration, cost ratios,
billing rules, and pricing tiers in real-time.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, validator
from typing import Dict, List, Optional, Any
import logging
from datetime import datetime
from decimal import Decimal

from app.core.pricing_config import (
    get_pricing_config, PricingConfigurationManager, PricingTier, 
    PricingRule, TierConfiguration, APISpecificPricing
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/pricing", tags=["admin-pricing"])

# Request/Response Models

class PricingRuleUpdate(BaseModel):
    fractional_ratio: Optional[float] = None
    minimum_charge: Optional[float] = None
    maximum_charge: Optional[float] = None
    active: Optional[bool] = None
    reason: str = "Admin configuration update"
    
    @validator('fractional_ratio')
    def validate_fractional_ratio(cls, v):
        if v is not None and (v < 0 or v > 1):
            raise ValueError('Fractional ratio must be between 0 and 1')
        return v

class TierConfigUpdate(BaseModel):
    monthly_credit: Optional[float] = None
    free_api_access_count: Optional[int] = None
    fractional_ratio_multiplier: Optional[float] = None
    maximum_monthly_spend: Optional[float] = None
    features: Optional[List[str]] = None
    priority_support: Optional[bool] = None
    reason: str = "Admin tier update"

class APISpecificPricingUpdate(BaseModel):
    api_name: str
    custom_fractional_ratio: Optional[float] = None
    custom_minimum_charge: Optional[float] = None
    custom_maximum_charge: Optional[float] = None
    active: Optional[bool] = None
    reason: str = "Admin API pricing update"

class SystemConfigUpdate(BaseModel):
    default_access_duration_days: Optional[int] = None
    cache_expiry_days: Optional[int] = None
    commission_rate: Optional[float] = None
    minimum_indexing_cost: Optional[float] = None
    maximum_indexing_cost: Optional[float] = None
    reason: str = "Admin system config update"

# Configuration Overview Routes

@router.get("/overview")
async def get_pricing_overview(
    pricing_config: PricingConfigurationManager = Depends(get_pricing_config)
) -> Dict[str, Any]:
    """Get comprehensive overview of pricing configuration"""
    try:
        summary = pricing_config.get_configuration_summary()
        
        # Add detailed breakdown
        pricing_rules = []
        for rule in pricing_config.pricing_rules.values():
            pricing_rules.append({
                "rule_id": rule.rule_id,
                "name": rule.name,
                "description": rule.description,
                "fractional_ratio": float(rule.fractional_ratio),
                "fractional_percentage": float(rule.fractional_ratio * 100),
                "minimum_charge": float(rule.minimum_charge),
                "maximum_charge": float(rule.maximum_charge),
                "applies_to_apis": rule.applies_to_apis,
                "applies_to_tiers": [tier.value for tier in rule.applies_to_tiers],
                "active": rule.active,
                "created_at": rule.created_at.isoformat(),
                "created_by": rule.created_by
            })
        
        tier_configs = []
        for tier_config in pricing_config.tier_configurations.values():
            tier_configs.append({
                "tier": tier_config.tier.value,
                "display_name": tier_config.display_name,
                "description": tier_config.description,
                "monthly_credit": float(tier_config.monthly_credit),
                "free_api_access_count": tier_config.free_api_access_count,
                "fractional_ratio_multiplier": float(tier_config.fractional_ratio_multiplier),
                "discount_percentage": float((1 - tier_config.fractional_ratio_multiplier) * 100),
                "maximum_monthly_spend": float(tier_config.maximum_monthly_spend) if tier_config.maximum_monthly_spend else None,
                "features": tier_config.features,
                "priority_support": tier_config.priority_support
            })
        
        api_pricing = []
        for api_price in pricing_config.api_pricing.values():
            api_pricing.append({
                "api_name": api_price.api_name,
                "custom_fractional_ratio": float(api_price.custom_fractional_ratio) if api_price.custom_fractional_ratio else None,
                "custom_minimum_charge": float(api_price.custom_minimum_charge) if api_price.custom_minimum_charge else None,
                "custom_maximum_charge": float(api_price.custom_maximum_charge) if api_price.custom_maximum_charge else None,
                "tier_overrides": api_price.tier_overrides,
                "active": api_price.active
            })
        
        return {
            "summary": summary,
            "pricing_rules": pricing_rules,
            "tier_configurations": tier_configs,
            "api_specific_pricing": api_pricing,
            "recent_changes": [
                {
                    "change_id": change.change_id,
                    "change_type": change.change_type.value,
                    "admin_email": change.admin_email,
                    "timestamp": change.timestamp.isoformat(),
                    "reason": change.reason
                }
                for change in pricing_config.configuration_changes[-10:]  # Last 10 changes
            ]
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get pricing overview: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get pricing overview: {str(e)}")

@router.get("/cost-calculator")
async def get_cost_calculator(
    api_name: str,
    original_cost: float,
    tenant_tier: str = "demo",
    tenant_apis_used: int = 0,
    pricing_config: PricingConfigurationManager = Depends(get_pricing_config)
) -> Dict[str, Any]:
    """Calculate costs for different scenarios - useful for admin testing"""
    try:
        tier = PricingTier(tenant_tier)
        original_cost_decimal = Decimal(str(original_cost))
        
        fractional_cost, savings, rule_used = pricing_config.calculate_api_cost(
            api_name=api_name,
            original_cost=original_cost_decimal,
            tenant_tier=tier,
            tenant_apis_used=tenant_apis_used
        )
        
        return {
            "calculation": {
                "api_name": api_name,
                "original_cost": float(original_cost_decimal),
                "fractional_cost": float(fractional_cost),
                "savings": float(savings),
                "savings_percentage": float(savings / original_cost_decimal * 100) if original_cost_decimal > 0 else 0,
                "pricing_rule_used": rule_used
            },
            "tenant_info": {
                "tier": tenant_tier,
                "apis_used": tenant_apis_used,
                "tier_pricing": pricing_config.get_tenant_pricing_info(tier)
            },
            "cost_breakdown": {
                "base_fractional_cost": float(fractional_cost),
                "tier_discount_applied": tier != PricingTier.DEMO,
                "free_tier_eligible": tenant_apis_used < 3  # Default free tier limit
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Cost calculation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Cost calculation failed: {str(e)}")

# Pricing Rule Management

@router.put("/rules/{rule_id}")
async def update_pricing_rule(
    rule_id: str,
    update: PricingRuleUpdate,
    admin_user_id: str = "admin",  # TODO: Get from auth
    admin_email: str = "admin@kiff.ai",  # TODO: Get from auth
    pricing_config: PricingConfigurationManager = Depends(get_pricing_config)
):
    """Update a pricing rule"""
    try:
        updates = {}
        if update.fractional_ratio is not None:
            updates["fractional_ratio"] = update.fractional_ratio
        if update.minimum_charge is not None:
            updates["minimum_charge"] = update.minimum_charge
        if update.maximum_charge is not None:
            updates["maximum_charge"] = update.maximum_charge
        if update.active is not None:
            updates["active"] = update.active
        
        success = pricing_config.update_pricing_rule(
            rule_id=rule_id,
            updates=updates,
            admin_user_id=admin_user_id,
            admin_email=admin_email,
            reason=update.reason
        )
        
        if success:
            return {
                "success": True,
                "message": f"Pricing rule '{rule_id}' updated successfully",
                "rule_id": rule_id,
                "updated_fields": list(updates.keys())
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to update pricing rule")
            
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"❌ Failed to update pricing rule: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update pricing rule: {str(e)}")

@router.get("/rules/{rule_id}")
async def get_pricing_rule(
    rule_id: str,
    pricing_config: PricingConfigurationManager = Depends(get_pricing_config)
):
    """Get details of a specific pricing rule"""
    try:
        if rule_id not in pricing_config.pricing_rules:
            raise HTTPException(status_code=404, detail=f"Pricing rule '{rule_id}' not found")
        
        rule = pricing_config.pricing_rules[rule_id]
        return {
            "rule_id": rule.rule_id,
            "name": rule.name,
            "description": rule.description,
            "fractional_ratio": float(rule.fractional_ratio),
            "fractional_percentage": float(rule.fractional_ratio * 100),
            "minimum_charge": float(rule.minimum_charge),
            "maximum_charge": float(rule.maximum_charge),
            "applies_to_apis": rule.applies_to_apis,
            "applies_to_tiers": [tier.value for tier in rule.applies_to_tiers],
            "active": rule.active,
            "created_at": rule.created_at.isoformat(),
            "created_by": rule.created_by
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get pricing rule: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get pricing rule: {str(e)}")

# Tier Configuration Management

@router.get("/tiers")
async def get_all_tiers(
    pricing_config: PricingConfigurationManager = Depends(get_pricing_config)
):
    """Get all pricing tier configurations"""
    try:
        tiers = []
        for tier_config in pricing_config.tier_configurations.values():
            tiers.append(pricing_config.get_tenant_pricing_info(tier_config.tier))
        
        return {
            "tiers": tiers,
            "total_tiers": len(tiers)
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get tiers: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get tiers: {str(e)}")

@router.get("/tiers/{tier_name}")
async def get_tier_configuration(
    tier_name: str,
    pricing_config: PricingConfigurationManager = Depends(get_pricing_config)
):
    """Get specific tier configuration"""
    try:
        tier = PricingTier(tier_name)
        return pricing_config.get_tenant_pricing_info(tier)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Tier '{tier_name}' not found")
    except Exception as e:
        logger.error(f"❌ Failed to get tier configuration: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get tier configuration: {str(e)}")

# API-Specific Pricing

@router.post("/api-pricing")
async def create_api_specific_pricing(
    pricing_update: APISpecificPricingUpdate,
    admin_user_id: str = "admin",  # TODO: Get from auth
    admin_email: str = "admin@kiff.ai",  # TODO: Get from auth
    pricing_config: PricingConfigurationManager = Depends(get_pricing_config)
):
    """Create or update API-specific pricing"""
    try:
        api_pricing = APISpecificPricing(
            api_name=pricing_update.api_name,
            custom_fractional_ratio=Decimal(str(pricing_update.custom_fractional_ratio)) if pricing_update.custom_fractional_ratio else None,
            custom_minimum_charge=Decimal(str(pricing_update.custom_minimum_charge)) if pricing_update.custom_minimum_charge else None,
            custom_maximum_charge=Decimal(str(pricing_update.custom_maximum_charge)) if pricing_update.custom_maximum_charge else None,
            active=pricing_update.active if pricing_update.active is not None else True
        )
        
        pricing_config.api_pricing[pricing_update.api_name] = api_pricing
        pricing_config._save_configuration()
        
        logger.info(f"✅ Created/updated API pricing for {pricing_update.api_name} by {admin_email}")
        
        return {
            "success": True,
            "message": f"API-specific pricing created/updated for {pricing_update.api_name}",
            "api_name": pricing_update.api_name
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to create API pricing: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create API pricing: {str(e)}")

@router.get("/api-pricing/{api_name}")
async def get_api_specific_pricing(
    api_name: str,
    pricing_config: PricingConfigurationManager = Depends(get_pricing_config)
):
    """Get API-specific pricing configuration"""
    try:
        if api_name not in pricing_config.api_pricing:
            return {
                "api_name": api_name,
                "has_custom_pricing": False,
                "message": "Using default pricing rules"
            }
        
        api_pricing = pricing_config.api_pricing[api_name]
        return {
            "api_name": api_pricing.api_name,
            "has_custom_pricing": True,
            "custom_fractional_ratio": float(api_pricing.custom_fractional_ratio) if api_pricing.custom_fractional_ratio else None,
            "custom_minimum_charge": float(api_pricing.custom_minimum_charge) if api_pricing.custom_minimum_charge else None,
            "custom_maximum_charge": float(api_pricing.custom_maximum_charge) if api_pricing.custom_maximum_charge else None,
            "tier_overrides": api_pricing.tier_overrides,
            "active": api_pricing.active
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get API pricing: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get API pricing: {str(e)}")

# System Configuration

@router.get("/system-config")
async def get_system_configuration(
    pricing_config: PricingConfigurationManager = Depends(get_pricing_config)
):
    """Get system-wide configuration"""
    return {
        "system_config": pricing_config.system_config,
        "description": "System-wide pricing and billing configuration"
    }

@router.put("/system-config")
async def update_system_configuration(
    update: SystemConfigUpdate,
    admin_user_id: str = "admin",  # TODO: Get from auth
    admin_email: str = "admin@kiff.ai",  # TODO: Get from auth
    pricing_config: PricingConfigurationManager = Depends(get_pricing_config)
):
    """Update system configuration"""
    try:
        old_config = pricing_config.system_config.copy()
        
        # Apply updates
        if update.default_access_duration_days is not None:
            pricing_config.system_config["default_access_duration_days"] = update.default_access_duration_days
        if update.cache_expiry_days is not None:
            pricing_config.system_config["cache_expiry_days"] = update.cache_expiry_days
        if update.commission_rate is not None:
            pricing_config.system_config["commission_rate"] = update.commission_rate
        if update.minimum_indexing_cost is not None:
            pricing_config.system_config["minimum_indexing_cost"] = update.minimum_indexing_cost
        if update.maximum_indexing_cost is not None:
            pricing_config.system_config["maximum_indexing_cost"] = update.maximum_indexing_cost
        
        pricing_config._save_configuration()
        
        logger.info(f"✅ Updated system configuration by {admin_email}")
        
        return {
            "success": True,
            "message": "System configuration updated successfully",
            "old_config": old_config,
            "new_config": pricing_config.system_config
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to update system config: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update system config: {str(e)}")

# Configuration Audit

@router.get("/audit-log")
async def get_configuration_audit_log(
    limit: int = 50,
    pricing_config: PricingConfigurationManager = Depends(get_pricing_config)
):
    """Get audit log of configuration changes"""
    try:
        changes = sorted(
            pricing_config.configuration_changes,
            key=lambda x: x.timestamp,
            reverse=True
        )[:limit]
        
        return {
            "changes": [
                {
                    "change_id": change.change_id,
                    "change_type": change.change_type.value,
                    "admin_user_id": change.admin_user_id,
                    "admin_email": change.admin_email,
                    "timestamp": change.timestamp.isoformat(),
                    "reason": change.reason,
                    "has_old_values": bool(change.old_values),
                    "has_new_values": bool(change.new_values)
                }
                for change in changes
            ],
            "total_changes": len(pricing_config.configuration_changes),
            "showing": len(changes)
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get audit log: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get audit log: {str(e)}")

# Health check
@router.get("/health")
async def pricing_config_health():
    """Health check for pricing configuration system"""
    try:
        pricing_config = get_pricing_config()
        summary = pricing_config.get_configuration_summary()
        
        return {
            "status": "healthy",
            "message": "Pricing configuration system operational",
            "active_rules": summary["active_rules"],
            "total_rules": summary["pricing_rules"],
            "tier_configs": summary["tier_configurations"],
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Pricing config health check failed: {e}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

# Export router
__all__ = ["router"]