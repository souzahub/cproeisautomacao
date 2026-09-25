from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..config import SYNC_SECRET_KEY
from ..database import get_db
from ..models import User, PanelSetting
from ..schemas import PanelSettingsUpdate
from ..security import get_current_user

router = APIRouter(prefix="/api/settings", tags=["settings"])

@router.get("")
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    slot_price_setting = db.query(PanelSetting).filter(PanelSetting.key == "default_slot_price").first()
    sync_key_setting = db.query(PanelSetting).filter(PanelSetting.key == "sync_secret_key").first()

    default_price = 30.0
    if slot_price_setting and slot_price_setting.value:
        try:
            default_price = float(slot_price_setting.value)
        except ValueError:
            default_price = 30.0

    sync_key = sync_key_setting.value if sync_key_setting and sync_key_setting.value else SYNC_SECRET_KEY

    return {
        "default_slot_price": default_price,
        "sync_secret_key": sync_key
    }

@router.post("")
def update_settings(
    payload: PanelSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if payload.default_slot_price is not None:
        slot_setting = db.query(PanelSetting).filter(PanelSetting.key == "default_slot_price").first()
        if not slot_setting:
            slot_setting = PanelSetting(key="default_slot_price", value=str(payload.default_slot_price))
            db.add(slot_setting)
        else:
            slot_setting.value = str(payload.default_slot_price)

    if payload.sync_secret_key is not None:
        key_setting = db.query(PanelSetting).filter(PanelSetting.key == "sync_secret_key").first()
        if not key_setting:
            key_setting = PanelSetting(key="sync_secret_key", value=payload.sync_secret_key.strip())
            db.add(key_setting)
        else:
            key_setting.value = payload.sync_secret_key.strip()

    db.commit()

    return get_settings(db=db, current_user=current_user)
