# Astra CRM — Super Admin Mission Control Platform
## Complete System Architecture, Functional Specification & Operational Master Knowledge Base

> **Document Type:** Master System Architecture & Technical Specification Manual  
> **Application Name:** Astra CRM (Srinivas CRM — V1)  
> **Target Audience:** Developers, DevOps Engineers, System Architects, and AI Assistants (Gemini, ChatGPT, Claude)  
> **Source Specifications:** `block_1.pdf` (`b1.md`), `Block_2.pdf` (`b2.md`), `Block 3.pdf` (`b3.md`), `Block 4.pdf` (`b4.md`), `Block 2 Modification Specifications.pdf`, `updates.md`, `design_update.md`  
> **Production Live URL:** [https://prajwalskandas31-sudo.github.io/Astra-CRM/](https://prajwalskandas31-sudo.github.io/Astra-CRM/)  
> **Primary Technology Stack:** React 18.3, Vite 5.4, Tailwind CSS 3.4, Vanilla CSS Design System, Lucide React, SheetJS (XLSX), Python 3.12 (FastAPI Backend Gateway), In-Memory / LocalStorage State Engine

---

## 1. Executive Summary & System Overview

### 1.1 Purpose & Enterprise Domain
**Astra CRM** is an enterprise-grade Customer Relationship Management and sales governance platform engineered for high-velocity outbound calling, strict team hierarchy enforcement, multi-channel lead ingestion, deduplication, and automated compliance tracking.

The system addresses the operational bottlenecks of large distributed outbound sales and relationship management teams:
1. **Unregulated Lead Reassignment & Account Deletion:** Preventing orphaned leads when sales agents resign or are terminated through a **Mandatory Pre-Deletion Lead Reassignment Lock**.
2. **Lead Duplication & Data Contamination:** Enforcing a multi-tiered deduplication barrier comparing incoming bulk and single leads against a central master dataset before ingestion.
3. **Calling Pipeline Disorganization:** Standardizing post-call outcomes via Super Admin-configured dynamic dispositions, mandatory callback date/time flags, and customizable dashboard shortcut bars.
4. **Demand-Driven Lead Distribution:** Fulfilling inbound lead requests from executives and team leads via an **Auto-Disappearing Inbound Queue** based on language matching.
5. **Organizational Hierarchy & Scoped Visibility:** Enforcing strict data isolation and granular feature access control across a multi-tiered hierarchy:
   $$\text{Super Admin} \succ \text{Admin} \succ \text{Manager} \succ \text{Team Leader (TL)} \succ \text{Executive} \succ \text{Custom Roles}$$

---

## 2. High-Level System Architecture & Flow Diagrams

### 2.1 Layered Architecture Overview

```
+-----------------------------------------------------------------------------------+
|                            Astra CRM Presentation Layer                           |
|                       (React 18.3 + Vite SPA + Tailwind CSS)                      |
+-----------------------------------------------------------------------------------+
       |                     |                     |                     |
       v                     v                     v                     v
+--------------+      +--------------+      +--------------+      +--------------+
|   Block 1:   |      |   Block 2:   |      |   Block 3:   |      |   Block 4:   |
|     User     |      | Dispositions |      | Lead Ingest  |      | Super Admin  |
|  Hierarchy & |      |  & Pipeline  |      |   & Dedupe   |      | Lead Summary |
|  Role Master |      |   Manager    |      |    Module    |      |  Operations  |
+--------------+      +--------------+      +--------------+      +--------------+
       \                     |                     |                     /
        \                    |                     |                    /
         +-------------------+---------------------+-------------------+
                             |                     |
                             v                     v
              +-----------------------------------------------+
              |            Extended Feature Blocks            |
              | - Block 5: Lead Assignment History & Search   |
              | - Feature Access & Permissions Master Block   |
              | - Role Simulator Engine (Persona Switcher)    |
              | - Employee KYC Documents & Custom Fields      |
              | - IP Whitelisting & Location Restriction      |
              +-----------------------------------------------+
                                     |
                                     v
              +-----------------------------------------------+
              |              Central State Store              |
              |        `CRMContext.jsx` (Reactive State)      |
              |   LocalStorage Cache (`crm_storage_version`)  |
              +-----------------------------------------------+
                                     |
                      HTTP / REST (JSON API Protocol)
                                     v
              +-----------------------------------------------+
              |              Backend API Gateway              |
              |         Python FastAPI (Uvicorn :8000)        |
              |         Seed Database (`database.py`)         |
              +-----------------------------------------------+
```

---

### 2.2 Core Operational Flowcharts

#### A. Mandatory Pre-Deletion Lead Reassignment Protocol (Block 1)
```
[ Super Admin initiates Account Deletion for User ]
                         │
                         ▼
           [ Does User Hold Active Leads? ]
                  ├── NO  ──> Display Confirmation Modal ──> Delete User Account
                  └── YES
                         │
                         ▼
        [ HARD INTERLOCK: Account Deletion Blocked ]
                         │
                         ▼
        [ Display Lead Reassignment Wizard ]
        - Shows Total Active Lead Count
        - Shows Lead Details & Preview
        - Dropdown: Select Target Active User
                         │
                         ▼
        [ Super Admin Confirms Target User ]
                         │
                         ├── 1. Bulk Transfer all leads (`assignedToId`, `assignedToName`)
                         ├── 2. Append Audit Log to every lead ("Reassigned from X to Y")
                         ├── 3. Synchronize Assignment Batches & Performance Reports
                         └── 4. Execute Permanent Account Deletion
```

#### B. Lead Ingestion & Deduplication Pipeline (Block 3)
```
[ Upload Lead File (.xlsx / .csv) ]
                │
                ▼
  [ Verify Column Structure & Order ]
  Headers must be: 1. CONTACT NAME, 2. CONTACT NUMBER, 3. LANGUAGE
         ├── Mismatch ──> HALT IMMEDIATELY: Throw "Invalid File Format"
         └── Match
                │
                ▼
  [ Compare Records against Central Master Reference Database ]
         │
         ├── Number Not Found in Master ──> SUCCESSFUL LEAD
         │                                   ├── Save with disposition: "New Lead"
         │                                   └── Available for Language-Based Assignment
         │
         ├── Number Exists in Master ───> DUPLICATE LEAD
         │                                   ├── Automatically Merged / Deleted from batch
         │                                   └── Blocked from re-creation
         │
         └── Incomplete Record Data ─────> FAILED LEAD (Logged with failure reason)
                │
                ▼
  [ Render Batch Analytics: Bar & Pie Charts ]
  [ Generate 3 Downloadable Reports: Successful.csv, Duplicate.csv, Failed.csv ]
```

#### C. Inbound Lead Request Lifecycle (Block 4)
```
[ Executive / TL Submits Lead Request (Language + Desired Quantity) ]
                               │
                               ▼
        [ Request Added to Inbound Lead Requests Queue ]
        (Visible inside Super Admin Panel with Pending Status)
                               │
                               ▼
        [ Super Admin Reviews & Allocates Matching Leads ]
                               │
                               ▼
        [ AUTO-DISAPPEAR RULE ACTIVATED ]
        ├── Leads credited to Requester's active pipeline
        └── Request automatically marks complete and DISAPPEARS from active queue
```

---

## 3. Complete Repository Structure & File Map

```
Astra-CRM/
│
├── .agents/skills/                        # Agentic workflow skills (deploy-to-vercel, ponytail, etc.)
├── assets/                                # Static media & screenshot references
├── backend/                               # Python FastAPI Backend Service
│   ├── auth.py                            # Authentication, token generation, login route
│   ├── database.py                        # In-memory database & pre-seeded enterprise datasets
│   ├── main.py                            # FastAPI entrypoint, CORS setup, all REST endpoints
│   └── requirements.txt                   # FastAPI, Uvicorn, Pydantic, Python-Multipart
│
├── dist/                                  # Production bundle built via `npm run build`
├── public/                                # Static public web assets
├── src/
│   ├── components/                        # Modular React UI Views & Modals
│   │   ├── CRMDashboard.jsx               # Main agent workbench, calling controls, pipeline board
│   │   ├── CustomRolesBuilder.jsx         # Annexure-I Multi-level Custom Role Designer
│   │   ├── DispositionsManager.jsx        # Super Admin Dispositions & Pipeline Settings
│   │   ├── EmployeeDocumentsModal.jsx     # Employee KYC file upload & verification (10 slots)
│   │   ├── FeatureAccessBlock.jsx         # Super Admin granular capability permissions matrix
│   │   ├── LeadHistoryBlock.jsx           # Block 5 Lead assignment search & historical audit trail
│   │   ├── LeadReassignmentModal.jsx      # Pre-deletion mandatory reassignment wizard modal
│   │   ├── LeadReassignmentView.jsx       # Bulk cross-rep lead reassignment interface
│   │   ├── LeadSummarySuperAdmin.jsx      # Block 4 Inbound requests queue & instance tracker
│   │   ├── LeadUploadModule.jsx           # Block 3 Master record, bulk upload, single entry & reports
│   │   ├── LoginPage.jsx                  # Multi-persona secure authentication portal
│   │   ├── Navbar.jsx                     # Top bar, tab title, notifications, current user badge
│   │   ├── RoleSimulatorBanner.jsx        # Top banner for Super Admin to simulate lower roles
│   │   ├── SaleApprovalWorkflow.jsx       # Sale registration, verification queue & eKYC movement
│   │   ├── Sidebar.jsx                    # Permission-guarded primary navigation bar
│   │   ├── SystemSettings.jsx             # Theme builder, custom fields, document types, IP registry
│   │   ├── TeamMonitoring.jsx             # Teammate metrics (Sales, MITC compliance, call volume)
│   │   ├── ToastNotification.jsx          # Non-blocking glassmorphic notification toasts
│   │   ├── UserDirectory.jsx              # Employee table, active/inactive filters, account actions
│   │   ├── UserModal.jsx                  # Employee onboarding wizard with bank, KYC & custom fields
│   │   └── ui/                            # Atomic UI primitives
│   │
│   ├── context/
│   │   └── CRMContext.jsx                 # Central reactive state engine, local caching & actions
│   │
│   ├── App.jsx                            # Root layout, routing guards, tab switcher, ErrorBoundary
│   ├── globals.css                        # CSS utility classes
│   ├── index.css                          # Master design system, color tokens, animations, layouts
│   └── main.jsx                           # React 18 DOM mount point
│
├── b1.md                                  # Block 1 Technical Requirements breakdown
├── b2.md                                  # Block 2 Technical Requirements breakdown
├── b3.md                                  # Block 3 Technical Requirements breakdown
├── b4.md                                  # Block 4 Technical Requirements breakdown
├── block_1.pdf                            # Original Block 1 visual specification
├── Block_2.pdf                            # Original Block 2 visual specification
├── Block 2 Modification Specifications.pdf # Block 2 amendment specifications
├── Block 3.pdf                            # Original Block 3 visual specification
├── Block 4.pdf                            # Original Block 4 visual specification
├── updates.md                             # Changelog & verification audit log
├── design_update.md                       # Design polish & styling log
├── package.json                           # Dependencies & GitHub Pages deployment scripts
├── vite.config.js                         # Vite build configuration (base: '/Astra-CRM/')
└── COMPLETE_SYSTEM_DOCUMENTATION.md       # Complete AI-referable system reference manual (this file)
```

---

## 4. Comprehensive Breakdown of the 5 Functional Blocks

### 4.1 Block 1: User Management & Role Hierarchy (Role Master)

Derived from `block_1.pdf` and `b1.md`.

#### 1. User Creation & Field Specifications
Every employee profile in the CRM requires comprehensive organizational and compliance fields:
- **Core Identity:** User Name, Contact Number, Email Address, Password, Employee ID (Unique, e.g. `EMP-103`), Account Expiry Date.
- **Organizational Placement:** Role (Dropdown: Super Admin, Admin, Manager, Team Leader, Executive, Custom Roles), Reporting Person (Hierarchical parent user).
- **Executive Team Selection Rule:** When creating or editing a user with the **Executive** role, the system **mandates** assigning a specific Team Leader and/or Manager.
- **Banking & Payroll Information:** Bank Account Number, IFSC Code, Bank Name & Branch.
- **HR & Compliance References:** Family Reference Number, Referred By (Referrer name & employee ID).
- **Custom Profile Fields:** Dynamically defined by Super Admin (e.g. Emergency Contact Details, Past Employment History).
- **Employee KYC Document Slots:** Support for up to 10 customizable document types (Aadhaar Card, PAN Card, 10th Marks Card, Resume/CV, Graduation Certificate, etc.) with upload status, preview, and download.

#### 2. Role-Based Access Control (RBAC) Hierarchy
| Role | Authority & Access Scope |
| :--- | :--- |
| **Super Admin** | • Only role capable of creating employee IDs and permanently deleting accounts.<br>• Full system administrative privileges across all blocks.<br>• Controls Admin access ON/OFF toggle.<br>• Password management for any user.<br>• Final approval for sales before routing to eKYC stage.<br>• Creates and manages multi-level custom roles.<br>• Access to Block 4 Lead Summary Operations. |
| **Admin** | • High-level operations manager enabled directly by Super Admin.<br>• Manages users, dispositions, assignments, and sales approvals. |
| **Manager** | • Scoped organizational tree visibility.<br>• Monitors Team Leaders and Executives underneath them.<br>• Tracks sales conversions, call metrics, and MITC compliance. |
| **Team Leader (TL)** | • Scoped operational visibility.<br>• Monitors and assists Executives assigned directly under their team. |
| **Executive** | • Strict data isolation.<br>• Access restricted exclusively to their own assigned leads, calling workbench, and personal sales. |
| **Custom Roles** | • Multi-level custom tiers configured via Custom Roles Builder (Annexure-I). |

#### 3. Mandatory Pre-Deletion Lead Reassignment Protocol
To prevent data loss, the system incorporates a **Mandatory Lock**:
1. General users cannot delete accounts.
2. Only **Super Admin** can delete accounts.
3. If an account has **0 leads**, a clean confirmation modal confirms permanent deletion.
4. If an account holds **$\ge 1$ active leads**, the deletion request is intercepted. The Pre-Deletion Reassignment Wizard displays:
   - User Name & Employee ID.
   - Exact count of active leads held.
   - Preview list of affected customer contacts.
   - Target user selection dropdown (filtered to active eligible users).
5. Upon confirmation, all leads transfer seamlessly (`assignedToId`, `assignedToName`, `assignedToRole`), an audit entry is stamped on each lead, and the user account is purged.
6. The Super Admin cannot delete their own active account.

#### 4. Team Monitoring & Compliance
- Real-time team visibility tracking:
  - Total dials and call duration.
  - Conversion rates and completed sales.
  - **MITC Status (Most Important Terms & Conditions):** Regulatory compliance check indicating client acknowledged mandatory contractual terms.
  - Active lead stage breakdown across team members.

---

### 4.2 Block 2: Dispositions & Pipeline Management

Derived from `Block_2.pdf`, `b2.md`, and `Block 2 Modification Specifications.pdf`.

#### 1. Disposition Configuration (Settings Panel)
- **Authority:** Strictly configured and managed by the **Super Admin** under System Settings.
- **Default Dispositions Catalog:**
  1. `New Lead` (Default fresh lead state; color: blue)
  2. `Interested` (High purchase intent; color: emerald)
  3. `Call Back Later` (Requires Date & Time Picker; color: amber)
  4. `Give Demo Call` (Requires Date & Time Picker; color: purple)
  5. `Follow Up` (Requires Date & Time Picker; color: indigo)
  6. `Not Interested` (Client declined; color: rose)
  7. `Commitment` (Verbal commitment; color: cyan)
  8. `Paid / Converted` (Deal closed; color: emerald)
- **Mandatory Date/Time Flag (`requiresDateTimePicker`):** Dispositions such as *Call Back Later*, *Give Demo Call*, and *Follow Up* force the agent to select a specific date and time before saving.

#### 2. Dynamic Shortcut Buttons & Dashboard Integration
- Every disposition configured by the Super Admin automatically generates a corresponding shortcut button on the CRM calling dashboard.
- **Per-User Shortcut Personalization (`user_shortcut_settings`):** Each representative can configure which disposition shortcuts appear in their top quick-action bar to streamline repetitive logging.
- **Post-Call Disconnect Modal Workflow:** Immediately upon disconnecting a customer call, an outcome popup triggers prompting the agent to:
  - Click the relevant disposition shortcut button.
  - Select scheduled follow-up date and time if required by the disposition.
  - Add call notes and discussion summary.
  - Automatically advance to the next queued lead.

---

### 4.3 Block 3: Lead Upload Module (Ingestion & Reports)

Derived from `Block 3.pdf` and `b3.md`. Placed directly in the primary navigation sidebar as a standalone feature module.

#### 1. Sub-Block 1: Data Record Upload (Super Admin Only)
- **Purpose:** Ingests master datasets that act as the central reference database for system-wide duplicate prevention.
- **Supported Formats:** Excel (`.xlsx`, `.xls`) and CSV.
- **Strict Column Sequence Requirement:**
  1. `CONTACT NAME`
  2. `CONTACT NUMBER`
  3. `LANGUAGE`
- **Error Halting:** If headers are missing, misnamed, or out of sequence, the ingestion halts immediately with the exact system message:
  > `"Invalid File Format"`

#### 2. Sub-Block 2: Bulk Upload Option (Super Admin Only)
- Uploads large batches of prospect leads. Headers must strictly adhere to the 3-column format.
- **Automated Lead Deduplication Logic:**
  - **Successful Leads:** Contact numbers absent from the master database. Ingested with default disposition `"New Lead"`.
  - **Duplicate Leads:** Contact numbers already present in the master reference database. Detected, merged/deleted from the upload file, and prevented from entering the pipeline.
  - **Failed Leads:** Records with missing contact names, malformed phone numbers, or absent language tags.
- **Visual Analytics:** Interactive Bar & Pie charts displaying batch breakdown metrics.
- **Export Buttons:** Instant download of 3 segregated audit files:
  - `Successful_Leads.csv`
  - `Duplicate_Leads.csv`
  - `Failed_Leads.csv`
- **Language-Based Dynamic Allocation:** Super Admin selects a target language (e.g. Hindi, Telugu, English, Kannada) and allocates confirmed leads to active Executives/TLs in custom quotas.

#### 3. Sub-Block 3: Single Upload Option (All Roles Access)
- Accessible to Super Admin, Admin, Manager, Team Leader, and Executive.
- Input fields: Contact Name, Contact Number, Language.
- Evaluated against the central master database:
  - If new: Ingested into database with `"New Lead"` disposition.
  - If duplicate: Blocked immediately with exact warning:
    > `"Lead already exists, please contact Super Admin."`

#### 4. Sub-Block 4: Reports (Export & Download Feature)
- Instant PDF and CSV report export.
- **Super Admin View (Section 1):** Total count of unassigned leads in system, categorized language-wise.
- **User Level View (Section 2):** Total count of new leads assigned and currently present under each representative's disposition (aggregating entries with `"New Lead"` status in Block 2).

---

### 4.4 Block 4: Lead Summary — Super Admin Operations

Derived from `Block 4.pdf` and `b4.md`. Restricted exclusively to the Super Admin inside the Super Admin panel.

#### 1. Inbound Lead Requests Queue
- Displays inbound lead requests submitted by sales representatives and team leads.
- Displays Requesting User, Team, Requested Language, Quantity, Request Date, and Status (`Pending`, `Fulfilled`).
- **The Auto-Disappear Rule:** When the Super Admin allocates leads fulfilling an inbound request, the system marks the request fulfilled and it **immediately disappears** from the active inbound queue.

#### 2. Lead Assignment History & 5-Way Multi-Filtering
Super Admin can inspect past assignment files and filter leads using combined criteria:
1. **User Dropdown:** Filter by specific assigned representative.
2. **Date Lookup / Date Picker:** Filter leads assigned on a specific date or date range.
3. **Language Dropdown:** Filter by language tag.
4. **Teamwise Dropdown:** Filter by team/manager branch.
5. **User Disposition Dropdown:** Filter by agent-updated disposition status (*New Lead*, *Interested*, *Call Back Later*, *Paid*, etc.).
- **Adjustable View Density:** Pagination controls allowing `10`, `20`, `50`, `100`, `500`, or `1000` records per page.

#### 3. Instance Tracking Detail View
Clicking an assignment instance reveals:
- Total Leads Uploaded / Assigned in batch.
- Count of Dialed Leads (leads where a disposition or call was logged).
- Count of Uncontacted Leads Left (leads remaining in `"New Lead"` state).
- Detailed real-time count for every disposition stage.

#### 4. Batch & Granular Operations
- **File-Level Operations:** Reassign an entire batch to another representative; single or bulk deletion of batches.
- **Granular Lead Operations:** Checkbox selection of individual leads across tables; granular reassignment or permanent deletion.

---

### 4.5 Extended Feature Blocks (Block 5 & Governance)

#### 1. Block 5: Lead Assignment History (`LeadHistoryBlock.jsx`)
- Complete historical audit log and search bar across every lead ever ingested or assigned.
- Search by customer name, phone number, language, assignment date, current owner, or past owner.
- Full chronological event timeline tracking every transfer, disposition change, and call attempt.

#### 2. Feature Access & Permissions Master Block (`FeatureAccessBlock.jsx`)
- Super Admin master panel to grant or revoke specific CRM features for individual users, overriding default role baselines.
- Organizes 16 granular capabilities across 6 feature categories:
  1. **Core CRM & Pipeline:** Dashboard, Lead History, Disposition Shortcuts, Inbound Lead Requests.
  2. **User Directory & Team:** Directory, User Creation/Editing, Delete Users, Employee Documents.
  3. **Operations & Dispositions:** Dispositions Manager, Team Monitoring, Lead Reassignment.
  4. **Lead Ingestion & Reports:** Single Upload, Bulk File Upload, Ingestion Reports.
  5. **Sales & Approvals:** Sale Approvals Queue, Register New Sale.
  6. **Administration & Governance:** Lead Summary (Block 4), System Settings, Custom Roles Builder, Feature Access Control.

#### 3. Sale Approval & eKYC Workflow Queue (`SaleApprovalWorkflow.jsx`)
- Multi-stage sale verification pipeline:
  ```
  [ Executive registers Sale with Payment Proof ]
                        │
                        ▼
       [ Super Admin / Admin Approval Queue ]
            ├── Reject  ──> Flagged for revision with notes
            └── Approve ──> Moves to eKYC Stage (Compliance & Agreement generation)
  ```

#### 4. Role Simulator Engine (`RoleSimulatorBanner.jsx`)
- Top bar component allowing the Super Admin to preview and test the CRM through the eyes of any role (*Admin*, *Manager*, *Team Leader*, *Executive*) without logging out.

#### 5. Employee KYC Documents & Custom Fields
- Super Admin customizes up to 10 document types with mandatory flags.
- Upload modal supports PDF, PNG, JPG, and DOCX with document status badges (*Verified*, *Pending*, *Not Uploaded*).
- Dynamic custom field builder allowing two-level sub-field definitions (e.g. Field: "Emergency Contact" -> Subfields: "Contact Name", "Emergency Mobile").

#### 6. IP Whitelisting & Location Restriction Engine
- Automatically checks public IP via `api.ipify.org` / `api64.ipify.org`.
- Super Admin can bind users to approved static or office IP addresses (`crm_ip_registry`).
- Access from unapproved IPs triggers an authorization denial modal.

---

## 5. Data Models, State Engine & Schema Specifications

The system is managed through `CRMContext.jsx` with persistent browser caching and a Python FastAPI backend.

### 5.1 Primary Data Structures

#### 1. User Object (`users`)
```typescript
interface User {
  id: string;                     // e.g. "usr-1"
  name: string;                   // e.g. "Srinivas R"
  email: string;                  // e.g. "superadmin@company.com"
  mobile: string;                 // e.g. "+91 98765 43210"
  role: 'Super Admin' | 'Admin' | 'Manager' | 'Team Leader' | 'Executive' | string;
  password?: string;              // Authentication password
  status: 'Active' | 'Inactive';  // Account lifecycle state
  reportingTo: string;            // Parent manager / supervisor name
  expiryDate: string;             // Account validity (DD-MM-YYYY)
  employeeId: string;             // Corporate ID (e.g. "EMP-001")
  adminAccessEnabled?: boolean;   // Super Admin toggle for Admin authority
  bankAccountNumber?: string;     // Salary account number
  ifscCode?: string;              // Bank IFSC code
  bankNameAndBranch?: string;     // Branch details
  familyReferenceNumber?: string; // Emergency family contact
  referredBy?: string;            // Corporate sponsor / referrer
  customFieldValues?: Record<string, { sub1: string; sub2: string }>;
  uploadedDocuments?: Record<string, { fileName: string; uploadedAt: string; fileUrl: string; isVerified: boolean }>;
}
```

#### 2. Lead Object (`leads`)
```typescript
interface Lead {
  id: string;                     // e.g. "lead-1049"
  name: string;                   // Customer full name
  contactNumber: string;          // Customer phone number
  language: string;               // Language preference (Hindi, English, etc.)
  disposition: string;            // Current outcome stage (e.g. "New Lead")
  assignedToId: string;           // Currently assigned user ID
  assignedToName: string;         // Currently assigned user name
  assignedToRole: string;         // Representative role
  assignedDate: string;           // ISO timestamp of assignment
  followUpDateTime?: string;      // Scheduled callback date and time
  callNotes?: string;             // Historical agent notes
  callAttempts: number;           // Total outbound call attempts logged
  batchId?: string;               // Associated bulk upload batch ID
  auditHistory: Array<{
    timestamp: string;
    action: string;
    performedBy: string;
    details: string;
  }>;
}
```

#### 3. Master Record Object (`masterRecords`)
```typescript
interface MasterRecord {
  id: string;
  name: string;
  contactNumber: string;          // Indexed unique deduplication key
  language: string;
  uploadedAt: string;
  uploadedBy: string;
}
```

#### 4. Disposition Object (`dispositions`)
```typescript
interface Disposition {
  id: string;                     // e.g. "disp-1"
  name: string;                   // Display title
  requiresDateTimePicker: boolean;// True for Call Back, Demo, Follow Up
  color: 'blue' | 'emerald' | 'amber' | 'purple' | 'indigo' | 'rose' | 'cyan';
  isDefault: boolean;             // System baseline vs custom
  description?: string;
}
```

#### 5. Inbound Lead Request Object (`leadRequests`)
```typescript
interface LeadRequest {
  id: string;                     // e.g. "lreq-102"
  userId: string;                 // Requesting user ID
  userName: string;               // Requesting user name
  teamName: string;               // Associated team/manager
  language: string;               // Requested language
  requestedQuantity: number;      // Quantity of leads requested
  requestDate: string;            // Date requested
  status: 'Pending' | 'Fulfilled';
  fulfilledDate?: string;
}
```

#### 6. Assignment Instance Object (`assignmentInstances`)
```typescript
interface AssignmentInstance {
  id: string;                     // Batch ID (e.g. "inst-901")
  fileName: string;               // Source upload file name
  assignedToUserId: string;       // Recipient user ID
  assignedToUserName: string;     // Recipient name
  assignedDate: string;           // Date of batch allocation
  totalLeads: number;             // Total leads in batch
  language: string;               // Language tag
  leadIds: string[];              // Contained lead IDs
}
```

---

### 5.2 Local Storage Schema & Cache Keys

The reactive state engine caches state in browser `localStorage` using versioned keys:
- `crm_storage_version`: Schema migration key (`2026_09_29_v6_ip_restriction`). Bumping this key automatically clears stale mock leads and performs a clean factory reset.
- `crm_token`: Active session JWT / bearer authentication string.
- `crm_user`: Serialized profile of the currently logged-in user.
- `crm_users`: Array of all registered employees and administrators.
- `crm_leads`: Array of active and historical customer leads.
- `crm_dispositions`: Array of active pipeline dispositions.
- `crm_master_records`: Central reference deduplication records.
- `crm_assignment_instances`: Logged bulk assignment batches.
- `crm_lead_requests`: Inbound lead request backlog.
- `crm_user_permissions`: Granular feature overrides keyed by `userId`.
- `crm_user_shortcut_settings`: Per-user disposition shortcut button configurations.
- `crm_document_types`: Super Admin-defined employee KYC document slots.
- `crm_user_custom_fields`: Dynamic organizational custom fields.
- `crm_ip_registry`: IP whitelisting mapping table.

---

## 6. Backend API Gateway Specifications (FastAPI)

The backend service is located in `backend/main.py` and provides a REST API.

### 6.1 Authentication Endpoints (`/api/auth`)
- `POST /api/auth/login`: Authenticates user by mobile/email and password. Returns user object, assigned role, and JWT token.
- `POST /api/auth/verify-token`: Validates session validity and permissions.

### 6.2 User Endpoints (`/api/users`)
- `GET /api/users`: Returns list of all active/inactive users with role metadata.
- `POST /api/users`: Provisions new employee account.
- `PUT /api/users/{user_id}`: Updates employee profile, bank info, or status.
- `DELETE /api/users/{user_id}`: Permanently purges user account. Enforces lead reassignment lock if active leads are detected.
- `POST /api/users/reassign-leads`: Bulk transfers leads from one representative to another.

### 6.3 Dispositions Endpoints (`/api/dispositions`)
- `GET /api/dispositions`: Fetches configured pipeline dispositions and color badges.
- `POST /api/dispositions`: Super Admin creates new disposition with mandatory date/time flag.
- `PUT /api/dispositions/{id}`: Modifies disposition title or flags.
- `DELETE /api/dispositions/{id}`: Removes disposition from pipeline.

### 6.4 Lead Management Endpoints (`/api/leads`)
- `GET /api/leads`: Returns leads filtered by user ID, disposition, language, or search query.
- `POST /api/leads/single`: Adds a single lead after master deduplication check.
- `POST /api/leads/bulk-upload`: Receives spreadsheet file, performs deduplication, generates analytics, and returns segregated lists.
- `POST /api/leads/master-record`: Ingests master reference data for duplicate prevention.
- `POST /api/leads/{lead_id}/update-disposition`: Updates outcome stage, call notes, and follow-up time.

### 6.5 Sales & Approvals Endpoints (`/api/sales`)
- `GET /api/sales`: Retrieves sales queue for Super Admin / Admin verification.
- `POST /api/sales`: Registers customer sale with payment proof attachment.
- `POST /api/sales/{sale_id}/approve`: Moves sale to eKYC stage.
- `POST /api/sales/{sale_id}/reject`: Flags sale for revision.

---

## 7. Frontend User Interface & Design System

### 7.1 Modern Design Architecture (`index.css`)
The UI employs a custom design system with rich glassmorphic aesthetics:
- **Design Tokens:** Strict HSL CSS variables for light and dark modes:
  ```css
  --primary: #4f46e5;         /* Deep Indigo Accent */
  --primary-hover: #4338ca;
  --bg-main: #0b0f19;         /* High-contrast Command Slate */
  --bg-card: rgba(17, 24, 39, 0.85);
  --border-card: rgba(255, 255, 255, 0.08);
  --text-main: #f9fafb;
  --text-muted: #9ca3af;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  ```
- **Glassmorphism & Micro-Interactions:** Subtle card borders (`border-card`), backdrop blurs (`backdrop-filter: blur(12px)`), smooth CSS transitions on hover, and status glow indicators.
- **Dynamic Theming:** Built-in color theme switcher in System Settings allowing instant accent color customization (Indigo, Emerald, Violet, Rose, Cyan, Amber).

### 7.2 Core UI Views & Navigation Matrix
1. **`Navbar` (`Navbar.jsx`):** Dynamic tab title display, current user avatar, role badge, quick theme switcher, and logout trigger.
2. **`Sidebar` (`Sidebar.jsx`):** Collapsible primary navigation. Automatically hides restricted tabs using `hasPermission(tabId)`.
3. **`CRMDashboard` (`CRMDashboard.jsx`):** The primary agent workspace featuring:
   - Dynamic Disposition Shortcuts bar.
   - Lead Calling Table with Click-to-Call, WhatsApp trigger, and history viewer.
   - Post-Call Outcome Modal.
   - Pipeline Kanban Board with drag-and-drop stage movement.
4. **`UserDirectory` (`UserDirectory.jsx`):** Searchable corporate directory with Active/Inactive filters, Role filter, Add User wizard, and "Clear All Data" factory reset button.
5. **`LeadUploadModule` (`LeadUploadModule.jsx`):** Master upload interface with visual drop zones, real-time column header sequence verification, interactive Recharts graphs, and 3-button CSV export.
6. **`LeadSummarySuperAdmin` (`LeadSummarySuperAdmin.jsx`):** Super Admin command center for fulfilling inbound rep lead requests and managing assignment instances with 5-way filtering.
7. **`FeatureAccessBlock` (`FeatureAccessBlock.jsx`):** Interactive permissions matrix allowing checkbox toggles for every individual capability per user.
8. **`RoleSimulatorBanner` (`RoleSimulatorBanner.jsx`):** Top banner showing an active simulated persona with an instant reset button.

---

## 8. Deployment, Infrastructure & Developer Workflow

### 8.1 GitHub Pages Deployment (Production)
The frontend is hosted live on GitHub Pages:
- **Production URL:** [https://prajwalskandas31-sudo.github.io/Astra-CRM/](https://prajwalskandas31-sudo.github.io/Astra-CRM/)
- **Vite Configuration (`vite.config.js`):**
  ```javascript
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react';

  export default defineConfig({
    plugins: [react()],
    base: '/Astra-CRM/',
  });
  ```
- **Deployment Command:**
  ```powershell
  npm run deploy
  ```
  *(Executes `vite build` into `dist/`, then pushes to the `gh-pages` branch via `gh-pages -d dist`).*

---

### 8.2 Local Development Setup

#### 1. Frontend Development Server
```powershell
# Navigate to project root
cd "c:\Users\skand\OneDrive\Desktop\Personal Clients\Srinivas - CRM\Apps\CRM - V1 - AG"

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```
- Local URL: `http://localhost:5173/Astra-CRM/` (or `http://localhost:5173/`)

#### 2. Backend Development Server
```powershell
# Navigate to backend directory
cd "backend"

# Start FastAPI Uvicorn ASGI Server
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
- API Docs: `http://localhost:8000/docs`

---

### 8.3 Data Purge & Factory Reset Procedure
If you need to wipe all test data, dummy users, or leads and reset to a clean state:
1. **Via UI:** Log in as Super Admin -> Navigate to **User Directory** -> Click **Clear All Data** in the top action toolbar -> Confirm prompt.
2. **Via Code:** Open `src/context/CRMContext.jsx`, increment the `DATA_STORAGE_VERSION` constant (e.g. from `2026_09_29_v6_ip_restriction` to `2026_10_10_v1_clean`). The application will automatically purge `localStorage` and reinitialize with default baseline users on next browser refresh.

---

## 9. AI Knowledge Bank & Frequently Asked Questions (FAQ)

This section provides definitive guidance for AI assistants (Gemini, ChatGPT, Claude) when answering technical or operational questions about Astra CRM:

### Q1: What prevents lead loss when an employee resigns or is deleted?
**A:** The **Pre-Deletion Lead Reassignment Protocol** (Block 1). Account deletion is strictly blocked if the target user holds any active leads. The Super Admin must select an eligible active user in the reassignment wizard. All leads are transferred with full audit logs before the account deletion completes.

### Q2: What happens if an uploaded spreadsheet has columns `NAME`, `LANGUAGE`, `PHONE` instead of the expected format?
**A:** Ingestion is halted immediately. Both Data Record Upload and Bulk Upload strictly enforce the 3-column sequence: `1) CONTACT NAME, 2) CONTACT NUMBER, 3) LANGUAGE`. Any deviation triggers the exact error message: `"Invalid File Format"`.

### Q3: How does the system prevent lead duplicates across different upload batches?
**A:** The Super Admin uploads master records into the central reference database. Every bulk or single lead upload compares the incoming phone number against this master database. If a match is found:
- In Bulk Upload: The lead is detected as duplicate, merged/deleted from the upload, and omitted from the active pipeline.
- In Single Upload: The form blocks creation and shows `"Lead already exists, please contact Super Admin."`

### Q4: What is the "Auto-Disappear Rule" in Block 4?
**A:** When sales representatives submit an Inbound Lead Request for a specific language and quantity, it appears in the Super Admin's Lead Requests queue. Once the Super Admin allocates leads fulfilling that request, the request is marked completed and automatically disappears from the active queue.

### Q5: Can an Executive view other teammates' leads or performance metrics?
**A:** No. Under the RBAC rules, Executives have strict data isolation; they can only view their own assigned leads. Team Leaders can view Executives assigned under them, Managers can view their entire organizational branch, and Super Admins have global visibility.

### Q6: Can a custom role or individual user be granted access to features outside their default role baseline?
**A:** Yes. The **Feature Access & Permissions Master Block** (`FeatureAccessBlock.jsx`) allows the Super Admin to grant or revoke any of the 16 individual CRM capabilities for any specific user, regardless of their standard role.

### Q7: What is the purpose of the Role Simulator Banner?
**A:** It enables the Super Admin to preview and test the CRM interface from the perspective of an Admin, Manager, Team Leader, or Executive without logging out or altering actual database credentials.

---
