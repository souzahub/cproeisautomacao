import os
from datetime import datetime
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from ..database import SessionLocal
from ..models import Schedule
from .bot_runner import bot_runner


def _job_id(schedule_id: int) -> str:
    return f"schedule_{schedule_id}"


class SchedulerService:
    def __init__(self):
        self.scheduler: Optional[BackgroundScheduler] = None

    def start(self):
        if os.getenv("SCHEDULER_ENABLED", "false").lower() not in ("true", "1", "yes"):
            print("[scheduler] agendador interno inativo no servidor (execucao delegada para desktop local)")
            return

        if self.scheduler:
            return

        self.scheduler = BackgroundScheduler(timezone="America/Sao_Paulo")
        self.scheduler.start()
        self.reload_jobs()
        print("[scheduler] iniciado")

    def reload_jobs(self):
        if not self.scheduler:
            return
        db = SessionLocal()
        try:
            total = 0
            for schedule in db.query(Schedule).filter(Schedule.is_active == True).all():
                if self.sync_job(schedule):
                    total += 1
            print(f"[scheduler] {total} agendamento(s) carregado(s)")
        except Exception as e:
            print(f"[scheduler] falha ao carregar agendamentos: {e}")
        finally:
            db.close()

    def sync_job(self, schedule: Schedule) -> bool:
        """Cria/atualiza o job no APScheduler a partir do registro do banco."""
        if not self.scheduler:
            return False

        self.remove_job(schedule.id)

        if not schedule.is_active:
            return False

        try:
            hora, minuto = (schedule.hora or "08:00").split(":")[:2]
            dias = (schedule.dias_semana or "").strip()
            if not dias:
                return False

            self.scheduler.add_job(
                _executar_agendamento,
                trigger=CronTrigger(
                    day_of_week=dias,
                    hour=int(hora),
                    minute=int(minuto),
                ),
                args=[schedule.id],
                id=_job_id(schedule.id),
                replace_existing=True,
            )
            return True
        except Exception as e:
            print(f"[scheduler] agendamento {schedule.id} invalido: {e}")
            return False

    def remove_job(self, schedule_id: int):
        if not self.scheduler:
            return
        try:
            self.scheduler.remove_job(_job_id(schedule_id))
        except Exception:
            pass


def _registrar_resultado(schedule_id: int, resultado: str):
    db = SessionLocal()
    try:
        schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
        if schedule:
            schedule.last_run_at = datetime.utcnow()
            schedule.last_result = resultado[:250]
            db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def _executar_agendamento(schedule_id: int):
    """Disparado pelo APScheduler no horario marcado."""
    db = SessionLocal()
    try:
        schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
        if not schedule or not schedule.is_active:
            return
        nome = schedule.name or f"agendamento {schedule.id}"
        mode = schedule.mode if schedule.mode in ["homologacao", "producao"] else "homologacao"
        client_id = schedule.client_id
    except Exception:
        return
    finally:
        db.close()

    status_atual = bot_runner.get_status().get("status")
    if status_atual == "running":
        _registrar_resultado(schedule_id, "pulado: bot ja em execucao")
        print(f"[scheduler] '{nome}' pulado (bot em execucao)")
        return

    try:
        res = bot_runner.start_bot(
            mode=mode,
            triggered_by=f"agendamento: {nome}",
            client_id=client_id,
        )
        if res.get("success"):
            _registrar_resultado(schedule_id, f"iniciado em modo {mode}")
            print(f"[scheduler] '{nome}' iniciado em modo {mode}")
        else:
            _registrar_resultado(schedule_id, res.get("message", "falha ao iniciar"))
    except Exception as e:
        _registrar_resultado(schedule_id, f"erro: {e}")
        print(f"[scheduler] erro ao executar '{nome}': {e}")


scheduler_service = SchedulerService()
