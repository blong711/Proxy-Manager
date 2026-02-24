from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.models.user import User, UserRole

SECRET_KEY = "proxy-manager-super-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


async def authenticate_user(username: str, password: str) -> Optional[User]:
    user = await User.find_one(User.username == username)
    if not user or not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user


async def get_user_by_username(username: str) -> Optional[User]:
    return await User.find_one(User.username == username)


async def create_user(username: str, password: str, role: UserRole = UserRole.USER) -> User:
    user = User(
        username=username,
        hashed_password=hash_password(password),
        role=role,
    )
    await user.insert()
    return user


async def ensure_default_users():
    """Create default admin and user accounts if they don't exist."""
    admin = await User.find_one(User.username == "admin")
    if not admin:
        await create_user("admin", "admin123", UserRole.ADMIN)

    user = await User.find_one(User.username == "user")
    if not user:
        await create_user("user", "user123", UserRole.USER)
