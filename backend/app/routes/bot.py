from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, BotExecution
from ..schemas import BotStartRequest, BotStatusResponse, BotExecutionResponse
from ..security import get_current_user, get_current_master
from ..services.bot_runner import bot_runner

router = APIRouter(prefix="/api/bot", tags=["bot"])

@router.post("/start")
def start_bot(req: BotStartRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    target_client_id = req.client_id
    if current_user.role != "master":
        from ..models import ClientProfile
        client = db.query(ClientProfile).filter(ClientProfile.user_id == current_user.id).first()
        if not client:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nenhum perfil de cliente vinculado a este operador."
            )
        target_client_id = client.id

    mode = req.mode if req.mode in ["homologacao", "producao"] else "homologacao"
    res = bot_runner.start_bot(mode=mode, triggered_by=current_user.email, client_id=target_client_id)
    return res

@router.post("/consult")
def consult_vagas(req: BotStartRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    target_client_id = req.client_id
    if current_user.role != "master":
        from ..models import ClientProfile
        client = db.query(ClientProfile).filter(ClientProfile.user_id == current_user.id).first()
        if not client:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nenhum perfil de cliente vinculado a este operador."
            )
        target_client_id = client.id

    res = bot_runner.start_consultation(triggered_by=current_user.email, client_id=target_client_id)
    return res

@router.post("/stop")
def stop_bot(current_user: User = Depends(get_current_user)):
    return bot_runner.stop_bot()


@router.get("/status", response_model=BotStatusResponse)
def get_bot_status(current_user: User = Depends(get_current_user)):
    return bot_runner.get_status()

@router.get("/logs")
def get_bot_logs(offset: int = Query(0, ge=0), current_user: User = Depends(get_current_user)):
    status_info = bot_runner.get_status()
    logs = bot_runner.get_logs(start_index=offset)
    return {
        "status": status_info["status"],
        "mode": status_info["mode"],
        "client_name": status_info.get("client_name"),
        "logs": logs,
        "total_count": status_info["logs_count"]
    }

@router.get("/history", response_model=List[BotExecutionResponse])
def get_execution_history(limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == "master":
        return db.query(BotExecution).order_by(BotExecution.id.desc()).limit(limit).all()

    from ..models import ClientProfile
    client = db.query(ClientProfile).filter(ClientProfile.user_id == current_user.id).first()
    client_name = client.name if client else ""

    query = db.query(BotExecution).filter(
        (BotExecution.triggered_by == current_user.email) | (BotExecution.client_name == client_name)
    )
    return query.order_by(BotExecution.id.desc()).limit(limit).all()

@router.delete("/history")
@router.post("/history/clear")
def clear_execution_history(db: Session = Depends(get_db), current_master: User = Depends(get_current_master)):
    db.query(BotExecution).delete()
    db.commit()
    return {"message": "Historico limpo."}
