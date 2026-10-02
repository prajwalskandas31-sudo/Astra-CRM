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
  Plus,
  Sliders,
  Edit2,
  Tag,
  Check
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
  const { 
    users, 
    customRoles, 
    documentTypes = [], 
    userCustomFields = [], 
    addUserCustomField, 
    updateUserCustomField, 
    deleteUserCustomField, 
    simulatedRole,
    currentUser,
    addUser, 
    updateUser, 
    downloadUserDocument 
  } = useCRM();
  const { showToast } = useToast();

  const isSuperAdmin = simulatedRole === 'Super Admin' || currentUser?.role === 'Super Admin';

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

  // Custom Profile Fields State (Up to 20 fields with 2 sub-fields each)
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [isAddingCustomField, setIsAddingCustomField] = useState(false);
  const [newFieldForm, setNewFieldForm] = useState({
    fieldName: '',
    subField1Name: '',
    subField2Name: ''
  });
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [editFieldForm, setEditFieldForm] = useState({
    fieldName: '',
    subField1Name: '',
    subField2Name: ''
  });

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
        setCustomFieldValues(userToEdit.customFieldValues ? { ...userToEdit.customFieldValues } : {});
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
        setCustomFieldValues({});
        setBulkText('');
        setUploadedFileName('');
        setUploadedFileSize('');
        setFileError('');
        setShowPreview(false);
      }
      setIsAddingCustomField(false);
      setEditingFieldId(null);
      setNewFieldForm({ fieldName: '', subField1Name: '', subField2Name: '' });
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

  const handleCustomFieldValueChange = (fieldId, subKey, value) => {
    setCustomFieldValues(prev => ({
      ...prev,
      [fieldId]: {
        ...(prev[fieldId] || {}),
        [subKey]: value
      }
    }));
  };

  const handleCreateCustomField = async (e) => {
    if (e) e.preventDefault();
    if (!newFieldForm.fieldName.trim()) {
      showToast('Please provide a Custom Field Name.', 'warning');
      return;
    }
    if (!newFieldForm.subField1Name.trim() || !newFieldForm.subField2Name.trim()) {
      showToast('Please provide custom names for both Sub-Field 1 and Sub-Field 2.', 'warning');
      return;
    }
    if (userCustomFields.length >= 20) {
      showToast('Maximum limit of 20 custom fields reached. Remove an existing field to add a new one.', 'warning');
      return;
    }

    const res = await addUserCustomField(newFieldForm);
    if (res?.success) {
      showToast(`Custom field '${newFieldForm.fieldName.trim()}' created! (Total: ${userCustomFields.length + 1}/20)`, 'success');
      setNewFieldForm({ fieldName: '', subField1Name: '', subField2Name: '' });
      setIsAddingCustomField(false);
    } else {
      showToast(res?.message || 'Failed to create custom field', 'error');
    }
  };

  const handleStartEditField = (field) => {
    setEditingFieldId(field.id);
    setEditFieldForm({
      fieldName: field.fieldName,
      subField1Name: field.subField1Name,
      subField2Name: field.subField2Name
    });
  };

  const handleCancelEditField = () => {
    setEditingFieldId(null);
    setEditFieldForm({ fieldName: '', subField1Name: '', subField2Name: '' });
  };

  const handleSaveEditField = async (fieldId) => {
    if (!editFieldForm.fieldName.trim() || !editFieldForm.subField1Name.trim() || !editFieldForm.subField2Name.trim()) {
      showToast('Field Name and both Sub-Field names are required.', 'warning');
      return;
    }

    const res = await updateUserCustomField(fieldId, editFieldForm);
    if (res?.success) {
      showToast('Custom field names updated successfully.', 'success');
      setEditingFieldId(null);
    } else {
      showToast(res?.message || 'Failed to update custom field', 'error');
    }
  };

  const handleDeleteCustomField = async (fieldId, fieldName) => {
    if (window.confirm(`Are you sure you want to delete custom field '${fieldName}'?`)) {
      await deleteUserCustomField(fieldId);
      showToast(`Custom field '${fieldName}' deleted.`, 'info');
      setCustomFieldValues(prev => {
        const copy = { ...prev };
        delete copy[fieldId];
        return copy;
      });
    }
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
          documents: attachedDocs,
          customFieldValues
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
          documents: attachedDocs,
          customFieldValues
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

                {/* ── Provision: User & Bank Profile Details ── */}
                <div style={{
                    gridColumn: '1 / -1',
                    background: 'var(--bg-table-head)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.88rem' }}>
                        <Landmark size={16} />
                        <span>User & Bank Profile Details</span>
                      </div>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Bank & Reference Verification
                      </span>
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

                {/* ── Provision: Custom Profile Fields (Up to 20) with 2 Sub-Fields Each ── */}
                <div style={{
                  gridColumn: '1 / -1',
                  background: 'var(--bg-table-head)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.88rem' }}>
                      <Sliders size={16} />
                      <span>Custom Profile Fields ({userCustomFields.length}/20)</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '0.74rem',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        background: userCustomFields.length >= 20 ? 'rgba(239, 68, 68, 0.15)' : 'var(--accent-soft)',
                        color: userCustomFields.length >= 20 ? '#ef4444' : 'var(--accent)',
                        border: `1px solid ${userCustomFields.length >= 20 ? 'rgba(239, 68, 68, 0.3)' : 'var(--accent-border)'}`,
                        fontWeight: 600
                      }}>
                        {userCustomFields.length} / 20 Configured
                      </span>

                      {isSuperAdmin && (
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{
                            fontSize: '0.74rem',
                            padding: '4px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: isAddingCustomField ? 'var(--accent-soft)' : undefined,
                            borderColor: isAddingCustomField ? 'var(--accent-primary)' : undefined
                          }}
                          onClick={() => {
                            if (!isAddingCustomField && userCustomFields.length >= 20) {
                              showToast('Maximum limit of 20 custom fields reached. Remove an existing field to add a new one.', 'warning');
                              return;
                            }
                            setIsAddingCustomField(!isAddingCustomField);
                          }}
                          title={userCustomFields.length >= 20 ? 'Maximum 20 fields reached' : 'Create new custom field with 2 sub-fields'}
                        >
                          <Plus size={13} /> {isAddingCustomField ? 'Close Creator' : '+ Add Custom Field'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Provision for custom employee profile attributes. Super Admin can define up to 20 custom fields with custom names for the parent field and both sub-fields.
                  </div>

                  {/* Super Admin: New Custom Field Creator Panel */}
                  {isAddingCustomField && isSuperAdmin && (
                    <div style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--accent-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent)' }}>
                          <Tag size={14} />
                          <span>Define New Custom Field & 2 Sub-Fields (Slot {userCustomFields.length + 1} of 20)</span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Super Admin Authority</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '0.74rem' }}>Custom Field Name *</label>
                          <input
                            type="text"
                            value={newFieldForm.fieldName}
                            onChange={(e) => setNewFieldForm(prev => ({ ...prev, fieldName: e.target.value }))}
                            placeholder="e.g. Emergency Contact, Vehicle Details"
                            style={{ fontSize: '0.8rem' }}
                          />
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '0.74rem' }}>Sub-Field 1 Name *</label>
                          <input
                            type="text"
                            value={newFieldForm.subField1Name}
                            onChange={(e) => setNewFieldForm(prev => ({ ...prev, subField1Name: e.target.value }))}
                            placeholder="e.g. Contact Person, Registration No."
                            style={{ fontSize: '0.8rem' }}
                          />
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '0.74rem' }}>Sub-Field 2 Name *</label>
                          <input
                            type="text"
                            value={newFieldForm.subField2Name}
                            onChange={(e) => setNewFieldForm(prev => ({ ...prev, subField2Name: e.target.value }))}
                            placeholder="e.g. Mobile Number, Vehicle Model"
                            style={{ fontSize: '0.8rem' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '2px' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '0.74rem', padding: '5px 12px' }}
                          onClick={() => {
                            setIsAddingCustomField(false);
                            setNewFieldForm({ fieldName: '', subField1Name: '', subField2Name: '' });
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ fontSize: '0.74rem', padding: '5px 14px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                          onClick={handleCreateCustomField}
                        >
                          <Check size={13} /> Save Custom Field
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Configured Custom Fields List with 2 Sub-Fields Values */}
                  {userCustomFields.length === 0 ? (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '10px 0', textAlign: 'center' }}>
                      No custom fields configured yet. {isSuperAdmin ? "Click '+ Add Custom Field' above to define your first custom field." : "Super Admin has not created custom fields yet."}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {userCustomFields.map((field, index) => (
                        <div
                          key={field.id}
                          style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '12px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px'
                          }}
                        >
                          {/* Field Header & Super Admin Rename / Delete Actions */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                              <span style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '4px',
                                background: 'var(--accent-soft)',
                                color: 'var(--accent)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.7rem',
                                fontWeight: 700
                              }}>
                                {index + 1}
                              </span>
                              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {field.fieldName}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                ({field.subField1Name} & {field.subField2Name})
                              </span>
                            </div>

                            {isSuperAdmin && editingFieldId !== field.id && (
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ padding: '3px 7px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  onClick={() => handleStartEditField(field)}
                                  title="Rename field and sub-field labels"
                                >
                                  <Edit2 size={11} /> Rename Names
                                </button>
                                <button
                                  type="button"
                                  className="btn-danger"
                                  style={{ padding: '3px 7px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  onClick={() => handleDeleteCustomField(field.id, field.fieldName)}
                                  title="Delete custom field"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Inline Rename Form for Super Admin */}
                          {editingFieldId === field.id ? (
                            <div style={{
                              background: 'var(--bg-table-head)',
                              border: '1px solid var(--accent-border)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '10px 12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px'
                            }}>
                              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--accent)' }}>
                                Rename Custom Field & Sub-Fields Labels:
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label style={{ fontSize: '0.72rem' }}>Field Name</label>
                                  <input
                                    type="text"
                                    value={editFieldForm.fieldName}
                                    onChange={(e) => setEditFieldForm(prev => ({ ...prev, fieldName: e.target.value }))}
                                    style={{ fontSize: '0.78rem' }}
                                  />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label style={{ fontSize: '0.72rem' }}>Sub-Field 1 Name</label>
                                  <input
                                    type="text"
                                    value={editFieldForm.subField1Name}
                                    onChange={(e) => setEditFieldForm(prev => ({ ...prev, subField1Name: e.target.value }))}
                                    style={{ fontSize: '0.78rem' }}
                                  />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label style={{ fontSize: '0.72rem' }}>Sub-Field 2 Name</label>
                                  <input
                                    type="text"
                                    value={editFieldForm.subField2Name}
                                    onChange={(e) => setEditFieldForm(prev => ({ ...prev, subField2Name: e.target.value }))}
                                    style={{ fontSize: '0.78rem' }}
                                  />
                                </div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '4px' }}>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                                  onClick={handleCancelEditField}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="btn-primary"
                                  style={{ fontSize: '0.72rem', padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  onClick={() => handleSaveEditField(field.id)}
                                >
                                  <Check size={11} /> Save Names
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Sub-Field 1 and Sub-Field 2 Values Entry */
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label style={{ fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{field.subField1Name}</span>
                                </label>
                                <input
                                  type="text"
                                  value={customFieldValues[field.id]?.sub1 || ''}
                                  onChange={(e) => handleCustomFieldValueChange(field.id, 'sub1', e.target.value)}
                                  placeholder={`Enter ${field.subField1Name}`}
                                  style={{ fontSize: '0.82rem' }}
                                />
                              </div>

                              <div className="form-group" style={{ margin: 0 }}>
                                <label style={{ fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{field.subField2Name}</span>
                                </label>
                                <input
                                  type="text"
                                  value={customFieldValues[field.id]?.sub2 || ''}
                                  onChange={(e) => handleCustomFieldValueChange(field.id, 'sub2', e.target.value)}
                                  placeholder={`Enter ${field.subField2Name}`}
                                  style={{ fontSize: '0.82rem' }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Provision: Employee Documents Upload & Verification ── */}
                <div style={{
                    gridColumn: '1 / -1',
                    background: 'var(--bg-table-head)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.88rem' }}>
                        <FileText size={16} />
                        <span>Employee Documents & Verification</span>
                      </div>
                      {attachedDocs.length > 0 && (
                        <span className="badge badge-success" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                          {attachedDocs.length} {attachedDocs.length === 1 ? 'Doc Attached' : 'Docs Attached'}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                      Upload and manage verification documents (Aadhaar, PAN, Degree, Offer Letter, etc.) directly for this employee.
                    </div>

                    {/* Document Picker & Attach Input Row */}
                    <div style={{
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'flex-end',
                      background: 'var(--bg-card)',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      flexWrap: 'wrap'
                    }}>
                      <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '160px' }}>
                        <label style={{ fontSize: '0.74rem' }}>Select Document Type</label>
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
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
                        No documents attached yet for this employee. Select a document type and file above to attach.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
                        {attachedDocs.map(doc => (
                          <div
                            key={doc.id || doc.documentTypeId}
                            style={{
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '9px 12px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '10px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.68rem',
                                fontWeight: 600,
                                background: doc.fileType?.includes('pdf') || doc.fileName?.endsWith('.pdf') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                color: doc.fileType?.includes('pdf') || doc.fileName?.endsWith('.pdf') ? '#ef4444' : '#10b981',
                                flexShrink: 0
                              }}>
                                {doc.fileType?.includes('pdf') || doc.fileName?.endsWith('.pdf') ? 'PDF' : 'IMG'}
                              </span>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {doc.documentName}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  {doc.fileName} • {doc.fileSize}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              {doc.fileData && (
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '0.72rem',
                                    borderRadius: 'var(--radius-sm)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    flexShrink: 0
                                  }}
                                  onClick={() => downloadUserDocument(doc, formData.name)}
                                  title="Download attached document"
                                >
                                  <Download size={12} /> Download
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn-danger"
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '0.72rem',
                                  borderRadius: 'var(--radius-sm)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  flexShrink: 0
                                }}
                                onClick={() => handleRemoveAttachedDoc(doc.id)}
                                title="Remove document"
                              >
                                <Trash2 size={12} /> Remove
                              </button>
                            </div>
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
