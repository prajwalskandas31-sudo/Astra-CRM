# Seed Data Store & In-Memory DB for Srinivas CRM

USERS_DB = [
  {
    "id": "usr-1",
    "name": "Sreenivasulu",
    "mobile": "9876543210",
    "email": "superadmin@company.com",
    "password": "admin123",
    "role": "Super Admin",
    "reportingTo": "Board of Directors",
    "employeeId": "EMP-001",
    "status": "Active",
    "expiryDate": "31-12-2030",
    "canCreateEmployees": True,
    "adminAccessEnabled": True
  },
  {
    "id": "usr-11",
    "name": "Ramesh Chandra",
    "mobile": "9876543211",
    "email": "admin@company.com",
    "password": "admin123",
    "role": "Admin",
    "reportingTo": "Sreenivasulu",
    "employeeId": "EMP-002",
    "status": "Active",
    "expiryDate": "31-12-2030",
    "canCreateEmployees": False,
    "adminAccessEnabled": True
  },
  {
    "id": "usr-9",
    "name": "Vikram Sharma",
    "mobile": "9845011223",
    "email": "vikram.manager@company.com",
    "password": "manager123",
    "role": "Manager",
    "reportingTo": "Sreenivasulu",
    "employeeId": "EMP-050",
    "status": "Active",
    "expiryDate": "31-12-2028"
  },
  {
    "id": "usr-10",
    "name": "Priya Nair",
    "mobile": "9741238901",
    "email": "priya.tl@company.com",
    "password": "tl123",
    "role": "Team Leader",
    "reportingTo": "Vikram Sharma",
    "employeeId": "EMP-080",
    "status": "Active",
    "expiryDate": "31-12-2028"
  },
  {
    "id": "usr-3",
    "name": "AJAY",
    "mobile": "9390616049",
    "email": "tajayvarma76@gmail.com",
    "password": "executive123",
    "role": "Executive",
    "reportingTo": "Priya Nair",
    "employeeId": "EMP-103",
    "status": "Active",
    "expiryDate": "27-07-2027"
  },
  {
    "id": "usr-2",
    "name": "ABHINAYA M",
    "mobile": "7331113490",
    "email": "abhinaya.m@company.com",
    "password": "executive123",
    "role": "Executive",
    "reportingTo": "Priya Nair",
    "employeeId": "EMP-102",
    "status": "Active",
    "expiryDate": "27-07-2027"
  },
  {
    "id": "usr-4",
    "name": "AKSHATA",
    "mobile": "9035997607",
    "email": "akshu337@gmail.com",
    "password": "executive123",
    "role": "Executive",
    "reportingTo": "Priya Nair",
    "employeeId": "EMP-104",
    "status": "Active",
    "expiryDate": "27-07-2027"
  },
  {
    "id": "usr-5",
    "name": "ANITHA",
    "mobile": "7022183964",
    "email": "anithaani4336@gmail.com",
    "password": "executive123",
    "role": "Executive",
    "reportingTo": "Priya Nair",
    "employeeId": "EMP-105",
    "status": "Active",
    "expiryDate": "27-07-2027"
  },
  {
    "id": "usr-6",
    "name": "ANITHA Y",
    "mobile": "7989176099",
    "email": "anitha.y@company.com",
    "password": "executive123",
    "role": "Executive",
    "reportingTo": "Sreenivasulu",
    "employeeId": "EMP-106",
    "status": "Active",
    "expiryDate": "27-07-2027"
  },
  {
    "id": "usr-7",
    "name": "ANKITHA",
    "mobile": "8867232331",
    "email": "ankithaankitha934@gmail.com",
    "password": "executive123",
    "role": "Executive",
    "reportingTo": "Sreenivasulu",
    "employeeId": "EMP-107",
    "status": "Active",
    "expiryDate": "27-07-2027"
  },
  {
    "id": "usr-8",
    "name": "ANURADHA N",
    "mobile": "9916109653",
    "email": "anuradha.n@company.com",
    "password": "executive123",
    "role": "Executive",
    "reportingTo": "Sreenivasulu",
    "employeeId": "EMP-108",
    "status": "Active",
    "expiryDate": "27-07-2027"
  }
]

