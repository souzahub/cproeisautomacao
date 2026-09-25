import os
import sys
import re
import time
import json
import socket
import sqlite3
import subprocess
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
import requests
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
LOGS_DIR = BASE_DIR / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)
ENV_PATH = BASE_DIR / ".env"

if sys.stdout is None or not hasattr(sys.stdout, "write"):
    sys.stdout = open(LOGS_DIR / "agendador_runtime.log", "a", encoding="utf-8", buffering=1)
if sys.stderr is None or not hasattr(sys.stderr, "write"):
    sys.stderr = open(LOGS_DIR / "agendador_runtime.log", "a", encoding="utf-8", buffering=1)

if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

load_dotenv(dotenv_path=ENV_PATH)

TZ_BR = ZoneInfo("America/Sao_Paulo")
SERVER_URL = (os.getenv("VITE_API_URL") or os.getenv("API_URL") or os.getenv("SERVER_URL") or "http://127.0.0.1:8000").rstrip("/")
if "cprsautomacao.devsouza.online" in SERVER_URL:
    SERVER_URL = "http://127.0.0.1:8000"
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "luansouza.ti29@gmail.com").strip()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Souz@199133").strip()
CHECK_INTERVAL_SECONDS = 20
LOCK_PORT = 58921

def garantir_instancia_unica():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.bind(("127.0.0.1", LOCK_PORT))
        s.listen(1)
        return s
    except Exception:
        registrar_log("uma instancia do agendador ja esta ativa no sistema")
        sys.exit(0)

def registrar_log(mensagem: str):
    agora_str = datetime.now(TZ_BR).strftime("%Y-%m-%d %H:%M:%S")
    linha = f"[{agora_str}] {mensagem}"
    try:
        print(linha, flush=True)
    except Exception:
        pass
    nome_arquivo = f"agendamento_{datetime.now(TZ_BR).strftime('%Y-%m-%d')}.log"
    caminho = LOGS_DIR / nome_arquivo
    try:
        with open(caminho, "a", encoding="utf-8") as f:
            f.write(linha + "\n")
    except Exception:
        pass

def autenticar_servidor():
    urls_tentativas = [SERVER_URL, "http://127.0.0.1:8000", "http://localhost:8000"]
    urls_unicas = []
    for u in urls_tentativas:
        if u not in urls_unicas and "cprsautomacao.devsouza.online" not in u:
            urls_unicas.append(u)

    usuarios_tentativas = [
        ADMIN_EMAIL,
        "luansouza",
        "luan",
        "luansouza.ti29@gmail.com",
        "luansouza88@gmail.com"
    ]
    senhas_tentativas = [
        ADMIN_PASSWORD,
        "Souz@199133",
        "admin123"
    ]

    for base_url in urls_unicas:
        login_url = f"{base_url}/api/auth/login"
        for u in usuarios_tentativas:
            if not u:
                continue
            for s in senhas_tentativas:
                if not s:
                    continue
                try:
                    resp = requests.post(login_url, json={"email": u, "password": s}, timeout=8)
                    if resp.status_code == 200:
                        token = resp.json().get("access_token")
                        if token:
                            return base_url, token
                except Exception:
                    pass
    return None, None

def buscar_cliente_servidor(base_url: str, token: str, client_id: int):
    url = f"{base_url}/api/clients/{client_id}"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        registrar_log(f"falha ao buscar dados do cliente {client_id}: {e}")
    return None

def reportar_resultado_servidor(base_url: str, token: str, schedule_id: int, resultado: str):
    url = f"{base_url}/api/schedules/{schedule_id}/resultado"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        requests.post(url, headers=headers, json={"resultado": resultado[:250]}, timeout=10)
    except Exception:
        pass

