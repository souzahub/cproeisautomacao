from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Client, Agendamento, PanelSetting
from ..schemas import ClientResponse, ClientUpdate
from ..security import get_current_user

router = APIRouter(prefix="/api/clients", tags=["clients"])

def get_default_slot_price(db: Session) -> float:
    setting = db.query(PanelSetting).filter(PanelSetting.key == "default_slot_price").first()
    if setting and setting.value:
        try:
            return float(setting.value)
        except ValueError:
            return 30.0
    return 30.0

@router.get("", response_model=List[ClientResponse])
def list_clients(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Client).order_by(Client.name.asc())
    if search:
        query = query.filter((Client.name.ilike(f"%{search}%")) | (Client.document.ilike(f"%{search}%")))

    clients = query.all()
    results = []

    for c in clients:
        ags = db.query(Agendamento).filter(
            (Agendamento.client_id == c.id) | (Agendamento.client_name == c.name)
        ).all()

        tot_ag = len(ags)
        tot_fat = sum(a.valor_cobrado for a in ags)
        tot_pago = sum(a.valor_cobrado for a in ags if a.status_pagamento == "pago")
        tot_pend = sum(a.valor_cobrado for a in ags if a.status_pagamento != "pago")

        results.append({
            "id": c.id,
            "remote_id": c.remote_id,
            "name": c.name,
            "document_type": c.document_type,
            "document": c.document,
            "phone": c.phone or "",
            "valor_agendamento": c.valor_agendamento,
            "is_active": c.is_active,
            "total_agendamentos": tot_ag,
            "total_faturado": tot_fat,
            "total_pago": tot_pago,
            "total_pendente": tot_pend,
            "created_at": c.created_at
        })

    return results

@router.get("/{client_id}", response_model=ClientResponse)
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cliente nao encontrado")

    ags = db.query(Agendamento).filter(
        (Agendamento.client_id == c.id) | (Agendamento.client_name == c.name)
    ).all()

    tot_ag = len(ags)
    tot_fat = sum(a.valor_cobrado for a in ags)
    tot_pago = sum(a.valor_cobrado for a in ags if a.status_pagamento == "pago")
    tot_pend = sum(a.valor_cobrado for a in ags if a.status_pagamento != "pago")

    return {
        "id": c.id,
        "remote_id": c.remote_id,
        "name": c.name,
        "document_type": c.document_type,
        "document": c.document,
        "phone": c.phone or "",
        "valor_agendamento": c.valor_agendamento,
        "is_active": c.is_active,
        "total_agendamentos": tot_ag,
        "total_faturado": tot_fat,
        "total_pago": tot_pago,
        "total_pendente": tot_pend,
        "created_at": c.created_at
    }

@router.patch("/{client_id}", response_model=ClientResponse)
def update_client(
    client_id: int,
    payload: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cliente nao encontrado")

    if payload.name is not None:
        c.name = payload.name
    if payload.phone is not None:
        c.phone = payload.phone
    if payload.valor_agendamento is not None:
        c.valor_agendamento = payload.valor_agendamento if payload.valor_agendamento > 0 else None
    if payload.is_active is not None:
        c.is_active = payload.is_active

    db.commit()
    db.refresh(c)

    return get_client(client_id=c.id, db=db, current_user=current_user)
