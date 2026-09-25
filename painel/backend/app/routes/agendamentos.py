import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Agendamento
from ..schemas import AgendamentoResponse, AgendamentoUpdatePayment
from ..security import get_current_user

router = APIRouter(prefix="/api/agendamentos", tags=["agendamentos"])

@router.get("", response_model=List[AgendamentoResponse])
def list_agendamentos(
    client_name: Optional[str] = Query(None),
    status_pagamento: Optional[str] = Query(None),
    tipo_vaga: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Agendamento).order_by(Agendamento.id.desc())

    if client_name:
        query = query.filter(Agendamento.client_name.ilike(f"%{client_name}%"))
    if status_pagamento:
        query = query.filter(Agendamento.status_pagamento == status_pagamento)
    if tipo_vaga:
        query = query.filter(Agendamento.tipo_vaga.ilike(f"%{tipo_vaga}%"))
    if search:
        query = query.filter(
            (Agendamento.evento.ilike(f"%{search}%")) |
            (Agendamento.client_name.ilike(f"%{search}%")) |
            (Agendamento.data_evento.ilike(f"%{search}%"))
        )

    return query.offset(offset).limit(limit).all()

@router.patch("/{agendamento_id}/status-pagamento", response_model=AgendamentoResponse)
def update_payment_status(
    agendamento_id: int,
    payload: AgendamentoUpdatePayment,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ag = db.query(Agendamento).filter(Agendamento.id == agendamento_id).first()
    if not ag:
        raise HTTPException(status_code=404, detail="Agendamento nao encontrado")

    ag.status_pagamento = payload.status_pagamento
    if payload.status_pagamento == "pago":
        ag.pago_em = datetime.datetime.utcnow()
    else:
        ag.pago_em = None

    if payload.valor_cobrado is not None:
        ag.valor_cobrado = max(0.0, payload.valor_cobrado)

    db.commit()
    db.refresh(ag)
    return ag

@router.post("/marcar-todos-pagos")
def mark_all_paid(
    client_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ags = db.query(Agendamento).filter(
        Agendamento.client_name == client_name,
        Agendamento.status_pagamento != "pago"
    ).all()

    now = datetime.datetime.utcnow()
    for a in ags:
        a.status_pagamento = "pago"
        a.pago_em = now

    db.commit()
    return {"message": f"{len(ags)} agendamentos marcados como pagos", "total": len(ags)}

@router.delete("/{agendamento_id}")
def delete_agendamento(
    agendamento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ag = db.query(Agendamento).filter(Agendamento.id == agendamento_id).first()
    if not ag:
        raise HTTPException(status_code=404, detail="Agendamento nao encontrado")

    db.delete(ag)
    db.commit()
    return {"message": "Agendamento removido"}
