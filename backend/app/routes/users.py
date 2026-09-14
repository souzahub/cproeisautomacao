from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..schemas import UserCreate, UserUpdate, UserResponse
from ..security import get_password_hash, get_current_master

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("", response_model=List[UserResponse])
def list_users(db: Session = Depends(get_db), current_master: User = Depends(get_current_master)):
    return db.query(User).order_by(User.id.asc()).all()

@router.post("", response_model=UserResponse)
def create_user(user_in: UserCreate, db: Session = Depends(get_db), current_master: User = Depends(get_current_master)):
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email ja cadastrado."
        )
    user = User(
        email=user_in.email,
        name=user_in.name or "",
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role if user_in.role in ["master", "operador"] else "operador",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.put("/{user_id}", response_model=UserResponse)
def update_user(user_id: int, user_in: UserUpdate, db: Session = Depends(get_db), current_master: User = Depends(get_current_master)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario nao encontrado.")

    if user_in.email is not None and user_in.email.strip():
        existing = db.query(User).filter(User.email == user_in.email.strip(), User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nome de usuario ja em uso.")
        user.email = user_in.email.strip()

    if user_in.name is not None:
        user.name = user_in.name
    if user_in.role is not None:
        if user.id == current_master.id and user_in.role != "master":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nao e permitido rebaixar sua propria conta master.")
        user.role = user_in.role
    if user_in.is_active is not None:
        if user.id == current_master.id and not user_in.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nao e permitido desativar sua propria conta master.")
        user.is_active = user_in.is_active
    if user_in.password and user_in.password.strip():
        user.hashed_password = get_password_hash(user_in.password.strip())

    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_master: User = Depends(get_current_master)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario nao encontrado.")
    if user.id == current_master.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nao e permitido excluir sua propria conta.")

    db.delete(user)
    db.commit()
    return {"message": "Usuario removido."}
