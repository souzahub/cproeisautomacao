from datetime import datetime
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
    from ..models import ClientProfile
    if current_user.role != "master":
        client = db.query(ClientProfile).filter(ClientProfile.user_id == current_user.id).first()
        if not client and current_user.name:
            client = db.query(ClientProfile).filter(ClientProfile.name.ilike(f"%{current_user.name}%")).first()
        if not client and current_user.email:
            client = db.query(ClientProfile).filter(ClientProfile.system_user == current_user.email).first()
        if not client and req.client_id:
            client = db.query(ClientProfile).filter(ClientProfile.id == req.client_id).first()
        if not client:
            client = db.query(ClientProfile).filter(ClientProfile.is_active == True).first()

        if not client:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nenhum perfil de cliente cadastrado ou vinculado para execução."
            )
        target_client_id = client.id

    mode = req.mode if req.mode in ["homologacao", "producao"] else "homologacao"
    res = bot_runner.start_bot(mode=mode, triggered_by=current_user.email, client_id=target_client_id)
    return res

@router.post("/consult")
def consult_vagas(req: BotStartRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    target_client_id = req.client_id
    from ..models import ClientProfile
    if current_user.role != "master":
        client = db.query(ClientProfile).filter(ClientProfile.user_id == current_user.id).first()
        if not client and current_user.name:
            client = db.query(ClientProfile).filter(ClientProfile.name.ilike(f"%{current_user.name}%")).first()
        if not client and current_user.email:
            client = db.query(ClientProfile).filter(ClientProfile.system_user == current_user.email).first()
        if not client and req.client_id:
            client = db.query(ClientProfile).filter(ClientProfile.id == req.client_id).first()
        if not client:
            client = db.query(ClientProfile).filter(ClientProfile.is_active == True).first()

        if not client:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nenhum perfil de cliente cadastrado ou vinculado para execução."
            )
        target_client_id = client.id

    res = bot_runner.start_consultation(triggered_by=current_user.email, client_id=target_client_id)
    return res

@router.post("/stop")
def stop_bot(current_user: User = Depends(get_current_user)):
    return bot_runner.stop_bot()


@router.get("/status", response_model=BotStatusResponse)
def get_bot_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    status_info = dict(bot_runner.get_status())
    if not status_info.get("started_at"):
        last_exec = db.query(BotExecution).order_by(BotExecution.id.desc()).first()
        if last_exec:
            if status_info.get("status") == "idle":
                status_info["status"] = last_exec.status or "completed"
            status_info["mode"] = last_exec.mode or status_info.get("mode") or "homologacao"
            status_info["client_name"] = last_exec.client_name or status_info.get("client_name")
            if last_exec.started_at:
                try:
                    status_info["started_at"] = last_exec.started_at.strftime("%d/%m/%Y, %H:%M")
                except Exception:
                    status_info["started_at"] = str(last_exec.started_at)
    return status_info

