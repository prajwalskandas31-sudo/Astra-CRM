import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { Upload, FileSpreadsheet, UserPlus, BarChart3, Download, CheckCircle, AlertTriangle, Tag, ShieldAlert } from 'lucide-react';

export const LeadUploadModule = () => {
  const { leads, addLead, addBulkLeads, simulatedRole, users } = useCRM();
  const { showToast } = useToast();

  const [activeSubBlock, setActiveSubBlock] = useState('single'); // 'master', 'bulk', 'single', 'report'

  // Master Data Record State (Super Admin)
  const [masterRecords, setMasterRecords] = useState([
    { contactPerson: 'Rohan Mehta', phone: '+91 91234 56789', language: 'Hindi' },
    { contactPerson: 'Kavita Rao', phone: '+91 91234 56790', language: 'English' },
    { contactPerson: 'Dr. Suresh Patil', phone: '+91 91234 56791', language: 'Marathi' }
  ]);

  // Single Upload Form
  const [singleForm, setSingleForm] = useState({
    contactPerson: '',
    phone: '',
    language: 'English',
    assignedToId: 'usr-5'
  });

  // Bulk Upload File Simulator
  const [bulkFileText, setBulkFileText] = useState('');
  const [uploadResult, setUploadResult] = useState(null);

  // Single Upload Handler
  const handleSingleSubmit = (e) => {
    e.preventDefault();
    if (!singleForm.contactPerson || !singleForm.phone) {
      showToast('Contact Name and Phone Number are required.', 'warning');
      return;
    }

    // Check duplicate against master database
    const isDuplicate = masterRecords.some(m => m.phone.replace(/\s+/g, '') === singleForm.phone.replace(/\s+/g, ''));
    if (isDuplicate) {
      showToast('Lead already exists, please contact Super Admin.', 'error');
      return;
    }

    const assignedUser = users.find(u => u.id === singleForm.assignedToId);

    // Save with default disposition 'New Lead'
    addLead({
      contactPerson: singleForm.contactPerson,
      phone: singleForm.phone,
      language: singleForm.language,
      assignedToId: singleForm.assignedToId,
      assignedToName: assignedUser?.name || 'Executive'
    });

    // Add to master records
    setMasterRecords(prev => [...prev, { contactPerson: singleForm.contactPerson, phone: singleForm.phone, language: singleForm.language }]);

    showToast(`Lead '${singleForm.contactPerson}' uploaded successfully with default disposition [New Lead].`, 'success');
    setSingleForm({ contactPerson: '', phone: '', language: 'English', assignedToId: 'usr-5' });
  };

  // Bulk Upload Handler
  const handleBulkUploadSubmit = (e) => {
    e.preventDefault();
    if (!bulkFileText.trim()) {
      showToast('Please paste Excel CSV dataset or select file.', 'warning');
      return;
    }

    const lines = bulkFileText.trim().split('\n');
    if (lines.length < 1) {
      showToast('Invalid File Format', 'error');
      return;
    }

    // Validate headers (Strict order requirement: CONTACT NAME, CONTACT NUMBER, LANGUAGE)
    const headerCols = lines[0].split(',').map(c => c.trim().toUpperCase());
    if (headerCols[0] !== 'CONTACT NAME' || headerCols[1] !== 'CONTACT NUMBER' || headerCols[2] !== 'LANGUAGE') {
      showToast('Invalid File Format', 'error');
      setUploadResult({ error: 'Invalid File Format: Headers must strictly be 1) CONTACT NAME, 2) CONTACT NUMBER, 3) LANGUAGE' });
      return;
    }

    const successful = [];
    const duplicates = [];
    const failed = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim());
      if (parts.length < 3 || !parts[0] || !parts[1]) {
        failed.push({ line: i, raw: lines[i], reason: 'Missing required columns' });
        continue;
      }

      const name = parts[0];
      const phone = parts[1];
      const lang = parts[2] || 'English';

      const isDup = masterRecords.some(m => m.phone.replace(/\s+/g, '') === phone.replace(/\s+/g, ''));
      if (isDup) {
        duplicates.push({ contactPerson: name, phone, language: lang });
      } else {
        successful.push({ contactPerson: name, phone, language: lang, assignedToId: 'usr-5', assignedToName: 'ABHINAYA M' });
      }
    }

    if (successful.length > 0) {
      addBulkLeads(successful);
      setMasterRecords(prev => [...prev, ...successful.map(s => ({ contactPerson: s.contactPerson, phone: s.phone, language: s.language }))]);
    }

    setUploadResult({
      successCount: successful.length,
      duplicateCount: duplicates.length,
      failedCount: failed.length,
      successful,
      duplicates,
      failed
    });

    showToast(`Bulk upload complete: ${successful.length} New Leads added with default status [New Lead].`, 'success');
  };

  // Report Metrics Calculation (Block 2 & Block 3 Sync)
  const newLeads = leads.filter(l => l.disposition === 'New Lead');
  const userLeadCounts = users.map(u => {
    const userNewLeads = leads.filter(l => (l.assignedToId === u.id || l.assignedToName === u.name) && l.disposition === 'New Lead');
    const userTotalLeads = leads.filter(l => l.assignedToId === u.id || l.assignedToName === u.name);
    return {
      user: u,
      newLeadCount: userNewLeads.length,
      totalLeadCount: userTotalLeads.length
    };
  });

  const handleDownloadPDFReport = () => {
    showToast('Generating and downloading Block 3 PDF Lead Report...', 'info');
    setTimeout(() => {
      showToast('Block 3 PDF Report downloaded successfully!', 'success');
    }, 1200);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Navigation Sub-Blocks Bar */}
      <div className="directory-card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Upload size={18} color="var(--accent-primary)" /> Lead Upload Module (Block 3 Standalone Feature)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Upload leads into system database. All successful uploads default to <strong>New Lead</strong> status in Block 2 pipeline.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {simulatedRole === 'Super Admin' && (
              <>
                <button
                  className={`btn-secondary ${activeSubBlock === 'master' ? 'active' : ''}`}
                  onClick={() => setActiveSubBlock('master')}
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                >
                  Data Record Upload
                </button>
                <button
                  className={`btn-secondary ${activeSubBlock === 'bulk' ? 'active' : ''}`}
                  onClick={() => setActiveSubBlock('bulk')}
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                >
                  <FileSpreadsheet size={13} /> Bulk Upload
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

            {simulatedRole === 'Super Admin' && (
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
      </div>

      {/* Sub-Block 1: Data Record Upload Option (Super Admin Only) */}
      {activeSubBlock === 'master' && simulatedRole === 'Super Admin' && (
        <div className="directory-card" style={{ padding: '20px 24px' }}>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileSpreadsheet size={16} color="var(--accent-primary)" /> Master Data Record Database (Super Admin)
          </h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Master reference database used for duplicate checking during single & bulk uploads. Must strictly follow column sequence: <strong>1) CONTACT NAME, 2) CONTACT NUMBER, 3) LANGUAGE</strong>.
          </p>

          <div className="table-responsive">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>CONTACT NAME</th>
                  <th>CONTACT NUMBER</th>
                  <th>LANGUAGE</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {masterRecords.map((m, idx) => (
                  <tr key={idx}>
                    <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{m.contactPerson}</td>
                    <td>{m.phone}</td>
                    <td><span className="badge" style={{ backgroundColor: 'var(--bg-input)' }}>{m.language}</span></td>
                    <td><span className="badge badge-active">Master Reference</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-Block 2: Bulk Upload Option (Super Admin Only) */}
      {activeSubBlock === 'bulk' && simulatedRole === 'Super Admin' && (
        <div className="directory-card" style={{ padding: '20px 24px' }}>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Upload size={16} color="var(--accent-primary)" /> Excel Bulk Upload Sub-Block
          </h4>
          <div className="alert-box alert-info" style={{ marginBottom: '16px' }}>
            <strong>Strict Order Requirement:</strong> Excel file headers must follow this exact sequence:
            <code style={{ marginLeft: '6px', background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>CONTACT NAME, CONTACT NUMBER, LANGUAGE</code>
          </div>

          <form onSubmit={handleBulkUploadSubmit}>
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label style={{ fontWeight: 600 }}>Paste CSV Data (or test sample):</label>
              <textarea
                rows={5}
                value={bulkFileText}
                onChange={(e) => setBulkFileText(e.target.value)}
                placeholder="CONTACT NAME, CONTACT NUMBER, LANGUAGE&#10;Sunil Varma, +91 98888 11111, Kannada&#10;Meera Sen, +91 98888 22222, Telugu&#10;Deepak Roy, +91 98888 33333, Hindi"
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn-primary">
                Process Excel Bulk Upload
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setBulkFileText("CONTACT NAME, CONTACT NUMBER, LANGUAGE\nSunil Varma, +91 98888 11111, Kannada\nMeera Sen, +91 98888 22222, Telugu\nDeepak Roy, +91 98888 33333, Hindi")}
              >
                Load Sample Data
              </button>
            </div>
          </form>

          {/* Results Summary */}
          {uploadResult && (
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              {uploadResult.error ? (
                <div className="alert-box alert-warning">
                  <AlertTriangle size={16} /> <strong>{uploadResult.error}</strong>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>SUCCESSFUL LEADS</span>
                    <h3 style={{ color: '#10b981', margin: '4px 0 0 0' }}>{uploadResult.successCount} New Leads</h3>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Disposition set to 'New Lead'</p>
                  </div>

                  <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600 }}>DUPLICATE LEADS</span>
                    <h3 style={{ color: '#f59e0b', margin: '4px 0 0 0' }}>{uploadResult.duplicateCount} Merged/Blocked</h3>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Matched master database</p>
                  </div>

                  <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>FAILED LEADS</span>
                    <h3 style={{ color: '#ef4444', margin: '4px 0 0 0' }}>{uploadResult.failedCount} Errors</h3>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Missing required row data</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sub-Block 3: Single Upload Option (All Users) */}
      {activeSubBlock === 'single' && (
        <div className="directory-card" style={{ padding: '20px 24px', maxWidth: '600px' }}>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <UserPlus size={16} color="var(--accent-primary)" /> Single Lead Upload Sub-Block (All Users Access)
          </h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            All users can upload individual leads. Automatically checked against master database and initialized with <strong>New Lead</strong> disposition.
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
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="Tamil">Tamil</option>
                <option value="Telugu">Telugu</option>
                <option value="Kannada">Kannada</option>
                <option value="Marathi">Marathi</option>
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

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Upload & Assign Lead (Default: New Lead)
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sub-Block 4: Reports (Export & Dynamic Counter Sync) */}
      {activeSubBlock === 'report' && (
        <div className="directory-card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h4 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BarChart3 size={16} color="var(--accent-primary)" /> Block 3 Report Sub-Block (Synced with Block 2)
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Dynamic counters aggregating all leads with <strong>New Lead</strong> status in Block 2 CURRENT DISPOSITION.
              </p>
            </div>

            <button className="btn-primary" onClick={handleDownloadPDFReport}>
              <Download size={15} /> Download PDF Report
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div style={{ padding: '14px 18px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Total System New Leads
              </span>
              <h2 style={{ color: '#3b82f6', margin: '6px 0 0 0', fontSize: '1.6rem' }}>{newLeads.length}</h2>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Current Disposition = 'New Lead'</span>
            </div>

            <div style={{ padding: '14px 18px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Total Active Pipeline Leads
              </span>
              <h2 style={{ color: 'var(--accent-primary)', margin: '6px 0 0 0', fontSize: '1.6rem' }}>{leads.length}</h2>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>All disposition stages</span>
            </div>
          </div>

          <h4 style={{ fontSize: '0.86rem', marginBottom: '10px', color: 'var(--text-secondary)' }}>
            User Level Breakdown - New Leads Count (Block 2 Integration):
          </h4>

          <div className="table-responsive">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>User Name</th>
                  <th>Role</th>
                  <th>New Leads Count ('New Lead' Disposition)</th>
                  <th>Total Assigned Leads</th>
                  <th>Pipeline Share</th>
                </tr>
              </thead>
              <tbody>
                {userLeadCounts.map((uc, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{uc.user.name}</td>
                    <td><span className="badge badge-role">{uc.user.role}</span></td>
                    <td>
                      <span className="badge" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontWeight: 700 }}>
                        <Tag size={11} /> {uc.newLeadCount} New Leads
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
      )}
    </div>
  );
};
