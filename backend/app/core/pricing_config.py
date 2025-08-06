"""
Centralized Pricing Configuration Management
===========================================

Dynamic pricing configuration system that allows admins to control
all pricing parameters, cost ratios, and billing rules from a central location.

Key Features:
- Dynamic pricing updates without code changes
- Admin-controlled cost ratios and limits
- Per-API custom pricing rules
- Tenant-specific pricing tiers
- Configuration validation and rollback
- Audit trail for pricing changes
"""

import logging
import json
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timezone
from dataclasses import dataclass, asdict, field
from decimal import Decimal
from enum import Enum
from pathlib import Path

logger = logging.getLogger(__name__)

class PricingTier(Enum):
    """Pricing tiers for different tenant types"""
    FREE = "free"
    DEMO = "demo"
    STARTER = "starter"
    PRO = "pro"
    ENTERPRISE = "enterprise"

class ConfigChangeType(Enum):
    """Types of configuration changes"""
    PRICING_UPDATE = "pricing_update"
    TIER_CHANGE = "tier_change"
    API_PRICING = "api_pricing"
    SYSTEM_CONFIG = "system_config"

@dataclass
class PricingRule:
    """Represents a pricing rule for APIs"""
    rule_id: str
    name: str
    description: str
    fractional_ratio: Decimal  # Percentage of original cost (0.05 = 5%)
    minimum_charge: Decimal
    maximum_charge: Decimal
    applies_to_apis: List[str]  # Empty means all APIs
    applies_to_tiers: List[PricingTier]
    active: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str = "system"

@dataclass
class TierConfiguration:
    """Configuration for a specific pricing tier"""
    tier: PricingTier
    display_name: str
    description: str
    monthly_credit: Decimal
    free_api_access_count: int
    fractional_ratio_multiplier: Decimal  # Multiplier for base pricing (1.0 = normal, 0.8 = 20% discount)
    maximum_monthly_spend: Optional[Decimal]
    features: List[str]
    priority_support: bool = False

@dataclass
class APISpecificPricing:
    """Custom pricing for specific APIs"""
    api_name: str
    custom_fractional_ratio: Optional[Decimal] = None
    custom_minimum_charge: Optional[Decimal] = None
    custom_maximum_charge: Optional[Decimal] = None
    tier_overrides: Dict[str, Dict[str, Decimal]] = field(default_factory=dict)
    active: bool = True

@dataclass
class ConfigurationChange:
    """Audit log entry for configuration changes"""
    change_id: str
    change_type: ConfigChangeType
    admin_user_id: str
    admin_email: str
    timestamp: datetime
    old_values: Dict[str, Any]
    new_values: Dict[str, Any]
    reason: str
    approved_by: Optional[str] = None

