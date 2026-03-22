from sqlalchemy.orm import Session
import models
import schemas
from datetime import datetime, timezone
from dateutil.relativedelta import relativedelta
import uuid
import math


SENSOR_MESSAGE_COST = 0.10 / 100000
SENSOR_ONBOARD_FEE = 1.00


def calculate_amount_due(message_count: int, sensor_count: int, ml_features: list) -> float:
    return (
        message_count * SENSOR_MESSAGE_COST
        + sensor_count * SENSOR_ONBOARD_FEE
        + sum(f.cost for f in ml_features)
    )


def calculate_next_due_date(frequency: models.BillingFrequency, last_date: datetime) -> datetime:
    if frequency == models.BillingFrequency.DAILY:
        return last_date + relativedelta(days=1)
    elif frequency == models.BillingFrequency.WEEKLY:
        return last_date + relativedelta(weeks=1)
    elif frequency == models.BillingFrequency.MONTHLY:
        return last_date + relativedelta(months=1)
    elif frequency == models.BillingFrequency.QUARTERLY:
        return last_date + relativedelta(months=3)
    elif frequency == models.BillingFrequency.YEARLY:
        return last_date + relativedelta(years=1)
    return last_date


def create_billing(db: Session, billing: schemas.BillingCreate):
    db_billing = models.Billing(**billing.model_dump(), amount_due=0.0)
    db.add(db_billing)
    db.commit()
    db.refresh(db_billing)
    return db_billing


def get_billing_by_tenant(db: Session, tenant_id: int):
    return db.query(models.Billing).filter(models.Billing.tenant_id == tenant_id).first()


def update_billing_on_payment(db: Session, billing: models.Billing):
    billing.message_count = 0
    billing.sensor_count = 0
    billing.amount_due = 0.0
    billing.last_payment_date = datetime.now(timezone.utc).replace(tzinfo=None)
    billing.due_date = calculate_next_due_date(billing.frequency, billing.last_payment_date)
    billing.status = models.BillingStatus.ACTIVE
    db.commit()
    db.refresh(billing)
    return billing


def create_ml_feature_subscription(
    db: Session,
    ml_feature: schemas.MLFeatureSubscriptionCreate,
    billing_id: int,
):
    db_ml = models.MLFeatureSubscription(**ml_feature.model_dump(), billing_id=billing_id)
    db.add(db_ml)
    db.commit()
    db.refresh(db_ml)
    return db_ml


def _auto_suspend_if_overdrawn(billing: "models.Billing") -> bool:
    """Set billing to SUSPENDED if amount_due exceeds balance. Returns True if newly suspended."""
    if (
        billing.status == models.BillingStatus.ACTIVE
        and billing.amount_due > (billing.balance or 0.0)
    ):
        billing.status = models.BillingStatus.SUSPENDED
        return True
    return False


def update_sensor_count(db: Session, tenant_id: int, delta: int) -> tuple["models.Billing | None", bool]:
    billing = get_billing_by_tenant(db, tenant_id)
    newly_suspended = False
    if billing:
        billing.sensor_count = max(0, billing.sensor_count + delta)
        # Only recalculate amount_due while billing is active.
        # Once suspended, amount_due is frozen at the suspension value so the
        # outstanding debt is preserved for end-of-cycle deduction.
        if billing.status == models.BillingStatus.ACTIVE:
            billing.amount_due = calculate_amount_due(
                billing.message_count, billing.sensor_count, billing.ml_features
            )
            newly_suspended = _auto_suspend_if_overdrawn(billing)
        db.commit()
        db.refresh(billing)
    return billing, newly_suspended


def update_message_count(db: Session, tenant_id: int, increment: int) -> tuple["models.Billing | None", bool]:
    billing = get_billing_by_tenant(db, tenant_id)
    newly_suspended = False
    if billing:
        billing.message_count += increment
        # Only recalculate amount_due while billing is active.
        # Once suspended, amount_due is frozen at the suspension value so the
        # outstanding debt is preserved for end-of-cycle deduction.
        if billing.status == models.BillingStatus.ACTIVE:
            billing.amount_due = calculate_amount_due(
                billing.message_count, billing.sensor_count, billing.ml_features
            )
            newly_suspended = _auto_suspend_if_overdrawn(billing)
        db.commit()
        db.refresh(billing)
    return billing, newly_suspended


def _detect_card_brand(card_number: str) -> str:
    if card_number.startswith("4"):
        return "Visa"
    if card_number.startswith(("51", "52", "53", "54", "55")):
        return "Mastercard"
    if card_number.startswith(("34", "37")):
        return "Amex"
    return "Card"


