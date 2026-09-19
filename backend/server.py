import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, List

from fastapi import (
    FastAPI, APIRouter, Depends, HTTPException, Request, Response,
    UploadFile, File, Header, Query,
)
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import auth as auth_mod
from auth import (
    db, get_current_user, require_premium, create_session, set_session_cookie,
    register_email_user, login_email_user, process_google_session, user_public,
)
from storage import init_storage, put_object, get_object, APP_NAME, MIME_TYPES
from pdf_report import build_report_pdf

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI()
api = APIRouter(prefix="/api")

PAID_IN_CATEGORIES = {"Downpayment", "Termin", "Pelunasan"}
INCOME_CATEGORIES = ["Downpayment", "Termin", "Pelunasan", "Lainnya"]
EXPENSE_CATEGORIES = ["Material", "Makan", "Toll", "Bensin", "Lainnya"]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ---------- Schemas ----------
class RegisterIn(BaseModel):
    email: EmailStr
    name: str
    password: str = Field(min_length=6)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionIn(BaseModel):
    session_id: str


class ProjectIn(BaseModel):
    name: str
    owner: str = ""
    nominal: int = 0
    companyName: str = ""
    alamatProyek: str = ""
    tanggalMulai: Optional[str] = None
    targetSelesai: Optional[str] = None
    category: str = "Residensial"
    status: str = "Berjalan"
    thumbnail: Optional[str] = None


class TransactionIn(BaseModel):
    type: str
    amount: int
    description: str = ""
    date: Optional[str] = None
    category: str = "Lainnya"
    receiptUrl: Optional[str] = None


class WorkerIn(BaseModel):
    name: str
    borongan: int = 0


class WorkerPayIn(BaseModel):
    type: str  # "kasbon" | "pelunasan"
    amount: int
    date: Optional[str] = None
    description: str = ""


class WorkItemIn(BaseModel):
    name: str
    nilai: int = 0
    startDate: Optional[str] = None
    endDate: Optional[str] = None


class ProgressIn(BaseModel):
    date: Optional[str] = None
    progress: int = 0
    notes: str = ""
    photoUrls: List[str] = []
    subItemId: Optional[str] = None


class SubItemIn(BaseModel):
    name: str
    harga: int = 0
    status: bool = False


class RabIn(BaseModel):
    rabTotal: int = 0


# ---------- Finance calc ----------
async def compute_summary(project: dict) -> dict:
    project_id = project["id"]
    nominal = project.get("nominal", 0) or 0
    txs = await db.transactions.find({"project_id": project_id}, {"_id": 0}).to_list(5000)
    total_in = sum(t["amount"] for t in txs if t["type"] == "in")
    total_out = sum(t["amount"] for t in txs if t["type"] == "out")
    balance = total_in - total_out
    margin_pct = (balance / nominal * 100) if nominal else 0
    realisasi_pct = (total_in / nominal * 100) if nominal else 0
    terbayar = sum(t["amount"] for t in txs if t["type"] == "in" and t.get("category") in PAID_IN_CATEGORIES)
    sisa_tagihan = nominal - terbayar
    return {
        "totalIn": total_in,
        "totalOut": total_out,
        "balance": balance,
        "marginPct": round(margin_pct, 2),
        "realisasiPct": round(realisasi_pct, 2),
        "terbayar": terbayar,
        "sisaTagihan": sisa_tagihan,
        "nominal": nominal,
        "txCount": len(txs),
    }


async def compute_worker(worker: dict) -> dict:
    project_id = worker["project_id"]
    name = worker["name"]
    txs = await db.transactions.find(
        {"project_id": project_id, "type": "out"}, {"_id": 0}
    ).to_list(5000)
    total_kasbon = sum(t["amount"] for t in txs if t.get("category") == f"Kasbon Tukang {name}")
    total_pelunasan = sum(t["amount"] for t in txs if t.get("category") == f"Pelunasan Tukang {name}")
    sisa = worker.get("borongan", 0) - total_kasbon - total_pelunasan
    return {
        **{k: v for k, v in worker.items() if k != "project_id"},
        "totalKasbon": total_kasbon,
        "totalPelunasan": total_pelunasan,
        "totalDibayar": total_kasbon + total_pelunasan,
        "sisaHutang": sisa,
    }