class PricingConfigurationManager:
    """
    Centralized pricing configuration management system
    """
    
    def __init__(self, config_file: str = None):
        self.logger = logging.getLogger(__name__)
        
        # Configuration file path
        if config_file is None:
            config_file = Path(__file__).parent.parent / "config" / "pricing_config.json"
        self.config_file = Path(config_file)
        self.config_file.parent.mkdir(parents=True, exist_ok=True)
        
        # In-memory configuration cache
        self.pricing_rules: Dict[str, PricingRule] = {}
        self.tier_configurations: Dict[PricingTier, TierConfiguration] = {}
        self.api_pricing: Dict[str, APISpecificPricing] = {}
        self.system_config: Dict[str, Any] = {}
        self.configuration_changes: List[ConfigurationChange] = []
        
        # Load or initialize configuration
        self._load_configuration()
        
        self.logger.info("🎛️ Pricing Configuration Manager initialized")
        self.logger.info(f"📁 Config file: {self.config_file}")
        self.logger.info(f"🔧 Active pricing rules: {len(self.pricing_rules)}")
    
    def _load_configuration(self):
        """Load configuration from file or create defaults"""
        try:
            if self.config_file.exists():
                with open(self.config_file, 'r') as f:
                    config_data = json.load(f)
                self._parse_configuration(config_data)
                self.logger.info("✅ Configuration loaded from file")
            else:
                self._create_default_configuration()
                self._save_configuration()
                self.logger.info("🆕 Created default configuration")
        except Exception as e:
            self.logger.error(f"❌ Failed to load configuration: {e}")
            self._create_default_configuration()
    
    def _create_default_configuration(self):
        """Create default pricing configuration"""
        
        # Default pricing rule
        default_rule = PricingRule(
            rule_id="default_fractional",
            name="Default Fractional Pricing",
            description="Standard 5% fractional cost with $0.20 minimum",
            fractional_ratio=Decimal("0.05"),
            minimum_charge=Decimal("0.20"),
            maximum_charge=Decimal("10.00"),
            applies_to_apis=[],  # All APIs
            applies_to_tiers=list(PricingTier),
            created_by="system_init"
        )
        self.pricing_rules["default_fractional"] = default_rule
        
        # Tier configurations
        self.tier_configurations = {
            PricingTier.FREE: TierConfiguration(
                tier=PricingTier.FREE,
                display_name="Free Tier",
                description="Limited free access to try out APIs",
                monthly_credit=Decimal("0.00"),
                free_api_access_count=3,
                fractional_ratio_multiplier=Decimal("0.00"),  # Free
                maximum_monthly_spend=Decimal("0.00"),
                features=["3 free API access", "Basic support"]
            ),
            PricingTier.DEMO: TierConfiguration(
                tier=PricingTier.DEMO,
                display_name="Demo Account",
                description="Demo account with credits for testing",
                monthly_credit=Decimal("50.00"),
                free_api_access_count=5,
                fractional_ratio_multiplier=Decimal("1.00"),
                maximum_monthly_spend=Decimal("100.00"),
                features=["$50 monthly credit", "All APIs", "Email support"]
            ),
            PricingTier.STARTER: TierConfiguration(
                tier=PricingTier.STARTER,
                display_name="Starter",
                description="Perfect for individual developers",
                monthly_credit=Decimal("25.00"),
                free_api_access_count=5,
                fractional_ratio_multiplier=Decimal("1.00"),
                maximum_monthly_spend=Decimal("100.00"),
                features=["$25 monthly credit", "All APIs", "Email support"],
                priority_support=False
            ),
            PricingTier.PRO: TierConfiguration(
                tier=PricingTier.PRO,
                display_name="Professional",
                description="For growing teams and businesses",
                monthly_credit=Decimal("100.00"),
                free_api_access_count=10,
                fractional_ratio_multiplier=Decimal("0.80"),  # 20% discount
                maximum_monthly_spend=Decimal("500.00"),
                features=["$100 monthly credit", "20% discount", "Priority support", "Advanced analytics"],
                priority_support=True
            ),
            PricingTier.ENTERPRISE: TierConfiguration(
                tier=PricingTier.ENTERPRISE,
                display_name="Enterprise",
                description="Custom solutions for large organizations",
                monthly_credit=Decimal("500.00"),
                free_api_access_count=50,
                fractional_ratio_multiplier=Decimal("0.60"),  # 40% discount
                maximum_monthly_spend=None,  # Unlimited
                features=["$500 monthly credit", "40% discount", "Dedicated support", "Custom integrations"],
                priority_support=True
            )
        }
        
        # System configuration
        self.system_config = {
            "default_access_duration_days": 30,
            "cache_expiry_days": 90,
            "minimum_indexing_cost": 1.00,
            "maximum_indexing_cost": 100.00,
            "commission_rate": 0.15,
            "currency": "USD",
            "tax_rate": 0.00,
            "payment_methods": ["demo", "stripe", "credit_balance"],
            "refund_policy_days": 7,
            "billing_cycle": "monthly"
        }
    
    def _parse_configuration(self, config_data: Dict[str, Any]):
        """Parse configuration data from JSON"""
        # Parse pricing rules
        for rule_data in config_data.get("pricing_rules", []):
            rule = PricingRule(
                rule_id=rule_data["rule_id"],
                name=rule_data["name"],
                description=rule_data["description"],
                fractional_ratio=Decimal(str(rule_data["fractional_ratio"])),
                minimum_charge=Decimal(str(rule_data["minimum_charge"])),
                maximum_charge=Decimal(str(rule_data["maximum_charge"])),
                applies_to_apis=rule_data["applies_to_apis"],
                applies_to_tiers=[PricingTier(tier) for tier in rule_data["applies_to_tiers"]],
                active=rule_data.get("active", True),
                created_at=datetime.fromisoformat(rule_data["created_at"]),
                created_by=rule_data.get("created_by", "system")
            )
            self.pricing_rules[rule.rule_id] = rule
        
        # Parse tier configurations
        for tier_data in config_data.get("tier_configurations", []):
            tier_config = TierConfiguration(
                tier=PricingTier(tier_data["tier"]),
                display_name=tier_data["display_name"],
                description=tier_data["description"],
                monthly_credit=Decimal(str(tier_data["monthly_credit"])),
                free_api_access_count=tier_data["free_api_access_count"],
                fractional_ratio_multiplier=Decimal(str(tier_data["fractional_ratio_multiplier"])),
                maximum_monthly_spend=Decimal(str(tier_data["maximum_monthly_spend"])) if tier_data.get("maximum_monthly_spend") else None,
                features=tier_data["features"],
                priority_support=tier_data.get("priority_support", False)
            )
            self.tier_configurations[tier_config.tier] = tier_config
        
        # Parse API-specific pricing
        for api_data in config_data.get("api_pricing", []):
            api_pricing = APISpecificPricing(
                api_name=api_data["api_name"],
                custom_fractional_ratio=Decimal(str(api_data["custom_fractional_ratio"])) if api_data.get("custom_fractional_ratio") else None,
                custom_minimum_charge=Decimal(str(api_data["custom_minimum_charge"])) if api_data.get("custom_minimum_charge") else None,
                custom_maximum_charge=Decimal(str(api_data["custom_maximum_charge"])) if api_data.get("custom_maximum_charge") else None,
                tier_overrides=api_data.get("tier_overrides", {}),
                active=api_data.get("active", True)
            )
            self.api_pricing[api_pricing.api_name] = api_pricing
        
        # Parse system configuration  
        self.system_config = config_data.get("system_config", {})
    
    def _save_configuration(self):
        """Save current configuration to file"""
        try:
            config_data = {
                "pricing_rules": [
                    {
                        "rule_id": rule.rule_id,
                        "name": rule.name,
                        "description": rule.description,
                        "fractional_ratio": str(rule.fractional_ratio),
                        "minimum_charge": str(rule.minimum_charge),
                        "maximum_charge": str(rule.maximum_charge),
                        "applies_to_apis": rule.applies_to_apis,
                        "applies_to_tiers": [tier.value for tier in rule.applies_to_tiers],
                        "active": rule.active,
                        "created_at": rule.created_at.isoformat(),
                        "created_by": rule.created_by
                    }
                    for rule in self.pricing_rules.values()
                ],
                "tier_configurations": [
                    {
                        "tier": config.tier.value,
                        "display_name": config.display_name,
                        "description": config.description,
                        "monthly_credit": str(config.monthly_credit),
                        "free_api_access_count": config.free_api_access_count,
                        "fractional_ratio_multiplier": str(config.fractional_ratio_multiplier),
                        "maximum_monthly_spend": str(config.maximum_monthly_spend) if config.maximum_monthly_spend else None,
                        "features": config.features,
                        "priority_support": config.priority_support
                    }
                    for config in self.tier_configurations.values()
                ],
                "api_pricing": [
                    {
                        "api_name": pricing.api_name,
                        "custom_fractional_ratio": str(pricing.custom_fractional_ratio) if pricing.custom_fractional_ratio else None,
                        "custom_minimum_charge": str(pricing.custom_minimum_charge) if pricing.custom_minimum_charge else None,
                        "custom_maximum_charge": str(pricing.custom_maximum_charge) if pricing.custom_maximum_charge else None,
                        "tier_overrides": pricing.tier_overrides,
                        "active": pricing.active
                    }
                    for pricing in self.api_pricing.values()
                ],
                "system_config": self.system_config,
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "version": "1.0"
            }
            
            with open(self.config_file, 'w') as f:
                json.dump(config_data, f, indent=2)
            
            self.logger.info(f"💾 Configuration saved to {self.config_file}")
            
        except Exception as e:
            self.logger.error(f"❌ Failed to save configuration: {e}")
            raise
    
    def calculate_api_cost(
        self, 
        api_name: str, 
        original_cost: Decimal, 
        tenant_tier: PricingTier,
        tenant_apis_used: int = 0
    ) -> Tuple[Decimal, Decimal, str]:
        """
        Calculate the fractional cost for API access based on configuration
        
        Returns:
            Tuple of (fractional_cost, savings, pricing_rule_used)
        """
        try:
            # Check for free tier eligibility
            tier_config = self.tier_configurations.get(tenant_tier)
            if tier_config and tenant_apis_used < tier_config.free_api_access_count:
                savings = original_cost
                return Decimal("0.00"), savings, "free_tier"
            
            # Get API-specific pricing if exists
            api_pricing = self.api_pricing.get(api_name)
            
            # Find applicable pricing rule
            applicable_rule = None
            for rule in self.pricing_rules.values():
                if not rule.active:
                    continue
                if rule.applies_to_tiers and tenant_tier not in rule.applies_to_tiers:
                    continue
                if rule.applies_to_apis and api_name not in rule.applies_to_apis:
                    continue
                applicable_rule = rule
                break
            
            if not applicable_rule:
                applicable_rule = self.pricing_rules.get("default_fractional")
            
            if not applicable_rule:
                raise ValueError("No applicable pricing rule found")
            
            # Calculate base fractional cost
            fractional_ratio = applicable_rule.fractional_ratio
            minimum_charge = applicable_rule.minimum_charge
            maximum_charge = applicable_rule.maximum_charge
            
            # Apply API-specific overrides
            if api_pricing and api_pricing.active:
                if api_pricing.custom_fractional_ratio:
                    fractional_ratio = api_pricing.custom_fractional_ratio
                if api_pricing.custom_minimum_charge:
                    minimum_charge = api_pricing.custom_minimum_charge
                if api_pricing.custom_maximum_charge:
                    maximum_charge = api_pricing.custom_maximum_charge
            
            # Apply tier multiplier
            if tier_config:
                fractional_ratio *= tier_config.fractional_ratio_multiplier
            
            # Calculate fractional cost
            fractional_cost = original_cost * fractional_ratio
            fractional_cost = max(fractional_cost, minimum_charge)
            fractional_cost = min(fractional_cost, maximum_charge)
            
            savings = original_cost - fractional_cost
            
            return fractional_cost, savings, applicable_rule.rule_id
            
        except Exception as e:
            self.logger.error(f"❌ Cost calculation failed: {e}")
            # Fallback to default
            fractional_cost = max(original_cost * Decimal("0.05"), Decimal("0.20"))
            savings = original_cost - fractional_cost
            return fractional_cost, savings, "fallback_default"
    
    def update_pricing_rule(
        self, 
        rule_id: str, 
        updates: Dict[str, Any], 
        admin_user_id: str, 
        admin_email: str,
        reason: str = "Admin update"
    ) -> bool:
        """Update a pricing rule with audit logging"""
        try:
            if rule_id not in self.pricing_rules:
                raise ValueError(f"Pricing rule '{rule_id}' not found")
            
            old_rule = self.pricing_rules[rule_id]
            old_values = asdict(old_rule)
            
            # Apply updates
            if "fractional_ratio" in updates:
                old_rule.fractional_ratio = Decimal(str(updates["fractional_ratio"]))
            if "minimum_charge" in updates:
                old_rule.minimum_charge = Decimal(str(updates["minimum_charge"]))
            if "maximum_charge" in updates:
                old_rule.maximum_charge = Decimal(str(updates["maximum_charge"]))
            if "active" in updates:
                old_rule.active = updates["active"]
            
            new_values = asdict(old_rule)
            
            # Log change
            change = ConfigurationChange(
                change_id=f"pricing_{rule_id}_{int(datetime.now().timestamp())}",
                change_type=ConfigChangeType.PRICING_UPDATE,
                admin_user_id=admin_user_id,
                admin_email=admin_email,
                timestamp=datetime.now(timezone.utc),
                old_values=old_values,
                new_values=new_values,
                reason=reason
            )
            self.configuration_changes.append(change)
            
            # Save configuration
            self._save_configuration()
            
            self.logger.info(f"✅ Updated pricing rule '{rule_id}' by {admin_email}")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Failed to update pricing rule: {e}")
            return False
    
    def get_configuration_summary(self) -> Dict[str, Any]:
        """Get summary of current configuration for admin dashboard"""
        return {
            "pricing_rules": len(self.pricing_rules),
            "active_rules": len([r for r in self.pricing_rules.values() if r.active]),
            "tier_configurations": len(self.tier_configurations),
            "api_specific_pricing": len(self.api_pricing),
            "recent_changes": len([c for c in self.configuration_changes if c.timestamp > datetime.now(timezone.utc).replace(day=1)]),
            "system_config": self.system_config,
            "last_updated": self.config_file.stat().st_mtime if self.config_file.exists() else None
        }
    
    def get_tenant_pricing_info(self, tenant_tier: PricingTier) -> Dict[str, Any]:
        """Get pricing information for a specific tenant tier"""
        tier_config = self.tier_configurations.get(tenant_tier)
        if not tier_config:
            return {"error": "Tier configuration not found"}
        
        return {
            "tier": tier_config.tier.value,
            "display_name": tier_config.display_name,
            "description": tier_config.description,
            "monthly_credit": float(tier_config.monthly_credit),
            "free_api_access_count": tier_config.free_api_access_count,
            "discount_percentage": float((1 - tier_config.fractional_ratio_multiplier) * 100),
            "features": tier_config.features,
            "priority_support": tier_config.priority_support,
            "maximum_monthly_spend": float(tier_config.maximum_monthly_spend) if tier_config.maximum_monthly_spend else None
        }

# Global pricing configuration manager instance
_pricing_config_manager: Optional[PricingConfigurationManager] = None

def get_pricing_config() -> PricingConfigurationManager:
    """Get the global pricing configuration manager instance"""
    global _pricing_config_manager
    if _pricing_config_manager is None:
        _pricing_config_manager = PricingConfigurationManager()
    return _pricing_config_manager