import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, Text, ForeignKey
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

class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    remote_id = Column(Integer, index=True, nullable=True)
    name = Column(String, nullable=False, index=True)
    document_type = Column(String, default="CPF")
    document = Column(String, nullable=False, index=True)
    phone = Column(String, default="")
    valor_agendamento = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    agendamentos = relationship("Agendamento", back_populates="client")

class Agendamento(Base):
    __tablename__ = "agendamentos"

    id = Column(Integer, primary_key=True, index=True)
    remote_id = Column(String, index=True, nullable=True)
    execution_id = Column(Integer, nullable=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True, index=True)
    client_name = Column(String, default="", index=True)
    client_document = Column(String, default="", index=True)
    evento = Column(String, default="")
    convenio = Column(String, default="HCPM - RAS")
    data_evento = Column(String, default="")
    horario = Column(String, default="")
    ponto_encontro = Column(String, default="")
    endereco = Column(String, default="")
    tipo_vaga = Column(String, default="Titular")
    status = Column(String, default="Confirmada")
    modo = Column(String, default="producao")
    data_agendamento = Column(String, default="")
    valor_cobrado = Column(Float, default=0.0)
    status_pagamento = Column(String, default="pendente")
    pago_em = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    client = relationship("Client", back_populates="agendamentos")

class PanelSetting(Base):
    __tablename__ = "panel_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True)
    value = Column(Text, default="")
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
