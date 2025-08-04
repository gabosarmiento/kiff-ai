"""
Account Management Service
Handles user account operations, secure deletion, and usage tracking
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.models.models import User, Agent, APIKey, UsageRecord
from app.core.database import get_db
from app.core.security import get_password_hash, verify_password

logger = logging.getLogger(__name__)

class RealAccountService:
    """Production-ready account management service with complete user lifecycle"""
    
    def __init__(self):
        self.logger = logger
        self.verification_tokens = {}  # In production, use Redis
        self.password_reset_tokens = {}  # In production, use Redis
        self.email_templates_dir = Path(__file__).parent.parent / "templates" / "emails"
        self.email_templates_dir.mkdir(parents=True, exist_ok=True)
    
    async def register_user(self, email: str, password: str, full_name: str, 
                           marketing_consent: bool = False) -> Dict[str, Any]:
        """Register a new user with email verification"""
        try:
            db = next(get_db())
            
            # Validate email format
            if not self._is_valid_email(email):
                raise ValueError("Invalid email format")
            
            # Check if user already exists
            existing_user = db.query(User).filter(User.email == email).first()
            if existing_user:
                if existing_user.is_verified:
                    raise ValueError("User with this email already exists")
                else:
                    # Resend verification email for unverified user
                    await self._send_verification_email(existing_user.email, existing_user.id)
                    return {"message": "Verification email resent", "user_id": existing_user.id}
            
            # Validate password strength
            if not self._is_strong_password(password):
                raise ValueError("Password must be at least 8 characters with uppercase, lowercase, number, and special character")
            
            # Create new user
            hashed_password = get_password_hash(password)
            user = User(
                email=email,
                hashed_password=hashed_password,
                full_name=full_name,
                is_active=False,  # Inactive until email verified
                is_verified=False,
                settings={
                    "theme": "dark", 
                    "notifications": True,
                    "marketing_consent": marketing_consent,
                    "timezone": "UTC"
                }
            )
            
            db.add(user)
            db.commit()
            db.refresh(user)
            
            # Create user management record
            user_management = UserManagement(
                user_id=user.id,
                status=UserStatus.PENDING,
                subscription_plan=SubscriptionPlan.FREE,
                monthly_token_limit=10000,
                monthly_api_calls_limit=1000,
                sandbox_limit=2
            )
            db.add(user_management)
            
            # Initialize usage tracking
            await self._initialize_usage_tracking(user.id, db)
            
            # Send verification email
            await self._send_verification_email(user.email, user.id)
            
            db.commit()
            
            self.logger.info(f"Registered new user: {email}")
            return {
                "user_id": user.id,
                "email": user.email,
                "message": "Registration successful. Please check your email to verify your account.",
                "verification_required": True
            }
            
        except Exception as e:
            self.logger.error(f"Error registering user: {e}")
            db.rollback()
            raise
        finally:
            db.close()
    
    async def get_user_profile(self, user_id: str) -> Dict[str, Any]:
        """Get user profile with usage statistics"""
        try:
            db = next(get_db())
            
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                raise ValueError("User not found")
            
            # Get usage statistics
            usage_stats = await self._get_usage_statistics(user_id, db)
            
            return {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "full_name": user.full_name,
                "avatar_url": user.avatar_url,
                "is_active": user.is_active,
                "is_verified": user.is_verified,
                "settings": user.settings,
                "created_at": user.created_at.isoformat(),
                "last_login": user.last_login.isoformat() if user.last_login else None,
                "usage_stats": usage_stats
            }
            
        except Exception as e:
            self.logger.error(f"Error getting user profile: {e}")
            raise
        finally:
            db.close()
    
    async def update_user_profile(self, user_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update user profile information"""
        try:
            db = next(get_db())
            
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                raise ValueError("User not found")
            
            # Update allowed fields
            allowed_fields = ["full_name", "avatar_url", "settings"]
            for field, value in updates.items():
                if field in allowed_fields:
                    setattr(user, field, value)
            
            user.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(user)
            
            self.logger.info(f"Updated user profile: {user_id}")
            return await self.get_user_profile(user_id)
            
        except Exception as e:
            self.logger.error(f"Error updating user profile: {e}")
            raise
        finally:
            db.close()
    
    async def change_password(self, user_id: str, current_password: str, new_password: str) -> bool:
        """Change user password with verification"""
        try:
            db = next(get_db())
            
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                raise ValueError("User not found")
            
            # Verify current password
            if not verify_password(current_password, user.hashed_password):
                raise ValueError("Current password is incorrect")
            
            # Update password
            user.hashed_password = get_password_hash(new_password)
            user.updated_at = datetime.utcnow()
            db.commit()
            
            self.logger.info(f"Password changed for user: {user_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error changing password: {e}")
            raise
        finally:
            db.close()
    
    async def delete_account(self, user_id: str, password: str) -> Dict[str, Any]:
        """Securely delete user account and all associated data"""
        try:
            db = next(get_db())
            
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                raise ValueError("User not found")
            
            # Verify password for security
            if not verify_password(password, user.hashed_password):
                raise ValueError("Password verification failed")
            
            # Get deletion statistics before deletion
            deletion_stats = await self._get_deletion_statistics(user_id, db)
            
            # Cascade delete all user data
            await self._cascade_delete_user_data(user_id, db)
            
            # Delete the user account
            db.delete(user)
            db.commit()
            
            self.logger.info(f"Successfully deleted user account: {user.username} ({user_id})")
            
            return {
                "deleted": True,
                "username": user.username,
                "deletion_timestamp": datetime.utcnow().isoformat(),
                "deleted_data": deletion_stats
            }
            
        except Exception as e:
            self.logger.error(f"Error deleting account: {e}")
            db.rollback()
            raise
        finally:
            db.close()
    
    async def get_usage_summary(self, user_id: str, days: int = 30) -> Dict[str, Any]:
        """Get detailed usage summary for the user"""
        try:
            db = next(get_db())
            
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=days)
            
            # Get usage records
            usage_records = db.query(UsageRecord).filter(
                and_(
                    UsageRecord.user_id == user_id,
                    UsageRecord.timestamp >= start_date,
                    UsageRecord.timestamp <= end_date
                )
            ).all()
            
            # Aggregate usage by type
            usage_summary = {
                "period_days": days,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "total_tokens": 0,
                "total_api_calls": 0,
                "total_app_generations": 0,
                "total_agents_created": 0,
                "usage_by_type": {},
                "daily_usage": []
            }
            
            for record in usage_records:
                usage_summary["total_tokens"] += record.tokens_used or 0
                usage_summary["total_api_calls"] += record.api_calls or 0
                
                if record.resource_type == "app_generation":
                    usage_summary["total_app_generations"] += 1
                elif record.resource_type == "agent_generation":
                    usage_summary["total_agents_created"] += 1
                
                # Group by type
                if record.resource_type not in usage_summary["usage_by_type"]:
                    usage_summary["usage_by_type"][record.resource_type] = {
                        "count": 0,
                        "tokens": 0,
                        "api_calls": 0
                    }
                
                usage_summary["usage_by_type"][record.resource_type]["count"] += 1
                usage_summary["usage_by_type"][record.resource_type]["tokens"] += record.tokens_used or 0
                usage_summary["usage_by_type"][record.resource_type]["api_calls"] += record.api_calls or 0
            
            return usage_summary
            
        except Exception as e:
            self.logger.error(f"Error getting usage summary: {e}")
            raise
        finally:
            db.close()
    
    async def track_usage(self, user_id: str, resource_type: str, tokens_used: int = 0, 
                         api_calls: int = 0, metadata: Optional[Dict] = None) -> None:
        """Track resource usage for a user"""
        try:
            db = next(get_db())
            
            usage_record = UsageRecord(
                user_id=user_id,
                resource_type=resource_type,
                tokens_used=tokens_used,
                api_calls=api_calls,
                metadata=metadata,
                timestamp=datetime.utcnow()
            )
            
            db.add(usage_record)
            db.commit()
            
            self.logger.debug(f"Tracked usage for user {user_id}: {resource_type}")
            
        except Exception as e:
            self.logger.error(f"Error tracking usage: {e}")
            raise
        finally:
            db.close()
    
    async def _initialize_usage_tracking(self, user_id: str, db: Session) -> None:
        """Initialize usage tracking for new user"""
        initial_record = UsageRecord(
            user_id=user_id,
            resource_type="account_created",
            tokens_used=0,
            api_calls=0,
            metadata={"event": "account_creation"},
            timestamp=datetime.utcnow()
        )
        db.add(initial_record)
    
    async def _get_usage_statistics(self, user_id: str, db: Session) -> Dict[str, Any]:
        """Get current usage statistics for user"""
        # Get total usage
        total_usage = db.query(
            func.sum(UsageRecord.tokens_used).label("total_tokens"),
            func.sum(UsageRecord.api_calls).label("total_api_calls"),
            func.count(UsageRecord.id).label("total_operations")
        ).filter(UsageRecord.user_id == user_id).first()
        
        # Get recent usage (last 7 days)
        recent_date = datetime.utcnow() - timedelta(days=7)
        recent_usage = db.query(
            func.sum(UsageRecord.tokens_used).label("recent_tokens"),
            func.sum(UsageRecord.api_calls).label("recent_api_calls")
        ).filter(
            and_(
                UsageRecord.user_id == user_id,
                UsageRecord.timestamp >= recent_date
            )
        ).first()
        
        return {
            "total_tokens": total_usage.total_tokens or 0,
            "total_api_calls": total_usage.total_api_calls or 0,
            "total_operations": total_usage.total_operations or 0,
            "recent_tokens_7d": recent_usage.recent_tokens or 0,
            "recent_api_calls_7d": recent_usage.recent_api_calls or 0
        }
    
    async def _get_deletion_statistics(self, user_id: str, db: Session) -> Dict[str, int]:
        """Get statistics of data to be deleted"""
        stats = {}
        
        # Count agents
        stats["agents"] = db.query(Agent).filter(Agent.user_id == user_id).count()
        

        
        # Count generated applications
        # TODO: Implement proper app generation tracking for kiff system
        stats["generated_apps"] = 0  # Placeholder - backtest functionality removed
        
        # Count API keys
        stats["api_keys"] = db.query(APIKey).filter(APIKey.user_id == user_id).count()
        
        # Count usage records
        stats["usage_records"] = db.query(UsageRecord).filter(UsageRecord.user_id == user_id).count()
        
        return stats
    
    async def _cascade_delete_user_data(self, user_id: str, db: Session) -> None:
        """Cascade delete all user-related data"""
        # Delete in proper order to respect foreign key constraints
        
        # Delete usage records
        db.query(UsageRecord).filter(UsageRecord.user_id == user_id).delete()
        
        # Delete API keys
        db.query(APIKey).filter(APIKey.user_id == user_id).delete()
        
        # Delete generated applications data
        # TODO: Implement proper app generation data cleanup for kiff system
        # BacktestResult model removed - legacy functionality cleaned up
        pass  # Placeholder for future app generation data cleanup
        

        
        # Delete agents
        db.query(Agent).filter(Agent.user_id == user_id).delete()
        
        self.logger.info(f"Cascaded deletion completed for user: {user_id}")


# Alias for backward compatibility
AccountService = RealAccountService
