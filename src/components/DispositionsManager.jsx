import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { Layers, Plus, Edit2, Trash2, CheckCircle, Tag, ArrowRight, Calendar, Clock } from 'lucide-react';

export const DispositionsManager = () => {
  const { dispositions, addDisposition, updateDisposition, deleteDisposition, simulatedRole } = useCRM();
  const { showToast } = useToast();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingDisp, setEditingDisp] = useState(null);

  const [dispForm, setDispForm] = useState({
    name: '',
    requiresDateTimePicker: false,
    color: 'purple'
  });

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!dispForm.name) return;

    if (editingDisp) {
      updateDisposition(editingDisp.id, dispForm);
      showToast(`Disposition '${dispForm.name}' updated.`, 'success');
      setEditingDisp(null);
    } else {
      addDisposition(dispForm);
      showToast(`Disposition '${dispForm.name}' created and added to Dashboard shortcuts.`, 'success');
    }

    setIsAddOpen(false);
    setDispForm({ name: '', requiresDateTimePicker: false, color: 'purple' });
  };

  const handleEditClick = (d) => {
    setEditingDisp(d);
    setDispForm({
      name: d.name,
      requiresDateTimePicker: d.requiresDateTimePicker || false,
      color: d.color || 'purple'
    });
    setIsAddOpen(true);
  };

  const handleDelete = (id, name) => {
    deleteDisposition(id);
    showToast(`Disposition '${name}' removed.`, 'info');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div className="directory-card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="var(--accent-primary)" /> Dispositions & Pipeline Manager (Block 2 Settings)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Configure client lead stages and date/time controls. Dispositions added here generate shortcut buttons on the user CRM Dashboard.
            </p>
          </div>

          {simulatedRole === 'Super Admin' && (
            <button className="btn-primary" onClick={() => { setEditingDisp(null); setDispForm({ name: '', requiresDateTimePicker: false, color: 'purple' }); setIsAddOpen(true); }}>
              <Plus size={15} /> Create Disposition
            </button>
          )}
        </div>
      </div>

      {/* Visual Pipeline Flow */}
      <div className="directory-card" style={{ padding: '20px 24px' }}>
        <h4 style={{ fontSize: '0.86rem', marginBottom: '14px', color: 'var(--text-secondary)' }}>
          Active Pipeline Stage Flow Architecture:
        </h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          {dispositions.map((d, index) => (
            <React.Fragment key={d.id}>
              <div style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--accent-border)',
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Tag size={13} color="var(--accent-primary)" />
                <span style={{ fontWeight: 600, fontSize: '0.84rem' }}>{d.name}</span>
                {d.requiresDateTimePicker && (
                  <Clock size={12} color="var(--warning-color, #f59e0b)" title="Requires Date & Time Picker" />
                )}
              </div>
              {index < dispositions.length - 1 && (
                <ArrowRight size={14} color="var(--text-muted)" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Dispositions List Table */}
      <div className="directory-card">
        <div className="directory-toolbar">
          <div className="directory-title-area">
            <h3>Configured Disposition List</h3>
            <p>Super Admin authorization enabled for pipeline configuration & dynamic calendar toggles.</p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="crm-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Disposition Stage Name</th>
                <th>Date & Time Control</th>
                <th>Dashboard Status</th>
                <th>Authority</th>
                {simulatedRole === 'Super Admin' && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {dispositions.map((d, index) => (
                <tr key={d.id}>
                  <td style={{ color: 'var(--text-muted)' }}>{index + 1}</td>
                  <td style={{ fontWeight: 600 }}>
                    <span className="badge badge-disposition">{d.name}</span>
                  </td>
                  <td>
                    {d.requiresDateTimePicker ? (
                      <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Calendar size={12} /> Date & Time Required
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        No Date/Time Prompt
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-disposition">
                      <CheckCircle size={12} /> Active Shortcut Button
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      Super Admin Only
                    </span>
                  </td>
                  {simulatedRole === 'Super Admin' && (
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: '0.76rem' }} onClick={() => handleEditClick(d)}>
                          <Edit2 size={12} /> Edit
                        </button>
                        {!d.isDefault && (
                          <button className="btn-danger" style={{ padding: '3px 8px', fontSize: '0.76rem' }} onClick={() => handleDelete(d.id, d.name)}>
                            <Trash2 size={12} /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isAddOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3>{editingDisp ? 'Edit Disposition' : 'Create Disposition Stage'}</h3>
              <button className="modal-close-btn" onClick={() => setIsAddOpen(false)}>×</button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ fontWeight: 600 }}>Disposition Name *</label>
                  <input
                    type="text"
                    value={dispForm.name}
                    onChange={(e) => setDispForm({ ...dispForm, name: e.target.value })}
                    placeholder="e.g. Call Back Later"
                    required
                  />
                </div>

                {/* Block 2 Specification: Calendar Toggle (Enable/Disable Date & Time picker per disposition) */}
                <div className="form-group" style={{
                  padding: '12px 14px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)'
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={dispForm.requiresDateTimePicker}
                      onChange={(e) => setDispForm({ ...dispForm, requiresDateTimePicker: e.target.checked })}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} color="var(--accent-primary)" /> Enable Date & Time Picker
                      </span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px' }}>
                        Requires users to pick a scheduled date and time when selecting this disposition outcome.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsAddOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">
                  {editingDisp ? 'Save Changes' : 'Generate Shortcut'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

