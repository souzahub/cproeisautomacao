from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: str
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ClientResponse(BaseModel):
    id: int
    remote_id: Optional[int] = None
    name: str
    document_type: str
    document: str
    phone: str
    valor_agendamento: Optional[float] = None
    is_active: bool
    total_agendamentos: Optional[int] = 0
    total_faturado: Optional[float] = 0.0
    total_pago: Optional[float] = 0.0
    total_pendente: Optional[float] = 0.0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    valor_agendamento: Optional[float] = None
    is_active: Optional[bool] = None

class AgendamentoResponse(BaseModel):
    id: int
    remote_id: Optional[str] = None
    execution_id: Optional[int] = None
    client_id: Optional[int] = None
    client_name: str
    client_document: str
    evento: str
    convenio: str
    data_evento: str
    horario: str
    ponto_encontro: str
    endereco: str
    tipo_vaga: str
    status: str
    modo: str
    data_agendamento: str
    valor_cobrado: float
    status_pagamento: str
    pago_em: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AgendamentoUpdatePayment(BaseModel):
    status_pagamento: str
    valor_cobrado: Optional[float] = None

class SyncUserItem(BaseModel):
    email: str
    name: Optional[str] = ""
    hashed_password: str
    role: Optional[str] = "operador"
    is_active: Optional[bool] = True

class SyncClientItem(BaseModel):
    remote_id: Optional[int] = None
    name: str
    document_type: Optional[str] = "CPF"
    document: str
    phone: Optional[str] = ""
    is_active: Optional[bool] = True

class SyncAgendamentoItem(BaseModel):
    remote_id: Optional[str] = None
    execution_id: Optional[int] = None
    client_name: str
    client_document: Optional[str] = ""
    evento: str
    convenio: Optional[str] = "HCPM - RAS"
    data_evento: Optional[str] = ""
    horario: Optional[str] = ""
    ponto_encontro: Optional[str] = ""
    endereco: Optional[str] = ""
    tipo_vaga: Optional[str] = "Titular"
    status: Optional[str] = "Confirmada"
    modo: Optional[str] = "producao"
    data_agendamento: Optional[str] = ""

class SyncPushPayload(BaseModel):
    sync_secret: Optional[str] = ""
    users: Optional[List[SyncUserItem]] = []
    clients: Optional[List[SyncClientItem]] = []
    agendamentos: Optional[List[SyncAgendamentoItem]] = []

class DashboardMetrics(BaseModel):
    total_clientes: int
    total_agendamentos: int
    total_faturado: float
    total_pago: float
    total_pendente: float
    preco_padrao_agendamento: float
    ultimos_agendamentos: List[AgendamentoResponse]

class PanelSettingsUpdate(BaseModel):
    default_slot_price: Optional[float] = 30.0
    sync_secret_key: Optional[str] = None
