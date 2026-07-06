from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.models.user_profile import UserProfile
from app.schemas.user_profile import UserProfileRead, UserProfileUpdate


router = APIRouter(prefix="/profile", tags=["profile"])


def get_or_create_profile(user_id: int, db: Session) -> UserProfile:
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == user_id))
    if profile is not None:
        return profile

    profile = UserProfile(user_id=user_id)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("", response_model=UserProfileRead)
def read_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserProfileRead:
    return get_or_create_profile(current_user.id, db)


@router.put("", response_model=UserProfileRead)
def update_profile(
    payload: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserProfileRead:
    profile = get_or_create_profile(current_user.id, db)
    for key, value in payload.model_dump().items():
        setattr(profile, key, value)
    db.commit()
    db.refresh(profile)
    return profile
