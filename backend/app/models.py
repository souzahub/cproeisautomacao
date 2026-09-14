import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, default="")
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="operador")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    clients = relationship("ClientProfile", back_populates="user")

class BotExecution(Base):
    __tablename__ = "bot_executions"

    id = Column(Integer, primary_key=True, index=True)
    status = Column(String, default="running")
    mode = Column(String, default="homologacao")
    triggered_by = Column(String, default="")
    client_name = Column(String, default="")
    logs = Column(Text, default="")
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)

class BotConfig(Base):
    __tablename__ = "bot_configs"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True)
    value = Column(Text, default="")
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class ClientProfile(Base):
    __tablename__ = "client_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String, nullable=False, index=True)
    document_type = Column(String, default="CPF")
    document = Column(String, nullable=False, index=True)
    password = Column(String, nullable=False)
    convenio = Column(String, default="HCPM - RAS")
    preferred_events = Column(Text, default="")
    only_listed_events = Column(Boolean, default=False)
    only_titular = Column(Boolean, default=False)
    tipo_data = Column(String, default="dias_frente")
    data_inicio = Column(String, nullable=True)
    data_fim = Column(String, nullable=True)
    meta_vagas = Column(Integer, default=1)
    days_forward_initial = Column(Integer, default=6)
    days_forward_max = Column(Integer, default=7)
    interval_seconds = Column(Integer, default=6)
    max_attempts = Column(Integer, default=120)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="clients")