def _build_tx_meta(topup: schemas.BillingTopUpRequest) -> dict:
    """Return description, card_last4, card_brand for a topup."""
    method = topup.payment_method
    if method == "credit_card" and topup.card_number:
        num = topup.card_number.replace(" ", "")
        last4 = num[-4:]
        brand = _detect_card_brand(num)
        return {
            "description": f"Top-up via {brand} ending {last4}",
            "card_last4": last4,
            "card_brand": brand,
        }
    if method == "paypal" and topup.payer_email:
        return {"description": f"Top-up via PayPal ({topup.payer_email})"}
    if method == "skrill" and topup.payer_email:
        return {"description": f"Top-up via Skrill ({topup.payer_email})"}
    if method == "revolut" and topup.payer_email:
        return {"description": f"Top-up via Revolut ({topup.payer_email})"}
    if method == "bank_transfer":
        ref = topup.reference or "N/A"
        return {"description": f"Top-up via Wire Transfer (ref: {ref})"}
    label = method.replace("_", " ").title()
    return {"description": f"Top-up via {label}"}


def topup_billing(db: Session, tenant_id: int, topup: schemas.BillingTopUpRequest) -> models.Billing:
    billing = get_billing_by_tenant(db, tenant_id)
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if not billing:
        billing = models.Billing(
            tenant_id=tenant_id,
            status=models.BillingStatus.ACTIVE,
            frequency=models.BillingFrequency.MONTHLY,
            payment_method=topup.payment_method,
            balance=0.0,
            amount_due=0.0,
            due_date=now + relativedelta(months=1),
        )
        db.add(billing)
        db.flush()

    billing.balance = (billing.balance or 0.0) + topup.amount
    billing.status = models.BillingStatus.ACTIVE
    billing.payment_method = topup.payment_method
    billing.last_payment_date = now

    meta = _build_tx_meta(topup)
    tx = models.Transaction(
        billing_id=billing.id,
        type=models.TransactionType.CREDIT,
        amount=topup.amount,
        balance_after=billing.balance,
        payment_method=topup.payment_method,
        reference=f"TXN-{uuid.uuid4().hex[:8].upper()}",
        **meta,
    )
    db.add(tx)
    db.commit()
    db.refresh(billing)
    return billing


def get_transactions(
    db: Session, billing_id: int, page: int = 1, per_page: int = 20
) -> schemas.TransactionPage:
    query = (
        db.query(models.Transaction)
        .filter(models.Transaction.billing_id == billing_id)
        .order_by(models.Transaction.created_at.desc())
    )
    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    return schemas.TransactionPage(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, math.ceil(total / per_page)),
    )


def update_billing_frequency(
    db: Session, tenant_id: int, frequency: models.BillingFrequency
) -> models.Billing | None:
    billing = get_billing_by_tenant(db, tenant_id)
    if not billing:
        return None
    billing.frequency = frequency
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    billing.due_date = calculate_next_due_date(frequency, now)
    db.commit()
    db.refresh(billing)
    return billing


def process_billing_cycle(
    db: Session,
    tenant_id: int,
    req: schemas.BillingProcessCycleRequest,
) -> models.Billing:
    billing = get_billing_by_tenant(db, tenant_id)
    if not billing:
        raise ValueError("No billing record found")
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    # Use the server-side amount_due (frozen at suspension or current running total).
    # Never trust an amount sent from the frontend — the backend owns the debt value.
    amount_owed = billing.amount_due
    cycle_messages = billing.message_count
    deduct = min(amount_owed, billing.balance or 0.0)
    billing.balance = (billing.balance or 0.0) - deduct
    billing.message_count = 0
    billing.amount_due = 0.0
    billing.last_payment_date = now
    billing.due_date = calculate_next_due_date(billing.frequency, now)
    if billing.balance <= 0:
        billing.status = models.BillingStatus.SUSPENDED
    else:
        billing.status = models.BillingStatus.ACTIVE
    tx = models.Transaction(
        billing_id=billing.id,
        type=models.TransactionType.DEBIT,
        amount=deduct,
        balance_after=billing.balance,
        description=f"Billing cycle charge — {cycle_messages:,} messages",
        usage_period=req.usage_period or now.strftime("%Y-%m"),
        data_points=cycle_messages,
        reference=f"CYCLE-{uuid.uuid4().hex[:8].upper()}",
    )
    db.add(tx)
    db.commit()
    db.refresh(billing)
    return billing


def get_billing_rate(db: Session) -> models.BillingRate:
    rate = db.query(models.BillingRate).first()
    if not rate:
        rate = models.BillingRate()
        db.add(rate)
        db.commit()
        db.refresh(rate)
    return rate


