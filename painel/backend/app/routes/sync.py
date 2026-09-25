import datetime
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from ..config import SYNC_SECRET_KEY
from ..database import get_db
from ..models import User, Client, Agendamento, PanelSetting
from ..schemas import SyncPushPayload

router = APIRouter(prefix="/api/sync", tags=["sync"])

def get_default_slot_price(db: Session) -> float:
    setting = db.query(PanelSetting).filter(PanelSetting.key == "default_slot_price").first()
    if setting and setting.value:
        try:
            return float(setting.value)
        except ValueError:
            return 30.0
    return 30.0

@router.post("/push")
def receive_sync(
    payload: SyncPushPayload,
    x_sync_secret: str = Header(None),
    db: Session = Depends(get_db)
):
    provided_secret = x_sync_secret or payload.sync_secret
    configured_secret = SYNC_SECRET_KEY
    custom_secret = db.query(PanelSetting).filter(PanelSetting.key == "sync_secret_key").first()
    if custom_secret and custom_secret.value:
        configured_secret = custom_secret.value

    if not provided_secret or provided_secret != configured_secret:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chave de sincronizacao invalida"
        )

    users_synced = 0
    if payload.users:
        for u in payload.users:
            if not u.email:
                continue
            existing = db.query(User).filter(User.email == u.email).first()
            if existing:
                existing.name = u.name or existing.name
                existing.hashed_password = u.hashed_password
                existing.role = u.role or existing.role
                existing.is_active = u.is_active if u.is_active is not None else existing.is_active
            else:
                new_user = User(
                    email=u.email,
                    name=u.name or "",
                    hashed_password=u.hashed_password,
                    role=u.role or "operador",
                    is_active=u.is_active if u.is_active is not None else True
                )
                db.add(new_user)
            users_synced += 1

    clients_synced = 0
    client_map = {}
    if payload.clients:
        for c in payload.clients:
            if not c.document and not c.name:
                continue
            existing_c = None
            if c.document:
                existing_c = db.query(Client).filter(Client.document == c.document).first()
            if not existing_c and c.name:
                existing_c = db.query(Client).filter(Client.name == c.name).first()

            if existing_c:
                existing_c.name = c.name or existing_c.name
                existing_c.phone = c.phone or existing_c.phone
                existing_c.document_type = c.document_type or existing_c.document_type
                existing_c.is_active = c.is_active if c.is_active is not None else existing_c.is_active
                if c.remote_id:
                    existing_c.remote_id = c.remote_id
                client_map[existing_c.name] = existing_c
            else:
                new_c = Client(
                    remote_id=c.remote_id,
                    name=c.name,
                    document_type=c.document_type or "CPF",
                    document=c.document or "",
                    phone=c.phone or "",
                    is_active=c.is_active if c.is_active is not None else True
                )
                db.add(new_c)
                db.flush()
                client_map[new_c.name] = new_c
            clients_synced += 1

    default_price = get_default_slot_price(db)
    agendamentos_synced = 0

    if payload.agendamentos:
        for a in payload.agendamentos:
            clean_event = (a.evento or "").strip()
            clean_client = (a.client_name or "").strip()
            clean_data = (a.data_evento or "").strip()

            target_client = client_map.get(clean_client)
            if not target_client and clean_client:
                target_client = db.query(Client).filter(Client.name == clean_client).first()

            target_price = default_price
            client_id_val = None
            client_doc_val = a.client_document or ""

            if target_client:
                client_id_val = target_client.id
                if not client_doc_val:
                    client_doc_val = target_client.document
                if target_client.valor_agendamento is not None and target_client.valor_agendamento > 0:
                    target_price = target_client.valor_agendamento

            query = db.query(Agendamento)
            if a.remote_id:
                existing_ag = query.filter(Agendamento.remote_id == a.remote_id).first()
            elif a.execution_id:
                existing_ag = query.filter(
                    Agendamento.execution_id == a.execution_id,
                    Agendamento.evento == clean_event,
                    Agendamento.data_evento == clean_data
                ).first()
            else:
                existing_ag = query.filter(
                    Agendamento.client_name == clean_client,
                    Agendamento.evento == clean_event,
                    Agendamento.data_evento == clean_data
                ).first()

            if not existing_ag:
                new_ag = Agendamento(
                    remote_id=a.remote_id or f"synced-{a.execution_id}-{clean_event[:20]}",
                    execution_id=a.execution_id,
                    client_id=client_id_val,
                    client_name=clean_client or "Padrao",
                    client_document=client_doc_val,
                    evento=clean_event,
                    convenio=a.convenio or "HCPM - RAS",
                    data_evento=clean_data,
                    horario=a.horario or "",
                    ponto_encontro=a.ponto_encontro or "",
                    endereco=a.endereco or "",
                    tipo_vaga=a.tipo_vaga or "Titular",
                    status=a.status or "Confirmada",
                    modo=a.modo or "producao",
                    data_agendamento=a.data_agendamento or datetime.datetime.now().strftime("%d/%m/%Y %H:%M"),
                    valor_cobrado=target_price,
                    status_pagamento="pendente"
                )
                db.add(new_ag)
                agendamentos_synced += 1

    db.commit()

    return {
        "status": "success",
        "synced_at": datetime.datetime.utcnow().isoformat(),
        "users_synced": users_synced,
        "clients_synced": clients_synced,
        "agendamentos_synced": agendamentos_synced
    }

@router.get("/status")
def sync_status(
    x_sync_secret: str = Header(None),
    db: Session = Depends(get_db)
):
    configured_secret = SYNC_SECRET_KEY
    custom_secret = db.query(PanelSetting).filter(PanelSetting.key == "sync_secret_key").first()
    if custom_secret and custom_secret.value:
        configured_secret = custom_secret.value

    if not x_sync_secret or x_sync_secret != configured_secret:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chave de sincronizacao invalida"
        )

    total_u = db.query(User).count()
    total_c = db.query(Client).count()
    total_a = db.query(Agendamento).count()

    return {
        "status": "online",
        "total_users": total_u,
        "total_clients": total_c,
        "total_agendamentos": total_a
    }
