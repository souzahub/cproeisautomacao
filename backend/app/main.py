import os
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .config import ADMIN_EMAIL, ADMIN_PASSWORD, BASE_DIR, ENV_PATH
from .database import engine, Base, SessionLocal
from .models import User, ClientProfile
from .security import get_password_hash
from .routes import auth, users, settings, bot, comprovantes, clients

Base.metadata.create_all(bind=engine)

def run_migrations():
    from sqlalchemy import inspect, text
    with engine.connect() as conn:
        inspector = inspect(engine)
        if "client_profiles" in inspector.get_table_names():
            columns = [c["name"] for c in inspector.get_columns("client_profiles")]
            if "tipo_data" not in columns:
                conn.execute(text("ALTER TABLE client_profiles ADD COLUMN tipo_data VARCHAR DEFAULT 'dias_frente'"))
            if "data_inicio" not in columns:
                conn.execute(text("ALTER TABLE client_profiles ADD COLUMN data_inicio VARCHAR"))
            if "data_fim" not in columns:
                conn.execute(text("ALTER TABLE client_profiles ADD COLUMN data_fim VARCHAR"))
            if "meta_vagas" not in columns:
                conn.execute(text("ALTER TABLE client_profiles ADD COLUMN meta_vagas INTEGER DEFAULT 1"))
            conn.commit()

        if "bot_executions" in inspector.get_table_names():
            columns = [c["name"] for c in inspector.get_columns("bot_executions")]
            if "client_name" not in columns:
                conn.execute(text("ALTER TABLE bot_executions ADD COLUMN client_name VARCHAR DEFAULT ''"))
            conn.commit()

run_migrations()

def seed_master_user():
    db = SessionLocal()
    try:
        master_user = db.query(User).filter(User.role == "master").first()
        if not master_user:
            email = ADMIN_EMAIL or "admin@cproeis.local"
            password = ADMIN_PASSWORD or "admin123"
            user = User(
                email=email,
                name="Master Admin",
                hashed_password=get_password_hash(password),
                role="master",
                is_active=True
            )
            db.add(user)
            db.commit()
        else:
            if ADMIN_EMAIL:
                master_user.email = ADMIN_EMAIL
            if ADMIN_PASSWORD:
                master_user.hashed_password = get_password_hash(ADMIN_PASSWORD)
            db.commit()

        client_count = db.query(ClientProfile).count()
        if client_count == 0:
            env_data = {}
            if ENV_PATH.exists():
                with open(ENV_PATH, "r", encoding="utf-8") as f:
                    for line in f:
                        stripped = line.strip()
                        if stripped and not stripped.startswith("#") and "=" in stripped:
                            k, v = stripped.split("=", 1)
                            env_data[k.strip()] = v.strip()

            initial_cpf = env_data.get("CPF") or os.getenv("CPF")
            initial_senha = env_data.get("SENHA") or os.getenv("SENHA")
            initial_conv = env_data.get("CONVENIO") or os.getenv("CONVENIO", "HCPM - RAS")
            initial_eventos = env_data.get("EVENTOS_PREFERIDOS") or os.getenv("EVENTOS_PREFERIDOS", "")

            if initial_cpf and initial_senha:
                init_client = ClientProfile(
                    name="Cliente Padrão",
                    document_type=env_data.get("TIPO_DOCUMENTO", "CPF"),
                    document=initial_cpf,
                    password=initial_senha,
                    convenio=initial_conv,
                    preferred_events=initial_eventos,
                    only_listed_events=False,
                    only_titular=False,
                    days_forward_initial=6,
                    days_forward_max=7,
                    interval_seconds=6,
                    max_attempts=120,
                    is_active=True
                )
                db.add(init_client)
                db.commit()
    finally:
        db.close()

seed_master_user()

app = FastAPI(title="CPROEIS Automation API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(clients.router)
app.include_router(settings.router)
app.include_router(bot.router)
app.include_router(comprovantes.router)

@app.get("/")
def root_status():
    return {
        "status": "online",
        "service": "CPROEIS API Server",
        "version": "1.0.0"
    }

@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "service": "CPROEIS API Server",
        "version": "1.0.0"
    }
