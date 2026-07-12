import base64
import json
import logging
import threading
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from py_vapid import Vapid02
from pywebpush import WebPushException, webpush
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.push_subscription import PushSubscription


logger = logging.getLogger(__name__)

_vapid_lock = threading.Lock()
_vapid: Vapid02 | None = None


def _load_vapid() -> Vapid02:
    """Load the VAPID key pair, generating and persisting one on first use."""
    global _vapid
    if _vapid is not None:
        return _vapid

    with _vapid_lock:
        if _vapid is not None:
            return _vapid
        key_path = Path(get_settings().vapid_private_key_file)
        if key_path.exists():
            vapid = Vapid02.from_file(str(key_path))
        else:
            vapid = Vapid02()
            vapid.generate_keys()
            vapid.save_key(str(key_path))
        _vapid = vapid
        return vapid


def get_vapid_public_key() -> str:
    """Return the base64url-encoded uncompressed public key for PushManager.subscribe."""
    vapid = _load_vapid()
    raw = vapid.public_key.public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _vapid_private_key_path() -> str:
    _load_vapid()  # guarantees the key file exists
    return str(Path(get_settings().vapid_private_key_file))


def send_push_to_user(db: Session, user_id: int, *, title: str, body: str, url: str = "/") -> int:
    """Send a web push to every subscription of the user. Returns delivered count.

    Dead subscriptions (endpoint gone) are removed so they stop accumulating.
    """
    subscriptions = list(
        db.scalars(select(PushSubscription).where(PushSubscription.user_id == user_id)).all()
    )
    if not subscriptions:
        return 0

    settings = get_settings()
    payload = json.dumps({"title": title, "body": body, "url": url})
    delivered = 0

    for subscription in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": subscription.endpoint,
                    "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
                },
                data=payload,
                vapid_private_key=_vapid_private_key_path(),
                vapid_claims={"sub": settings.vapid_subject},
            )
            delivered += 1
        except WebPushException as exc:
            status_code = exc.response.status_code if exc.response is not None else None
            if status_code in {404, 410}:
                db.delete(subscription)
            else:
                logger.warning("Web push to user %s failed: %s", user_id, exc)
        except Exception:
            logger.exception("Web push to user %s failed unexpectedly", user_id)

    return delivered
