from datetime import datetime, timedelta
from typing import List
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Schedule
from ..schemas import (
    ScheduleCreate,
    ScheduleUpdate,
    ScheduleResponse,
    ScheduleDueResponse,
    ScheduleResultRequest,
)
from ..security import get_current_user
from ..services.scheduler_service import scheduler_service

router = APIRouter(prefix="/api/schedules", tags=["schedules"])

TZ_BR = ZoneInfo("America/Sao_Paulo")

ATRASO_MAXIMO_MIN = 120

def validar_horario(hora: str):
    try:
        h, m = hora.split(":")[:2]
        if not (0 <= int(h) <= 23 and 0 <= int(m) <= 59):
            raise ValueError
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Horario invalido. Use o formato HH:MM."
        )

def validar_dias(dias: str):
    partes = [d.strip() for d in (dias or "").split(",") if d.strip()]
    if not partes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selecione ao menos um dia da semana."
        )
    for d in partes:
        if not d.isdigit() or not (0 <= int(d) <= 6):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dias da semana invalidos."
            )

def buscar_agendamento(schedule_id: int, db: Session, current_user: User) -> Schedule:
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agendamento nao encontrado."
        )
    if current_user.role != "master" and schedule.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sem permissao para este agendamento."
        )
    return schedule

@router.get("", response_model=List[ScheduleResponse])
def list_schedules(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Schedule)
    if current_user.role != "master":
        query = query.filter(Schedule.user_id == current_user.id)
    return query.order_by(Schedule.hora.asc(), Schedule.id.desc()).all()

@router.get("/due", response_model=List[ScheduleDueResponse])
def list_due_schedules(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Agendamentos vencidos que o app desktop deve executar agora.

    O disparo acontece na maquina do usuario (IP brasileiro), nao na VPS.
    Ao retornar um agendamento ja marcamos last_run_at: assim, se houver dois
    desktops abertos, o segundo recebe lista vazia e o bot nao roda duplicado.
    """
    agora = datetime.now(TZ_BR)

    query = db.query(Schedule).filter(Schedule.is_active == True)
    if current_user.role != "master":
        query = query.filter(Schedule.user_id == current_user.id)

    vencidos = []
    for schedule in query.all():
        try:
            dias = [int(d.strip()) for d in (schedule.dias_semana or "").split(",") if d.strip()]
            if agora.weekday() not in dias:
                continue

            h, m = (schedule.hora or "08:00").split(":")[:2]
            marcado = agora.replace(hour=int(h), minute=int(m), second=0, microsecond=0)
        except Exception:
            continue

        atraso_min = int((agora - marcado).total_seconds() // 60)
        if atraso_min < 0 or atraso_min > ATRASO_MAXIMO_MIN:
            continue

        if schedule.last_run_at:
            ultimo = schedule.last_run_at.replace(tzinfo=ZoneInfo("UTC")).astimezone(TZ_BR)
            if ultimo >= marcado:
                continue

        schedule.last_run_at = datetime.utcnow()
        schedule.last_result = "reivindicado pelo desktop"
        vencidos.append(
            ScheduleDueResponse(
                id=schedule.id,
                name=schedule.name or f"agendamento {schedule.id}",
                client_id=schedule.client_id,
                mode=schedule.mode if schedule.mode in ["homologacao", "producao"] else "homologacao",
                atraso_min=atraso_min,
            )
        )

    if vencidos:
        db.commit()
    return vencidos


@router.post("/{schedule_id}/resultado", response_model=ScheduleResponse)
def report_result(
    schedule_id: int,
    payload: ScheduleResultRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """O desktop informa como terminou a execucao que ele reivindicou."""
    schedule = buscar_agendamento(schedule_id, db, current_user)
    schedule.last_result = (payload.resultado or "")[:250]
    db.commit()
    db.refresh(schedule)
    return schedule


@router.post("", response_model=ScheduleResponse)
def create_schedule(schedule_in: ScheduleCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    validar_horario(schedule_in.hora)
    validar_dias(schedule_in.dias_semana)

    schedule = Schedule(
        user_id=current_user.id,
        client_id=schedule_in.client_id,
        name=(schedule_in.name or "").strip() or "Agendamento",
        hora=schedule_in.hora,
        dias_semana=schedule_in.dias_semana,
        mode=schedule_in.mode if schedule_in.mode in ["homologacao", "producao"] else "homologacao",
        is_active=schedule_in.is_active if schedule_in.is_active is not None else True,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    scheduler_service.sync_job(schedule)
    return schedule

@router.put("/{schedule_id}", response_model=ScheduleResponse)
def update_schedule(schedule_id: int, schedule_in: ScheduleUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    schedule = buscar_agendamento(schedule_id, db, current_user)

    if schedule_in.hora is not None:
        validar_horario(schedule_in.hora)
        schedule.hora = schedule_in.hora
    if schedule_in.dias_semana is not None:
        validar_dias(schedule_in.dias_semana)
        schedule.dias_semana = schedule_in.dias_semana
    if schedule_in.name is not None:
        schedule.name = schedule_in.name.strip() or "Agendamento"
    if schedule_in.client_id is not None:
        schedule.client_id = schedule_in.client_id
    if schedule_in.mode is not None and schedule_in.mode in ["homologacao", "producao"]:
        schedule.mode = schedule_in.mode
    if schedule_in.is_active is not None:
        schedule.is_active = schedule_in.is_active

    db.commit()
    db.refresh(schedule)

    scheduler_service.sync_job(schedule)
    return schedule

@router.post("/{schedule_id}/toggle", response_model=ScheduleResponse)
def toggle_schedule(schedule_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    schedule = buscar_agendamento(schedule_id, db, current_user)
    schedule.is_active = not bool(schedule.is_active)
    db.commit()
    db.refresh(schedule)

    scheduler_service.sync_job(schedule)
    return schedule

@router.delete("/{schedule_id}")
def delete_schedule(schedule_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    schedule = buscar_agendamento(schedule_id, db, current_user)
    scheduler_service.remove_job(schedule.id)
    db.delete(schedule)
    db.commit()
    return {"message": "Agendamento removido com sucesso."}
