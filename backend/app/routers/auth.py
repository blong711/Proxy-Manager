from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
from app.services.auth_service import authenticate_user, create_access_token, decode_token, get_user_by_username, create_user
from app.models.user import User, UserRole

router = APIRouter()
bearer_scheme = HTTPBearer(auto_error=False)


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str


class UserInfo(BaseModel):
    id: Optional[str] = None
    username: str
    role: str
    is_active: bool


class UserListItem(BaseModel):
    id: str
    username: str
    role: str
    is_active: bool


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise credentials_exception

    payload = decode_token(credentials.credentials)
    if payload is None:
        raise credentials_exception

    username: str = payload.get("sub")
    if username is None:
        raise credentials_exception

    user = await get_user_by_username(username)
    if user is None or not user.is_active:
        raise credentials_exception

    return user


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    user = await authenticate_user(body.username, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    token = create_access_token({"sub": user.username, "role": user.role})
    return LoginResponse(
        access_token=token,
        username=user.username,
        role=user.role,
    )


@router.get("/me", response_model=UserInfo)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserInfo(
        username=current_user.username,
        role=current_user.role,
        is_active=current_user.is_active,
    )


class RegisterRequest(BaseModel):
    username: str
    password: str


@router.post("/register", response_model=UserInfo, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest):
    """Public endpoint — anyone can register, role is always 'user'."""
    existing = await get_user_by_username(body.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên đăng nhập đã tồn tại.",
        )
    user = await create_user(body.username, body.password, UserRole.USER)
    return UserInfo(username=user.username, role=user.role, is_active=user.is_active)


# ── User management (admin only) ─────────────────────────────────────────────

class UpdateRoleRequest(BaseModel):
    role: UserRole


@router.get("/users", response_model=List[UserListItem])
async def list_users(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    users = await User.find_all().to_list()
    return [
        UserListItem(id=str(u.id), username=u.username, role=u.role, is_active=u.is_active)
        for u in users
    ]


@router.patch("/users/{username}/role", response_model=UserInfo)
async def update_user_role(
    username: str,
    body: UpdateRoleRequest,
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    if username == current_user.username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không thể tự đổi role của bản thân.")
    user = await get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.role = body.role
    await user.save()
    return UserInfo(username=user.username, role=user.role, is_active=user.is_active)


@router.patch("/users/{username}/toggle", response_model=UserInfo)
async def toggle_user_active(
    username: str,
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    if username == current_user.username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không thể tự khóa tài khoản bản thân.")
    user = await get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = not user.is_active
    await user.save()
    return UserInfo(username=user.username, role=user.role, is_active=user.is_active)


@router.delete("/users/{username}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    username: str,
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    if username == current_user.username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không thể xóa tài khoản bản thân.")
    user = await get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    await user.delete()

