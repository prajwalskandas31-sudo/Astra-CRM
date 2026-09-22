import React, { useState, useRef } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import {
  X,
  FileText,
  UploadCloud,
  Download,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  Plus,
  ShieldCheck,
  File,
  Image as ImageIcon,
  ExternalLink,
  Layers,
  Sparkles
} from 'lucide-react';

export const EmployeeDocumentsModal = ({ isOpen, onClose, user }) => {
  const {
    documentTypes,
    addDocumentType,
    uploadUserDocument,
    deleteUserDocument,
    downloadUserDocument,
    simulatedRole
  } = useCRM();
  const { showToast } = useToast();

  const [isCreatingType, setIsCreatingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeRequired, setNewTypeRequired] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [uploadingSlotId, setUploadingSlotId] = useState(null);

  // Hidden file inputs mapped by documentTypeId
  const fileInputRefs = useRef({});

  if (!isOpen || !user) return null;

  const userDocs = user.documents || [];
  const uploadedCount = userDocs.length;
  const totalSlots = documentTypes.length;

  const handleFileSelect = (docType, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (.pdf, .jpg, .jpeg, .png)
    const validExtensions = ['pdf', 'jpg', 'jpeg', 'png'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!validExtensions.includes(ext)) {
      showToast('Invalid File: Only .pdf, .jpg, and .png formats are supported.', 'error');
      e.target.value = '';
      return;
    }

    // Limit size to 10MB
    if (file.size > 10 * 1024 * 1024) {
      showToast('File size exceeds 10 MB limit.', 'error');
      e.target.value = '';
      return;
    }

    setUploadingSlotId(docType.id);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result;
      const sizeStr = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
        : `${Math.round(file.size / 1024)} KB`;

      const payload = {
        documentTypeId: docType.id,
        documentName: docType.name,
        fileName: file.name,
        fileType: file.type || (ext === 'pdf' ? 'application/pdf' : 'image/' + ext),
        fileSize: sizeStr,
        fileData: base64Data
      };

      const res = await uploadUserDocument(user.id, payload);
      setUploadingSlotId(null);
      if (res?.success) {
        showToast(`'${docType.name}' uploaded and saved directly to Owner's Database!`, 'success');
      } else {
        showToast('Failed to save document. Please try again.', 'error');
      }
      if (fileInputRefs.current[docType.id]) {
        fileInputRefs.current[docType.id].value = '';
      }
    };
    reader.onerror = () => {
      setUploadingSlotId(null);
      showToast('Error reading file data.', 'error');
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async (doc) => {
    if (window.confirm(`Are you sure you want to remove '${doc.documentName}' from ${user.name}'s records?`)) {
      await deleteUserDocument(user.id, doc.id);
      showToast(`'${doc.documentName}' removed from Owner's Database.`, 'info');
      if (previewDoc?.id === doc.id) {
        setPreviewDoc(null);
      }
    }
  };

  const handleCreateNewType = async (e) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;

    if (documentTypes.length >= 10) {
      showToast('Maximum limit of 10 document types reached.', 'error');
      return;
    }

    const res = await addDocumentType({
      name: newTypeName.trim(),
      required: newTypeRequired,
      description: `Custom document: ${newTypeName.trim()}`
    });

    if (res?.success) {
      showToast(`Custom document slot '${newTypeName}' created! (Total: ${documentTypes.length + 1}/10)`, 'success');
      setNewTypeName('');
      setNewTypeRequired(false);
      setIsCreatingType(false);
    } else {
      showToast(res?.message || 'Failed to create document type', 'error');
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        style={{
          maxWidth: '820px',
          width: '95%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: '16px 22px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FileText size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>
                  Employee Documents Vault
                </h3>
                <span className="badge badge-role" style={{ fontSize: '0.72rem' }}>
                  {user.name} ({user.employeeId || 'EMP-' + user.id})
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Stored directly in the Owner's Database • Super Admin authorized direct download
              </p>
            </div>
          </div>

          <button className="modal-close-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          className="modal-body"
          style={{
            padding: '20px 22px',
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}
        >
          {/* Top Banner Stats */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '0.84rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Documents Uploaded: </span>
                <strong style={{ color: uploadedCount > 0 ? 'var(--status-success)' : 'var(--text-primary)' }}>
                  {uploadedCount} / {totalSlots}
                </strong>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                  ({10 - totalSlots} custom slots available)
                </span>
              </div>
            </div>

            {simulatedRole === 'Super Admin' && (
              <button
                type="button"
                className="btn-secondary"
                style={{
                  fontSize: '0.78rem',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)',
                  borderColor: isCreatingType ? 'var(--accent)' : 'var(--border-color)',
                  color: isCreatingType ? 'var(--accent)' : 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onClick={() => setIsCreatingType(!isCreatingType)}
                disabled={totalSlots >= 10}
              >
                <Plus size={14} />
                {totalSlots >= 10 ? 'Max 10 Slots Reached' : isCreatingType ? 'Cancel New Type' : 'Create Document Type (Max 10)'}
              </button>
            )}
          </div>

          {/* Inline Create Document Type Form (Similar to Dispositions) */}
          {isCreatingType && simulatedRole === 'Super Admin' && (
            <form
              onSubmit={handleCreateNewType}
              style={{
                background: 'var(--bg-table-head)',
                border: '1px dashed var(--accent-border)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)' }}>
                <Sparkles size={16} />
                <span>Create Custom Document Slot (e.g. Aadhar, PAN, 10th Marks Card, etc.)</span>
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 2, minWidth: '220px' }}>
                  <input
                    type="text"
                    placeholder="Enter document name (e.g. 12th Marks Memo, Passport, Cheque)..."
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    required
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.82rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-input)'
                    }}
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newTypeRequired}
                    onChange={(e) => setNewTypeRequired(e.target.checked)}
                  />
                  <span>Mandatory / Required</span>
                </label>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" className="btn-primary" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                    Save Document Type
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                    onClick={() => setIsCreatingType(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Document Slots List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {documentTypes.map((docType, index) => {
              const uploadedDoc = userDocs.find(d => d.documentTypeId === docType.id || d.documentName?.toLowerCase() === docType.name?.toLowerCase());
              const isUploadingThis = uploadingSlotId === docType.id;
              const isPdf = uploadedDoc?.fileType?.includes('pdf') || uploadedDoc?.fileName?.endsWith('.pdf');

              return (
                <div
                  key={docType.id}
                  style={{
                    background: uploadedDoc ? 'rgba(255, 255, 255, 0.02)' : 'var(--bg-card)',
                    border: `1px solid ${uploadedDoc ? 'var(--accent-border)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    transition: 'border-color 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: uploadedDoc ? 'var(--status-success-bg)' : 'var(--bg-table-head)',
                        color: uploadedDoc ? 'var(--status-success)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        border: `1px solid ${uploadedDoc ? 'var(--status-success-border)' : 'var(--border-color)'}`
                      }}>
                        {uploadedDoc ? '✓' : index + 1}
                      </span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            {docType.name}
                          </strong>
                          {docType.required && (
                            <span style={{
                              fontSize: '0.68rem',
                              color: 'var(--status-danger)',
                              background: 'var(--status-danger-bg)',
                              padding: '1px 6px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--status-danger-border)'
                            }}>
                              Required
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {docType.description || 'Employee document upload slot'}
                        </div>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div>
                      {uploadedDoc ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.74rem',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-full)',
                          background: 'var(--status-success-bg)',
                          color: 'var(--status-success)',
                          border: '1px solid var(--status-success-border)',
                          fontWeight: 500
                        }}>
                          <CheckCircle2 size={13} /> Stored in DB
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.74rem',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-full)',
                          background: 'var(--bg-table-head)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border-color)'
                        }}>
                          Not Uploaded
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Uploaded Document Info Card OR Upload Action Button */}
                  {uploadedDoc ? (
                    <div style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '200px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: 'var(--radius-sm)',
                          background: isPdf ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: isPdf ? '#ef4444' : '#10b981',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {isPdf ? <FileText size={18} /> : <ImageIcon size={18} />}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                            {uploadedDoc.fileName}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            <span>{uploadedDoc.fileSize || 'Standard Size'}</span>
                            {uploadedDoc.uploadedAt && (
                              <span> • Uploaded: {uploadedDoc.uploadedAt}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons: Download, Preview, Replace, Delete */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Download button */}
                        <button
                          type="button"
                          className="btn-primary"
                          style={{
                            padding: '5px 12px',
                            fontSize: '0.76rem',
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                          onClick={() => downloadUserDocument(uploadedDoc, user.name)}
                          title="Download document directly from CRM"
                        >
                          <Download size={13} /> Download
                        </button>

                        {/* Preview button */}
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{
                            padding: '5px 10px',
                            fontSize: '0.76rem',
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                          onClick={() => setPreviewDoc(uploadedDoc)}
                          title="Preview document inline"
                        >
                          <Eye size={13} /> Preview
                        </button>

                        {/* Replace Document */}
                        {simulatedRole === 'Super Admin' && (
                          <>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{
                                padding: '5px 10px',
                                fontSize: '0.76rem',
                                borderRadius: 'var(--radius-sm)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                              onClick={() => fileInputRefs.current[docType.id]?.click()}
                              title="Upload replacement file"
                            >
                              <UploadCloud size={13} /> Replace
                            </button>

                            {/* Delete Document */}
                            <button
                              type="button"
                              className="btn-danger"
                              style={{
                                padding: '5px 8px',
                                fontSize: '0.76rem',
                                borderRadius: 'var(--radius-sm)'
                              }}
                              onClick={() => handleDelete(uploadedDoc)}
                              title="Delete document"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Upload Input Zone */
                    simulatedRole === 'Super Admin' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{
                            padding: '7px 14px',
                            fontSize: '0.78rem',
                            borderRadius: 'var(--radius-sm)',
                            borderColor: 'var(--accent-border)',
                            color: 'var(--accent)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                          onClick={() => fileInputRefs.current[docType.id]?.click()}
                          disabled={isUploadingThis}
                        >
                          <UploadCloud size={14} />
                          {isUploadingThis ? 'Saving to Database...' : `Upload ${docType.name} (.pdf, .jpg, .png)`}
                        </button>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Max 10 MB • Supported: PDF, JPG, PNG
                        </span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Document not yet submitted by Super Admin.
                      </div>
                    )
                  )}

                  {/* Hidden file input */}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/png,image/jpeg"
                    style={{ display: 'none' }}
                    ref={(el) => (fileInputRefs.current[docType.id] = el)}
                    onChange={(e) => handleFileSelect(docType, e)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className="modal-footer"
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            <ShieldCheck size={14} color="var(--accent)" />
            <span>Files securely encoded & saved directly to Owner's Database record.</span>
          </div>

          <button type="button" className="btn-primary" onClick={onClose}>
            Done / Close
          </button>
        </div>
      </div>

      {/* Document Inline Preview Modal */}
      {previewDoc && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div
            className="modal-content"
            style={{
              maxWidth: '850px',
              width: '95%',
              maxHeight: '94vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <div className="modal-header" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={17} style={{ color: 'var(--accent)' }} />
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{previewDoc.documentName} Preview</h4>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {previewDoc.fileName} • {previewDoc.fileSize}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ padding: '4px 10px', fontSize: '0.75rem', gap: '5px' }}
                  onClick={() => downloadUserDocument(previewDoc, user.name)}
                >
                  <Download size={13} /> Download
                </button>
                <button className="modal-close-btn" onClick={() => setPreviewDoc(null)}>
                  <X size={16} />
                </button>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                minHeight: '400px',
                maxHeight: '70vh',
                overflow: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0d1117',
                padding: '16px'
              }}
            >
              {previewDoc.fileType?.includes('pdf') || previewDoc.fileName?.endsWith('.pdf') ? (
                <iframe
                  src={previewDoc.fileData}
                  title="PDF Preview"
                  style={{ width: '100%', height: '580px', border: 'none', borderRadius: 'var(--radius-sm)' }}
                />
              ) : (
                <img
                  src={previewDoc.fileData}
                  alt={previewDoc.documentName}
                  style={{ maxWidth: '100%', maxHeight: '580px', objectFit: 'contain', borderRadius: 'var(--radius-sm)' }}
                />
              )}
            </div>

            <div className="modal-footer" style={{ padding: '10px 20px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setPreviewDoc(null)}>
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
