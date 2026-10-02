import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { 
  X, 
  UserPlus, 
  Users, 
  AlertCircle, 
  Landmark, 
  FileSpreadsheet, 
  UploadCloud, 
  Download, 
  FileText, 
  CheckCircle2, 
  Trash2, 
  Eye, 
  EyeOff, 
  AlertTriangle,
  Plus
} from 'lucide-react';
import * as XLSX from 'xlsx';

// Helper to parse CSV lines handling quoted values with commas
const parseCSVLine = (line) => {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur.trim());
  return result;
};

// Check if a line appears to be a header row
const isHeaderRow = (parts) => {
  if (!parts || parts.length === 0) return false;
  const p0 = (parts[0] || '').toLowerCase().replace(/[^a-z]/g, '');
  const p1 = (parts[1] || '').toLowerCase().replace(/[^a-z]/g, '');
  return (
    p0.includes('name') &&
    (p1.includes('contact') || p1.includes('mobile') || p1.includes('phone') || p1.includes('number') || p1 === '')
  );
};

export const UserModal = ({ isOpen, onClose, userToEdit = null }) => {
  const { users, customRoles, documentTypes = [], addUser, updateUser } = useCRM();
  const { showToast } = useToast();

  const [mode, setMode] = useState('single');
  const [formData, setFormData] = useState({
    name: userToEdit ? userToEdit.name : '',
    mobile: userToEdit ? userToEdit.mobile : '',
    password: '',
    role: userToEdit ? userToEdit.role : 'Executive',
    email: userToEdit ? userToEdit.email : '',
    reportingTo: userToEdit ? userToEdit.reportingTo : '',
    employeeId: userToEdit ? userToEdit.employeeId : '',
    bankAccountNumber: userToEdit ? (userToEdit.bankAccountNumber || '') : '',
    ifscCode: userToEdit ? (userToEdit.ifscCode || '') : '',
    bankNameAndBranch: userToEdit ? (userToEdit.bankNameAndBranch || '') : '',
    familyReferenceNumber: userToEdit ? (userToEdit.familyReferenceNumber || '') : '',
    referredBy: userToEdit ? (userToEdit.referredBy || '') : ''
  });

  // Attached Documents State (Direct upload on user creation/edit)
  const [attachedDocs, setAttachedDocs] = useState([]);
  const [selectedDocTypeId, setSelectedDocTypeId] = useState('');
  const [docFileToUpload, setDocFileToUpload] = useState(null);
  const [isAttachingDoc, setIsAttachingDoc] = useState(false);
  const docFileInputRef = useRef(null);

  // Bulk Upload State
  const [bulkText, setBulkText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedFileSize, setUploadedFileSize] = useState('');
  const [fileError, setFileError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      if (userToEdit) {
        setFormData({
          name: userToEdit.name || '',
          mobile: userToEdit.mobile || '',
          password: '',
          role: userToEdit.role || 'Executive',
          email: userToEdit.email || '',
          reportingTo: userToEdit.reportingTo || '',
          employeeId: userToEdit.employeeId || '',
          bankAccountNumber: userToEdit.bankAccountNumber || '',
          ifscCode: userToEdit.ifscCode || '',
          bankNameAndBranch: userToEdit.bankNameAndBranch || '',
          familyReferenceNumber: userToEdit.familyReferenceNumber || '',
          referredBy: userToEdit.referredBy || ''
        });
        setAttachedDocs(userToEdit.documents ? [...userToEdit.documents] : []);
      } else {
        setFormData({
          name: '',
          mobile: '',
          password: '',
          role: 'Executive',
          email: '',
          reportingTo: '',
          employeeId: '',
          bankAccountNumber: '',
          ifscCode: '',
          bankNameAndBranch: '',
          familyReferenceNumber: '',
          referredBy: ''
        });
        setAttachedDocs([]);
        setBulkText('');
        setUploadedFileName('');
        setUploadedFileSize('');
        setFileError('');
        setShowPreview(false);
      }
      setSelectedDocTypeId(documentTypes[0]?.id || '');
      setDocFileToUpload(null);
      if (docFileInputRef.current) docFileInputRef.current.value = '';
    }
  }, [isOpen, userToEdit, documentTypes]);

  useEffect(() => {
    if (documentTypes.length > 0 && !selectedDocTypeId) {
      setSelectedDocTypeId(documentTypes[0].id);
    }
  }, [documentTypes, selectedDocTypeId]);

  const handleAttachDocument = (e) => {
    if (e) e.preventDefault();
    if (!docFileToUpload) {
      showToast('Please select a document file to attach.', 'warning');
      return;
    }
    const docType = documentTypes.find(dt => dt.id === selectedDocTypeId) || { name: 'Document', id: selectedDocTypeId };
    setIsAttachingDoc(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const fileData = event.target.result;
      const sizeStr = (docFileToUpload.size / 1024).toFixed(0) + ' KB';
      const newDoc = {
        id: 'doc-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        documentTypeId: docType.id || selectedDocTypeId || 'doc-custom',
        documentName: docType.name || 'Document',
        fileName: docFileToUpload.name,
        fileType: docFileToUpload.type,
        fileSize: sizeStr,
        fileData: fileData,
        uploadedAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
      };

      setAttachedDocs(prev => {
        const existingIdx = prev.findIndex(d => d.documentTypeId === newDoc.documentTypeId);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = newDoc;
          return updated;
        }
        return [...prev, newDoc];
      });

      setDocFileToUpload(null);
      if (docFileInputRef.current) docFileInputRef.current.value = '';
      setIsAttachingDoc(false);
      showToast(`Document '${docType.name}' attached.`, 'success');
    };
    reader.onerror = () => {
      setIsAttachingDoc(false);
      showToast('Failed to read document file.', 'error');
    };
    reader.readAsDataURL(docFileToUpload);
  };

  const handleRemoveAttachedDoc = (docId) => {
    setAttachedDocs(prev => prev.filter(d => d.id !== docId));
    showToast('Attached document removed.', 'info');
  };

  const managementUsers = useMemo(() => {
    return users.filter(u => 
      ['Super Admin', 'Admin', 'Manager', 'Team Leader', 'Team Lead'].includes(u.role) &&
      (!userToEdit || u.id !== userToEdit.id)
    );
  }, [users, userToEdit]);

  const dedicatedManagers = useMemo(() => {
    return users.filter(u => 
      u.role === 'Manager' &&
      (!userToEdit || u.id !== userToEdit.id)
    );
  }, [users, userToEdit]);

  const seniorLeadership = useMemo(() => {
    return users.filter(u => 
      ['Admin', 'Super Admin'].includes(u.role) &&
      (!userToEdit || u.id !== userToEdit.id)
    );
  }, [users, userToEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'role') {
      setFormData(prev => ({
        ...prev,
        role: value,
        reportingTo: ''
      }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Parse bulkText into user objects with real-time feedback
  const parsedRecords = useMemo(() => {
    if (!bulkText.trim()) return [];
    const lines = bulkText.split(/\r?\n/).filter(l => l.trim().length > 0);
    const records = [];
    lines.forEach((line, index) => {
      const parts = parseCSVLine(line);
      if (index === 0 && isHeaderRow(parts)) {
        return; // skip header row
      }
      if (parts[0] && parts[1]) {
        records.push({
          name: parts[0],
          mobile: parts[1],
          email: parts[2] || '',
          role: parts[3] || 'Executive',
          reportingTo: parts[4] || 'Sreenivasulu',
          employeeId: parts[5] || '',
          bankAccountNumber: parts[6] || '',
          ifscCode: parts[7] || '',
          bankNameAndBranch: parts[8] || '',
          familyReferenceNumber: parts[9] || '',
          referredBy: parts[10] || ''
        });
      }
    });
    return records;
  }, [bulkText]);

  // Check if first line in textarea looks like a header
  const hasDetectedHeader = useMemo(() => {
    if (!bulkText.trim()) return false;
    const lines = bulkText.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return false;
    const firstLineParts = parseCSVLine(lines[0]);
    return isHeaderRow(firstLineParts);
  }, [bulkText]);

  // Read Excel (.xlsx, .xls) or CSV file and convert to CSV formatted text
  const handleFileUpload = (file) => {
    if (!file) return;
    setFileError('');

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValid) {
      setFileError('Invalid file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.');
      showToast('Please select a valid Excel or CSV file.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          setFileError('The uploaded workbook contains no readable sheets.');
          return;
        }
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert sheet directly to CSV format text
        const csvContent = XLSX.utils.sheet_to_csv(worksheet, { blankrows: false });
        
        if (!csvContent || !csvContent.trim()) {
          setFileError('The uploaded sheet contains no data.');
          showToast('Uploaded spreadsheet is empty.', 'warning');
          return;
        }

        const trimmedCsv = csvContent.trim();
        setBulkText(trimmedCsv);
        setUploadedFileName(file.name);
        setUploadedFileSize((file.size / 1024).toFixed(1) + ' KB');

        const lines = trimmedCsv.split(/\r?\n/).filter(l => l.trim().length > 0);
        showToast(`Successfully read ${lines.length} lines from "${file.name}" into CSV format.`, 'success');
      } catch (err) {
        console.error('Error reading Excel file:', err);
        setFileError('Failed to parse Excel file. Please ensure it is a valid spreadsheet.');
        showToast('Error reading Excel file.', 'error');
      }
    };
    reader.onerror = () => {
      setFileError('Failed to read the file.');
      showToast('File read error.', 'error');
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleClearUploadedFile = () => {
    setUploadedFileName('');
    setUploadedFileSize('');
    setBulkText('');
    setFileError('');
    setShowPreview(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Generate & download Excel Template (.xlsx)
  const handleDownloadTemplate = () => {
    try {
      const templateData = [
        {
          'Name': 'ABHINAYA M',
          'Contact Number': '+91 98765 43214',
          'Email': 'abhinaya@company.com',
          'Role': 'Executive',
          'Reporting To': 'Priya Nair',
          'Employee ID': 'EXEC-301',
          'Bank Account Number': '91234567890127',
          'IFSC Code': 'HDFC0000456',
          'Bank Name and Branch': 'HDFC Bank, HSR Layout Branch',
          'Family Reference Number': '+91 98765 43223',
          'Referred By': 'Priya Nair (TL-201)'
        },
        {
          'Name': 'AJAY',
          'Contact Number': '+91 98765 43215',
          'Email': 'ajay@company.com',
          'Role': 'Executive',
          'Reporting To': 'Priya Nair',
          'Employee ID': 'EXEC-302',
          'Bank Account Number': '91234567890128',
          'IFSC Code': 'KKBK0000987',
          'Bank Name and Branch': 'Kotak Mahindra Bank, Jayanagar Branch',
          'Family Reference Number': '+91 98765 43224',
          'Referred By': 'Priya Nair (TL-201)'
        },
        {
          'Name': 'RAHUL SHARMA',
          'Contact Number': '+91 98765 43230',
          'Email': 'rahul.s@company.com',
          'Role': 'Executive',
          'Reporting To': 'Priya Nair',
          'Employee ID': 'EXEC-306',
          'Bank Account Number': '91234567890132',
          'IFSC Code': 'SBIN0004521',
          'Bank Name and Branch': 'State Bank of India, Koramangala',
          'Family Reference Number': '+91 98765 43228',
          'Referred By': 'Rajesh Kumar (EMP-002)'
        }
      ];

      const ws = XLSX.utils.json_to_sheet(templateData);
      ws['!cols'] = [
        { wch: 18 },
        { wch: 18 },
        { wch: 25 },
        { wch: 14 },
        { wch: 18 },
        { wch: 14 },
        { wch: 22 },
        { wch: 14 },
        { wch: 32 },
        { wch: 24 },
        { wch: 24 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Bulk_Users_Template');
      XLSX.writeFile(wb, 'Bulk_Users_Upload_Template.xlsx');
      showToast('Excel template downloaded successfully.', 'info');
    } catch (err) {
      console.error('Template download error:', err);
      showToast('Failed to download template.', 'error');
    }
  };

  // Populate sample CSV data
  const handleLoadSampleCSV = () => {
    const sample = `Name, Contact Number, Email, Role, Reporting To, Employee ID, Bank Account Number, IFSC Code, Bank Name and Branch, Family Reference Number, Referred By
ABHINAYA M, +91 98765 43214, abhinaya@company.com, Executive, Priya Nair, EXEC-301, 91234567890127, HDFC0000456, "HDFC Bank, HSR Layout Branch", +91 98765 43223, Priya Nair (TL-201)
AJAY, +91 98765 43215, ajay@company.com, Executive, Priya Nair, EXEC-302, 91234567890128, KKBK0000987, "Kotak Mahindra Bank, Jayanagar Branch", +91 98765 43224, Priya Nair (TL-201)
RAHUL SHARMA, +91 98765 43230, rahul.s@company.com, Executive, Priya Nair, EXEC-306, 91234567890132, SBIN0004521, "State Bank of India, Koramangala", +91 98765 43228, Rajesh Kumar (EMP-002)`;
    setBulkText(sample);
    setUploadedFileName('sample_bulk_users.csv');
    setUploadedFileSize('0.4 KB');
    setFileError('');
    showToast('Sample user records loaded into CSV format.', 'info');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === 'single') {
      if (!formData.name || !formData.mobile) {
        showToast('Please provide User Name and Contact Number.', 'warning');
        return;
      }

      if (formData.role === 'Executive' && !formData.reportingTo) {
        showToast('Executive assignment rule: Please select a Reporting Team Leader or Manager.', 'warning');
        return;
      }

      if (['Team Leader', 'Team Lead'].includes(formData.role) && !formData.reportingTo) {
        showToast('Team Leader assignment rule: Please select a Reporting Manager.', 'warning');
        return;
      }

      if (userToEdit) {
        updateUser(userToEdit.id, {
          ...formData,
          documents: attachedDocs
        });
        showToast(`User '${formData.name}' details updated.`, 'success');
      } else {
        const cleanName = (formData.name || 'User').trim();
        const autoEmail = formData.email && formData.email.trim() 
          ? formData.email.trim() 
          : `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}@company.com`;
        const autoPass = formData.password || '123456';
        
        addUser({
          ...formData,
          name: cleanName,
          email: autoEmail,
          password: autoPass,
          documents: attachedDocs
        });
        showToast(`User '${cleanName}' created successfully. Login with Name (${cleanName}), Email (${autoEmail}), or Mobile!`, 'success');
      }
    } else {
      if (parsedRecords.length === 0) {
        showToast('Please upload an Excel file or provide valid user records in CSV format.', 'warning');
        return;
      }

      parsedRecords.forEach(userRecord => {
        addUser(userRecord);
      });

      showToast(`Successfully imported ${parsedRecords.length} users.`, 'success');
      setBulkText('');
      setUploadedFileName('');
      setUploadedFileSize('');
      setShowPreview(false);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: mode === 'bulk' ? '740px' : '640px', 
          maxHeight: '92vh', 
          display: 'flex', 
          flexDirection: 'column',
          transition: 'max-width 0.25s ease'
        }}
      >
        <div className="modal-header">
          <h3>{userToEdit ? 'Edit User Details' : (mode === 'single' ? 'Add User' : 'Bulk User Import')}</h3>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {!userToEdit && (
          <div style={{ padding: '10px 20px', background: 'var(--bg-table-head)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '10px', flexShrink: 0 }}>
            <button
              type="button"
              className={`btn-secondary ${mode === 'single' ? 'active' : ''}`}
              style={{ flex: 1, justifyContent: 'center', borderColor: mode === 'single' ? 'var(--accent-primary)' : 'var(--border-color)' }}
              onClick={() => setMode('single')}
            >
              <UserPlus size={15} /> Single User Creation
            </button>
            <button
              type="button"
              className={`btn-secondary ${mode === 'bulk' ? 'active' : ''}`}
              style={{ flex: 1, justifyContent: 'center', borderColor: mode === 'bulk' ? 'var(--accent-primary)' : 'var(--border-color)' }}
              onClick={() => setMode('bulk')}
            >
              <Users size={15} /> Add Bulk Users
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div className="modal-body" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 24px' }}>
            {mode === 'single' ? (
              <div className="form-grid">
                <div className="form-group">
                  <label>User Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. ABHINAYA M"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Contact Number *</label>
                  <input
                    type="text"
                    name="mobile"
                    value={formData.mobile}
                    onChange={handleChange}
                    placeholder="e.g. 7331113490"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Password {!userToEdit && '*'}</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder={userToEdit ? 'Leave blank to keep unchanged' : '••••••••'}
                    required={!userToEdit}
                  />
                </div>

                <div className="form-group">
                  <label>Role * (Role Master)</label>
                  <select name="role" value={formData.role} onChange={handleChange} required>
                    <option value="Executive">Executive</option>
                    <option value="Team Leader">Team Leader</option>
                    <option value="Manager">Manager</option>
                    <option value="Admin">Admin</option>
                    <option value="Super Admin">Super Admin</option>
                    {customRoles.map(cr => (
                      <option key={cr.id} value={cr.roleName}>{cr.roleName} (Custom)</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Email ID</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="anithaani4336@gmail.com"
                  />
                </div>

                <div className="form-group">
                  <label>Employee ID</label>
                  <input
                    type="text"
                    name="employeeId"
                    value={formData.employeeId}
                    onChange={handleChange}
                    placeholder="e.g. EMP-105"
                  />
                </div>

                {formData.role === 'Executive' && (
                  <div className="form-group" style={{ gridColumn: '1 / -1', background: 'var(--accent-soft)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-border)' }}>
                    <label style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                      <AlertCircle size={15} /> Executive Team Assignment:
                    </label>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Selecting Executive role requires selecting a Team Leader or Manager.
                    </div>
                    <select
                      name="reportingTo"
                      value={formData.reportingTo}
                      onChange={handleChange}
                      style={{ background: 'var(--bg-card)' }}
                      required
                    >
                      <option value="">-- Select Reporting Team Leader or Manager --</option>
                      {managementUsers.map(m => (
                        <option key={m.id} value={m.name}>{m.name} ({m.role})</option>
                      ))}
                    </select>
                  </div>
                )}

                {['Team Leader', 'Team Lead'].includes(formData.role) && (
                  <div className="form-group" style={{ gridColumn: '1 / -1', background: 'var(--accent-soft)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-border)' }}>
                    <label style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                      <AlertCircle size={15} /> Team Leader Assignment to Manager:
                    </label>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Selecting Team Leader role requires selecting a Reporting Manager.
                    </div>
                    <select
                      name="reportingTo"
                      value={formData.reportingTo}
                      onChange={handleChange}
                      style={{ background: 'var(--bg-card)' }}
                      required
                    >
                      <option value="">-- Select Reporting Manager --</option>
                      {dedicatedManagers.length > 0 && (
                        <optgroup label="Managers">
                          {dedicatedManagers.map(m => (
                            <option key={m.id} value={m.name}>
                              {m.name} ({m.role}{m.employeeId ? ` - ${m.employeeId}` : ''})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {seniorLeadership.length > 0 && (
                        <optgroup label="Senior Leadership / Admins">
                          {seniorLeadership.map(m => (
                            <option key={m.id} value={m.name}>
                              {m.name} ({m.role}{m.employeeId ? ` - ${m.employeeId}` : ''})
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                )}

                {/* ── Provision: Bank Account & Referral Details ── */}
                <div style={{
                    gridColumn: '1 / -1',
                    background: 'var(--bg-table-head)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.85rem' }}>
                      <Landmark size={15} />
                      <span>Bank Account & Referral Details (Optional)</span>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.76rem' }}>Bank Account Number</label>
                        <input
                          type="text"
                          name="bankAccountNumber"
                          value={formData.bankAccountNumber}
                          onChange={handleChange}
                          placeholder="e.g. 91234567890123"
                          style={{ fontSize: '0.82rem' }}
                        />
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.76rem' }}>IFSC Code</label>
                        <input
                          type="text"
                          name="ifscCode"
                          value={formData.ifscCode}
                          onChange={handleChange}
                          placeholder="e.g. HDFC0000123"
                          style={{ fontSize: '0.82rem' }}
                        />
                      </div>

                      <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '0.76rem' }}>Bank Name & Branch</label>
                        <input
                          type="text"
                          name="bankNameAndBranch"
                          value={formData.bankNameAndBranch}
                          onChange={handleChange}
                          placeholder="e.g. HDFC Bank, MG Road Branch"
                          style={{ fontSize: '0.82rem' }}
                        />
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.76rem' }}>Family Reference Number</label>
                        <input
                          type="text"
                          name="familyReferenceNumber"
                          value={formData.familyReferenceNumber}
                          onChange={handleChange}
                          placeholder="e.g. +91 98765 43219"
                          style={{ fontSize: '0.82rem' }}
                        />
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.76rem' }}>Referred By</label>
                        <input
                          type="text"
                          name="referredBy"
                          value={formData.referredBy}
                          onChange={handleChange}
                          placeholder="e.g. Priya Nair (TL-201)"
                          style={{ fontSize: '0.82rem' }}
                        />
                      </div>
                    </div>
                  </div>

                {/* ── Provision: Employee Documents Upload ── */}
                <div style={{
                    gridColumn: '1 / -1',
                    background: 'var(--bg-table-head)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.85rem' }}>
                        <UploadCloud size={15} />
                        <span>Upload Employee Documents (Optional)</span>
                      </div>
                      {attachedDocs.length > 0 && (
                        <span className="badge badge-success" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                          {attachedDocs.length} {attachedDocs.length === 1 ? 'Doc Attached' : 'Docs Attached'}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                      Directly attach verification documents (Aadhaar, PAN, Degree, etc.) to this employee profile.
                    </div>

                    {/* Document Picker & Attach Input Row */}
                    <div style={{
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'flex-end',
                      background: 'var(--bg-card)',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      flexWrap: 'wrap'
                    }}>
                      <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '160px' }}>
                        <label style={{ fontSize: '0.74rem' }}>Document Type</label>
                        <select
                          value={selectedDocTypeId}
                          onChange={(e) => setSelectedDocTypeId(e.target.value)}
                          style={{ fontSize: '0.8rem', background: 'var(--bg-input)' }}
                        >
                          {documentTypes.map(dt => (
                            <option key={dt.id} value={dt.id}>
                              {dt.name} {dt.required ? '(Mandatory)' : '(Optional)'}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '180px' }}>
                        <label style={{ fontSize: '0.74rem' }}>Select File (PDF, PNG, JPG)</label>
                        <input
                          ref={docFileInputRef}
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => setDocFileToUpload(e.target.files[0] || null)}
                          style={{ fontSize: '0.78rem', background: 'var(--bg-input)' }}
                        />
                      </div>

                      <button
                        type="button"
                        className="btn-primary"
                        onClick={handleAttachDocument}
                        disabled={isAttachingDoc || !docFileToUpload}
                        style={{
                          fontSize: '0.76rem',
                          padding: '7px 14px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          height: '36px'
                        }}
                      >
                        <Plus size={13} /> {isAttachingDoc ? 'Attaching...' : 'Attach Doc'}
                      </button>
                    </div>

                    {/* Attached Documents List Preview */}
                    {attachedDocs.length === 0 ? (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 0' }}>
                        No documents attached yet. Documents can also be added or managed anytime later from User Directory.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                        {attachedDocs.map(doc => (
                          <div
                            key={doc.id || doc.documentTypeId}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: 'var(--bg-card)',
                              padding: '8px 12px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-color)',
                              fontSize: '0.8rem'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                              <FileText size={15} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                              <div>
                                <strong style={{ color: 'var(--text-primary)', marginRight: '6px' }}>{doc.documentName}</strong>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>({doc.fileName} • {doc.fileSize})</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveAttachedDoc(doc.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--status-danger)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.75rem',
                                padding: '3px 6px'
                              }}
                              title="Remove document"
                            >
                              <Trash2 size={13} /> Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Provision to Add Excel File (.xlsx, .xls) or CSV */}
                <div style={{
                  border: `2px dashed ${isDragging ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  background: isDragging ? 'var(--accent-soft)' : 'var(--bg-table-head)',
                  borderRadius: 'var(--radius-lg, 8px)',
                  padding: '18px 20px',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileInputChange}
                    style={{ display: 'none' }}
                  />

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '10px',
                        background: 'var(--accent-soft)',
                        color: 'var(--accent-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--accent-border)',
                        flexShrink: 0
                      }}>
                        <FileSpreadsheet size={24} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                          Upload Excel File (.xlsx, .xls) or CSV
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          Spreadsheet rows are automatically converted and populated into CSV format below
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <UploadCloud size={14} /> Browse Excel File
                      </button>
                    </div>
                  </div>

                  {/* Uploaded File Badge */}
                  {uploadedFileName && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--accent-border)',
                      borderRadius: 'var(--radius-md, 6px)',
                      padding: '8px 12px',
                      fontSize: '0.82rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                        <CheckCircle2 size={16} color="var(--status-success)" />
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{uploadedFileName}</span>
                        {uploadedFileSize && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({uploadedFileSize})</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleClearUploadedFile}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--status-danger)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.78rem',
                          padding: '2px 6px'
                        }}
                        title="Remove file and clear text"
                      >
                        <Trash2 size={13} /> Clear
                      </button>
                    </div>
                  )}

                  {fileError && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: 'var(--status-danger)',
                      fontSize: '0.8rem',
                      background: 'var(--status-danger-bg)',
                      padding: '6px 10px',
                      borderRadius: '6px'
                    }}>
                      <AlertTriangle size={14} />
                      <span>{fileError}</span>
                    </div>
                  )}
                </div>

                {/* Helper Action Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '0.78rem', padding: '5px 10px' }}
                      onClick={handleDownloadTemplate}
                      title="Download sample Excel (.xlsx) file with pre-defined column headers"
                    >
                      <Download size={13} /> Download Excel Template
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '0.78rem', padding: '5px 10px' }}
                      onClick={handleLoadSampleCSV}
                      title="Load sample CSV data to test import"
                    >
                      <FileText size={13} /> Load Sample CSV
                    </button>
                  </div>

                  {parsedRecords.length > 0 && (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{
                        fontSize: '0.78rem',
                        padding: '5px 10px',
                        color: showPreview ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        borderColor: showPreview ? 'var(--accent-primary)' : 'var(--border-color)'
                      }}
                      onClick={() => setShowPreview(!showPreview)}
                    >
                      {showPreview ? <EyeOff size={13} /> : <Eye size={13} />}
                      {showPreview ? 'Hide Table Preview' : `Preview Parsed (${parsedRecords.length})`}
                    </button>
                  )}
                </div>

                {/* CSV Format Text Area */}
                <div className="form-group" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ margin: 0, fontWeight: 600 }}>Bulk User Data (CSV Format)</label>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {hasDetectedHeader && (
                        <span style={{
                          fontSize: '0.72rem',
                          background: 'var(--status-neutral-bg, #f0f0ee)',
                          color: 'var(--text-secondary)',
                          padding: '2px 7px',
                          borderRadius: '10px',
                          border: '1px solid var(--border-color)'
                        }}>
                          Header Row Auto-Skipped
                        </span>
                      )}
                      <span style={{
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        color: parsedRecords.length > 0 ? 'var(--status-success)' : 'var(--text-muted)',
                        background: parsedRecords.length > 0 ? 'var(--status-success-bg)' : 'transparent',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        border: parsedRecords.length > 0 ? '1px solid var(--status-success-border)' : 'none'
                      }}>
                        {parsedRecords.length > 0 ? `${parsedRecords.length} users ready to import` : '0 valid entries'}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: 1.4 }}>
                    Columns: <code>Name, Contact Number, Email, Role, Reporting To, Employee ID, Bank Account Number, IFSC Code, Bank Name and Branch, Family Reference Number, Referred By</code>
                  </div>

                  <textarea
                    rows={6}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={`Name, Contact Number, Email, Role, Reporting To\nABHINAYA M, +91 98765 43214, abhinaya@company.com, Executive, Priya Nair\nAJAY, +91 98765 43215, ajay@company.com, Executive, Priya Nair`}
                    style={{ fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: '1.4' }}
                  />
                </div>

                {/* Optional Parsed Table Preview */}
                {showPreview && parsedRecords.length > 0 && (
                  <div style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md, 6px)',
                    overflow: 'hidden',
                    background: 'var(--bg-surface)'
                  }}>
                    <div style={{
                      padding: '8px 12px',
                      background: 'var(--bg-table-head)',
                      borderBottom: '1px solid var(--border-color)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>Parsed User Records ({parsedRecords.length})</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ready for batch database insertion</span>
                    </div>
                    <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      <table className="crm-table" style={{ width: '100%', fontSize: '0.75rem', margin: 0 }}>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Name</th>
                            <th>Contact</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Reporting To</th>
                            <th>Bank Account</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedRecords.map((rec, i) => (
                            <tr key={i}>
                              <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                              <td style={{ fontWeight: 600 }}>{rec.name}</td>
                              <td>{rec.mobile}</td>
                              <td>{rec.email || '-'}</td>
                              <td><span className="badge">{rec.role}</span></td>
                              <td>{rec.reportingTo || '-'}</td>
                              <td>{rec.bankAccountNumber || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {mode === 'bulk' && parsedRecords.length > 0 && (
                <span>Ready to insert <strong>{parsedRecords.length}</strong> new users</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-primary"
                disabled={mode === 'bulk' && parsedRecords.length === 0}
                style={{
                  opacity: mode === 'bulk' && parsedRecords.length === 0 ? 0.6 : 1,
                  cursor: mode === 'bulk' && parsedRecords.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {userToEdit 
                  ? 'Save Changes' 
                  : (mode === 'single' 
                      ? 'Submit User' 
                      : (parsedRecords.length > 0 
                          ? `Import Bulk Users (${parsedRecords.length})` 
                          : 'Import Bulk Users'))}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
