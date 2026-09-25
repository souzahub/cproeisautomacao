from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..schemas import Token, UserLogin, UserResponse
from ..security import verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    raw_id = (credentials.email or credentials.username or "").strip()
    if not raw_id:
        raise HTTPException(status_code=400, detail="Informe o e-mail ou usuário.")
    
    user = db.query(User).filter(User.email.ilike(raw_id)).first()
    if not user and raw_id.lower() in ("admin", "master", "admin@cproeis.local"):
        user = db.query(User).filter(User.role == "master").first()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos."
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta desativada."
        )
    token = create_access_token({"sub": user.email, "user_id": user.id, "role": user.role})
    try:
        from ..services.sync_service import trigger_background_sync
        trigger_background_sync()
    except Exception:
        pass
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/token", response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    login_id = form_data.username.strip()
    user = db.query(User).filter(User.email.ilike(login_id)).first()
    if not user and login_id.lower() in ("admin", "master", "admin@cproeis.local"):
        user = db.query(User).filter(User.role == "master").first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos."
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta desativada."
        )
    token = create_access_token({"sub": user.email, "user_id": user.id, "role": user.role})
    try:
        from ..services.sync_service import trigger_background_sync
        trigger_background_sync()
    except Exception:
        pass
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return current_user
