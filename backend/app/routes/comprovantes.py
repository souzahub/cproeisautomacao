import os
import re
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from ..config import COMPROVANTES_DIR
from ..database import get_db
from ..models import User, BotExecution, ClientProfile
from ..schemas import ComprovanteFile
from ..security import get_current_user, verify_token_string

router = APIRouter(prefix="/api/comprovantes", tags=["comprovantes"])

@router.get("", response_model=List[ComprovanteFile])
def list_comprovantes(current_user: User = Depends(get_current_user)):
    files = []
    if COMPROVANTES_DIR.exists():
        for entry in os.scandir(COMPROVANTES_DIR):
            if entry.is_file() and entry.name.lower().endswith(".pdf"):
                stat = entry.stat()
                mod_time = datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
                files.append({
                    "name": entry.name,
                    "size_bytes": stat.st_size,
                    "modified_at": mod_time,
                    "download_url": f"/api/comprovantes/{entry.name}"
                })
    files.sort(key=lambda x: x["modified_at"], reverse=True)
    return files

@router.delete("")
def delete_all_comprovantes(current_user: User = Depends(get_current_user)):
    if current_user.role != "master":
        raise HTTPException(status_code=403, detail="Apenas administradores master podem remover comprovantes.")
    removed_count = 0
    if COMPROVANTES_DIR.exists():
        for entry in os.scandir(COMPROVANTES_DIR):
            if entry.is_file() and entry.name.lower().endswith(".pdf"):
                try:
                    os.unlink(entry.path)
                    removed_count += 1
                except Exception:
                    pass
    return {"message": f"{removed_count} comprovantes removidos."}

