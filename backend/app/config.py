import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH)

PORT = int(os.getenv("PORT", "3000"))
JWT_SECRET = os.getenv("JWT_SECRET", "proeis_chave_secreta_jwt_padrao_2026_antigravity")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 24

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", os.getenv("INITIAL_MASTER_EMAIL", "admin@cproeis.local")).strip()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", os.getenv("INITIAL_MASTER_PASSWORD", "admin123")).strip()

DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_URL = f"sqlite:///{DATA_DIR / 'app.db'}"

COMPROVANTES_DIR = BASE_DIR / "comprovantes"
COMPROVANTES_DIR.mkdir(parents=True, exist_ok=True)
