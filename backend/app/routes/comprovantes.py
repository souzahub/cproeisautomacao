import os
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from ..config import COMPROVANTES_DIR
from ..database import get_db
from ..models import User
from ..schemas import ComprovanteFile
from ..security import get_current_user, verify_token_string

router = APIRouter(prefix="/api/comprovantes", tags=["comprovantes"])

@router.get("", response_model=List[ComprovanteFile])
def list_comprovantes(current_user: User = Depends(get_current_user)):
    files = []
    if COMPROVANTES_DIR.exists():
        for entry in os.scandir(COMPROVANTES_DIR):
            if entry.is_file() and entry.name.lower().endswith(".pdf"):
                stat = entry.stat()
                mod_time = datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
                files.append({
                    "name": entry.name,
                    "size_bytes": stat.st_size,
                    "modified_at": mod_time,
                    "download_url": f"/api/comprovantes/{entry.name}"
                })
    files.sort(key=lambda x: x["modified_at"], reverse=True)
    return files

from fastapi import UploadFile, File

@router.post("/upload", response_model=ComprovanteFile)
async def upload_comprovante(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Apenas arquivos PDF sao permitidos.")

    COMPROVANTES_DIR.mkdir(parents=True, exist_ok=True)
    clean_name = os.path.basename(file.filename)
    dest_path = COMPROVANTES_DIR / clean_name

    content = await file.read()
    with open(dest_path, "wb") as f:
        f.write(content)

    stat = dest_path.stat()
    mod_time = datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
    return {
        "name": clean_name,
        "size_bytes": stat.st_size,
        "modified_at": mod_time,
        "download_url": f"/api/comprovantes/{clean_name}"
    }

@router.get("/{filename}")
def download_comprovante(
    filename: str,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    token_str = None
    if authorization and authorization.startswith("Bearer "):
        token_str = authorization.split(" ", 1)[1].strip()
    elif token:
        token_str = token.strip()

    if not token_str:
        raise HTTPException(status_code=401, detail="Nao autenticado.")

    verify_token_string(token_str, db)

    file_path = COMPROVANTES_DIR / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Arquivo nao encontrado.")

    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

