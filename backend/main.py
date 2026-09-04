import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

try:
    from backend.database import USERS_DB, DISPOSITIONS_DB, LEADS_DB, SALES_DB, CUSTOM_ROLES_DB
    from backend.auth import create_access_token, get_current_user, require_roles
except ImportError:
    from database import USERS_DB, DISPOSITIONS_DB, LEADS_DB, SALES_DB, CUSTOM_ROLES_DB
    from auth import create_access_token, get_current_user, require_roles


app = FastAPI(title="Srinivas CRM API", version="1.0.0")

# Enable CORS for Node.JS Vite Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Schemas
class LoginRequest(BaseModel):
    email: str
    password: str

class UserCreate(BaseModel):
    name: str
    mobile: str
    password: Optional[str] = "password123"
    role: str = "Executive"
    email: Optional[str] = ""
    reportingTo: Optional[str] = "Sreenivasulu"
    employeeId: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None
    reportingTo: Optional[str] = None

class PasswordChange(BaseModel):
    newPassword: str

class LeadReassignDelete(BaseModel):
    targetUserId: str

class DispositionCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    color: Optional[str] = "purple"

class LeadDispositionUpdate(BaseModel):
    dispositionName: str
    callNotes: Optional[str] = ""

class LeadReassignRequest(BaseModel):
    fromUserId: str
    toUserId: str

class SaleRegister(BaseModel):
    clientName: str
    amount: str
    employeeName: Optional[str] = None
    mitcStatus: Optional[str] = "Verified"
    complianceStatus: Optional[str] = "Compliant"

class CustomRoleCreate(BaseModel):
    roleName: str
    level: str = "Level 2"
    accessScope: str = "Departmental"

# Health Check
@app.get("/api/health")
def health_check():
    return {"status": "online", "system": "Srinivas CRM FastAPI Backend"}

