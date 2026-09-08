import React, { useState, useEffect } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { 
  Upload, 
  FileSpreadsheet, 
  UserPlus, 
  BarChart3, 
  Download, 
  CheckCircle, 
  AlertTriangle, 
  Tag, 
  ShieldAlert,
  PieChart,
  Filter,
  UserCheck,
  Search,
  FileText
} from 'lucide-react';

export const LeadUploadModule = () => {
  const { 
    leads, 
    addLead, 
    addBulkLeads, 
    simulatedRole, 
    users, 
    masterRecords, 
    addMasterRecords, 
    assignLeadsByLanguage 
  } = useCRM();
  
  const { showToast } = useToast();

  // Active sub-block state: 'master', 'bulk', 'single', 'report'
  const [activeSubBlock, setActiveSubBlock] = useState('single');

  // Enforce RBAC: Non-Super Admin roles strictly limited to Single Upload
  const isSuperAdmin = simulatedRole === 'Super Admin';
  
  useEffect(() => {
    if (!isSuperAdmin && activeSubBlock !== 'single') {
      setActiveSubBlock('single');
    }
  }, [simulatedRole, isSuperAdmin, activeSubBlock]);

  // --- 1. Data Record Upload State ---
  const [masterInputText, setMasterInputText] = useState('');
  const [masterSearch, setMasterSearch] = useState('');
  const [masterError, setMasterError] = useState('');

  // --- 2. Bulk Upload State ---
  const [bulkInputText, setBulkInputText] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [uploadResult, setUploadResult] = useState(null);

  // Dynamic Lead Assignment State (Block 1 Integration)
  const [assignLang, setAssignLang] = useState('Hindi');
  const [assignQty, setAssignQty] = useState('10');
  const [assignTargetUserId, setAssignTargetUserId] = useState(users.find(u => u.role === 'Executive')?.id || users[0]?.id || '');

  // --- 3. Single Upload Form State ---
  const [singleForm, setSingleForm] = useState({
    contactPerson: '',
    phone: '',
    language: 'English',
    assignedToId: users.find(u => u.role === 'Executive')?.id || users[0]?.id || ''
  });

  // ==========================================
  // HANDLER: Data Record Upload (Super Admin)
  // ==========================================
  const handleMasterUpload = (e) => {
    e.preventDefault();
    setMasterError('');

    if (!masterInputText.trim()) {
      showToast('Please paste CSV/Excel dataset or load sample data.', 'warning');
      return;
    }

    const lines = masterInputText.trim().split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 1) {
      setMasterError('Invalid File Format');
      showToast('Invalid File Format', 'error');
      return;
    }

    // Strict Order Validation: 1) CONTACT NAME, 2) CONTACT NUMBER, 3) LANGUAGE
    const headerCols = lines[0].split(',').map(c => c.trim().toUpperCase());
    if (headerCols.length < 3 || headerCols[0] !== 'CONTACT NAME' || headerCols[1] !== 'CONTACT NUMBER' || headerCols[2] !== 'LANGUAGE') {
      setMasterError('Invalid File Format: Headers must strictly follow 1) CONTACT NAME, 2) CONTACT NUMBER, 3) LANGUAGE');
      showToast('Invalid File Format', 'error');
      return;
    }

    const newRecords = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim());
      if (parts.length >= 2 && parts[0] && parts[1]) {
        newRecords.push({
          contactPerson: parts[0],
          phone: parts[1],
          language: parts[2] || 'English'
        });
      }
    }

    if (newRecords.length === 0) {
      setMasterError('Invalid File Format: No valid data rows found.');
      showToast('Invalid File Format', 'error');
      return;
    }

    addMasterRecords(newRecords);
    showToast(`Master Data Database updated with ${newRecords.length} reference records.`, 'success');
    setMasterInputText('');
  };

  // ==========================================
  // HANDLER: Bulk Upload (Super Admin)
  // ==========================================
  const handleBulkUploadSubmit = (e) => {
    e.preventDefault();
    setBulkError('');

    if (!bulkInputText.trim()) {
      showToast('Please paste CSV dataset or click Load Sample Data.', 'warning');
      return;
    }

    const lines = bulkInputText.trim().split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 1) {
      setBulkError('Invalid File Format');
      showToast('Invalid File Format', 'error');
      return;
    }

    // Strict Order Validation: 1) CONTACT NAME, 2) CONTACT NUMBER, 3) LANGUAGE
    const headerCols = lines[0].split(',').map(c => c.trim().toUpperCase());
    if (headerCols.length < 3 || headerCols[0] !== 'CONTACT NAME' || headerCols[1] !== 'CONTACT NUMBER' || headerCols[2] !== 'LANGUAGE') {
      setBulkError('Invalid File Format: Column order must strictly follow 1) CONTACT NAME, 2) CONTACT NUMBER, 3) LANGUAGE');
      showToast('Invalid File Format', 'error');
      return;
    }

    const successful = [];
    const duplicates = [];
    const failed = [];

    // Normalize phone helper for comparison
    const normPhone = (p) => p.replace(/[^0-9]/g, '');

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim());
      const name = parts[0];
      const phone = parts[1];
      const lang = parts[2];

      // Failed row check: missing individual row data
      if (!name || !phone || !lang) {
        failed.push({
          row: i,
          contactPerson: name || '[Missing Name]',
          phone: phone || '[Missing Phone]',
          language: lang || '[Missing Language]',
          reason: !name ? 'Missing CONTACT NAME' : !phone ? 'Missing CONTACT NUMBER' : 'Missing LANGUAGE'
        });
        continue;
      }

      // Duplicate check against central Master Data database & current leads
      const cleanP = normPhone(phone);
      const isDupInMaster = masterRecords.some(m => normPhone(m.phone) === cleanP);
      const isDupInLeads = leads.some(l => normPhone(l.phone) === cleanP);

      if (isDupInMaster || isDupInLeads) {
        duplicates.push({
          contactPerson: name,
          phone: phone,
          language: lang,
          reason: isDupInMaster ? 'Matched Master Data Record' : 'Matched Existing Lead'
        });
      } else {
        successful.push({
          contactPerson: name,
          phone: phone,
          language: lang,
          assignedToId: null, // Default unassigned for language-based assignment engine
          assignedToName: 'Unassigned'
        });
      }
    }

    // Process successful leads into database and update master database
    if (successful.length > 0) {
      addBulkLeads(successful);
      addMasterRecords(successful.map(s => ({ contactPerson: s.contactPerson, phone: s.phone, language: s.language })));
    }

    setUploadResult({
      successCount: successful.length,
      duplicateCount: duplicates.length,
      failedCount: failed.length,
      totalProcessed: lines.length - 1,
      successful,
      duplicates,
      failed
    });

    showToast(`Bulk Upload complete! ${successful.length} New Leads added with default disposition [New Lead].`, 'success');
  };

  // CSV Export Helper
  const downloadCSV = (filename, headers, rows) => {
    const csvContent = 'data:text/csv;charset=utf-8,' 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Downloaded ${filename}`, 'info');
  };

  // ==========================================
  // HANDLER: Single Upload Form (All Users)
  // ==========================================
  const handleSingleSubmit = (e) => {
    e.preventDefault();
    if (!singleForm.contactPerson || !singleForm.phone) {
      showToast('Contact Name and Contact Number are required.', 'warning');
      return;
    }

    const normPhone = (p) => p.replace(/[^0-9]/g, '');
    const cleanP = normPhone(singleForm.phone);

    // Duplicate check against central Master Data records
    const isDuplicate = masterRecords.some(m => normPhone(m.phone) === cleanP) || leads.some(l => normPhone(l.phone) === cleanP);
    if (isDuplicate) {
      showToast('Lead already exists, please contact Super Admin.', 'error');
      return;
    }

    const assignedUser = users.find(u => u.id === singleForm.assignedToId);

    // Add new lead with default status 'New Lead'
    addLead({
      contactPerson: singleForm.contactPerson,
      phone: singleForm.phone,
      language: singleForm.language,
      assignedToId: singleForm.assignedToId,
      assignedToName: assignedUser?.name || 'Executive'
    });

    // Sync into central master database
    addMasterRecords([{ contactPerson: singleForm.contactPerson, phone: singleForm.phone, language: singleForm.language }]);

    showToast(`Lead '${singleForm.contactPerson}' uploaded successfully with default disposition [New Lead].`, 'success');
    setSingleForm({
      contactPerson: '',
      phone: '',
      language: 'English',
      assignedToId: users.find(u => u.role === 'Executive')?.id || users[0]?.id || ''
    });
  };

  // ==========================================
  // HANDLER: Dynamic Lead Assignment by Language
  // ==========================================
  const handleAssignLeads = () => {
    const qty = parseInt(assignQty, 10);
    if (isNaN(qty) || qty <= 0) {
      showToast('Please enter a valid quantity of leads to assign.', 'warning');
      return;
    }

    const assigned = assignLeadsByLanguage(assignLang, qty, assignTargetUserId);
    const targetUser = users.find(u => u.id === assignTargetUserId);

    if (assigned > 0) {
      showToast(`Successfully assigned ${assigned} ${assignLang} leads to ${targetUser?.name} (${targetUser?.role})!`, 'success');
    } else {
      showToast(`No unassigned ${assignLang} leads available in the system.`, 'warning');
    }
  };

  // ==========================================
  // METRICS & REPORT CALCULATIONS (Block 2 & 3 Sync)
  // ==========================================
  const languagesList = ['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Marathi', 'Malayalam', 'Bengali'];

  // Super Admin View Section 1: Unassigned leads breakdown language-wise
  const unassignedLeads = leads.filter(l => l.isUnassigned || !l.assignedToId || l.assignedToName === 'Unassigned');
  const languageBreakdown = languagesList.map(lang => {
    const unassignedCount = unassignedLeads.filter(l => l.language?.toLowerCase() === lang.toLowerCase()).length;
    const totalCount = leads.filter(l => l.language?.toLowerCase() === lang.toLowerCase()).length;
    return { language: lang, unassignedCount, totalCount };
  });

  // User Level View Section 2: Count of 'New Lead' disposition per user from Block 2
  const userPerformanceList = users.map(u => {
    const userNewLeads = leads.filter(l => (l.assignedToId === u.id || l.assignedToName === u.name) && l.disposition === 'New Lead');
    const userTotalLeads = leads.filter(l => l.assignedToId === u.id || l.assignedToName === u.name);
    return {
      user: u,
      newLeadCount: userNewLeads.length,
      totalLeadCount: userTotalLeads.length
    };
  });

  // Instant PDF / Printable Report Export Handler
  const handleDownloadPDFReport = () => {
    const printWindow = window.open('', '_blank');
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Block 3 Lead Upload & Performance Report</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 40px; margin: 0; line-height: 1.5; }
          .header { border-bottom: 3px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
          .header h1 { margin: 0; color: #0f172a; font-size: 24px; }
          .header p { margin: 4px 0 0 0; color: #64748b; font-size: 13px; }
          .section { margin-bottom: 32px; }
          .section-title { font-size: 16px; font-weight: 700; color: #1e3a8a; border-left: 4px solid #3b82f6; padding-left: 10px; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
          th { background: #f1f5f9; color: #334155; text-align: left; padding: 10px; border-bottom: 2px solid #cbd5e1; font-weight: 600; }
          td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
          .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background: #e0f2fe; color: #0369a1; }
          .footer { font-size: 11px; color: #94a3b8; margin-top: 40px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>ASTRA CRM - BLOCK 3 REPORT</h1>
            <p>Lead Upload Module & Block 2 Disposition Performance Metrics</p>
          </div>
          <div style="text-align: right;">
            <p><strong>Generated:</strong> ${today}</p>
            <p><strong>Scope:</strong> Enterprise System Audit</p>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Page 1: Super Admin View - Unassigned Leads Language Breakdown</div>
          <p style="font-size: 13px; color: #475569;">Total Unassigned Leads in Central Database: <strong>${unassignedLeads.length}</strong></p>
          <table>
            <thead>
              <tr>
                <th>Language</th>
                <th>Unassigned Leads Count</th>
                <th>Total System Leads</th>
                <th>Language Share</th>
              </tr>
            </thead>
            <tbody>
              ${languageBreakdown.map(l => `
                <tr>
                  <td><strong>${l.language}</strong></td>
                  <td><span class="badge">${l.unassignedCount} Leads</span></td>
                  <td>${l.totalCount}</td>
                  <td>${leads.length > 0 ? ((l.totalCount / leads.length) * 100).toFixed(1) + '%' : '0%'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Page 2: User Level View - Block 2 Disposition Counter (New Lead Status)</div>
          <p style="font-size: 13px; color: #475569;">Aggregated count of active leads with <strong>"New Lead"</strong> status assigned under each user's disposition.</p>
          <table>
            <thead>
              <tr>
                <th>User Name</th>
                <th>Role</th>
                <th>"New Lead" Disposition Count</th>
                <th>Total Assigned Leads</th>
                <th>Workload Share</th>
              </tr>
            </thead>
            <tbody>
              ${userPerformanceList.map(u => `
                <tr>
                  <td><strong>${u.user.name}</strong></td>
                  <td>${u.user.role}</td>
                  <td><span class="badge" style="background: #dbeafe; color: #1d4ed8;">${u.newLeadCount} New Leads</span></td>
                  <td>${u.totalLeadCount}</td>
                  <td>${leads.length > 0 ? ((u.totalLeadCount / leads.length) * 100).toFixed(1) + '%' : '0%'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="footer">
          Report automatically compiled by Astra CRM Block 3 Module • Confidential & Proprietary
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    showToast('Block 3 PDF Report window opened for instant printing/download.', 'success');
  };

  const filteredMasterRecords = masterRecords.filter(m => 
    m.contactPerson.toLowerCase().includes(masterSearch.toLowerCase()) ||
    m.phone.includes(masterSearch) ||
    m.language.toLowerCase().includes(masterSearch.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header & Role Navigation Bar */}
      <div className="directory-card" style={{ padding: '16px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Upload size={18} color="var(--accent-primary)" /> Block 3: Lead Upload Module
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Standalone feature module for uploading master records, bulk leads, single entries, and Block 2 synced reports.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {isSuperAdmin && (
              <>
                <button
                  className={`btn-secondary ${activeSubBlock === 'master' ? 'active' : ''}`}
                  onClick={() => setActiveSubBlock('master')}
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                >
                  <FileSpreadsheet size={13} /> Data Record Upload
                </button>
                <button
                  className={`btn-secondary ${activeSubBlock === 'bulk' ? 'active' : ''}`}
                  onClick={() => setActiveSubBlock('bulk')}
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                >
                  <Upload size={13} /> Bulk Upload
                </button>
              </>
            )}

            <button
              className={`btn-secondary ${activeSubBlock === 'single' ? 'active' : ''}`}
              onClick={() => setActiveSubBlock('single')}
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
            >
              <UserPlus size={13} /> Single Upload
            </button>

            {isSuperAdmin && (
              <button
                className={`btn-secondary ${activeSubBlock === 'report' ? 'active' : ''}`}
                onClick={() => setActiveSubBlock('report')}
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              >
                <BarChart3 size={13} /> Report Sub-Block
              </button>
            )}
          </div>
        </div>

        {!isSuperAdmin && (
          <div className="alert-box alert-info" style={{ marginTop: '12px', fontSize: '0.78rem', padding: '8px 12px' }}>
            <ShieldAlert size={14} /> <strong>Role Scoping Active:</strong> As a <strong>{simulatedRole}</strong>, access is strictly limited to the <strong>Single Upload</strong> option per Block 3 specification.
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* SUB-BLOCK 1: DATA RECORD UPLOAD OPTION (SUPER ADMIN ONLY)    */}
      {/* ============================================================ */}
      {activeSubBlock === 'master' && isSuperAdmin && (
        <div className="directory-card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h4 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                <FileSpreadsheet size={16} color="var(--accent-primary)" /> Master Data Record Upload (Super Admin Central Database)
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Upload master datasets serving as central reference database for lead comparison.
              </p>
            </div>
            <span className="badge badge-active" style={{ fontSize: '0.78rem' }}>
              {masterRecords.length} Reference Records Active
            </span>
          </div>

          <div className="alert-box alert-warning" style={{ marginBottom: '16px' }}>
            <strong>Strict Order Requirement:</strong> Excel/CSV column sequence must strictly follow:
            <code style={{ marginLeft: '6px', background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
              1) CONTACT NAME, 2) CONTACT NUMBER, 3) LANGUAGE
            </code>
          </div>

          {masterError && (
            <div className="alert-box alert-warning" style={{ marginBottom: '16px', color: '#ef4444', borderColor: '#ef4444' }}>
              <AlertTriangle size={16} /> <strong>Error:</strong> {masterError}
            </div>
          )}

          <form onSubmit={handleMasterUpload} style={{ marginBottom: '24px' }}>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Paste Excel / CSV Master Dataset:</label>
              <textarea
                rows={4}
                value={masterInputText}
                onChange={(e) => setMasterInputText(e.target.value)}
                placeholder="CONTACT NAME, CONTACT NUMBER, LANGUAGE&#10;Vikramaditya Shah, +91 99000 11111, Hindi&#10;Deepika Sen, +91 99000 22222, English&#10;Ganesh Hedge, +91 99000 33333, Kannada"
                style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn-primary">
                Upload & Process Master Dataset
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setMasterInputText("CONTACT NAME, CONTACT NUMBER, LANGUAGE\nVikramaditya Shah, +91 99000 11111, Hindi\nDeepika Sen, +91 99000 22222, English\nGanesh Hedge, +91 99000 33333, Kannada\nSiddharth Malhotra, +91 99000 44444, Tamil")}
              >
                Load Sample Master Dataset
              </button>
            </div>
          </form>

          {/* Master Records Central Table */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: 0 }}>
              Central Reference Database Records ({filteredMasterRecords.length})
            </h4>
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search master database..."
                value={masterSearch}
                onChange={(e) => setMasterSearch(e.target.value)}
                style={{ paddingLeft: '30px', fontSize: '0.78rem', height: '32px' }}
              />
            </div>
          </div>

          <div className="table-responsive">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>CONTACT NAME</th>
                  <th>CONTACT NUMBER</th>
                  <th>LANGUAGE</th>
                  <th>Database Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredMasterRecords.map((m, idx) => (
                  <tr key={idx}>
                    <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{m.contactPerson}</td>
                    <td>{m.phone}</td>
                    <td><span className="badge" style={{ backgroundColor: 'var(--bg-input)' }}>{m.language}</span></td>
                    <td><span className="badge badge-active"><CheckCircle size={10} /> Central Reference</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-BLOCK 2: BULK UPLOAD OPTION (SUPER ADMIN ONLY)          */}
      {/* ============================================================ */}
      {activeSubBlock === 'bulk' && isSuperAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="directory-card" style={{ padding: '20px 24px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Upload size={16} color="var(--accent-primary)" /> Sub-Block 1: Bulk Upload Option (Super Admin)
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Bulk lead processing engine. Compares uploaded entries against master data record database. All new successful leads initialize with default status <strong>New Lead</strong>.
            </p>

            <div className="alert-box alert-info" style={{ marginBottom: '16px' }}>
              <strong>Strict Order Requirement:</strong> File headers must strictly follow exact order:
              <code style={{ marginLeft: '6px', background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                1) CONTACT NAME, 2) CONTACT NUMBER, 3) LANGUAGE
              </code>
            </div>

            {bulkError && (
              <div className="alert-box alert-warning" style={{ marginBottom: '16px', color: '#ef4444', borderColor: '#ef4444' }}>
                <AlertTriangle size={16} /> <strong>Upload Error:</strong> {bulkError}
              </div>
            )}

            <form onSubmit={handleBulkUploadSubmit}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Paste Excel / CSV Dataset:</label>
                <textarea
                  rows={5}
                  value={bulkInputText}
                  onChange={(e) => setBulkInputText(e.target.value)}
                  placeholder="CONTACT NAME, CONTACT NUMBER, LANGUAGE&#10;Sunil Varma, +91 98888 11111, Kannada&#10;Meera Sen, +91 98888 22222, Telugu&#10;Deepak Roy, +91 98888 33333, Hindi&#10;Rohan Mehta, +91 91234 56789, Hindi&#10;Incomplete Lead, , Tamil"
                  style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" className="btn-primary">
                  Process Bulk Upload Sheet
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setBulkInputText("CONTACT NAME, CONTACT NUMBER, LANGUAGE\nSunil Varma, +91 98888 11111, Kannada\nMeera Sen, +91 98888 22222, Telugu\nDeepak Roy, +91 98888 33333, Hindi\nRohan Mehta, +91 91234 56789, Hindi\nIncomplete Lead, , Tamil")}
                >
                  Load Sample Bulk Dataset
                </button>
              </div>
            </form>
          </div>

          {/* BULK UPLOAD ANALYTICS & EXPORT DASHBOARD */}
          {uploadResult && (
            <div className="directory-card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h4 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                    <BarChart3 size={16} color="var(--accent-primary)" /> Bulk Upload Analytics & Data Export Summary
                  </h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                    Categorized breakdown of processed records against central master records.
                  </p>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Total Rows Processed: <strong>{uploadResult.totalProcessed}</strong>
                </div>
              </div>

              {/* 3 Analytics Metric Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                <div style={{ padding: '14px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
                    SUCCESSFUL LEADS
                  </span>
                  <h2 style={{ color: '#10b981', margin: '4px 0 0 0', fontSize: '1.6rem' }}>{uploadResult.successCount}</h2>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Added with status 'New Lead'</p>
                </div>

                <div style={{ padding: '14px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.74rem', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase' }}>
                    DUPLICATE LEADS
                  </span>
                  <h2 style={{ color: '#f59e0b', margin: '4px 0 0 0', fontSize: '1.6rem' }}>{uploadResult.duplicateCount}</h2>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Merged/Deleted from upload</p>
                </div>

                <div style={{ padding: '14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.74rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>
                    FAILED LEADS
                  </span>
                  <h2 style={{ color: '#ef4444', margin: '4px 0 0 0', fontSize: '1.6rem' }}>{uploadResult.failedCount}</h2>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Missing required row data</p>
                </div>
              </div>

              {/* Visual SVG Bar Chart Representation */}
              <div style={{ background: 'var(--bg-input)', padding: '16px 20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
                <h5 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px', margin: '0 0 12px 0' }}>
                  Lead Validation Categorization Distribution
                </h5>

                {uploadResult.totalProcessed > 0 && (
                  <div style={{ display: 'flex', height: '24px', width: '100%', borderRadius: '6px', overflow: 'hidden', gap: '2px' }}>
                    <div 
                      style={{ 
                        width: `${(uploadResult.successCount / uploadResult.totalProcessed) * 100}%`, 
                        background: '#10b981', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: '0.7rem',
                        fontWeight: 700
                      }}
                      title={`Successful Leads: ${uploadResult.successCount}`}
                    >
                      {uploadResult.successCount > 0 && `${((uploadResult.successCount / uploadResult.totalProcessed) * 100).toFixed(0)}%`}
                    </div>
                    <div 
                      style={{ 
                        width: `${(uploadResult.duplicateCount / uploadResult.totalProcessed) * 100}%`, 
                        background: '#f59e0b', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: '0.7rem',
                        fontWeight: 700
                      }}
                      title={`Duplicate Leads: ${uploadResult.duplicateCount}`}
                    >
                      {uploadResult.duplicateCount > 0 && `${((uploadResult.duplicateCount / uploadResult.totalProcessed) * 100).toFixed(0)}%`}
                    </div>
                    <div 
                      style={{ 
                        width: `${(uploadResult.failedCount / uploadResult.totalProcessed) * 100}%`, 
                        background: '#ef4444', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: '0.7rem',
                        fontWeight: 700
                      }}
                      title={`Failed Leads: ${uploadResult.failedCount}`}
                    >
                      {uploadResult.failedCount > 0 && `${((uploadResult.failedCount / uploadResult.totalProcessed) * 100).toFixed(0)}%`}
                    </div>
                  </div>
                )}
              </div>

              {/* Single-Click Excel/CSV Export Buttons */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  className="btn-secondary"
                  disabled={uploadResult.successCount === 0}
                  onClick={() => downloadCSV(
                    'Successful_Leads.csv',
                    ['CONTACT NAME', 'CONTACT NUMBER', 'LANGUAGE', 'DISPOSITION'],
                    uploadResult.successful.map(s => [s.contactPerson, s.phone, s.language, 'New Lead'])
                  )}
                  style={{ fontSize: '0.8rem', color: uploadResult.successCount > 0 ? '#10b981' : 'inherit' }}
                >
                  <Download size={14} /> Download Successful Leads ({uploadResult.successCount})
                </button>

                <button
                  className="btn-secondary"
                  disabled={uploadResult.duplicateCount === 0}
                  onClick={() => downloadCSV(
                    'Duplicate_Leads.csv',
                    ['CONTACT NAME', 'CONTACT NUMBER', 'LANGUAGE', 'REASON'],
                    uploadResult.duplicates.map(d => [d.contactPerson, d.phone, d.language, d.reason])
                  )}
                  style={{ fontSize: '0.8rem', color: uploadResult.duplicateCount > 0 ? '#f59e0b' : 'inherit' }}
                >
                  <Download size={14} /> Download Duplicate Leads ({uploadResult.duplicateCount})
                </button>

                <button
                  className="btn-secondary"
                  disabled={uploadResult.failedCount === 0}
                  onClick={() => downloadCSV(
                    'Failed_Leads.csv',
                    ['ROW', 'CONTACT NAME', 'CONTACT NUMBER', 'LANGUAGE', 'FAILURE REASON'],
                    uploadResult.failed.map(f => [f.row, f.contactPerson, f.phone, f.language, f.reason])
                  )}
                  style={{ fontSize: '0.8rem', color: uploadResult.failedCount > 0 ? '#ef4444' : 'inherit' }}
                >
                  <Download size={14} /> Download Failed Leads ({uploadResult.failedCount})
                </button>
              </div>
            </div>
          )}

          {/* DYNAMIC LEAD ASSIGNMENT ENGINE BY LANGUAGE (BLOCK 1 INTEGRATION) */}
          <div className="directory-card" style={{ padding: '20px 24px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <UserCheck size={16} color="var(--accent-primary)" /> Language-Based Lead Assignment Engine (Block 1 Routing)
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Super Admin can filter confirmed unassigned leads by language and assign custom quantities directly to Executives or Team Leads created in Block 1.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', alignItems: 'end' }}>
              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '0.82rem' }}>Filter by Language:</label>
                <select value={assignLang} onChange={(e) => setAssignLang(e.target.value)}>
                  {languagesList.map(lang => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '0.82rem' }}>Assign Quantity:</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={assignQty}
                  onChange={(e) => setAssignQty(e.target.value)}
                  placeholder="e.g. 10"
                />
              </div>

              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '0.82rem' }}>Assign To User (Block 1 Hierarchy):</label>
                <select value={assignTargetUserId} onChange={(e) => setAssignTargetUserId(e.target.value)}>
                  {users.filter(u => u.status === 'Active').map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role}) - {u.reportingTo ? `Reports to: ${u.reportingTo}` : 'Top Level'}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <button type="button" className="btn-primary" onClick={handleAssignLeads} style={{ width: '100%', justifyContent: 'center' }}>
                  Assign Confirmed Leads
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-BLOCK 3: SINGLE UPLOAD OPTION (ALL USERS ACCESS)        */}
      {/* ============================================================ */}
      {activeSubBlock === 'single' && (
        <div className="directory-card" style={{ padding: '20px 24px', maxWidth: '640px' }}>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <UserPlus size={16} color="var(--accent-primary)" /> Sub-Block 2: Single Lead Upload Option (All Users)
          </h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Upload an individual lead entry. Entries are automatically checked against the central master data database and initialized with <strong>New Lead</strong> status.
          </p>

          <form onSubmit={handleSingleSubmit} className="form-grid">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontWeight: 600 }}>CONTACT NAME *</label>
              <input
                type="text"
                value={singleForm.contactPerson}
                onChange={(e) => setSingleForm({ ...singleForm, contactPerson: e.target.value })}
                placeholder="e.g. Ramesh Chandra"
                required
              />
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 600 }}>CONTACT NUMBER *</label>
              <input
                type="text"
                value={singleForm.phone}
                onChange={(e) => setSingleForm({ ...singleForm, phone: e.target.value })}
                placeholder="e.g. +91 99887 76655"
                required
              />
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 600 }}>LANGUAGE *</label>
              <select
                value={singleForm.language}
                onChange={(e) => setSingleForm({ ...singleForm, language: e.target.value })}
              >
                {languagesList.map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontWeight: 600 }}>Assign To User</label>
              <select
                value={singleForm.assignedToId}
                onChange={(e) => setSingleForm({ ...singleForm, assignedToId: e.target.value })}
              >
                {users.filter(u => u.status === 'Active').map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Upload Single Lead (Default Status: New Lead)
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-BLOCK 4: REPORT SUB-BLOCK (SUPER ADMIN & BLOCK 2 SYNC)  */}
      {/* ============================================================ */}
      {activeSubBlock === 'report' && isSuperAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="directory-card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <h4 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                  <BarChart3 size={16} color="var(--accent-primary)" /> Sub-Block 3: Lead Upload Reports & Block 2 Sync
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Central analytics dashboard aggregating unassigned leads by language and user-level <strong>New Lead</strong> status.
                </p>
              </div>

              <button className="btn-primary" onClick={handleDownloadPDFReport}>
                <Download size={15} /> Download PDF Report
              </button>
            </div>

            {/* Overview Summary Badges */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div style={{ padding: '14px 18px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Total Unassigned Leads
                </span>
                <h2 style={{ color: '#3b82f6', margin: '6px 0 0 0', fontSize: '1.6rem' }}>{unassignedLeads.length}</h2>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ready for Language Assignment</span>
              </div>

              <div style={{ padding: '14px 18px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Total System 'New Lead' Status
                </span>
                <h2 style={{ color: 'var(--accent-primary)', margin: '6px 0 0 0', fontSize: '1.6rem' }}>
                  {leads.filter(l => l.disposition === 'New Lead').length}
                </h2>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Block 2 Current Disposition Column</span>
              </div>

              <div style={{ padding: '14px 18px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Master Database Reference Records
                </span>
                <h2 style={{ color: '#10b981', margin: '6px 0 0 0', fontSize: '1.6rem' }}>{masterRecords.length}</h2>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Central duplicate prevention pool</span>
              </div>
            </div>
          </div>

          {/* PAGE / SECTION 1: SUPER ADMIN VIEW - UNASSIGNED LEADS BY LANGUAGE */}
          <div className="directory-card" style={{ padding: '20px 24px' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>
              Super Admin View (Page / Section 1): Unassigned Leads Language Breakdown
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Categorized breakdown of unassigned leads based on the <code>LANGUAGE</code> column from uploaded Excel sheets.
            </p>

            <div className="table-responsive">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Language</th>
                    <th>Unassigned Leads Count</th>
                    <th>Total Leads in Language</th>
                    <th>Share of Total Database</th>
                  </tr>
                </thead>
                <tbody>
                  {languageBreakdown.map((lb, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{lb.language}</td>
                      <td>
                        <span className="badge" style={{ backgroundColor: lb.unassignedCount > 0 ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)', color: lb.unassignedCount > 0 ? '#3b82f6' : 'var(--text-muted)', fontWeight: 700 }}>
                          <Tag size={11} /> {lb.unassignedCount} Unassigned
                        </span>
                      </td>
                      <td>{lb.totalCount} Leads</td>
                      <td>
                        {leads.length > 0 ? ((lb.totalCount / leads.length) * 100).toFixed(1) + '%' : '0%'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* PAGE / SECTION 2: USER LEVEL VIEW - INTEGRATION WITH BLOCK 2 DISPOSITION */}
          <div className="directory-card" style={{ padding: '20px 24px' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>
              User Level View - Integration with Block 2 (Page / Section 2): New Lead Disposition Counter
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Aggregated count of active leads with <strong>"New Lead"</strong> status within the Block 2 CURRENT DISPOSITION section for every user.
            </p>

            <div className="table-responsive">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>User Name</th>
                    <th>Role</th>
                    <th>"New Lead" Disposition Count (Block 2)</th>
                    <th>Total Assigned Leads</th>
                    <th>User Pipeline Share</th>
                  </tr>
                </thead>
                <tbody>
                  {userPerformanceList.map((uc, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{uc.user.name}</td>
                      <td><span className="badge badge-role">{uc.user.role}</span></td>
                      <td>
                        <span className="badge" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontWeight: 700 }}>
                          <FileText size={11} /> {uc.newLeadCount} New Leads
                        </span>
                      </td>
                      <td>{uc.totalLeadCount}</td>
                      <td>
                        {leads.length > 0 ? ((uc.totalLeadCount / leads.length) * 100).toFixed(1) + '%' : '0%'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default LeadUploadModule;
