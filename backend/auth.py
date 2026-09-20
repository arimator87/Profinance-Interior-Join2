import os
import uuid
import secrets
import logging
from datetime import datetime, timezone, timedelta

import bcrypt
import requests
from fastapi import HTTPException, Request, Response, Depends
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)

OWNER_EMAILS = {"furniture.mail@gmail.com", "furnitrue.mail@gmail.com"}


def normalize_phone(phone: str) -> str:
    if not phone:
        return ""
    digits = "".join(ch for ch in str(phone) if ch.isdigit())
    if digits.startswith("62"):
        digits = "0" + digits[2:]
    return digits

mongo_url = os.environ["MONGO_URL"]
_client = AsyncIOMotorClient(mongo_url)
db = _client[os.environ["DB_NAME"]]

SESSION_DAYS = 7
EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


def hash_password(password: str) -> str:
    pw = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pw, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    pw = password.encode("utf-8")[:72]
    return bcrypt.checkpw(pw, password_hash.encode("utf-8"))


def user_public(doc: dict) -> dict:
    return {
        "user_id": doc["user_id"],
        "email": doc["email"],
        "name": doc.get("name", ""),
        "phone": doc.get("phone", ""),
        "picture": doc.get("picture"),
        "subscriptionTier": doc.get("subscriptionTier", "free"),
        "subscriptionExpiry": doc.get("subscriptionExpiry"),
        "authProvider": doc.get("authProvider", "email"),
        "isDemo": bool(doc.get("isDemo", False)),
        "isAdmin": (doc.get("email", "") or "").strip().lower() in OWNER_EMAILS,
    }


async def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return token


def set_session_cookie(response: Response, token: str):
    response.set_cookie(
        key="session_token", value=token, httponly=True,
        secure=True, samesite="none", path="/",
        max_age=SESSION_DAYS * 24 * 60 * 60,
    )


async def register_email_user(email: str, name: str, password: str, phone: str = "") -> dict:
    email = (email or "").strip().lower()
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        "user_id": user_id,
        "email": email,
        "name": name,
        "phone": normalize_phone(phone),
        "password_hash": hash_password(password),
        "picture": None,
        "subscriptionTier": "free",
        "subscriptionExpiry": None,
        "stripeCustomerId": None,
        "authProvider": "email",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def reset_password_with_phone(email: str, phone: str, new_password: str) -> None:
    email = (email or "").strip().lower()
    generic = HTTPException(status_code=400, detail="Data tidak cocok. Pastikan email dan nomor telepon sesuai saat mendaftar.")
    if len(new_password or "") < 6:
        raise HTTPException(status_code=400, detail="Password baru minimal 6 karakter")
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not user.get("phone"):
        raise generic
    if normalize_phone(phone) != user.get("phone"):
        raise generic
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"password_hash": hash_password(new_password)}})


async def login_email_user(email: str, password: str) -> dict:
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    if not verify_password(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    return user


async def process_google_session(session_id: str) -> tuple[dict, str]:
    resp = requests.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": session_id}, timeout=30)
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Sesi Google tidak valid")
    data = resp.json()
    email = data["email"]
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": email,
            "name": data.get("name", ""),
            "password_hash": None,
            "picture": data.get("picture"),
            "subscriptionTier": "free",
            "subscriptionExpiry": None,
            "stripeCustomerId": None,
            "authProvider": "google",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user)
        user.pop("_id", None)
    else:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"name": data.get("name", user.get("name")), "picture": data.get("picture")}},
        )
    session_token = data.get("session_token") or secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return user, session_token


def _extract_token(request: Request) -> str | None:
    token = request.cookies.get("session_token")
    if token:
        return token
    auth = request.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        return auth.split(" ", 1)[1]
    return None


async def get_current_user(request: Request) -> dict:
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Tidak terautentikasi")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Sesi tidak ditemukan")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Sesi kedaluwarsa")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User tidak ditemukan")
    if user.get("isDemo") and request.method in ("POST", "PUT", "DELETE", "PATCH"):
        raise HTTPException(
            status_code=403,
            detail="Mode Demo: data tidak dapat diubah. Daftar akun gratis untuk mulai mengelola proyek Anda.",
        )
    email = (user.get("email") or "").strip().lower()
    if email in OWNER_EMAILS and user.get("subscriptionTier") != "premium":
        expiry = (datetime.now(timezone.utc) + timedelta(days=3650)).isoformat()
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"subscriptionTier": "premium", "subscriptionExpiry": expiry}},
        )
        user["subscriptionTier"] = "premium"
        user["subscriptionExpiry"] = expiry
    return user


async def require_premium(user: dict = Depends(get_current_user)) -> dict:
    tier = user.get("subscriptionTier", "free")
    expiry = user.get("subscriptionExpiry")
    active = tier == "premium"
    if active and expiry:
        exp = datetime.fromisoformat(expiry) if isinstance(expiry, str) else expiry
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc):
            active = False
    if not active:
        raise HTTPException(status_code=403, detail="Fitur ini hanya untuk pengguna Premium")
    return user
