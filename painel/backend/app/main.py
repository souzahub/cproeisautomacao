import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from .config import ADMIN_EMAIL, ADMIN_PASSWORD, BASE_DIR
from .database import engine, Base, SessionLocal
from .models import User
from .security import get_password_hash
from .routes import auth, sync, clients, agendamentos, billing, settings

Base.metadata.create_all(bind=engine)

def seed_master_user():
    db = SessionLocal()
    try:
        local_db_path = BASE_DIR.parent / "data" / "app.db"
        if local_db_path.exists():
            from sqlalchemy import create_engine as ce, text
            try:
                local_eng = ce(f"sqlite:///{local_db_path}")
                with local_eng.connect() as conn:
                    result = conn.execute(text("SELECT id, email, name, hashed_password, role, is_active FROM users"))
                    for row in result:
                        u_email = row[1]
                        existing = db.query(User).filter(User.email == u_email).first()
                        if not existing:
                            db.add(User(
                                email=u_email,
                                name=row[2] or "",
                                hashed_password=row[3],
                                role=row[4] or "operador",
                                is_active=bool(row[5])
                            ))
                        else:
                            existing.hashed_password = row[3]
                    db.commit()
            except Exception:
                pass

        master_user = db.query(User).filter(User.role == "master").first()
        if not master_user:
            email = ADMIN_EMAIL or "luansouza"
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
    finally:
        db.close()

seed_master_user()

app = FastAPI(title="Painel CPROEIS Easypanel", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(sync.router)
app.include_router(clients.router)
app.include_router(agendamentos.router)
app.include_router(billing.router)
app.include_router(settings.router)

FRONTEND_DIST = BASE_DIR / "frontend" / "dist"

STATUS_API = {
    "status": "online",
    "service": "CPROEIS Painel de Gestao",
    "version": "1.0.0"
}

@app.get("/api/health")
def health_check():
    return STATUS_API

@app.get("/{full_path:path}")
def serve_frontend(full_path: str):
    if (FRONTEND_DIST / "index.html").exists():
        if full_path and not full_path.startswith("api/"):
            arquivo = (FRONTEND_DIST / full_path).resolve()
            dist_root = FRONTEND_DIST.resolve()
            if dist_root in arquivo.parents and arquivo.is_file():
                return FileResponse(arquivo)
            return FileResponse(FRONTEND_DIST / "index.html")
        elif not full_path:
            return FileResponse(FRONTEND_DIST / "index.html")
    return STATUS_API