def montar_ambiente_execucao(cliente: dict, modo: str = "producao") -> dict:
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    env["MODO_HOMOLOGACAO"] = "true" if modo == "homologacao" else "false"
    env["MODO_VISIVEL"] = "true" if os.getenv("MODO_VISIVEL", "true").lower() in ("true", "1") else "false"

    if cliente:
        if cliente.get("document_type"):
            env["TIPO_DOCUMENTO"] = str(cliente["document_type"])
        if cliente.get("document"):
            env["CPF"] = str(cliente["document"])
        if cliente.get("password"):
            env["SENHA"] = str(cliente["password"])
        if cliente.get("convenio"):
            env["CONVENIO"] = str(cliente["convenio"])
        if cliente.get("preferred_events"):
            env["EVENTOS_PREFERIDOS"] = str(cliente["preferred_events"])
        if cliente.get("preferred_hours"):
            env["HORARIOS_PREFERIDOS"] = str(cliente["preferred_hours"])
        if cliente.get("phone"):
            env["CLIENTE_TELEFONE"] = str(cliente["phone"])
        if cliente.get("only_listed_events") is not None:
            env["APENAS_EVENTOS_LISTADOS"] = "true" if cliente["only_listed_events"] else "false"
        if cliente.get("only_titular") is not None:
            env["APENAS_TITULAR"] = "true" if cliente["only_titular"] else "false"
        if cliente.get("tipo_data"):
            env["TIPO_DATA"] = str(cliente["tipo_data"])
        if cliente.get("data_inicio"):
            env["DATA_INICIO"] = str(cliente["data_inicio"])
        if cliente.get("data_fim"):
            env["DATA_FIM"] = str(cliente["data_fim"])
        if cliente.get("meta_vagas") is not None:
            env["META_VAGAS"] = str(cliente["meta_vagas"])
        if cliente.get("days_forward_initial"):
            env["DIAS_A_FRENTE_INICIAL"] = str(cliente["days_forward_initial"])
        if cliente.get("days_forward_max"):
            env["DIAS_A_FRENTE_MAXIMO"] = str(cliente["days_forward_max"])
        if cliente.get("interval_seconds"):
            env["INTERVALO_SEGUNDOS"] = str(cliente["interval_seconds"])
        if cliente.get("max_attempts"):
            env["TENTATIVAS_MAXIMAS"] = str(cliente["max_attempts"])

    return env

def extrair_resumo_bot(linhas: list, codigo: int) -> str:
    hora_str = datetime.now(TZ_BR).strftime("%H:%M")
    if codigo != 0:
        for l in reversed(linhas):
            low = l.lower()
            if any(term in low for term in ["erro", "falha", "timeout", "exception", "timed out"]):
                return f"{l[:90]} ({hora_str})"
        return f"erro na execucao codigo {codigo} ({hora_str})"

    vagas = None
    meta = None
    motivo = ""

    for l in linhas:
        low = l.lower()
        m1 = re.search(r"Busca finalizada:\s*(\d+)\s+de\s+(\d+)\s+vaga\(s\)", l, re.IGNORECASE)
        if m1:
            vagas = int(m1.group(1))
            meta = int(m1.group(2))
        m2 = re.search(r"Meta de\s+(\d+)\s+vaga\(s\)\s+atingida", l, re.IGNORECASE)
        if m2:
            vagas = int(m2.group(1))
            meta = int(m2.group(1))
        if "ainda nao disponivel no menu do portal" in low:
            motivo = "datas ainda indisponiveis no portal"
        elif "erro ao confirmar imagem" in low:
            motivo = "captcha incorreto em tentativas"
        elif "falha ao efetuar login" in low:
            motivo = "falha no login"

    if vagas is not None and meta is not None:
        if vagas > 0:
            return f"{vagas} de {meta} vaga(s) agendada(s) ({hora_str})"
        else:
            detalhe = f" ({motivo})" if motivo else ""
            return f"0 de {meta} vaga(s) agendada(s){detalhe} ({hora_str})"

    if motivo:
        return f"0 vagas agendadas ({motivo}) ({hora_str})"

    return f"execucao concluida ({hora_str})"

