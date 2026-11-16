import React, { useState } from 'react';
import { Package, Settings2, X, Edit2, Trash2, Check, Plus } from 'lucide-react';
import { useCRM, MAX_COMPANY_ASSETS } from '../context/CRMContext';
import { useToast } from './ToastNotification';

// "Company Assets Provided" in Add / Edit User: pick from a dropdown of up to 10 asset items.
// A Super Admin can add, rename and remove those items from the same place.
export const CompanyAssetsField = ({ value = [], onChange }) => {
  const {
    companyAssets = [],
    addCompanyAsset,
    updateCompanyAsset,
    deleteCompanyAsset,
    simulatedRole,
    currentUser
  } = useCRM();
  const { showToast } = useToast();
  const isSuperAdmin = simulatedRole === 'Super Admin' || currentUser?.role === 'Super Admin';

  const [isManaging, setIsManaging] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const selected = Array.isArray(value) ? value : [];
  const nameOf = (id) => companyAssets.find(a => a.id === id)?.name;
  const available = companyAssets.filter(a => !selected.includes(a.id));
  const isFull = companyAssets.length >= MAX_COMPANY_ASSETS;

  const pick = (id) => {
    if (id && !selected.includes(id)) onChange([...selected, id]);
  };

  const remove = (id) => onChange(selected.filter(x => x !== id));

  const handleAdd = () => {
    const res = addCompanyAsset(newName);
    if (!res.success) { showToast(res.error, 'warning'); return; }
    setNewName('');
    showToast(`Asset '${res.asset.name}' added (${companyAssets.length + 1}/${MAX_COMPANY_ASSETS}).`, 'success');
  };

  const handleRename = (id) => {
    const res = updateCompanyAsset(id, editName);
    if (!res.success) { showToast(res.error, 'warning'); return; }
    setEditingId(null);
  };

  const handleDelete = (asset) => {
    if (!window.confirm(`Remove '${asset.name}' from the asset list? Users who already have it will show it as a removed asset.`)) return;
    deleteCompanyAsset(asset.id);
    if (editingId === asset.id) setEditingId(null);
  };

  const smallBtn = { fontSize: '0.74rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' };
  const iconBtn = { padding: '4px 6px', display: 'flex', alignItems: 'center' };

  return (
    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
          <Package size={14} /> Company Assets Provided
        </label>
        {isSuperAdmin && (
          <button
            type="button"
            className="btn-secondary"
            style={{
              ...smallBtn,
              background: isManaging ? 'var(--accent-soft)' : undefined,
              borderColor: isManaging ? 'var(--accent-primary)' : undefined
            }}
            onClick={() => setIsManaging(m => !m)}
          >
            <Settings2 size={13} /> {isManaging ? 'Close' : 'Manage Asset List'} ({companyAssets.length}/{MAX_COMPANY_ASSETS})
          </button>
        )}
      </div>

      <select value="" onChange={e => pick(e.target.value)} disabled={available.length === 0}>
        <option value="">
          {companyAssets.length === 0
            ? (isSuperAdmin ? '-- No assets set up yet. Use Manage Asset List --' : '-- No assets set up yet --')
            : available.length === 0 ? '-- All assets selected --' : '-- Select an asset to add --'}
        </option>
        {available.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>

      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
          {selected.map(id => {
            const name = nameOf(id);
            return (
              <span
                key={id}
                className="badge"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px',
                  background: 'var(--accent-soft)', border: '1px solid var(--accent-border)',
                  color: name ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.76rem'
                }}
              >
                {name || '(removed asset)'}
                <button
                  type="button"
                  onClick={() => remove(id)}
                  title="Remove"
                  aria-label={`Remove ${name || 'asset'}`}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex' }}
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {isSuperAdmin && isManaging && (
        <div style={{ marginTop: '10px', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-border)', background: 'var(--accent-soft)' }}>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Set up to {MAX_COMPANY_ASSETS} asset items (e.g. Laptop, SIM Card, ID Card). They appear in this dropdown for every user.
          </div>

          {companyAssets.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              {editingId === a.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleRename(a.id); } if (e.key === 'Escape') setEditingId(null); }}
                    autoFocus
                    maxLength={60}
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="btn-secondary" style={iconBtn} onClick={() => handleRename(a.id)} title="Save"><Check size={13} /></button>
                  <button type="button" className="btn-secondary" style={iconBtn} onClick={() => setEditingId(null)} title="Cancel"><X size={13} /></button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: '0.84rem' }}>{a.name}</span>
                  <button type="button" className="btn-secondary" style={iconBtn} onClick={() => { setEditingId(a.id); setEditName(a.name); }} title="Rename"><Edit2 size={13} /></button>
                  <button type="button" className="btn-secondary" style={{ ...iconBtn, color: '#ef4444' }} onClick={() => handleDelete(a)} title="Remove"><Trash2 size={13} /></button>
                </>
              )}
            </div>
          ))}

          {isFull ? (
            <div style={{ fontSize: '0.76rem', color: '#ef4444' }}>
              All {MAX_COMPANY_ASSETS} asset items are in use. Remove one to add another.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '6px', marginTop: companyAssets.length ? '4px' : 0 }}>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
                placeholder="New asset name, e.g. Laptop"
                maxLength={60}
                style={{ flex: 1 }}
              />
              <button type="button" className="btn-primary" style={smallBtn} onClick={handleAdd}>
                <Plus size={13} /> Add
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
