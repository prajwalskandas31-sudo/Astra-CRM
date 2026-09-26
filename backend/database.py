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
    "adminAccessEnabled": True,
    "bankAccountNumber": "91234567890123",
    "ifscCode": "HDFC0000123",
    "bankNameAndBranch": "HDFC Bank, MG Road Branch",
    "familyReferenceNumber": "9876543219",
    "referredBy": "Board of Directors"
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
    "adminAccessEnabled": True,
    "bankAccountNumber": "91234567890124",
    "ifscCode": "SBIN0001452",
    "bankNameAndBranch": "State Bank of India, Indiranagar Branch",
    "familyReferenceNumber": "9876543220",
    "referredBy": "Sreenivasulu (EMP-001)"
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
    "expiryDate": "31-12-2028",
    "bankAccountNumber": "91234567890125",
    "ifscCode": "ICIC0000456",
    "bankNameAndBranch": "ICICI Bank, Koramangala Branch",
    "familyReferenceNumber": "9876543221",
    "referredBy": "Sreenivasulu (EMP-001)"
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
    "expiryDate": "31-12-2028",
    "bankAccountNumber": "91234567890126",
    "ifscCode": "UTIB0000789",
    "bankNameAndBranch": "Axis Bank, Whitefield Branch",
    "familyReferenceNumber": "9876543222",
    "referredBy": "Vikram Sharma (EMP-050)"
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
    "expiryDate": "27-07-2027",
    "bankAccountNumber": "91234567890127",
    "ifscCode": "HDFC0000456",
    "bankNameAndBranch": "HDFC Bank, HSR Layout Branch",
    "familyReferenceNumber": "9876543223",
    "referredBy": "Priya Nair (EMP-080)"
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
    "expiryDate": "27-07-2027",
    "bankAccountNumber": "91234567890128",
    "ifscCode": "KKBK0000987",
    "bankNameAndBranch": "Kotak Mahindra Bank, Jayanagar Branch",
    "familyReferenceNumber": "9876543224",
    "referredBy": "Priya Nair (EMP-080)"
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
    "expiryDate": "27-07-2027",
    "bankAccountNumber": "91234567890129",
    "ifscCode": "BARB0KORAMA",
    "bankNameAndBranch": "Bank of Baroda, Electronic City",
    "familyReferenceNumber": "9876543225",
    "referredBy": "Priya Nair (EMP-080)"
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

LEADS_DB = []

SALES_DB = []

CUSTOM_ROLES_DB = [
  { "id": "crole-1", "roleName": "Regional Manager", "level": "Level 2", "accessScope": "Region" },
  { "id": "crole-2", "roleName": "Compliance Specialist", "level": "Level 3", "accessScope": "Audit" }
]

LEAD_REQUESTS_DB = []

ASSIGNMENT_INSTANCES_DB = []

# Configured Employee Document Types (Super Admin custom definitions, max 10 slots)
DOCUMENT_TYPES_DB = [
  {"id": "doctype-1", "name": "Aadhar Card", "required": True, "description": "Government issued Aadhaar identification card"},
  {"id": "doctype-2", "name": "PAN Card", "required": True, "description": "Permanent Account Number card for taxation"},
  {"id": "doctype-3", "name": "10th Marks Card", "required": True, "description": "Secondary School Leaving Certificate / 10th standard marks memo"},
  {"id": "doctype-4", "name": "Resume / CV", "required": False, "description": "Updated professional resume or curriculum vitae"},
  {"id": "doctype-5", "name": "Graduation Certificate", "required": False, "description": "Degree convocation or provisional passing certificate"}
]

