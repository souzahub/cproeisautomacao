from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..schemas import Token, UserLogin, UserResponse
from ..security import verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/login", response_model=Token)
def login_json(payload: UserLogin, db: Session = Depends(get_db)):
    raw_id = (payload.username or payload.email or "").strip()
    if not raw_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Informe o usuario ou e-mail"
        )

    user = db.query(User).filter(User.email.ilike(raw_id)).first()
    if not user:
        user = db.query(User).filter(User.name.ilike(raw_id)).first()
    if not user and raw_id.lower() in ("admin", "master", "admin@cproeis.local", "luansouza"):
        user = db.query(User).filter(User.role == "master").first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario ou senha incorretos"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario inativo"
        )

    access_token = create_access_token(data={"sub": user.email, "role": user.role, "id": user.id})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/token", response_model=Token)
def login_form(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    raw_id = form_data.username.strip()
    user = db.query(User).filter(User.email.ilike(raw_id)).first()
    if not user:
        user = db.query(User).filter(User.name.ilike(raw_id)).first()
    if not user and raw_id.lower() in ("admin", "master", "admin@cproeis.local", "luansouza"):
        user = db.query(User).filter(User.role == "master").first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario ou senha incorretos"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario inativo"
        )

    access_token = create_access_token(data={"sub": user.email, "role": user.role, "id": user.id})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
