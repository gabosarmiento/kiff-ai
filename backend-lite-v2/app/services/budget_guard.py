from __future__ import annotations
from dataclasses import dataclass
from decimal import Decimal
from typing import Optional
from sqlalchemy.orm import Session
from ..models.observability import TenantBudget
from ..services.email_service import EmailService

FALLBACK_TENANT_ID = "4485db48-71b7-47b0-8128-c6dca5be352d"


@dataclass
class BudgetDecision:
    state: str  # ok | soft_exceeded | hard_blocked
    should_block: bool
    notify: bool
    message: str


def _current_period(period: str) -> tuple[str, str]:
    import datetime as dt
    if period == "daily":
        return period, dt.date.today().isoformat()
    elif period == "monthly":
        today = dt.date.today()
        return period, dt.date(today.year, today.month, 1).isoformat()
    return period, dt.date.today().isoformat()


def get_budget_row(db: Session, tenant_id: str, period: str = "monthly") -> Optional[TenantBudget]:
    p, start = _current_period(period)
    row = (
        db.query(TenantBudget)
        .filter(TenantBudget.tenant_id == tenant_id, TenantBudget.period == p, TenantBudget.period_start == start)
        .first()
    )
    return row


def evaluate_budget(db: Session, tenant_id: Optional[str], projected_cost: Decimal) -> BudgetDecision:
    tid = tenant_id or FALLBACK_TENANT_ID
    row = get_budget_row(db, tid, period="monthly")
    if not row:
        return BudgetDecision(state="ok", should_block=False, notify=False, message="No budget configured")

    used = Decimal(str(row.usage_to_date_usd or 0))
    soft = Decimal(str(row.soft_limit_usd))
    hard = Decimal(str(row.hard_limit_usd))

    new_total = used + projected_cost

    if new_total >= hard:
        return BudgetDecision(state="hard_blocked", should_block=True, notify=True, message="Hard limit would be exceeded")
    if new_total >= soft:
        return BudgetDecision(state="soft_exceeded", should_block=False, notify=True, message="Soft limit exceeded")
    # Alert at 80% threshold
    if soft > 0 and new_total >= (soft * Decimal("0.8")):
        return BudgetDecision(state="ok", should_block=False, notify=True, message="Approaching soft limit (80%)")
    return BudgetDecision(state="ok", should_block=False, notify=False, message="Within budget")


def send_budget_alert(tenant_id: str, decision: BudgetDecision, to_email: Optional[str] = None) -> None:
    try:
        svc = EmailService()
        subject = f"Budget Alert [{decision.state}] for tenant {tenant_id}"
        text = decision.message
        # If no email configured here, rely on EmailService default config/env
        svc.send_email(to=to_email or svc.get_default_to(), subject=subject, text=text)
    except Exception:
        # Do not block LLM calls due to alert failures
        pass
