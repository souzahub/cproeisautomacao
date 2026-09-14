import os
import sys
import subprocess
import threading
from datetime import datetime
from typing import Optional, List, Dict
from ..config import BASE_DIR
from ..database import SessionLocal
from ..models import BotExecution, ClientProfile

class BotRunnerService:
    def __init__(self):
        self.process: Optional[subprocess.Popen] = None
        self.status: str = "idle"
        self.mode: str = "homologacao"
        self.client_name: Optional[str] = None
        self.started_at: Optional[str] = None
        self.logs: List[Dict[str, str]] = []
        self.current_execution_id: Optional[int] = None
        self.lock = threading.Lock()
        self.reader_thread: Optional[threading.Thread] = None

    def get_status(self) -> Dict:
        with self.lock:
            if self.process and self.process.poll() is not None:
                if self.status == "running":
                    self.status = "completed" if self.process.returncode == 0 else "error"
            return {
                "status": self.status,
                "mode": self.mode,
                "client_name": self.client_name,
                "started_at": self.started_at,
                "pid": self.process.pid if self.process and self.process.poll() is None else None,
                "logs_count": len(self.logs)
            }

    def clear_logs(self):
        with self.lock:
            self.logs = []

    def get_logs(self, start_index: int = 0) -> List[Dict[str, str]]:
        with self.lock:
            if start_index >= len(self.logs):
                return []
            return self.logs[start_index:]

    def _read_output(self, proc: subprocess.Popen, execution_id: Optional[int]):
        for line in iter(proc.stdout.readline, ""):
            if not line and proc.poll() is not None:
                break
            cleaned = line.rstrip()
            if cleaned:
                now_str = datetime.now().strftime("%H:%M:%S")
                with self.lock:
                    self.logs.append({"timestamp": now_str, "message": cleaned})
                    if len(self.logs) > 3000:
                        self.logs.pop(0)

        proc.stdout.close()
        proc.wait()

        with self.lock:
            if self.status == "running":
                self.status = "completed" if proc.returncode == 0 else "error"
            finished_status = self.status

        if execution_id:
            db = SessionLocal()
            try:
                exec_record = db.query(BotExecution).filter(BotExecution.id == execution_id).first()
                if exec_record:
                    exec_record.status = finished_status
                    exec_record.finished_at = datetime.utcnow()
                    with self.lock:
                        exec_record.logs = "\n".join([f"[{l['timestamp']}] {l['message']}" for l in self.logs])
                    db.commit()
            except Exception:
                db.rollback()
            finally:
                db.close()

    def start_bot(self, mode: str, triggered_by: str, client_id: Optional[int] = None) -> Dict:
        with self.lock:
            if self.process and self.process.poll() is None:
                return {"success": False, "message": "Automacao ja em execucao."}

            self.logs = []
            self.mode = mode
            self.status = "running"
            self.started_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        db = SessionLocal()
        execution_id = None
        client_name = "Padrao do sistema"
        client_data = None

        if client_id:
            try:
                client = db.query(ClientProfile).filter(ClientProfile.id == client_id).first()
                if client:
                    client_name = client.name
                    client_data = {
                        "document_type": client.document_type or "CPF",
                        "document": client.document or "",
                        "password": client.password or "",
                        "convenio": client.convenio or "",
                        "preferred_events": client.preferred_events or "",
                        "only_listed_events": bool(client.only_listed_events),
                        "only_titular": bool(client.only_titular),
                        "tipo_data": client.tipo_data or "dias_frente",
                        "data_inicio": client.data_inicio or "",
                        "data_fim": client.data_fim or "",
                        "meta_vagas": client.meta_vagas if client.meta_vagas is not None else 1,
                        "days_forward_initial": client.days_forward_initial or 6,
                        "days_forward_max": client.days_forward_max or 7,
                        "interval_seconds": client.interval_seconds or 6,
                        "max_attempts": client.max_attempts or 120
                    }
            except Exception:
                pass

        with self.lock:
            self.client_name = client_name

        try:
            exec_record = BotExecution(
                status="running",
                mode=mode,
                triggered_by=triggered_by,
                client_name=client_name,
                started_at=datetime.utcnow()
            )
            db.add(exec_record)
            db.commit()
            db.refresh(exec_record)
            execution_id = exec_record.id
            self.current_execution_id = execution_id
        except Exception:
            db.rollback()
        finally:
            db.close()

        env_vars = os.environ.copy()
        env_vars["PYTHONUNBUFFERED"] = "1"
        env_vars["MODO_HOMOLOGACAO"] = "true" if mode == "homologacao" else "false"

        if client_data:
            env_vars["TIPO_DOCUMENTO"] = client_data["document_type"]
            env_vars["CPF"] = client_data["document"]
            env_vars["SENHA"] = client_data["password"]
            env_vars["CONVENIO"] = client_data["convenio"]
            env_vars["EVENTOS_PREFERIDOS"] = client_data["preferred_events"]
            env_vars["APENAS_EVENTOS_LISTADOS"] = "true" if client_data["only_listed_events"] else "false"
            env_vars["APENAS_TITULAR"] = "true" if client_data["only_titular"] else "false"
            env_vars["TIPO_DATA"] = client_data["tipo_data"]
            env_vars["DATA_INICIO"] = client_data["data_inicio"]
            env_vars["DATA_FIM"] = client_data["data_fim"]
            env_vars["META_VAGAS"] = str(client_data["meta_vagas"])
            env_vars["DIAS_A_FRENTE_INICIAL"] = str(client_data["days_forward_initial"])
            env_vars["DIAS_A_FRENTE_MAXIMO"] = str(client_data["days_forward_max"])
            env_vars["INTERVALO_SEGUNDOS"] = str(client_data["interval_seconds"])
            env_vars["TENTATIVAS_MAXIMAS"] = str(client_data["max_attempts"])


        script_path = str(BASE_DIR / "bot.py")
        proc = subprocess.Popen(
            [sys.executable, script_path],
            cwd=str(BASE_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=env_vars
        )

        with self.lock:
            self.process = proc

        self.reader_thread = threading.Thread(target=self._read_output, args=(proc, execution_id), daemon=True)
        self.reader_thread.start()

        return {"success": True, "execution_id": execution_id, "mode": mode, "client_name": client_name}

    def start_consultation(self, triggered_by: str, client_id: Optional[int] = None) -> Dict:
        with self.lock:
            if self.process and self.process.poll() is None:
                return {"success": False, "message": "Automacao ou consulta ja em execucao."}

            self.logs = []
            self.mode = "consulta"
            self.status = "running"
            self.started_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        db = SessionLocal()
        execution_id = None
        client_name = "Padrao do sistema"
        client_data = None

        if client_id:
            try:
                client = db.query(ClientProfile).filter(ClientProfile.id == client_id).first()
                if client:
                    client_name = client.name
                    client_data = {
                        "document_type": client.document_type or "CPF",
                        "document": client.document or "",
                        "password": client.password or "",
                        "convenio": client.convenio or ""
                    }
            except Exception:
                pass

        with self.lock:
            self.client_name = client_name

        try:
            exec_record = BotExecution(
                status="running",
                mode="consulta",
                triggered_by=triggered_by,
                client_name=client_name,
                started_at=datetime.utcnow()
            )
            db.add(exec_record)
            db.commit()
            db.refresh(exec_record)
            execution_id = exec_record.id
            self.current_execution_id = execution_id
        except Exception:
            db.rollback()
        finally:
            db.close()

        env_vars = os.environ.copy()
        env_vars["PYTHONUNBUFFERED"] = "1"

        if client_data:
            env_vars["TIPO_DOCUMENTO"] = client_data["document_type"]
            env_vars["CPF"] = client_data["document"]
            env_vars["SENHA"] = client_data["password"]
            env_vars["CONVENIO"] = client_data["convenio"]

        script_path = str(BASE_DIR / "consultar_vagas.py")
        proc = subprocess.Popen(
            [sys.executable, script_path],
            cwd=str(BASE_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=env_vars
        )

        with self.lock:
            self.process = proc

        self.reader_thread = threading.Thread(target=self._read_output, args=(proc, execution_id), daemon=True)
        self.reader_thread.start()

        return {"success": True, "execution_id": execution_id, "mode": "consulta", "client_name": client_name}

    def stop_bot(self) -> Dict:
        with self.lock:
            if not self.process or self.process.poll() is not None:
                self.status = "stopped"
                return {"success": True, "message": "Automacao nao estava em execucao."}

            try:
                self.process.terminate()
                self.status = "stopped"
            except Exception as e:
                return {"success": False, "message": str(e)}

        if self.current_execution_id:
            db = SessionLocal()
            try:
                exec_record = db.query(BotExecution).filter(BotExecution.id == self.current_execution_id).first()
                if exec_record:
                    exec_record.status = "stopped"
                    exec_record.finished_at = datetime.utcnow()
                    with self.lock:
                        exec_record.logs = "\n".join([f"[{l['timestamp']}] {l['message']}" for l in self.logs])
                    db.commit()
            except Exception:
                db.rollback()
            finally:
                db.close()

        return {"success": True, "message": "Parada solicitada."}

bot_runner = BotRunnerService()

