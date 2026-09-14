from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, ClientProfile
from ..schemas import ClientProfileCreate, ClientProfileUpdate, ClientProfileResponse
from ..security import get_current_user, get_password_hash

router = APIRouter(prefix="/api/clients", tags=["clients"])

def to_client_response(client: ClientProfile, db: Session = None) -> ClientProfileResponse:
    res = ClientProfileResponse.model_validate(client)
    if client.user_id:
        if client.user:
            res.system_user = client.user.email
        elif db:
            u = db.query(User).filter(User.id == client.user_id).first()
            if u:
                res.system_user = u.email
    return res

@router.get("", response_model=List[ClientProfileResponse])
def list_clients(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == "master":
        clients = db.query(ClientProfile).order_by(ClientProfile.id.desc()).all()
    else:
        clients = db.query(ClientProfile).filter(ClientProfile.user_id == current_user.id).order_by(ClientProfile.id.desc()).all()
    return [to_client_response(c, db) for c in clients]

@router.post("", response_model=ClientProfileResponse)
def create_client(client_in: ClientProfileCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not client_in.name or not client_in.document or not client_in.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nome, documento e senha sao obrigatorios."
        )

    assigned_user_id = client_in.user_id if current_user.role == "master" else current_user.id

    if current_user.role == "master" and client_in.system_user and client_in.system_user.strip():
        username = client_in.system_user.strip()
        pwd = client_in.system_password.strip() if client_in.system_password and client_in.system_password.strip() else (client_in.password or "123456")
        existing_user = db.query(User).filter(User.email == username).first()
        if existing_user:
            if client_in.system_password and client_in.system_password.strip():
                existing_user.hashed_password = get_password_hash(pwd)
            existing_user.name = client_in.name
            assigned_user_id = existing_user.id
        else:
            new_user = User(
                email=username,
                name=client_in.name,
                hashed_password=get_password_hash(pwd),
                role="operador",
                is_active=True
            )
            db.add(new_user)
            db.flush()
            assigned_user_id = new_user.id

    client = ClientProfile(
        user_id=assigned_user_id,
        name=client_in.name,
        document_type=client_in.document_type or "CPF",
        document=client_in.document,
        password=client_in.password,
        convenio=client_in.convenio or "HCPM - RAS",
        preferred_events=client_in.preferred_events or "",
        only_listed_events=bool(client_in.only_listed_events),
        only_titular=bool(client_in.only_titular),
        tipo_data=client_in.tipo_data or "dias_frente",
        data_inicio=client_in.data_inicio,
        data_fim=client_in.data_fim,
        meta_vagas=client_in.meta_vagas if client_in.meta_vagas is not None else 1,
        days_forward_initial=client_in.days_forward_initial or 6,
        days_forward_max=client_in.days_forward_max or 7,
        interval_seconds=client_in.interval_seconds or 6,
        max_attempts=client_in.max_attempts or 120,
        is_active=True if client_in.is_active is None else client_in.is_active
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return to_client_response(client, db)

@router.get("/{client_id}", response_model=ClientProfileResponse)
def get_client(client_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    client = db.query(ClientProfile).filter(ClientProfile.id == client_id).first()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente nao encontrado.")
    if current_user.role != "master" and client.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso nao autorizado a este cliente.")
    return to_client_response(client, db)

@router.put("/{client_id}", response_model=ClientProfileResponse)
def update_client(client_id: int, client_in: ClientProfileUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    client = db.query(ClientProfile).filter(ClientProfile.id == client_id).first()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente nao encontrado.")
    if current_user.role != "master" and client.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso nao autorizado a este cliente.")

    if current_user.role == "master":
        if client_in.system_user and client_in.system_user.strip():
            username = client_in.system_user.strip()
            pwd = client_in.system_password.strip() if client_in.system_password and client_in.system_password.strip() else (client.password or "123456")
            user_obj = None
            if client.user_id:
                user_obj = db.query(User).filter(User.id == client.user_id).first()
            if not user_obj:
                user_obj = db.query(User).filter(User.email == username).first()

            if user_obj:
                user_obj.email = username
                if client_in.name:
                    user_obj.name = client_in.name
                if client_in.system_password and client_in.system_password.strip():
                    user_obj.hashed_password = get_password_hash(pwd)
                client.user_id = user_obj.id
            else:
                new_user = User(
                    email=username,
                    name=client_in.name or client.name,
                    hashed_password=get_password_hash(pwd),
                    role="operador",
                    is_active=True
                )
                db.add(new_user)
                db.flush()
                client.user_id = new_user.id
        elif client_in.user_id is not None:
            client.user_id = client_in.user_id if client_in.user_id > 0 else None

    if client_in.name is not None:
        client.name = client_in.name
    if client_in.document_type is not None:
        client.document_type = client_in.document_type
    if client_in.document is not None:
        client.document = client_in.document
    if client_in.password:
        client.password = client_in.password
    if client_in.convenio is not None:
        client.convenio = client_in.convenio
    if client_in.preferred_events is not None:
        client.preferred_events = client_in.preferred_events
    if client_in.only_listed_events is not None:
        client.only_listed_events = client_in.only_listed_events
    if client_in.only_titular is not None:
        client.only_titular = client_in.only_titular
    if client_in.tipo_data is not None:
        client.tipo_data = client_in.tipo_data
    if client_in.data_inicio is not None:
        client.data_inicio = client_in.data_inicio
    if client_in.data_fim is not None:
        client.data_fim = client_in.data_fim
    if client_in.meta_vagas is not None:
        client.meta_vagas = client_in.meta_vagas
    if client_in.days_forward_initial is not None:
        client.days_forward_initial = client_in.days_forward_initial
    if client_in.days_forward_max is not None:
        client.days_forward_max = client_in.days_forward_max
    if client_in.interval_seconds is not None:
        client.interval_seconds = client_in.interval_seconds
    if client_in.max_attempts is not None:
        client.max_attempts = client_in.max_attempts
    if client_in.is_active is not None:
        client.is_active = client_in.is_active

    db.commit()
    db.refresh(client)
    return to_client_response(client)

@router.delete("/{client_id}")
def delete_client(client_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    client = db.query(ClientProfile).filter(ClientProfile.id == client_id).first()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente nao encontrado.")
    if current_user.role != "master" and client.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso nao autorizado a este cliente.")

    db.delete(client)
    db.commit()
    return {"message": "Cliente removido."}