@router.get("/logs")
def get_bot_logs(offset: int = Query(0, ge=0), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    status_info = bot_runner.get_status()
    logs = bot_runner.get_logs(start_index=offset)
    if not logs:
        last_exec = db.query(BotExecution).order_by(BotExecution.id.desc()).first()
        if last_exec and last_exec.logs:
            db_lines = [l for l in last_exec.logs.splitlines() if l.strip()]
            formatted = []
            for l in db_lines[offset:]:
                if l.startswith("[") and "]" in l:
                    parts = l.split("]", 1)
                    formatted.append({"timestamp": parts[0].strip("["), "message": parts[1].strip()})
                else:
                    formatted.append({"timestamp": "", "message": l})
            return {
                "status": last_exec.status or status_info["status"],
                "mode": last_exec.mode or status_info["mode"],
                "client_name": last_exec.client_name or status_info.get("client_name"),
                "logs": formatted,
                "total_count": len(db_lines)
            }
    return {
        "status": status_info["status"],
        "mode": status_info["mode"],
        "client_name": status_info.get("client_name"),
        "logs": logs,
        "total_count": status_info["logs_count"]
    }

@router.post("/logs/clear")
@router.delete("/logs")
def clear_bot_logs(current_user: User = Depends(get_current_user)):
    bot_runner.clear_logs()
    return {"message": "Logs limpos com sucesso."}

@router.post("/solve-captcha")
def solve_captcha_api(payload: dict, current_user: User = Depends(get_current_user)):
    import base64
    import os
    b64_image = (payload.get("image") or "").strip()
    if not b64_image:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Imagem não informada.")

    clean_b64 = b64_image.split(",")[-1].strip()
    try:
        img_bytes = base64.b64decode(clean_b64)
    except Exception:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Base64 inválido.")

    from bot import resolver_captcha_gemini, resolver_captcha_local
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    model = os.getenv("GEMINI_MODEL", "antigravity99").strip()
    ai_base_url = os.getenv("AI_BASE_URL", "").strip()

    if api_key:
        code = resolver_captcha_gemini(img_bytes, api_key, model, ai_base_url=ai_base_url)
        if len(code) == 6:
            return {"success": True, "code": code, "provider": "ai_server"}

    try:
        import ddddocr
        ocr = ddddocr.DdddOcr(show_ad=False)
        code = resolver_captcha_local(img_bytes, ocr)
        if len(code) == 6:
            return {"success": True, "code": code, "provider": "ocr_server"}
    except Exception:
        pass

    return {"success": False, "code": "", "message": "Não foi possível resolver o captcha no servidor."}

@router.get("/history", response_model=List[BotExecutionResponse])
def get_execution_history(
    limit: int = Query(100, ge=1, le=500),
    user: Optional[str] = Query(None),
    client: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    mode: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(BotExecution)
    if current_user.role != "master":
        from ..models import ClientProfile
        client_prof = db.query(ClientProfile).filter(ClientProfile.user_id == current_user.id).first()
        client_name = client_prof.name if client_prof else ""
        query = query.filter(
            (BotExecution.triggered_by == current_user.email) | (BotExecution.client_name == client_name)
        )
    else:
        if user:
            query = query.filter(BotExecution.triggered_by.ilike(f"%{user}%"))
        if client:
            query = query.filter(BotExecution.client_name.ilike(f"%{client}%"))
        if status:
            query = query.filter(BotExecution.status == status)
        if mode:
            query = query.filter(BotExecution.mode == mode)

    return query.order_by(BotExecution.id.desc()).limit(limit).all()

@router.delete("/history")
@router.post("/history/clear")
def clear_execution_history(db: Session = Depends(get_db), current_master: User = Depends(get_current_master)):
    db.query(BotExecution).delete()
    db.commit()
    return {"message": "Historico limpo."}

@router.delete("/history/{execution_id}")
def delete_execution_history_item(execution_id: int, db: Session = Depends(get_db), current_master: User = Depends(get_current_master)):
    from fastapi import HTTPException, status
    item = db.query(BotExecution).filter(BotExecution.id == execution_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registro de execucao nao encontrado.")
    db.delete(item)
    db.commit()
    return {"message": "Registro removido."}

@router.post("/history", response_model=BotExecutionResponse)
def record_execution(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from datetime import datetime
    client_name = data.get("client_name") or "Padrao do sistema"
    exec_record = BotExecution(
        mode=data.get("mode", "homologacao"),
        status=data.get("status", "running"),
        triggered_by=current_user.email,
        client_name=client_name,
        started_at=datetime.utcnow()
    )
    db.add(exec_record)
    db.commit()
    db.refresh(exec_record)
    return exec_record

@router.put("/history/{execution_id}", response_model=BotExecutionResponse)
def update_execution_record(
    execution_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from datetime import datetime
    from fastapi import HTTPException, status
    item = db.query(BotExecution).filter(BotExecution.id == execution_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registro nao encontrado.")
    if "status" in data:
        item.status = data["status"]
    if data.get("finished_at"):
        item.finished_at = datetime.utcnow()
    if "logs" in data:
        item.logs = data["logs"]
    db.commit()
    db.refresh(item)
    return item

@router.post("/history/{execution_id}/send-whatsapp")
def send_whatsapp_execution(
    execution_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    import os
    from fastapi import HTTPException, status
    from ..models import ClientProfile
    from ..config import COMPROVANTES_DIR
    from ..services.whatsapp import (
        disparar_notificacoes_whatsapp,
        extrair_lista_numeros,
        parse_vagas_from_text,
        formatar_resumo_vagas_wpp
    )

    item = db.query(BotExecution).filter(BotExecution.id == execution_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registro de execucao nao encontrado.")

    from .settings import read_env_file
    env_data = read_env_file()

    api_url = (os.getenv("EVOLUTION_API_URL") or env_data.get("EVOLUTION_API_URL") or "").strip()
    instance = (os.getenv("EVOLUTION_INSTANCE") or env_data.get("EVOLUTION_INSTANCE") or "").strip()
    api_key = (os.getenv("EVOLUTION_API_KEY") or env_data.get("EVOLUTION_API_KEY") or "").strip()
    configured_numbers = (os.getenv("WHATSAPP_NOTIFY_NUMBERS") or env_data.get("WHATSAPP_NOTIFY_NUMBERS") or "").strip()

    if not api_url or not instance or not api_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Evolution API nao configurada nas configuracoes do sistema.")

    destinatarios = []
    if configured_numbers:
        destinatarios.extend(extrair_lista_numeros(configured_numbers))

    client = None
    if item.client_name:
        client = db.query(ClientProfile).filter(ClientProfile.name == item.client_name).first()
    if not client and current_user.role != "master":
        client = db.query(ClientProfile).filter(ClientProfile.user_id == current_user.id).first()

    if client and client.phone:
        for n in extrair_lista_numeros(client.phone):
            if n not in destinatarios:
                destinatarios.append(n)

    if not destinatarios:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nenhum numero de telefone valido encontrado para envio.")

    doc_clean = client.document.replace(".", "").replace("-", "").strip() if client and client.document else ""
    caminho_pdf = None
    if COMPROVANTES_DIR.exists():
        if doc_clean:
            pdf_candidato = COMPROVANTES_DIR / f"comprovante_{doc_clean}.pdf"
            if pdf_candidato.exists():
                caminho_pdf = str(pdf_candidato)
        if not caminho_pdf:
            pdf_padrao = COMPROVANTES_DIR / "comprovante_vagas.pdf"
            if pdf_padrao.exists():
                caminho_pdf = str(pdf_padrao)

    status_map = {
        "completed": "Concluído ✅",
        "running": "Em execução ⏳",
        "stopped": "Interrompido ⚠️",
        "error": "Erro ❌"
    }
    mode_map = {
        "homologacao": "Homologação (Teste) 🧪",
        "producao": "Produção 🚀",
        "consulta": "Consulta de Vagas 🔍"
    }

    status_pt = status_map.get(str(item.status).lower(), str(item.status))
    mode_pt = mode_map.get(str(item.mode).lower(), str(item.mode))
    nome_cli = item.client_name or "Cliente"
    data_hora_str = datetime.now().strftime("%d/%m/%Y às %H:%M")

    vagas = parse_vagas_from_text(item.logs or "")
    resumo_vagas = formatar_resumo_vagas_wpp(vagas)

    texto = (
        f"📋 *CPROEIS - Resumo da Execução #{item.id}*\n\n"
        f"👤 *Cliente:* {nome_cli}\n"
        f"📊 *Status:* {status_pt}\n"
        f"⚙️ *Modo:* {mode_pt}\n"
        f"🕒 *Horário:* {data_hora_str}\n\n"
        f"{resumo_vagas}\n\n"
        f"📄 Comprovante oficial em anexo."
    )

    res = disparar_notificacoes_whatsapp(
        numeros_raw=",".join(destinatarios),
        texto=texto,
        caminho_pdf=caminho_pdf,
        legenda="Comprovante Oficial CPROEIS",
        api_url=api_url,
        instance=instance,
        api_key=api_key
    )

    return {
        "success": res.get("success", False),
        "message": res.get("message", "envio processado"),
        "total_enviados": res.get("total_enviados", 0),
        "total_falhas": res.get("total_falhas", 0),
        "destinatarios": destinatarios,
        "tem_pdf": bool(caminho_pdf)
    }