@router.post("/upload", response_model=ComprovanteFile)
async def upload_comprovante(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Apenas arquivos PDF sao permitidos.")

    COMPROVANTES_DIR.mkdir(parents=True, exist_ok=True)
    clean_name = os.path.basename(file.filename)
    dest_path = COMPROVANTES_DIR / clean_name

    content = await file.read()
    with open(dest_path, "wb") as f:
        f.write(content)

    stat = dest_path.stat()
    mod_time = datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
    return {
        "name": clean_name,
        "size_bytes": stat.st_size,
        "modified_at": mod_time,
        "download_url": f"/api/comprovantes/{clean_name}"
    }

@router.get("/vagas-report")
def get_vagas_report(
    client_name: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(BotExecution).order_by(BotExecution.id.desc())
    if current_user.role != "master":
        client_prof = db.query(ClientProfile).filter(ClientProfile.user_id == current_user.id).first()
        c_name = client_prof.name if client_prof else ""
        query = query.filter((BotExecution.triggered_by == current_user.email) | (BotExecution.client_name == c_name))
    else:
        if client_name:
            query = query.filter(BotExecution.client_name.ilike(f"%{client_name}%"))

    executions = query.limit(limit).all()
    vagas_list = []
    item_id = 1

    for exc in executions:
        logs = exc.logs or ""
        lines = logs.split("\n")
        data_exec_str = exc.started_at.strftime("%d/%m/%Y às %H:%M") if exc.started_at else "-"
        exec_label = f"Execução #{exc.id} • {data_exec_str} ({exc.client_name or 'Padrão'})"

        if "====" in logs:
            blocos = logs.split("====")
            for bloco in blocos:
                b_lines = [l.strip() for l in bloco.strip().split("\n") if l.strip()]
                if not b_lines:
                    continue
                dados = {}
                for bl in b_lines:
                    clean_l = re.sub(r"^\[\d{2}:\d{2}:\d{2}\]\s*", "", bl)
                    if ":" in clean_l:
                        k, v = clean_l.split(":", 1)
                        dados[k.strip().lower()] = v.strip()

                if "evento" in dados or "convênio" in dados or "convenio" in dados:
                    tipo_v = dados.get("tipo de vaga", dados.get("tipo", "Titular"))
                    data_ev = dados.get("data e hora", dados.get("data/hora", dados.get("data", "-")))
                    vagas_list.append({
                        "id": f"v-{item_id}",
                        "execution_id": exc.id,
                        "execution_label": exec_label,
                        "cliente": exc.client_name or "Padrão",
                        "evento": dados.get("evento", "Evento Confirmado"),
                        "convenio": dados.get("convênio", dados.get("convenio", "HCPM - RAS")),
                        "data_evento": data_ev,
                        "horario": dados.get("data e hora", dados.get("data/hora", "-")),
                        "ponto_encontro": dados.get("ponto de encontro", dados.get("ponto encontro", "-")),
                        "endereco": dados.get("endereço", dados.get("endereco", "-")),
                        "tipo_vaga": tipo_v,
                        "status": "Confirmada no Portal",
                        "modo": exc.mode,
                        "data_agendamento": exc.started_at.strftime("%d/%m/%Y %H:%M") if exc.started_at else "-"
                    })
                    item_id += 1

        current_data = ""
        for line in lines:
            m_data = re.search(r"Data:\s*(\d{2}/\d{2}/\d{4})", line)
            if m_data:
                current_data = m_data.group(1)

            if "Inscricao confirmada" in line or "Inscrição confirmada" in line or "[HOMOLOGACAO] Vaga compativel" in line:
                clean_line = re.sub(r"^\[\d{2}:\d{2}:\d{2}\]\s*", "", line)
                if "identificada:" in clean_line:
                    nome_ev = clean_line.split("identificada:", 1)[1].strip()
                elif "agendadas):" in clean_line:
                    nome_ev = clean_line.split("agendadas):", 1)[1].strip()
                elif "confirmada (" in clean_line and "):" in clean_line:
                    nome_ev = clean_line.split("):", 1)[1].strip()
                else:
                    parts = clean_line.split(":", 1)
                    nome_ev = parts[1].strip() if len(parts) > 1 else clean_line.strip()

                is_homolog = "[HOMOLOGACAO]" in line

                ja_existe = any(
                    v["execution_id"] == exc.id and v["evento"] == nome_ev and (v["data_evento"] == current_data or current_data in v["data_evento"])
                    for v in vagas_list
                )
                if not ja_existe:
                    vagas_list.append({
                        "id": f"v-{item_id}",
                        "execution_id": exc.id,
                        "execution_label": exec_label,
                        "cliente": exc.client_name or "Padrão",
                        "evento": nome_ev,
                        "convenio": "HCPM - RAS",
                        "data_evento": current_data or (exc.started_at.strftime("%d/%m/%Y") if exc.started_at else "-"),
                        "horario": "07 às 19" if ("07" in nome_ev and "19" in nome_ev) or "07:00" in nome_ev else "-",
                        "ponto_encontro": "-",
                        "endereco": "-",
                        "tipo_vaga": "Titular",
                        "status": "Agendada com Sucesso" if not is_homolog else "Identificada (Teste Homologação)",
                        "modo": exc.mode,
                        "data_agendamento": exc.started_at.strftime("%d/%m/%Y %H:%M") if exc.started_at else "-"
                    })
                    item_id += 1

    seen_execs = {}
    for exc in executions:
        if exc.id not in seen_execs:
            d_str = exc.started_at.strftime("%d/%m/%Y às %H:%M") if exc.started_at else "-"
            seen_execs[exc.id] = {
                "id": exc.id,
                "label": f"Execução #{exc.id} • {d_str} ({exc.client_name or 'Padrão'})",
                "client_name": exc.client_name or "Padrão",
                "mode": exc.mode,
                "status": exc.status,
                "started_at": exc.started_at.strftime("%Y-%m-%d %H:%M:%S") if exc.started_at else None
            }

    executions_list = list(seen_execs.values())
    total_titular = len([v for v in vagas_list if "reserva" not in (v.get("tipo_vaga") or "").lower()])
    total_reserva = len(vagas_list) - total_titular

    return {
        "vagas": vagas_list,
        "executions": executions_list,
        "summary": {
            "total": len(vagas_list),
            "titular": total_titular,
            "reserva": total_reserva
        }
    }

@router.delete("/{filename}")
def delete_comprovante(
    filename: str,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "master":
        raise HTTPException(status_code=403, detail="Apenas administradores master podem remover comprovantes.")

    clean_name = os.path.basename(filename)
    file_path = (COMPROVANTES_DIR / clean_name).resolve()

    if COMPROVANTES_DIR.resolve() not in file_path.parents or not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Arquivo nao encontrado.")

    try:
        file_path.unlink()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Nao foi possivel remover o arquivo: {str(e)}")

    return {"message": "Comprovante removido."}

@router.get("/{filename}")
def download_comprovante(
    filename: str,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    token_str = None
    if authorization and authorization.startswith("Bearer "):
        token_str = authorization.split(" ", 1)[1].strip()
    elif token:
        token_str = token.strip()

    if not token_str:
        raise HTTPException(status_code=401, detail="Nao autenticado.")

    verify_token_string(token_str, db)

    file_path = COMPROVANTES_DIR / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Arquivo nao encontrado.")

    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.post("/{filename}/send-whatsapp")
def send_comprovante_whatsapp(
    filename: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from ..services.whatsapp import (
        disparar_notificacoes_whatsapp,
        extrair_lista_numeros,
        parse_vagas_from_text,
        formatar_resumo_vagas_wpp
    )

    clean_name = os.path.basename(filename)
    file_path = (COMPROVANTES_DIR / clean_name).resolve()

    if COMPROVANTES_DIR.resolve() not in file_path.parents or not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Arquivo nao encontrado.")

    from .settings import read_env_file
    env_data = read_env_file()

    api_url = (os.getenv("EVOLUTION_API_URL") or env_data.get("EVOLUTION_API_URL") or "").strip()
    instance = (os.getenv("EVOLUTION_INSTANCE") or env_data.get("EVOLUTION_INSTANCE") or "").strip()
    api_key = (os.getenv("EVOLUTION_API_KEY") or env_data.get("EVOLUTION_API_KEY") or "").strip()
    configured_numbers = (os.getenv("WHATSAPP_NOTIFY_NUMBERS") or env_data.get("WHATSAPP_NOTIFY_NUMBERS") or "").strip()

    if not api_url or not instance or not api_key:
        raise HTTPException(status_code=400, detail="Evolution API nao configurada nas configuracoes do sistema.")

    destinatarios = []
    if configured_numbers:
        destinatarios.extend(extrair_lista_numeros(configured_numbers))

    doc_match = re.search(r"comprovante_(\d+)\.pdf", clean_name)
    doc_digits = doc_match.group(1) if doc_match else ""

    client = None
    if doc_digits:
        all_clients = db.query(ClientProfile).all()
        for c in all_clients:
            if c.document:
                c_clean = re.sub(r"\D", "", c.document)
                if c_clean == doc_digits:
                    client = c
                    break

    if not client and current_user.role != "master":
        client = db.query(ClientProfile).filter(ClientProfile.user_id == current_user.id).first()

    if client and client.phone:
        for n in extrair_lista_numeros(client.phone):
            if n not in destinatarios:
                destinatarios.append(n)

    if not destinatarios:
        raise HTTPException(status_code=400, detail="Nenhum numero de telefone valido encontrado para envio.")

    nome_cli = client.name if client else "Cliente"
    data_hora_str = datetime.now().strftime("%d/%m/%Y às %H:%M")

    vagas_formatadas = ""
    latest_exec = None
    if client:
        latest_exec = db.query(BotExecution).filter(
            (BotExecution.client_name == client.name) | (BotExecution.triggered_by == current_user.email)
        ).order_by(BotExecution.id.desc()).first()
    else:
        latest_exec = db.query(BotExecution).order_by(BotExecution.id.desc()).first()

    if latest_exec and latest_exec.logs:
        vagas = parse_vagas_from_text(latest_exec.logs)
        if vagas:
            vagas_formatadas = formatar_resumo_vagas_wpp(vagas)

    corpo_vagas = f"\n\n{vagas_formatadas}" if vagas_formatadas else ""

    texto = (
        f"📋 *CPROEIS - Comprovante de Agendamento*\n\n"
        f"👤 *Cliente:* {nome_cli}\n"
        f"🕒 *Horário:* {data_hora_str}"
        f"{corpo_vagas}\n\n"
        f"📄 Comprovante oficial em anexo."
    )

    res = disparar_notificacoes_whatsapp(
        numeros_raw=",".join(destinatarios),
        texto=texto,
        caminho_pdf=str(file_path),
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
        "tem_pdf": True
    }
