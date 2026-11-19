import React, { useEffect, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { Tags, Plus, Trash2 } from 'lucide-react';

// Limits match _service_check in backend/sync.py
const NAME_MAX = 60;
const VALUE_MAX = 100000000;

const cleanValue = (v) => v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
const toNumber = (v) => (String(v ?? '').trim() === '' ? '' : Number(v));
const valueText = (v) => (v === '' || v === undefined || v === null ? '' : String(v));

/**
 * Service Master: every service offered and its Value (price). The list is the `services` collection,
 * which is the only source of Service Names on the Client Information Page; picking one there fills
 * in its Value. Only a Super Admin can change it (the server checks names and values too).
 */
export const ServiceMasterBlock = () => {
  const { services = [], addService, updateService, deleteService, currentUser } = useCRM();
  const { showToast } = useToast();
  const canEdit = currentUser?.role === 'Super Admin';

  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  // Rows being edited: { [id]: { name, value } }, saved when the field loses focus
  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    setDrafts(Object.fromEntries(services.map(s => [s.id, { name: s.name || '', value: valueText(s.value) }])));
  }, [services]);

  const nameTaken = (name, exceptId) => services.some(s => s.id !== exceptId && (s.name || '').trim().toLowerCase() === name.toLowerCase());

  const validate = (name, value, exceptId) => {
    if (!name) return 'Service Name is required.';
    if (name.length > NAME_MAX) return `Service Name can be at most ${NAME_MAX} characters.`;
    if (nameTaken(name, exceptId)) return `A service named "${name}" already exists.`;
    if (value !== '' && (Number.isNaN(Number(value)) || Number(value) > VALUE_MAX)) return 'Value must be a number up to 10,00,00,000.';
    return '';
  };

  const handleAdd = (e) => {
    e.preventDefault();
    const name = newName.trim();
    const problem = validate(name, newValue);
    if (problem) { showToast(problem, 'error'); return; }
    addService({ name, value: toNumber(newValue) });
    showToast(`Service "${name}" added. It is now in the Service Name list on the Client Information Page.`, 'success');
    setNewName('');
    setNewValue('');
  };

  const saveRow = (srv) => {
    const draft = drafts[srv.id];
    if (!draft) return;
    const name = draft.name.trim();
    const value = draft.value.trim();
    if (name === (srv.name || '') && value === valueText(srv.value)) return;
    const problem = validate(name, value, srv.id);
    if (problem) {
      showToast(problem, 'error');
      setDrafts(d => ({ ...d, [srv.id]: { name: srv.name || '', value: valueText(srv.value) } }));
      return;
    }
    updateService(srv.id, { name, value: toNumber(value) });
    showToast(`Service "${name}" saved.`, 'success');
  };

  const handleDelete = (srv) => {
    if (services.length <= 1) {
      showToast('At least one service must remain in the Service Master.', 'warning');
      return;
    }
    if (!window.confirm(`Delete the service "${srv.name}"? Clients already saved with it keep their service.`)) return;
    deleteService(srv.id);
    showToast(`Service "${srv.name}" deleted.`, 'info');
  };

  const field = { padding: '8px 12px', fontSize: '0.84rem', boxSizing: 'border-box' };

  return (
    <div className="directory-card" style={{ overflow: 'hidden' }}>
      <div className="directory-toolbar">
        <div className="directory-title-area">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tags size={18} color="var(--accent)" /> Service Master
          </h3>
          <p>
            {canEdit
              ? 'Every service offered and its Value. Services added here appear straight away in the Service Name list on the Client Information Page, which fills in the Value.'
              : 'Every service offered and its Value. Only a Super Admin can change them.'}
          </p>
        </div>
        <span className="badge" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', whiteSpace: 'nowrap' }}>
          {services.length} service{services.length === 1 ? '' : 's'}
        </span>
      </div>

      {canEdit && (
        <form onSubmit={handleAdd} style={{ padding: '0 20px 18px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: '2 1 240px' }}>
            <label htmlFor="service-new-name">Service Name</label>
            <input id="service-new-name" value={newName} onChange={e => setNewName(e.target.value)} maxLength={NAME_MAX}
              placeholder="e.g. Stock Cash Premium" style={field} required />
          </div>
          <div className="form-group" style={{ flex: '1 1 160px' }}>
            <label htmlFor="service-new-value">Value (₹)</label>
            <input id="service-new-value" inputMode="decimal" value={newValue} onChange={e => setNewValue(cleanValue(e.target.value))}
              placeholder="e.g. 15000" style={{ ...field, textAlign: 'right' }} />
          </div>
          <button type="submit" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '38px' }}>
            <Plus size={14} /> Add Service
          </button>
        </form>
      )}

      <div className="table-responsive">
        <table className="crm-table">
          <thead>
            <tr>
              <th style={{ width: '48px' }}>No.</th>
              <th>Service Name</th>
              <th style={{ textAlign: 'right', width: '200px' }}>Value (₹)</th>
              {canEdit && <th style={{ width: '90px' }}>Action</th>}
            </tr>
          </thead>
          <tbody>
            {services.length === 0 ? (
              <tr><td colSpan={canEdit ? 4 : 3} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No services yet.</td></tr>
            ) : services.map((srv, i) => {
              const draft = drafts[srv.id] || { name: srv.name || '', value: valueText(srv.value) };
              return (
                <tr key={srv.id}>
                  <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                  <td>
                    {canEdit ? (
                      <input aria-label={`Service Name ${i + 1}`} value={draft.name} maxLength={NAME_MAX}
                        onChange={e => setDrafts(d => ({ ...d, [srv.id]: { ...draft, name: e.target.value } }))}
                        onBlur={() => saveRow(srv)} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
                        style={{ ...field, width: '100%', fontWeight: 600 }} />
                    ) : <span style={{ fontWeight: 600 }}>{srv.name}</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {canEdit ? (
                      <input aria-label={`Value for ${srv.name}`} inputMode="decimal" value={draft.value} placeholder="Not set"
                        onChange={e => setDrafts(d => ({ ...d, [srv.id]: { ...draft, value: cleanValue(e.target.value) } }))}
                        onBlur={() => saveRow(srv)} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
                        style={{ ...field, width: '100%', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
                    ) : (
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {valueText(srv.value) === '' ? '—' : `₹${Number(srv.value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                      </span>
                    )}
                  </td>
                  {canEdit && (
                    <td>
                      <button type="button" className="btn-secondary" onClick={() => handleDelete(srv)} title={`Delete ${srv.name}`}
                        style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--status-danger)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Trash2 size={13} /> Delete
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
