from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.services.web_push import get_vapid_public_key


router = APIRouter(prefix="/push", tags=["push"])


class PushKeys(BaseModel):
    p256dh: str = Field(min_length=1)
    auth: str = Field(min_length=1)


class PushSubscriptionPayload(BaseModel):
    endpoint: str = Field(min_length=1)
    keys: PushKeys


class PushPublicKeyResponse(BaseModel):
    public_key: str


class PushSubscriptionResponse(BaseModel):
    id: int
    endpoint: str


@router.get("/public-key", response_model=PushPublicKeyResponse)
def public_key() -> PushPublicKeyResponse:
    return PushPublicKeyResponse(public_key=get_vapid_public_key())


@router.post("/subscribe", response_model=PushSubscriptionResponse, status_code=status.HTTP_201_CREATED)
def subscribe(
    payload: PushSubscriptionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PushSubscriptionResponse:
    subscription = db.scalar(select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint))
    if subscription is None:
        subscription = PushSubscription(
            user_id=current_user.id,
            endpoint=payload.endpoint,
            p256dh=payload.keys.p256dh,
            auth=payload.keys.auth,
        )
        db.add(subscription)
    else:
        subscription.user_id = current_user.id
        subscription.p256dh = payload.keys.p256dh
        subscription.auth = payload.keys.auth
    db.commit()
    db.refresh(subscription)
    return PushSubscriptionResponse(id=subscription.id, endpoint=subscription.endpoint)


class PushUnsubscribePayload(BaseModel):
    endpoint: str = Field(min_length=1)


@router.post("/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
def unsubscribe(
    payload: PushUnsubscribePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    subscription = db.scalar(
        select(PushSubscription).where(
            PushSubscription.endpoint == payload.endpoint,
            PushSubscription.user_id == current_user.id,
        )
    )
    if subscription is not None:
        db.delete(subscription)
        db.commit()