def charge_query(
    db: Session, tenant_id: int, qu: float, cost: float, sql_preview: str
) -> tuple["models.Billing | None", bool]:
    """Add a query charge to the tenant's running cost (amount_due) and record a USAGE ledger entry.

    Query charges accumulate in amount_due — they are NOT immediately deducted from balance.
    The balance is only reduced at the end of the billing cycle via process_billing_cycle.
    Returns (billing, newly_suspended).
    """
    billing = get_billing_by_tenant(db, tenant_id)
    if not billing:
        return None, False
    newly_suspended = False
    if billing.status == models.BillingStatus.ACTIVE:
        billing.amount_due = (billing.amount_due or 0.0) + cost
        newly_suspended = _auto_suspend_if_overdrawn(billing)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    tx = models.Transaction(
        billing_id=billing.id,
        type=models.TransactionType.USAGE,
        amount=cost,
        balance_after=billing.balance or 0.0,
        description=f"Query — {qu:.2f} QU · {sql_preview[:120]}",
        reference=f"QRY-{uuid.uuid4().hex[:8].upper()}",
        data_points=int(round(qu)),
        usage_period=now.strftime("%Y-%m"),
    )
    db.add(tx)
    db.commit()
    db.refresh(billing)
    return billing, newly_suspended


def get_cycle_detail(
    db: Session, tenant_id: int, usage_period: str
) -> schemas.CycleDetailResponse:
    """Return the breakdown for a billing cycle: message summary + individual query items."""
    billing = get_billing_by_tenant(db, tenant_id)
    empty = schemas.CycleDetailResponse(
        usage_period=usage_period,
        cycle_amount=0.0,
        cycle_date=None,
        message_count=0,
        message_cost=0.0,
        query_items=[],
        query_total_cost=0.0,
        query_total_qu=0.0,
    )
    if not billing:
        return empty
    cycle_tx = (
        db.query(models.Transaction)
        .filter(
            models.Transaction.billing_id == billing.id,
            models.Transaction.reference.like("CYCLE-%"),
            models.Transaction.usage_period == usage_period,
        )
        .order_by(models.Transaction.created_at.desc())
        .first()
    )
    usage_items = (
        db.query(models.Transaction)
        .filter(
            models.Transaction.billing_id == billing.id,
            models.Transaction.type == models.TransactionType.USAGE,
            models.Transaction.usage_period == usage_period,
        )
        .order_by(models.Transaction.created_at.asc())
        .all()
    )
    rate = get_billing_rate(db)
    message_count = cycle_tx.data_points or 0 if cycle_tx else 0
    message_cost = round(message_count * rate.message_rate, 6)
    query_total_cost = sum(tx.amount for tx in usage_items)
    query_total_qu = sum(float(tx.data_points or 0) for tx in usage_items)
    return schemas.CycleDetailResponse(
        usage_period=usage_period,
        cycle_amount=cycle_tx.amount if cycle_tx else 0.0,
        cycle_date=cycle_tx.created_at if cycle_tx else None,
        message_count=message_count,
        message_cost=message_cost,
        query_items=[schemas.UsageLineItem.model_validate(tx) for tx in usage_items],
        query_total_cost=round(query_total_cost, 6),
        query_total_qu=query_total_qu,
    )


def get_query_stats(
    db: Session, tenant_id: int, sensor_id: str | None, farm_id: str | None
) -> schemas.QueryStatsResponse:
    """Return aggregated query spend for a specific sensor and/or farm.

    Matches by searching the transaction description for sensor_id / farm_id
    strings — query charges embed the SQL preview in the description which
    typically contains the identifiers the user queried by.
    """
    billing = get_billing_by_tenant(db, tenant_id)
    if not billing:
        return schemas.QueryStatsResponse(query_count=0, total_qu=0.0, total_cost=0.0)
    q = (
        db.query(models.Transaction)
        .filter(
            models.Transaction.billing_id == billing.id,
            models.Transaction.reference.like("QRY-%"),
        )
    )
    if sensor_id:
        q = q.filter(models.Transaction.description.ilike(f"%{sensor_id}%"))
    elif farm_id:
        q = q.filter(models.Transaction.description.ilike(f"%{farm_id}%"))
    txns = q.all()
    return schemas.QueryStatsResponse(
        query_count=len(txns),
        total_qu=sum(float(t.data_points or 0) for t in txns),
        total_cost=sum(t.amount for t in txns),
    )


def update_billing_rate(db: Session, updates: schemas.BillingRateUpdate) -> models.BillingRate:
    rate = get_billing_rate(db)
    if updates.message_rate is not None:
        rate.message_rate = updates.message_rate
    if updates.storage_rate is not None:
        rate.storage_rate = updates.storage_rate
    if updates.query_rate is not None:
        rate.query_rate = updates.query_rate
    db.commit()
    db.refresh(rate)
    return rate
