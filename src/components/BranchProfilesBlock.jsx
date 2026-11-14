import React, { useMemo, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { GitBranch, Save, RotateCcw, Plus, Edit2, Trash2, MapPin, Phone, Users } from 'lucide-react';

// Roles that can be named as a branch manager
const MANAGER_ROLES = ['Manager', 'Admin', 'Super Admin'];

const EMPTY_FORM = { name: '', address: '', managerIds: [], phone: '' };

export const BranchProfilesBlock = () => {
  const { branches = [], addBranch, updateBranch, deleteBranch, users = [], currentUser } = useCRM();
  const { showToast } = useToast();
  // The server only accepts changes from a Super Admin; everyone else sees the branches read-only
  const canEdit = currentUser?.role === 'Super Admin';

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);

  const managerChoices = useMemo(
    () => users.filter(u => MANAGER_ROLES.includes(u.role) && u.status !== 'Inactive'),
    [users]
  );
  const userName = (id) => users.find(u => u.id === id)?.name;
  const membersOf = (branchId) => users.filter(u => u.branchId === branchId).length;

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const toggleManager = (id) => {
    setForm(f => ({
      ...f,
      managerIds: f.managerIds.includes(id) ? f.managerIds.filter(m => m !== id) : [...f.managerIds, id]
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      showToast('Branch Name is required.', 'error');
      return;
    }
    const clash = branches.find(b => b.id !== editingId && b.name.trim().toLowerCase() === name.toLowerCase());
    if (clash) {
      showToast(`A branch named "${clash.name}" already exists.`, 'error');
      return;
    }
    if (editingId) {
      updateBranch(editingId, form);
      showToast(`Branch "${name}" updated.`, 'success');
    } else {
      addBranch(form);
      showToast(`Branch "${name}" saved. It is now available in Add User.`, 'success');
    }
    resetForm();
  };

  const handleEdit = (branch) => {
    setEditingId(branch.id);
    setForm({
      name: branch.name || '',
      address: branch.address || '',
      managerIds: Array.isArray(branch.managerIds) ? branch.managerIds : [],
      phone: branch.phone || ''
    });
  };

  const handleDelete = (branch) => {
    const count = membersOf(branch.id);
    if (count > 0) {
      showToast(`"${branch.name}" has ${count} user${count === 1 ? '' : 's'} assigned. Move them to another branch in User Directory first.`, 'warning');
      return;
    }
    if (!window.confirm(`Delete branch "${branch.name}"?`)) return;
    deleteBranch(branch.id);
    if (editingId === branch.id) resetForm();
    showToast(`Branch "${branch.name}" deleted.`, 'info');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="directory-card" style={{ overflow: 'hidden' }}>
        <div className="directory-toolbar">
          <div className="directory-title-area">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GitBranch size={18} color="var(--accent)" /> Branch Profiles
            </h3>
            <p>
              {canEdit
                ? 'Every branch saved here appears in the Branch dropdown when adding users (single and bulk) in User Directory.'
                : 'The company branches users are assigned to. Only a Super Admin can change them.'}
            </p>
          </div>
        </div>

        {canEdit && (
          <form onSubmit={handleSubmit} style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
            <h4 style={{ margin: '0 0 14px', fontSize: '0.95rem' }}>
              Branch Details{editingId ? ` — editing "${branches.find(b => b.id === editingId)?.name || ''}"` : ''}
            </h4>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="branch-name">Branch Name *</label>
                <input
                  id="branch-name"
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Hyderabad - Ameerpet"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="branch-phone">Branch Phone Number</label>
                <input
                  id="branch-phone"
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="e.g. +91 40 1234 5678"
                  autoComplete="tel"
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="branch-address">Branch Address</label>
                <textarea
                  id="branch-address"
                  rows={2}
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="e.g. 2nd Floor, 7-1-28 Ameerpet, Hyderabad 500016"
                  autoComplete="street-address"
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Managers</label>
                {managerChoices.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    No active users with the Manager, Admin or Super Admin role yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {managerChoices.map(m => {
                      const on = form.managerIds.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px', margin: 0, cursor: 'pointer',
                            padding: '5px 10px', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 500,
                            border: `1px solid ${on ? 'var(--accent-border)' : 'var(--border-color)'}`,
                            background: on ? 'var(--accent-soft)' : 'transparent',
                            color: on ? 'var(--accent-primary)' : 'var(--text-secondary)'
                          }}
                        >
                          <input type="checkbox" checked={on} onChange={() => toggleManager(m.id)} style={{ margin: 0, width: 'auto' }} />
                          {m.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>({m.role})</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              {(editingId || form.name || form.address || form.phone || form.managerIds.length > 0) && (
                <button type="button" className="btn-secondary" onClick={resetForm}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <RotateCcw size={14} /> {editingId ? 'Cancel Edit' : 'Clear'}
                </button>
              )}
              <button type="submit" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {editingId ? <><Save size={14} /> Save Branch</> : <><Plus size={14} /> Add Branch</>}
              </button>
            </div>
          </form>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table className="crm-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Branch Name</th>
                <th>Address</th>
                <th>Managers</th>
                <th>Phone</th>
                <th>Users</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {branches.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    {canEdit ? 'No branches yet. Add the first one above.' : 'No branches have been set up yet.'}
                  </td>
                </tr>
              ) : branches.map((b, i) => {
                const managers = (b.managerIds || []).map(userName).filter(Boolean);
                return (
                  <tr key={b.id}>
                    <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{b.name}</td>
                    <td style={{ color: b.address ? 'var(--text-secondary)' : 'var(--text-muted)', maxWidth: '280px' }}>
                      {b.address ? <span style={{ display: 'inline-flex', gap: '4px' }}><MapPin size={13} style={{ flexShrink: 0, marginTop: '2px' }} />{b.address}</span> : '—'}
                    </td>
                    <td>{managers.length ? managers.join(', ') : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td>{b.phone ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Phone size={13} />{b.phone}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Users size={13} />{membersOf(b.id)}</span></td>
                    {canEdit && (
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button type="button" className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            onClick={() => handleEdit(b)} title="Edit branch">
                            <Edit2 size={13} /> Edit
                          </button>
                          <button type="button" className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--status-danger)' }}
                            onClick={() => handleDelete(b)} title="Delete branch">
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