async def compute_progress(project: dict):
    project_id = project["id"]
    items_raw = await db.work_items.find({"project_id": project_id}, {"_id": 0}).sort("createdAt", 1).to_list(2000)
    prepared = []
    total_item_value = 0
    for wi in items_raw:
        subs = await db.sub_items.find({"work_item_id": wi["id"]}, {"_id": 0}).sort("createdAt", 1).to_list(2000)
        has_subs = len(subs) > 0
        item_value = sum(s.get("harga", 0) for s in subs) if has_subs else (wi.get("nilai", 0) or 0)
        total_item_value += item_value
        prepared.append((wi, subs, has_subs, item_value))

    rab = project.get("rabTotal", 0) or 0
    if rab <= 0:
        rab = total_item_value

    async def last_prog(work_item_id, sub_item_id):
        q = {"workItemId": work_item_id}
        if sub_item_id is None:
            q["$or"] = [{"subItemId": None}, {"subItemId": {"$exists": False}}]
        else:
            q["subItemId"] = sub_item_id
        entries = await db.progress_entries.find(q, {"_id": 0}).sort("date", 1).to_list(2000)
        return (entries[-1]["progress"] if entries else 0), len(entries)

    items = []
    project_completed = 0
    for wi, subs, has_subs, item_value in prepared:
        item_weight = (item_value / rab * 100) if rab else 0
        sub_list = []
        if has_subs:
            completed = 0
            for s in subs:
                sp, scount = await last_prog(wi["id"], s["id"])
                sw = (s.get("harga", 0) / rab * 100) if rab else 0
                completed += s.get("harga", 0) * sp / 100
                sub_list.append({
                    "id": s["id"], "name": s["name"], "harga": s.get("harga", 0),
                    "weight": round(sw, 2), "lastProgress": sp, "entryCount": scount,
                })
            item_progress = round(completed / item_value * 100, 1) if item_value else 0
            item_completed = completed
            entry_count = sum(x["entryCount"] for x in sub_list)
        else:
            ip, icount = await last_prog(wi["id"], None)
            item_progress = ip
            item_completed = item_value * ip / 100
            entry_count = icount
        project_completed += item_completed
        items.append({
            "id": wi["id"], "name": wi["name"], "nilai": item_value, "manualNilai": wi.get("nilai", 0),
            "startDate": wi.get("startDate"), "endDate": wi.get("endDate"),
            "weight": round(item_weight, 2), "lastProgress": item_progress,
            "hasSubs": has_subs, "subItems": sub_list, "subCount": len(subs),
            "subTotal": item_value if has_subs else 0, "doneValue": round(item_completed),
            "entryCount": entry_count,
        })

    total_progress = round(project_completed / rab * 100, 2) if rab else 0
    return {
        "items": items, "rab": rab, "rabTotal": project.get("rabTotal", 0) or 0,
        "totalItemValue": total_item_value, "totalProgress": total_progress,
        "completedValue": round(project_completed),
    }


async def compute_workitems(project: dict):
    return (await compute_progress(project))["items"]


async def project_total_progress(project: dict):
    data = await compute_progress(project)
    return data["totalProgress"], data["items"]


async def get_owned_project(project_id: str, user: dict) -> dict:
    project = await db.projects.find_one({"id": project_id, "user_id": user["user_id"]}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Proyek tidak ditemukan")
    return project


# ---------- Auth routes ----------
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    user = await register_email_user(body.email, body.name, body.password)
    token = await create_session(user["user_id"])
    set_session_cookie(response, token)
    return {"user": user_public(user), "token": token}


@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    user = await login_email_user(body.email, body.password)
    token = await create_session(user["user_id"])
    set_session_cookie(response, token)
    return {"user": user_public(user), "token": token}


@api.post("/auth/session")
async def google_session(body: GoogleSessionIn, response: Response):
    user, token = await process_google_session(body.session_id)
    set_session_cookie(response, token)
    return {"user": user_public(user), "token": token}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user_public(user)


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token") or (
        request.headers.get("Authorization", "").replace("Bearer ", "") or None
    )
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ---------- Subscription (mockup) ----------
@api.post("/subscription/upgrade")
async def upgrade(plan: dict, user: dict = Depends(get_current_user)):
    months = 12 if plan.get("plan") == "yearly" else 1
    expiry = (datetime.now(timezone.utc) + timedelta(days=30 * months)).isoformat()
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"subscriptionTier": "premium", "subscriptionExpiry": expiry}},
    )
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return user_public(updated)


@api.post("/subscription/toggle")
async def toggle_tier(user: dict = Depends(get_current_user)):
    new_tier = "free" if user.get("subscriptionTier") == "premium" else "premium"
    expiry = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat() if new_tier == "premium" else None
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"subscriptionTier": new_tier, "subscriptionExpiry": expiry}},
    )
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return user_public(updated)


# ---------- Projects ----------
@api.post("/projects")
async def create_project(body: ProjectIn, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        **body.model_dump(),
        "createdAt": now_iso(),
    }
    await db.projects.insert_one(doc)
    doc.pop("_id", None)
    summary = await compute_summary(doc)
    return {**{k: v for k, v in doc.items() if k != "user_id"}, "summary": summary}


