from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, EmailStr

class Token(BaseModel):
    access_token: str
    token_type: str
    user: "UserResponse"

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class UserCreate(BaseModel):
    email: str
    name: Optional[str] = ""
    password: str
    role: Optional[str] = "operador"

class UserUpdate(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: str
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ClientProfileCreate(BaseModel):
    user_id: Optional[int] = None
    system_user: Optional[str] = None
    system_password: Optional[str] = None
    name: str
    document_type: Optional[str] = "CPF"
    document: str
    password: str
    convenio: Optional[str] = "HCPM - RAS"
    preferred_events: Optional[str] = ""
    only_listed_events: Optional[bool] = False
    only_titular: Optional[bool] = False
    tipo_data: Optional[str] = "dias_frente"
    data_inicio: Optional[str] = None
    data_fim: Optional[str] = None
    meta_vagas: Optional[int] = 1
    days_forward_initial: Optional[int] = 6
    days_forward_max: Optional[int] = 7
    interval_seconds: Optional[int] = 6
    max_attempts: Optional[int] = 120
    is_active: Optional[bool] = True

class ClientProfileUpdate(BaseModel):
    user_id: Optional[int] = None
    system_user: Optional[str] = None
    system_password: Optional[str] = None
    name: Optional[str] = None
    document_type: Optional[str] = None
    document: Optional[str] = None
    password: Optional[str] = None
    convenio: Optional[str] = None
    preferred_events: Optional[str] = None
    only_listed_events: Optional[bool] = None
    only_titular: Optional[bool] = None
    tipo_data: Optional[str] = None
    data_inicio: Optional[str] = None
    data_fim: Optional[str] = None
    meta_vagas: Optional[int] = None
    days_forward_initial: Optional[int] = None
    days_forward_max: Optional[int] = None
    interval_seconds: Optional[int] = None
    max_attempts: Optional[int] = None
    is_active: Optional[bool] = None

class ClientProfileResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    system_user: Optional[str] = None
    name: str
    document_type: str
    document: str
    password: str
    convenio: str
    preferred_events: str
    only_listed_events: bool
    only_titular: bool
    tipo_data: str
    data_inicio: Optional[str] = None
    data_fim: Optional[str] = None
    meta_vagas: int
    days_forward_initial: int
    days_forward_max: int
    interval_seconds: int
    max_attempts: int
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class BotStartRequest(BaseModel):
    mode: Optional[str] = "homologacao"
    client_id: Optional[int] = None

class BotStatusResponse(BaseModel):
    status: str
    mode: str
    client_name: Optional[str] = None
    started_at: Optional[str] = None
    pid: Optional[int] = None
    logs_count: int

class BotExecutionResponse(BaseModel):
    id: int
    status: str
    mode: str
    triggered_by: str
    client_name: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    logs: Optional[str] = None

    class Config:
        from_attributes = True

class BotSettingsSchema(BaseModel):
    PROEIS_URL: Optional[str] = "https://www.proeis.rj.gov.br/"
    TIPO_DOCUMENTO: Optional[str] = "CPF"
    CPF: Optional[str] = ""
    SENHA: Optional[str] = ""
    CONVENIO: Optional[str] = "HCPM - RAS"
    EVENTOS_PREFERIDOS: Optional[str] = ""
    APENAS_EVENTOS_LISTADOS: Optional[bool] = False
    APENAS_TITULAR: Optional[bool] = False
    TIPO_DATA: Optional[str] = "dias_frente"
    DATA_INICIO: Optional[str] = ""
    DATA_FIM: Optional[str] = ""
    META_VAGAS: Optional[int] = 1
    DIAS_A_FRENTE_INICIAL: Optional[int] = 6
    DIAS_A_FRENTE_MAXIMO: Optional[int] = 7
    INTERVALO_SEGUNDOS: Optional[int] = 6
    TENTATIVAS_MAXIMAS: Optional[int] = 120
    MODO_VISIVEL: Optional[bool] = False
    MODO_HOMOLOGACAO: Optional[bool] = True
    GEMINI_MODEL: Optional[str] = "gemini-3.7-flash"
    GEMINI_API_KEY: Optional[str] = ""

class ComprovanteFile(BaseModel):
    name: str
    size_bytes: int
    modified_at: str
    download_url: str