DISPOSITIONS_DB = [
  { "id": "disp-1", "name": "New Lead", "color": "cyan", "isDefault": True, "description": "Fresh lead added to pipeline" },
  { "id": "disp-2", "name": "Call Back Later", "color": "amber", "isDefault": True, "description": "Client requested follow-up call" },
  { "id": "disp-3", "name": "Give Demo Call", "color": "purple", "isDefault": True, "description": "Scheduled product demo walk-through" },
  { "id": "disp-4", "name": "Interested", "color": "emerald", "isDefault": True, "description": "High purchase intent expressed" },
  { "id": "disp-5", "name": "Follow Up", "color": "blue", "isDefault": True, "description": "Regular check-in required" },
  { "id": "disp-6", "name": "Not Interested", "color": "rose", "isDefault": True, "description": "Lead declined offer" },
  { "id": "disp-7", "name": "Commitment", "color": "purple", "isDefault": True, "description": "Verbal commitment received" },
  { "id": "disp-8", "name": "Paid / Converted", "color": "emerald", "isDefault": True, "description": "Payment complete / closed deal" }
]

LEADS_DB = [
  {
    "id": "ld-101",
    "clientName": "Apex Tech Solutions",
    "contactPerson": "Rohan Mehta",
    "phone": "9123456780",
    "assignedToId": "usr-3",  # AJAY
    "assignedToName": "AJAY",
    "value": "₹4,50,000",
    "disposition": "Give Demo Call",
    "status": "Negotiation",
    "history": [
      { "date": "2026-08-01 10:00", "text": "Lead created by Sreenivasulu" },
      { "date": "2026-08-02 11:30", "text": "Assigned to Executive AJAY" },
      { "date": "2026-08-15 14:00", "text": "Disposition updated to: Give Demo Call" }
    ]
  },
  {
    "id": "ld-102",
    "clientName": "Global Logistics Corp",
    "contactPerson": "Siddharth Rao",
    "phone": "9887766554",
    "assignedToId": "usr-4",  # AKSHATA
    "assignedToName": "AKSHATA",
    "value": "₹12,00,000",
    "disposition": "Interested",
    "status": "Sale Submitted",
    "history": [
      { "date": "2026-08-05 09:15", "text": "Lead created by Sreenivasulu" },
      { "date": "2026-08-06 14:20", "text": "Assigned to Executive AKSHATA" },
      { "date": "2026-08-18 16:30", "text": "Disposition updated to: Interested" }
    ]
  },
  {
    "id": "ld-103",
    "clientName": "Horizon Enterprises",
    "contactPerson": "Kavita Sundaram",
    "phone": "9900112233",
    "assignedToId": "usr-5",  # ANITHA
    "assignedToName": "ANITHA",
    "value": "₹7,80,000",
    "disposition": "Call Back Later",
    "status": "Proposal Sent",
    "history": [
      { "date": "2026-08-10 16:45", "text": "Assigned to Executive ANITHA" },
      { "date": "2026-08-19 11:00", "text": "Disposition updated to: Call Back Later (Client requested 4 PM callback)" }
    ]
  },
  {
    "id": "ld-104",
    "clientName": "Zenith Retail Chain",
    "contactPerson": "Manish Verma",
    "phone": "9811223344",
    "assignedToId": "usr-2",  # ABHINAYA M
    "assignedToName": "ABHINAYA M",
    "value": "₹3,20,000",
    "disposition": "New Lead",
    "status": "New",
    "history": [
      { "date": "2026-08-20 09:00", "text": "Lead created and assigned to ABHINAYA M" }
    ]
  }
]

SALES_DB = [
  {
    "id": "sale-201",
    "leadId": "ld-102",
    "clientName": "Global Logistics Corp",
    "amount": "₹12,00,000",
    "employeeId": "usr-4",
    "employeeName": "AKSHATA",
    "date": "2026-08-20",
    "status": "Pending Super Admin Approval",
    "mitcStatus": "Verified",
    "complianceStatus": "Compliant"
  }
]

CUSTOM_ROLES_DB = [
  { "id": "crole-1", "roleName": "Regional Manager", "level": "Level 2", "accessScope": "Region" },
  { "id": "crole-2", "roleName": "Compliance Specialist", "level": "Level 3", "accessScope": "Audit" }
]