@api.get("/projects")
async def list_projects(user: dict = Depends(get_current_user)):
    projects = await db.projects.find({"user_id": user["user_id"]}, {"_id": 0}).sort("createdAt", -1).to_list(1000)
    out = []
    for p in projects:
        summary = await compute_summary(p)
        out.append({**{k: v for k, v in p.items() if k != "user_id"}, "summary": summary})
    return out


@api.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    projects = await db.projects.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    total_balance = 0
    total_sisa = 0
    total_budget = 0
    total_in = 0
    total_out = 0
    for p in projects:
        s = await compute_summary(p)
        total_balance += s["balance"]
        total_sisa += s["sisaTagihan"]
        total_budget += s["nominal"]
        total_in += s["totalIn"]
        total_out += s["totalOut"]
    # total kasbon tukang aktif
    workers = await db.workers.find(
        {"project_id": {"$in": [p["id"] for p in projects]}}, {"_id": 0}
    ).to_list(5000)
    total_kasbon_aktif = 0
    for w in workers:
        cw = await compute_worker(w)
        if cw["sisaHutang"] > 0:
            total_kasbon_aktif += cw["totalKasbon"]
    return {
        "saldoBersih": total_balance,
        "totalSisaTagihan": total_sisa,
        "totalBudget": total_budget,
        "totalKasbonAktif": total_kasbon_aktif,
        "totalIn": total_in,
        "totalOut": total_out,
        "projectCount": len(projects),
    }


@api.get("/projects/{project_id}")
async def get_project(project_id: str, user: dict = Depends(get_current_user)):
    p = await get_owned_project(project_id, user)
    summary = await compute_summary(p)
    return {**{k: v for k, v in p.items() if k != "user_id"}, "summary": summary}


@api.put("/projects/{project_id}")
async def update_project(project_id: str, body: ProjectIn, user: dict = Depends(get_current_user)):
    await get_owned_project(project_id, user)
    await db.projects.update_one({"id": project_id}, {"$set": body.model_dump()})
    p = await db.projects.find_one({"id": project_id}, {"_id": 0})
    summary = await compute_summary(p)
    return {**{k: v for k, v in p.items() if k != "user_id"}, "summary": summary}


@api.delete("/projects/{project_id}")
async def delete_project(project_id: str, user: dict = Depends(get_current_user)):
    await get_owned_project(project_id, user)
    await db.projects.delete_one({"id": project_id})
    await db.transactions.delete_many({"project_id": project_id})
    await db.workers.delete_many({"project_id": project_id})
    items = await db.work_items.find({"project_id": project_id}, {"_id": 0}).to_list(2000)
    for wi in items:
        await db.progress_entries.delete_many({"workItemId": wi["id"]})
    await db.work_items.delete_many({"project_id": project_id})
    await db.sub_items.delete_many({"project_id": project_id})
    return {"ok": True}


# ---------- Transactions ----------
@api.post("/projects/{project_id}/transactions")
async def add_transaction(project_id: str, body: TransactionIn, user: dict = Depends(get_current_user)):
    await get_owned_project(project_id, user)
    doc = {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        **body.model_dump(),
        "date": body.date or now_iso(),
        "createdAt": now_iso(),
    }
    await db.transactions.insert_one(doc)
    doc.pop("_id", None)
    return {k: v for k, v in doc.items() if k != "project_id"}


@api.get("/projects/{project_id}/transactions")
async def list_transactions(project_id: str, user: dict = Depends(get_current_user)):
    await get_owned_project(project_id, user)
    txs = await db.transactions.find({"project_id": project_id}, {"_id": 0}).sort("date", -1).to_list(5000)
    return [{k: v for k, v in t.items() if k != "project_id"} for t in txs]


