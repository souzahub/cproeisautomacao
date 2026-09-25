from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Client, Agendamento, PanelSetting
from ..schemas import DashboardMetrics, AgendamentoResponse
from ..security import get_current_user

router = APIRouter(prefix="/api/billing", tags=["billing"])

def get_default_slot_price(db: Session) -> float:
    setting = db.query(PanelSetting).filter(PanelSetting.key == "default_slot_price").first()
    if setting and setting.value:
        try:
            return float(setting.value)
        except ValueError:
            return 30.0
    return 30.0

@router.get("/metrics", response_model=DashboardMetrics)
def get_dashboard_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    total_cli = db.query(Client).count()
    agendamentos = db.query(Agendamento).order_by(Agendamento.id.desc()).all()

    total_ag = len(agendamentos)
    total_fat = sum(a.valor_cobrado for a in agendamentos)
    total_pago = sum(a.valor_cobrado for a in agendamentos if a.status_pagamento == "pago")
    total_pend = sum(a.valor_cobrado for a in agendamentos if a.status_pagamento != "pago")
    preco_padrao = get_default_slot_price(db)

    ultimos = agendamentos[:10]

    return {
        "total_clientes": total_cli,
        "total_agendamentos": total_ag,
        "total_faturado": total_fat,
        "total_pago": total_pago,
        "total_pendente": total_pend,
        "preco_padrao_agendamento": preco_padrao,
        "ultimos_agendamentos": ultimos
    }