# Authentication Routes
@app.post("/api/auth/login")
def login(req: LoginRequest):
    user = next((u for u in USERS_DB if u["email"].lower() == req.email.lower()), None)
    if not user or user["password"] != req.password:
        raise HTTPException(status_code=401, detail="Invalid email address or password")

    if user["status"] != "Active":
        raise HTTPException(status_code=403, detail="Account is disabled/inactive. Contact Super Admin.")

    token = create_access_token({"sub": user["id"], "role": user["role"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "mobile": user["mobile"],
            "employeeId": user["employeeId"],
            "reportingTo": user["reportingTo"]
        }
    }

@app.get("/api/auth/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# Users Directory Routes
@app.get("/api/users")
def get_users(status_filter: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    users = USERS_DB
    if status_filter and status_filter != "All":
        users = [u for u in users if u["status"] == status_filter]
    return users

@app.post("/api/users")
def create_user(req: UserCreate, current_user: dict = Depends(require_roles(["Super Admin"]))):
    # Rule check for Executive: must have reporting person selected
    if req.role == "Executive" and not req.reportingTo:
        raise HTTPException(status_code=400, detail="Executive Team Selection Rule: Reporting TL/Manager required.")

    new_user = {
        "id": f"usr-{int(datetime.utcnow().timestamp())}",
        "name": req.name,
        "mobile": req.mobile,
        "password": req.password,
        "role": req.role,
        "email": req.email,
        "reportingTo": req.reportingTo or "Sreenivasulu",
        "employeeId": req.employeeId or f"EMP-{len(USERS_DB) + 100}",
        "status": "Active",
        "expiryDate": "27-07-2027"
    }
    USERS_DB.insert(0, new_user)
    return new_user

@app.put("/api/users/{user_id}")
def update_user(user_id: str, req: UserUpdate, current_user: dict = Depends(get_current_user)):
    user = next((u for u in USERS_DB if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if req.name: user["name"] = req.name
    if req.mobile: user["mobile"] = req.mobile
    if req.role: user["role"] = req.role
    if req.email: user["email"] = req.email
    if req.reportingTo: user["reportingTo"] = req.reportingTo

    return user

@app.put("/api/users/{user_id}/toggle-status")
def toggle_user_status(user_id: str, current_user: dict = Depends(require_roles(["Super Admin", "Admin"]))):
    user = next((u for u in USERS_DB if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user["status"] = "Inactive" if user["status"] == "Active" else "Active"
    return user

@app.put("/api/users/{user_id}/password")
def change_user_password(user_id: str, req: PasswordChange, current_user: dict = Depends(require_roles(["Super Admin"]))):
    user = next((u for u in USERS_DB if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user["password"] = req.newPassword
    return {"message": f"Password updated for user {user['name']}"}

@app.post("/api/users/{user_id}/reassign-and-delete")
def delete_user_with_reassignment(user_id: str, req: LeadReassignDelete, current_user: dict = Depends(require_roles(["Super Admin"]))):
    user = next((u for u in USERS_DB if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    target_user = next((u for u in USERS_DB if u["id"] == req.targetUserId), None)
    if not target_user:
        raise HTTPException(status_code=400, detail="Target user for lead reassignment not found")

    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M")

    # Reassign all active leads
    reassigned_count = 0
    for lead in LEADS_DB:
        if lead["assignedToId"] == user_id:
            lead["assignedToId"] = target_user["id"]
            lead["assignedToName"] = target_user["name"]
            lead["history"].append({
                "date": now_str,
                "text": f"Pre-deletion lead reassigned to {target_user['name']} by Super Admin"
            })
            reassigned_count += 1

    # Remove user
    USERS_DB.remove(user)
    return {"message": f"Reassigned {reassigned_count} leads to {target_user['name']} and deleted user {user['name']}."}

# Dispositions & Pipeline Routes (Block 2)
@app.get("/api/dispositions")
def get_dispositions():
    return DISPOSITIONS_DB

@app.post("/api/dispositions")
def create_disposition(req: DispositionCreate, current_user: dict = Depends(require_roles(["Super Admin"]))):
    new_disp = {
        "id": f"disp-{int(datetime.utcnow().timestamp())}",
        "name": req.name,
        "description": req.description,
        "color": req.color,
        "isDefault": False
    }
    DISPOSITIONS_DB.append(new_disp)
    return new_disp

@app.put("/api/dispositions/{disp_id}")
def update_disposition(disp_id: str, req: DispositionCreate, current_user: dict = Depends(require_roles(["Super Admin"]))):
    disp = next((d for d in DISPOSITIONS_DB if d["id"] == disp_id), None)
    if not disp:
        raise HTTPException(status_code=404, detail="Disposition not found")

    disp["name"] = req.name
    disp["description"] = req.description
    disp["color"] = req.color
    return disp

@app.delete("/api/dispositions/{disp_id}")
def delete_disposition(disp_id: str, current_user: dict = Depends(require_roles(["Super Admin"]))):
    disp = next((d for d in DISPOSITIONS_DB if d["id"] == disp_id), None)
    if not disp:
        raise HTTPException(status_code=404, detail="Disposition not found")

    DISPOSITIONS_DB.remove(disp)
    return {"message": "Disposition deleted successfully"}

# Leads & Post-Call Workflow Routes
@app.get("/api/leads")
def get_leads(current_user: dict = Depends(get_current_user)):
    # Scoped lead visibility based on role
    if current_user["role"] == "Executive":
        return [l for l in LEADS_DB if l["assignedToId"] == current_user["id"] or l["assignedToName"] == current_user["name"]]
    elif current_user["role"] in ["Manager", "Team Leader"]:
        return LEADS_DB
    return LEADS_DB

@app.post("/api/leads/{lead_id}/disposition")
def update_lead_disposition(lead_id: str, req: LeadDispositionUpdate, current_user: dict = Depends(get_current_user)):
    lead = next((l for l in LEADS_DB if l["id"] == lead_id), None)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M")
    notes_str = f" (Notes: '{req.callNotes}')" if req.callNotes else ""
    lead["disposition"] = req.dispositionName
    lead["history"].append({
        "date": now_str,
        "text": f"Post-Call Disposition updated to [{req.dispositionName}] by {current_user['role']} {current_user['name']}{notes_str}"
    })
    return lead

@app.post("/api/leads/reassign")
def reassign_leads(req: LeadReassignRequest, current_user: dict = Depends(require_roles(["Super Admin", "Admin"]))):
    target_user = next((u for u in USERS_DB if u["id"] == req.toUserId), None)
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")

    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M")
    reassigned_count = 0

    for lead in LEADS_DB:
        if lead["assignedToId"] == req.fromUserId:
            lead["assignedToId"] = target_user["id"]
            lead["assignedToName"] = target_user["name"]
            lead["history"].append({
                "date": now_str,
                "text": f"Lead reassigned to {target_user['name']} by {current_user['name']}"
            })
            reassigned_count += 1

    return {"message": f"Reassigned {reassigned_count} leads to {target_user['name']}."}

# Sale Approval Workflow Routes
@app.get("/api/sales")
def get_sales(current_user: dict = Depends(get_current_user)):
    return SALES_DB

@app.post("/api/sales")
def submit_sale(req: SaleRegister, current_user: dict = Depends(get_current_user)):
    new_sale = {
        "id": f"sale-{int(datetime.utcnow().timestamp())}",
        "leadId": "ld-custom",
        "clientName": req.clientName,
        "amount": req.amount,
        "employeeId": current_user["id"],
        "employeeName": current_user["name"],
        "date": datetime.utcnow().strftime("%Y-%m-%d"),
        "status": "Pending Super Admin Approval",
        "mitcStatus": req.mitcStatus or "Verified",
        "complianceStatus": req.complianceStatus or "Compliant"
    }
    SALES_DB.insert(0, new_sale)
    return new_sale

@app.post("/api/sales/{sale_id}/approve")
def approve_sale(sale_id: str, current_user: dict = Depends(require_roles(["Super Admin"]))):
    sale = next((s for s in SALES_DB if s["id"] == sale_id), None)
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    sale["status"] = "Approved (Moved to eKYC)"
    sale["stage"] = "eKYC Verification"
    return sale

@app.post("/api/sales/{sale_id}/reject")
def reject_sale(sale_id: str, current_user: dict = Depends(require_roles(["Super Admin"]))):
    sale = next((s for s in SALES_DB if s["id"] == sale_id), None)
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    sale["status"] = "Rejected"
    return sale

# Custom Roles Routes
@app.get("/api/custom-roles")
def get_custom_roles():
    return CUSTOM_ROLES_DB

@app.post("/api/custom-roles")
def create_custom_role(req: CustomRoleCreate, current_user: dict = Depends(require_roles(["Super Admin"]))):
    new_role = {
        "id": f"crole-{int(datetime.utcnow().timestamp())}",
        "roleName": req.roleName,
        "level": req.level,
        "accessScope": req.accessScope
    }
    CUSTOM_ROLES_DB.append(new_role)
    return new_role