@api.put("/transactions/{tx_id}")
async def update_transaction(tx_id: str, body: TransactionIn, user: dict = Depends(get_current_user)):
    tx = await db.transactions.find_one({"id": tx_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    await get_owned_project(tx["project_id"], user)
    update = body.model_dump()
    if not update.get("date"):
        update["date"] = tx["date"]
    await db.transactions.update_one({"id": tx_id}, {"$set": update})
    doc = await db.transactions.find_one({"id": tx_id}, {"_id": 0})
    return {k: v for k, v in doc.items() if k != "project_id"}


@api.delete("/transactions/{tx_id}")
async def delete_transaction(tx_id: str, user: dict = Depends(get_current_user)):
    tx = await db.transactions.find_one({"id": tx_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    await get_owned_project(tx["project_id"], user)
    await db.transactions.delete_one({"id": tx_id})
    return {"ok": True}


# ---------- Workers ----------
@api.post("/projects/{project_id}/workers")
async def add_worker(project_id: str, body: WorkerIn, user: dict = Depends(get_current_user)):
    await get_owned_project(project_id, user)
    doc = {"id": str(uuid.uuid4()), "project_id": project_id, **body.model_dump(), "createdAt": now_iso()}
    await db.workers.insert_one(doc)
    doc.pop("_id", None)
    return await compute_worker(doc)


@api.get("/projects/{project_id}/workers")
async def list_workers(project_id: str, user: dict = Depends(get_current_user)):
    await get_owned_project(project_id, user)
    workers = await db.workers.find({"project_id": project_id}, {"_id": 0}).to_list(2000)
    return [await compute_worker(w) for w in workers]


@api.put("/workers/{worker_id}")
async def update_worker(worker_id: str, body: WorkerIn, user: dict = Depends(get_current_user)):
    worker = await db.workers.find_one({"id": worker_id}, {"_id": 0})
    if not worker:
        raise HTTPException(status_code=404, detail="Tukang tidak ditemukan")
    await get_owned_project(worker["project_id"], user)
    old_name = worker["name"]
    new_name = body.name
    await db.workers.update_one({"id": worker_id}, {"$set": {"name": new_name, "borongan": body.borongan}})
    if new_name != old_name:
        for prefix in ("Kasbon Tukang", "Pelunasan Tukang"):
            await db.transactions.update_many(
                {"project_id": worker["project_id"], "category": f"{prefix} {old_name}"},
                {"$set": {"category": f"{prefix} {new_name}"}},
            )
    worker = await db.workers.find_one({"id": worker_id}, {"_id": 0})
    return await compute_worker(worker)


@api.post("/workers/{worker_id}/pay")
async def pay_worker(worker_id: str, body: WorkerPayIn, user: dict = Depends(get_current_user)):
    worker = await db.workers.find_one({"id": worker_id}, {"_id": 0})
    if not worker:
        raise HTTPException(status_code=404, detail="Tukang tidak ditemukan")
    await get_owned_project(worker["project_id"], user)
    label = "Kasbon Tukang" if body.type == "kasbon" else "Pelunasan Tukang"
    category = f"{label} {worker['name']}"
    doc = {
        "id": str(uuid.uuid4()),
        "project_id": worker["project_id"],
        "type": "out",
        "amount": body.amount,
        "description": body.description or f"{label} {worker['name']}",
        "date": body.date or now_iso(),
        "category": category,
        "receiptUrl": None,
        "createdAt": now_iso(),
    }
    await db.transactions.insert_one(doc)
    worker = await db.workers.find_one({"id": worker_id}, {"_id": 0})
    return await compute_worker(worker)


@api.delete("/workers/{worker_id}")
async def delete_worker(worker_id: str, user: dict = Depends(get_current_user)):
    worker = await db.workers.find_one({"id": worker_id}, {"_id": 0})
    if not worker:
        raise HTTPException(status_code=404, detail="Tukang tidak ditemukan")
    await get_owned_project(worker["project_id"], user)
    await db.workers.delete_one({"id": worker_id})
    return {"ok": True}


# ---------- Work Items (Premium) ----------
@api.post("/projects/{project_id}/workitems")
async def add_workitem(project_id: str, body: WorkItemIn, user: dict = Depends(require_premium)):
    await get_owned_project(project_id, user)
    doc = {"id": str(uuid.uuid4()), "project_id": project_id, **body.model_dump(), "createdAt": now_iso()}
    await db.work_items.insert_one(doc)
    p = await db.projects.find_one({"id": project_id}, {"_id": 0})
    items = await compute_workitems(p)
    return next(i for i in items if i["id"] == doc["id"])


@api.get("/projects/{project_id}/workitems")
async def list_workitems(project_id: str, user: dict = Depends(require_premium)):
    p = await get_owned_project(project_id, user)
    return await compute_workitems(p)


@api.put("/workitems/{item_id}")
async def update_workitem(item_id: str, body: WorkItemIn, user: dict = Depends(require_premium)):
    wi = await db.work_items.find_one({"id": item_id}, {"_id": 0})
    if not wi:
        raise HTTPException(status_code=404, detail="Item tidak ditemukan")
    await get_owned_project(wi["project_id"], user)
    await db.work_items.update_one({"id": item_id}, {"$set": body.model_dump()})
    p = await db.projects.find_one({"id": wi["project_id"]}, {"_id": 0})
    items = await compute_workitems(p)
    return next((i for i in items if i["id"] == item_id), {})


@api.delete("/workitems/{item_id}")
async def delete_workitem(item_id: str, user: dict = Depends(require_premium)):
    wi = await db.work_items.find_one({"id": item_id}, {"_id": 0})
    if not wi:
        raise HTTPException(status_code=404, detail="Item tidak ditemukan")
    await get_owned_project(wi["project_id"], user)
    await db.work_items.delete_one({"id": item_id})
    await db.progress_entries.delete_many({"workItemId": item_id})
    await db.sub_items.delete_many({"work_item_id": item_id})
    return {"ok": True}


@api.post("/workitems/{item_id}/subitems")
async def add_subitem(item_id: str, body: SubItemIn, user: dict = Depends(require_premium)):
    wi = await db.work_items.find_one({"id": item_id}, {"_id": 0})
    if not wi:
        raise HTTPException(status_code=404, detail="Item tidak ditemukan")
    await get_owned_project(wi["project_id"], user)
    doc = {
        "id": str(uuid.uuid4()),
        "work_item_id": item_id,
        "project_id": wi["project_id"],
        "name": body.name,
        "harga": body.harga,
        "status": body.status,
        "createdAt": now_iso(),
    }
    await db.sub_items.insert_one(doc)
    doc.pop("_id", None)
    return {k: v for k, v in doc.items() if k != "project_id"}


@api.get("/workitems/{item_id}/subitems")
async def list_subitems(item_id: str, user: dict = Depends(require_premium)):
    wi = await db.work_items.find_one({"id": item_id}, {"_id": 0})
    if not wi:
        raise HTTPException(status_code=404, detail="Item tidak ditemukan")
    await get_owned_project(wi["project_id"], user)
    subs = await db.sub_items.find({"work_item_id": item_id}, {"_id": 0}).sort("createdAt", 1).to_list(2000)
    return [{k: v for k, v in s.items() if k != "project_id"} for s in subs]


@api.put("/subitems/{sub_id}")
async def update_subitem(sub_id: str, body: SubItemIn, user: dict = Depends(require_premium)):
    sub = await db.sub_items.find_one({"id": sub_id}, {"_id": 0})
    if not sub:
        raise HTTPException(status_code=404, detail="Sub item tidak ditemukan")
    await get_owned_project(sub["project_id"], user)
    await db.sub_items.update_one(
        {"id": sub_id},
        {"$set": {"name": body.name, "harga": body.harga, "status": body.status}},
    )
    doc = await db.sub_items.find_one({"id": sub_id}, {"_id": 0})
    return {k: v for k, v in doc.items() if k != "project_id"}


@api.delete("/subitems/{sub_id}")
async def delete_subitem(sub_id: str, user: dict = Depends(require_premium)):
    sub = await db.sub_items.find_one({"id": sub_id}, {"_id": 0})
    if not sub:
        raise HTTPException(status_code=404, detail="Sub item tidak ditemukan")
    await get_owned_project(sub["project_id"], user)
    await db.sub_items.delete_one({"id": sub_id})
    return {"ok": True}


@api.post("/workitems/{item_id}/progress")
async def add_progress(item_id: str, body: ProgressIn, user: dict = Depends(require_premium)):
    wi = await db.work_items.find_one({"id": item_id}, {"_id": 0})
    if not wi:
        raise HTTPException(status_code=404, detail="Item tidak ditemukan")
    await get_owned_project(wi["project_id"], user)
    doc = {
        "id": str(uuid.uuid4()),
        "workItemId": item_id,
        "subItemId": body.subItemId,
        "date": body.date or now_iso(),
        "progress": max(0, min(100, body.progress)),
        "notes": body.notes,
        "photoUrls": body.photoUrls,
        "createdAt": now_iso(),
    }
    await db.progress_entries.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/workitems/{item_id}/progress")
async def list_progress(item_id: str, subItemId: Optional[str] = Query(None), user: dict = Depends(require_premium)):
    wi = await db.work_items.find_one({"id": item_id}, {"_id": 0})
    if not wi:
        raise HTTPException(status_code=404, detail="Item tidak ditemukan")
    await get_owned_project(wi["project_id"], user)
    q = {"workItemId": item_id}
    if subItemId:
        q["subItemId"] = subItemId
    else:
        q["$or"] = [{"subItemId": None}, {"subItemId": {"$exists": False}}]
    entries = await db.progress_entries.find(q, {"_id": 0}).sort("date", 1).to_list(2000)
    return entries


@api.get("/projects/{project_id}/progress-summary")
async def progress_summary(project_id: str, user: dict = Depends(require_premium)):
    p = await get_owned_project(project_id, user)
    data = await compute_progress(p)
    items = data["items"]
    all_entries = await db.progress_entries.find(
        {"workItemId": {"$in": [i["id"] for i in items]}}, {"_id": 0}
    ).sort("date", 1).to_list(5000)

    def parse(d):
        try:
            return datetime.fromisoformat(str(d)[:19])
        except Exception:
            return None

    proj_start = parse(p.get("tanggalMulai"))
    proj_end = parse(p.get("targetSelesai"))

    leaves = []  # (workItemId, subItemId, weight, start_dt, end_dt)
    for i in items:
        s = parse(i.get("startDate")) or proj_start
        e = parse(i.get("endDate")) or proj_end
        if i["hasSubs"]:
            for su in i["subItems"]:
                leaves.append((i["id"], su["id"], su["weight"], s, e))
        else:
            leaves.append((i["id"], None, i["weight"], s, e))

    entry_dts = [parse(e["date"]) for e in all_entries if parse(e["date"])]
    starts = [s for (_, _, _, s, _) in leaves if s]
    ends = [e for (_, _, _, _, e) in leaves if e]
    candidates = starts + ends + entry_dts
    if candidates:
        start_dt = min(starts + entry_dts) if (starts + entry_dts) else min(candidates)
        end_dt = max(ends + entry_dts) if (ends + entry_dts) else max(candidates)
    else:
        start_dt = end_dt = datetime.now().replace(microsecond=0)
    if end_dt < start_dt:
        end_dt = start_dt
    span_days = max((end_dt - start_dt).days, 1)

    def planned_at(dt):
        tot = 0.0
        for (_, _, w, s, e) in leaves:
            ls = s or start_dt
            le = e or end_dt
            if le <= ls:
                frac = 1.0 if dt >= ls else 0.0
            else:
                frac = max(0.0, min(1.0, (dt - ls).days / (le - ls).days))
            tot += w * frac
        return tot

    wmap = {(wi, si): w for (wi, si, w, _, _) in leaves}

    def actual_at(dstr):
        latest = {}
        for e in all_entries:
            if e["date"][:10] <= dstr:
                latest[(e["workItemId"], e.get("subItemId") or None)] = e["progress"]
        return sum(wmap.get(k, 0) * prog / 100 for k, prog in latest.items())

    ticks = set()
    for k in range(11):
        ticks.add((start_dt + timedelta(days=round(span_days * k / 10))).date().isoformat())
    for e in all_entries:
        pd = parse(e["date"])
        if pd:
            ticks.add(pd.date().isoformat())

    curve = []
    for d in sorted(ticks):
        dt = datetime.fromisoformat(d)
        curve.append({
            "date": d,
            "planned": round(min(100.0, planned_at(dt)), 1),
            "actual": round(min(100.0, actual_at(d)), 1),
        })

    today = datetime.now().replace(microsecond=0)
    return {
        "totalProgress": data["totalProgress"],
        "plannedProgress": round(min(100.0, planned_at(today)), 1),
        "items": items,
        "curve": curve,
        "rab": data["rab"],
        "rabTotal": data["rabTotal"],
        "totalItemValue": data["totalItemValue"],
        "completedValue": data["completedValue"],
        "start": start_dt.date().isoformat(),
        "end": end_dt.date().isoformat(),
    }


@api.put("/projects/{project_id}/rab-total")
async def set_rab_total(project_id: str, body: RabIn, user: dict = Depends(get_current_user)):
    await get_owned_project(project_id, user)
    await db.projects.update_one({"id": project_id}, {"$set": {"rabTotal": body.rabTotal}})
    return {"rabTotal": body.rabTotal}


# ---------- Report (Premium) ----------
@api.get("/projects/{project_id}/report")
async def report(project_id: str, user: dict = Depends(require_premium)):
    p = await get_owned_project(project_id, user)
    summary = await compute_summary(p)
    txs = await db.transactions.find({"project_id": project_id}, {"_id": 0}).to_list(5000)
    expense_by_cat = {}
    for t in txs:
        if t["type"] == "out":
            cat = t.get("category", "Lainnya")
            # group tukang categories
            if cat.startswith("Kasbon Tukang") or cat.startswith("Pelunasan Tukang"):
                cat = "Upah & Kasbon Tukang"
            expense_by_cat[cat] = expense_by_cat.get(cat, 0) + t["amount"]
    expense_list = sorted(
        [{"name": k, "value": v} for k, v in expense_by_cat.items()],
        key=lambda x: x["value"], reverse=True,
    )
    return {
        "summary": summary,
        "expenseByCategory": expense_list,
        "inOut": [
            {"name": "Pemasukan", "value": summary["totalIn"]},
            {"name": "Pengeluaran", "value": summary["totalOut"]},
        ],
        "marginBar": [
            {"name": "Nilai Kontrak", "value": summary["nominal"]},
            {"name": "Total Pengeluaran", "value": summary["totalOut"]},
            {"name": "Laba / Margin", "value": summary["balance"]},
        ],
    }


@api.get("/projects/{project_id}/report/pdf")
async def report_pdf(project_id: str, request: Request, auth: Optional[str] = Query(None)):
    # allow token via query param for direct download links
    if auth and not request.headers.get("Authorization"):
        request.scope.setdefault("headers", [])
    user = await _user_from_request_or_query(request, auth)
    await require_premium(user)
    p = await get_owned_project(project_id, user)
    summary = await compute_summary(p)
    txs = await db.transactions.find({"project_id": project_id}, {"_id": 0}).sort("date", 1).to_list(5000)
    workers_raw = await db.workers.find({"project_id": project_id}, {"_id": 0}).to_list(2000)
    workers = [await compute_worker(w) for w in workers_raw]
    _, work_items = await project_total_progress(p)
    entries = await db.progress_entries.find(
        {"workItemId": {"$in": [i["id"] for i in work_items]}}, {"_id": 0}
    ).sort("date", 1).to_list(5000)
    pdf_bytes = build_report_pdf(p, summary, txs, workers, work_items, entries)
    safe_name = "".join(c for c in p.get("name", "laporan") if c.isalnum() or c in " -_")[:40].strip() or "laporan"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Laporan-{safe_name}.pdf"'},
    )


async def _user_from_request_or_query(request: Request, auth: Optional[str]) -> dict:
    token = request.cookies.get("session_token")
    if not token:
        header = request.headers.get("Authorization")
        if header and header.startswith("Bearer "):
            token = header.split(" ", 1)[1]
    if not token and auth:
        token = auth
    if not token:
        raise HTTPException(status_code=401, detail="Tidak terautentikasi")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Sesi tidak ditemukan")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User tidak ditemukan")
    return user


# ---------- File upload / serve ----------
@api.post("/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = (file.filename.split(".")[-1].lower() if "." in file.filename else "bin")
    content_type = MIME_TYPES.get(ext, file.content_type or "application/octet-stream")
    path = f"{APP_NAME}/uploads/{user['user_id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    result = put_object(path, data, content_type)
    canonical = result["path"]
    await db.files.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "storage_path": canonical,
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": now_iso(),
    })
    return {"path": canonical}


@api.get("/files/{path:path}")
async def serve_file(path: str, request: Request, auth: Optional[str] = Query(None)):
    await _user_from_request_or_query(request, auth)
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="File tidak ditemukan")
    data, content_type = get_object(path)
    return Response(content=data, media_type=record.get("content_type", content_type))


