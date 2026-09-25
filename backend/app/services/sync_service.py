import os
import re
import threading
from datetime import datetime
import requests
from ..database import SessionLocal
from ..models import User, ClientProfile, BotExecution

def parse_agendamentos_from_executions(executions):
    vagas_list = []
    item_id = 1

    for exc in executions:
        logs = exc.logs or ""
        lines = logs.split("\n")

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
                        "remote_id": f"exec-{exc.id}-b-{item_id}",
                        "execution_id": exc.id,
                        "client_name": exc.client_name or "Padrao",
                        "evento": dados.get("evento", "Evento Confirmado"),
                        "convenio": dados.get("convênio", dados.get("convenio", "HCPM - RAS")),
                        "data_evento": data_ev,
                        "horario": dados.get("data e hora", dados.get("data/hora", "")),
                        "ponto_encontro": dados.get("ponto de encontro", dados.get("ponto encontro", "")),
                        "endereco": dados.get("endereço", dados.get("endereco", "")),
                        "tipo_vaga": tipo_v,
                        "status": "Confirmada",
                        "modo": exc.mode or "producao",
                        "data_agendamento": exc.started_at.strftime("%d/%m/%Y %H:%M") if exc.started_at else ""
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
                        "remote_id": f"exec-{exc.id}-l-{item_id}",
                        "execution_id": exc.id,
                        "client_name": exc.client_name or "Padrao",
                        "evento": nome_ev,
                        "convenio": "HCPM - RAS",
                        "data_evento": current_data or (exc.started_at.strftime("%d/%m/%Y") if exc.started_at else ""),
                        "horario": "07 às 19" if ("07" in nome_ev and "19" in nome_ev) or "07:00" in nome_ev else "",
                        "ponto_encontro": "",
                        "endereco": "",
                        "tipo_vaga": "Titular",
                        "status": "Confirmada" if not is_homolog else "Homologacao",
                        "modo": exc.mode or "producao",
                        "data_agendamento": exc.started_at.strftime("%d/%m/%Y %H:%M") if exc.started_at else ""
                    })
                    item_id += 1

    return vagas_list

def perform_sync():
    from ..routes.settings import read_env_file
    env_data = read_env_file()

    painel_url = (os.getenv("PAINEL_URL") or env_data.get("PAINEL_URL") or "").strip().rstrip("/")
    sync_secret = (os.getenv("SYNC_SECRET_KEY") or env_data.get("SYNC_SECRET_KEY") or "proeis_sync_secret_key_padrao_2026").strip()

    if not painel_url:
        return {"status": "skipped", "reason": "PAINEL_URL nao configurada"}

    db = SessionLocal()
    try:
        users = db.query(User).all()
        clients = db.query(ClientProfile).all()
        executions = db.query(BotExecution).order_by(BotExecution.id.desc()).limit(200).all()

        users_payload = [
            {
                "email": u.email,
                "name": u.name or "",
                "hashed_password": u.hashed_password,
                "role": u.role or "operador",
                "is_active": u.is_active
            }
            for u in users if u.email
        ]

        clients_payload = [
            {
                "remote_id": c.id,
                "name": c.name,
                "document_type": c.document_type or "CPF",
                "document": c.document,
                "phone": getattr(c, "phone", "") or "",
                "is_active": c.is_active
            }
            for c in clients if c.name
        ]

        agendamentos_payload = parse_agendamentos_from_executions(executions)

        endpoint = f"{painel_url}/api/sync/push"
        payload = {
            "sync_secret": sync_secret,
            "users": users_payload,
            "clients": clients_payload,
            "agendamentos": agendamentos_payload
        }

        resp = requests.post(
            endpoint,
            json=payload,
            headers={"X-Sync-Secret": sync_secret},
            timeout=10
        )

        if resp.status_code == 200:
            return {"status": "success", "response": resp.json()}
        else:
            return {"status": "error", "code": resp.status_code, "text": resp.text}
    except Exception as e:
        return {"status": "error", "error": str(e)}
    finally:
        db.close()

def trigger_background_sync():
    t = threading.Thread(target=perform_sync, daemon=True)
    t.start()