def registrar_execucao_banco(modo: str, cliente_nome: str, nome_tarefa: str, inicio: datetime, fim: datetime, sucesso: bool, linhas: list):
    caminho_db = BASE_DIR / "data" / "app.db"
    if not caminho_db.exists():
        return
    try:
        conn = sqlite3.connect(str(caminho_db))
        cursor = conn.cursor()
        status_exec = "completed" if sucesso else "error"
        triggered = f"agendamento ({nome_tarefa})"
        logs_texto = "\n".join(linhas)
        cursor.execute(
            """
            INSERT INTO bot_executions (status, mode, triggered_by, client_name, logs, started_at, finished_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                status_exec,
                modo,
                triggered,
                cliente_nome,
                logs_texto,
                inicio.strftime("%Y-%m-%d %H:%M:%S"),
                fim.strftime("%Y-%m-%d %H:%M:%S")
            )
        )
        conn.commit()
        conn.close()
    except Exception as e:
        registrar_log(f"falha ao registrar historico no banco: {e}")

def executar_bot_local(modo: str, cliente_data: dict, nome_tarefa: str) -> tuple[bool, str]:
    script_bot = BASE_DIR / "bot.py"
    if not script_bot.exists():
        return False, "arquivo bot.py nao encontrado"

    nome_cliente = (cliente_data or {}).get("name") or "Padrao"
    registrar_log(f"iniciando execucao local: '{nome_tarefa}' | cliente: {nome_cliente} | modo: {modo}")

    env = montar_ambiente_execucao(cliente_data or {}, modo=modo)
    cmd = [sys.executable, str(script_bot)]
    linhas_saida = []
    inicio_utc = datetime.utcnow()

    try:
        proc = subprocess.Popen(
            cmd,
            cwd=str(BASE_DIR),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace"
        )

        for line in iter(proc.stdout.readline, ""):
            if not line and proc.poll() is not None:
                break
            limpa = line.rstrip()
            if limpa:
                linhas_saida.append(limpa)
                registrar_log(f"  [bot] {limpa}")

        proc.stdout.close()
        codigo_retorno = proc.wait()
        fim_utc = datetime.utcnow()

        registrar_execucao_banco(modo, nome_cliente, nome_tarefa, inicio_utc, fim_utc, codigo_retorno == 0, linhas_saida)
        resultado = extrair_resumo_bot(linhas_saida, codigo_retorno)

        if codigo_retorno == 0:
            registrar_log(f"sucesso na execucao de '{nome_tarefa}': {resultado}")
            return True, resultado
        else:
            registrar_log(f"execucao finalizada com codigo de erro {codigo_retorno}: {resultado}")
            return False, resultado
    except Exception as e:
        resultado = f"falha ao iniciar processo: {str(e)}"
        registrar_log(resultado)
        return False, resultado

def verificar_agendamentos_banco_local() -> list:
    caminho_db = BASE_DIR / "data" / "app.db"
    if not caminho_db.exists():
        return []

    agora = datetime.now(TZ_BR)
    dia_semana_atual = agora.weekday()
    vencidos = []

    try:
        conn = sqlite3.connect(str(caminho_db))
        cursor = conn.cursor()

        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='schedules'")
        if not cursor.fetchone():
            conn.close()
            return []

        cursor.execute("SELECT id, name, hora, dias_semana, mode, client_id, is_active, last_run_at FROM schedules WHERE is_active=1")
        linhas = cursor.fetchall()

        for s_id, s_name, s_hora, s_dias, s_mode, s_client_id, s_active, s_last_run in linhas:
            try:
                dias = [int(d.strip()) for d in (s_dias or "").split(",") if d.strip()]
                if dia_semana_atual not in dias:
                    continue

                h, m = (s_hora or "08:00").split(":")[:2]
                marcado = agora.replace(hour=int(h), minute=int(m), second=0, microsecond=0)
            except Exception:
                continue

            atraso_min = int((agora - marcado).total_seconds() // 60)
            if atraso_min < 0 or atraso_min > 120:
                continue

            if s_last_run:
                try:
                    s_last_clean = s_last_run.replace("Z", "").split(".")[0]
                    ultimo = datetime.fromisoformat(s_last_clean).replace(tzinfo=ZoneInfo("UTC")).astimezone(TZ_BR)
                    if ultimo >= marcado:
                        continue
                except Exception:
                    pass

            cursor.execute("UPDATE schedules SET last_run_at=?, last_result=? WHERE id=?", (datetime.utcnow().isoformat(), "reivindicado local", s_id))
            conn.commit()

            cliente_data = None
            if s_client_id:
                cursor.execute("SELECT id, name, document_type, document, password, convenio, preferred_events, preferred_hours, only_listed_events, only_titular, tipo_data, data_inicio, data_fim, meta_vagas, days_forward_initial, days_forward_max, interval_seconds, max_attempts, phone FROM client_profiles WHERE id=?", (s_client_id,))
                c_row = cursor.fetchone()
                if c_row:
                    cliente_data = {
                        "id": c_row[0],
                        "name": c_row[1],
                        "document_type": c_row[2],
                        "document": c_row[3],
                        "password": c_row[4],
                        "convenio": c_row[5],
                        "preferred_events": c_row[6],
                        "preferred_hours": c_row[7],
                        "only_listed_events": bool(c_row[8]),
                        "only_titular": bool(c_row[9]),
                        "tipo_data": c_row[10],
                        "data_inicio": c_row[11],
                        "data_fim": c_row[12],
                        "meta_vagas": c_row[13],
                        "days_forward_initial": c_row[14],
                        "days_forward_max": c_row[15],
                        "interval_seconds": c_row[16],
                        "max_attempts": c_row[17],
                        "phone": c_row[18] if len(c_row) > 18 else "",
                    }

            vencidos.append({
                "id": s_id,
                "name": s_name or f"agendamento {s_id}",
                "mode": s_mode or "producao",
                "client_id": s_client_id,
                "cliente_data": cliente_data,
                "origem": "local"
            })

        conn.close()
    except Exception as e:
        registrar_log(f"falha ao verificar banco local: {e}")

    return vencidos

def loop_agendador():
    lock_socket = garantir_instancia_unica()
    registrar_log("iniciando servico local de agendamento cproeis")
    registrar_log(f"servidor de consulta: {SERVER_URL}")

    token_atual = None
    base_url_atual = None
    ultimo_sucesso_conexao = 0

    while True:
        try:
            if not token_atual or (time.time() - ultimo_sucesso_conexao > 1800):
                base_url, token = autenticar_servidor()
                if token:
                    base_url_atual = base_url
                    token_atual = token
                    ultimo_sucesso_conexao = time.time()
                    registrar_log(f"conectado ao servidor {base_url_atual}")

            processou_algum = False

            if token_atual and base_url_atual:
                try:
                    url_due = f"{base_url_atual}/api/schedules/due"
                    headers = {"Authorization": f"Bearer {token_atual}"}
                    resp = requests.get(url_due, headers=headers, timeout=10)

                    if resp.status_code == 200:
                        vencidos = resp.json()
                        for item in vencidos:
                            processou_algum = True
                            s_id = item.get("id")
                            s_nome = item.get("name") or f"agendamento {s_id}"
                            s_mode = item.get("mode") or "producao"
                            c_id = item.get("client_id")

                            cliente_data = None
                            if c_id:
                                cliente_data = buscar_cliente_servidor(base_url_atual, token_atual, c_id)

                            sucesso, res_msg = executar_bot_local(s_mode, cliente_data, s_nome)
                            reportar_resultado_servidor(base_url_atual, token_atual, s_id, res_msg)
                            break
                    elif resp.status_code == 401:
                        token_atual = None
                except Exception as e:
                    pass

            if not processou_algum:
                vencidos_locais = verificar_agendamentos_banco_local()
                for item in vencidos_locais:
                    s_id = item["id"]
                    s_nome = item["name"]
                    s_mode = item["mode"]
                    c_data = item.get("cliente_data")
                    sucesso, res_msg = executar_bot_local(s_mode, c_data, s_nome)
                    try:
                        conn = sqlite3.connect(str(BASE_DIR / "data" / "app.db"))
                        c = conn.cursor()
                        c.execute("UPDATE schedules SET last_result=? WHERE id=?", (res_msg[:250], s_id))
                        conn.commit()
                        conn.close()
                    except Exception:
                        pass
                    break

        except BaseException as e:
            registrar_log(f"interrupcao ou erro critico no loop: {type(e).__name__} - {e}")
            break

        time.sleep(CHECK_INTERVAL_SECONDS)

    registrar_log("servico de agendamento encerrado")

if __name__ == "__main__":
    try:
        loop_agendador()
    except Exception as ex:
        try:
            with open(BASE_DIR / "logs" / "crash.log", "a", encoding="utf-8") as f:
                f.write(f"Crash: {ex}\n")
                import traceback
                traceback.print_exc(file=f)
        except Exception:
            pass