@api.get("/")
async def root():
    return {"message": "ProFinance Interior API"}


@api.get("/categories")
async def categories():
    return {"income": INCOME_CATEGORIES, "expense": EXPENSE_CATEGORIES}


@api.post("/seed-demo")
async def seed_demo(user: dict = Depends(get_current_user)):
    existing = await db.projects.count_documents({"user_id": user["user_id"]})
    if existing > 0:
        raise HTTPException(status_code=400, detail="Data sudah ada, seed dilewati")

    def d(days_ago):
        return (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()

    thumbs = [
        "https://images.unsplash.com/photo-1633110187937-6e3b2f36dfca?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBsdXh1cnklMjBpbnRlcmlvciUyMGFyY2hpdGVjdHVyZSUyMGxpdmluZyUyMHJvb20lMjBraXRjaGVuJTIwb2ZmaWNlfGVufDB8fHx8MTc8OTgwMjMxN3ww&ixlib=rb-4.1.0&q=85",
        "https://images.pexels.com/photos/8089172/pexels-photo-8089172.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "https://images.unsplash.com/photo-1768321917661-d4f1a89d2185?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2MzR8MHwxfHNlYXJjaHwzfHxpbnRlcmlvciUyMGRlc2lnbiUyMGFyY2hpdGVjdHVyZSUyMGNvbnN0cnVjdGlvbiUyMHNpdGUlMjBmaW5pc2glMjByb29tfGVufDB8fHx8MTc4OTgwMjMxMHww&ixlib=rb-4.1.0&q=85",
    ]

    specs = [
        {
            "name": "Kitchen Set & Wall Panel Villa Canggu", "owner": "Bpk. Andika", "nominal": 285000000,
            "companyName": "Andika Family", "alamatProyek": "Canggu, Bali", "category": "Residensial",
            "start": 60, "end": -30, "thumb": 0,
            "tx": [
                ("in", 85000000, "Downpayment", "DP 30% kontrak", 58),
                ("in", 100000000, "Termin", "Termin 2 progress 50%", 30),
                ("out", 62000000, "Material", "HPL, plywood, hardware", 55),
                ("out", 18000000, "Material", "Granit & kaca backsplash", 40),
                ("out", 3200000, "Toll", "Ongkir & tol material", 38),
                ("out", 1500000, "Makan", "Konsumsi tukang mingguan", 20),
            ],
            "workers": [("Pak Slamet (Ketua)", 45000000), ("Tim Finishing HPL", 28000000)],
            "kasbon": [(0, 25000000), (1, 15000000)],
            "items": [("Pekerjaan Kabinet Bawah", 90000000, [(45, 100), (30, 100)]),
                      ("Wall Panel & Backdrop", 70000000, [(40, 60), (20, 85)]),
                      ("Finishing HPL & Hardware", 55000000, [(20, 40)])],
        },
        {
            "name": "Fitout Office Tower SCBD Lt.21", "owner": "PT Meridian Capital", "nominal": 620000000,
            "companyName": "PT Meridian Capital", "alamatProyek": "SCBD, Jakarta Selatan", "category": "Kantor",
            "start": 45, "end": -20, "thumb": 1,
            "tx": [
                ("in", 186000000, "Downpayment", "DP 30%", 44),
                ("in", 150000000, "Termin", "Termin partisi & plafon", 20),
                ("out", 210000000, "Material", "Partisi gypsum, kaca, plafon", 42),
                ("out", 45000000, "Material", "Karpet & vinyl flooring", 25),
                ("out", 4500000, "Bensin", "Operasional kendaraan", 18),
            ],
            "workers": [("Tim Partisi CV Jaya", 85000000), ("Tim Elektrikal", 42000000)],
            "kasbon": [(0, 40000000), (1, 20000000)],
            "items": [("Partisi & Dinding Gypsum", 220000000, [(40, 80), (20, 100)]),
                      ("Plafon & Pencahayaan", 150000000, [(30, 55)]),
                      ("Flooring Vinyl", 120000000, [(15, 30)])],
        },
        {
            "name": "Renovasi Rumah Cluster Bintaro", "owner": "Ibu Sari", "nominal": 140000000,
            "companyName": "-", "alamatProyek": "Bintaro Sektor 9", "category": "Residensial",
            "start": 30, "end": -15, "thumb": 2,
            "tx": [
                ("in", 42000000, "Downpayment", "DP awal", 28),
                ("out", 68000000, "Material", "Keramik, cat, plafon", 25),
                ("out", 12000000, "Material", "Pintu & kusen aluminium", 12),
                ("out", 900000, "Makan", "Konsumsi", 8),
            ],
            "workers": [("Pak Joko", 32000000)],
            "kasbon": [(0, 20000000)],
            "items": [("Pekerjaan Dinding & Cat", 55000000, [(25, 70)]),
                      ("Plafon & Listrik", 45000000, [(20, 40)])],
        },
    ]

    created = 0
    for spec in specs:
        pid = str(uuid.uuid4())
        await db.projects.insert_one({
            "id": pid, "user_id": user["user_id"], "name": spec["name"], "owner": spec["owner"],
            "nominal": spec["nominal"], "companyName": spec["companyName"], "alamatProyek": spec["alamatProyek"],
            "tanggalMulai": d(spec["start"]), "targetSelesai": d(spec["end"]), "category": spec["category"],
            "status": "Berjalan", "thumbnail": thumbs[spec["thumb"]], "createdAt": d(spec["start"]),
        })
        for typ, amt, cat, desc, days in spec["tx"]:
            await db.transactions.insert_one({
                "id": str(uuid.uuid4()), "project_id": pid, "type": typ, "amount": amt,
                "description": desc, "date": d(days), "category": cat, "receiptUrl": None, "createdAt": d(days),
            })
        workers = []
        for wname, boron in spec["workers"]:
            wid = str(uuid.uuid4())
            await db.workers.insert_one({"id": wid, "project_id": pid, "name": wname, "borongan": boron, "createdAt": d(spec["start"])})
            workers.append((wid, wname))
        for wi_idx, amt in spec["kasbon"]:
            wid, wname = workers[wi_idx]
            await db.transactions.insert_one({
                "id": str(uuid.uuid4()), "project_id": pid, "type": "out", "amount": amt,
                "description": f"Kasbon {wname}", "date": d(spec["start"] - 5),
                "category": f"Kasbon Tukang {wname}", "receiptUrl": None, "createdAt": d(spec["start"] - 5),
            })
        for iname, nilai, entries in spec["items"]:
            iid = str(uuid.uuid4())
            await db.work_items.insert_one({"id": iid, "project_id": pid, "name": iname, "nilai": nilai, "createdAt": d(spec["start"])})
            for days, prog in entries:
                await db.progress_entries.insert_one({
                    "id": str(uuid.uuid4()), "workItemId": iid, "date": d(days), "progress": prog,
                    "notes": f"Update lapangan progres {prog}%", "photoUrls": [], "createdAt": d(days),
                })
        created += 1

    return {"created": created}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown():
    auth_mod._client.close()
