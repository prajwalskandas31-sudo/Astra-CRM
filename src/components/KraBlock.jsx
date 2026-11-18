import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { API_BASE_URL, isBackendEnabled, readErrorDetail } from '../services/backendConfig';
import { ShieldCheck, Search, X, Download, PlayCircle, RefreshCw, AlertTriangle } from 'lucide-react';

const formatTime = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

const StatusBadge = ({ status }) => {
  const ok = /validated|registered/i.test(status || '');
  const tone = ok ? 'success' : 'warning';
  return (
    <span className="badge" style={{ fontSize: '0.72rem', fontWeight: 700, background: `var(--status-${tone}-bg)`, color: `var(--status-${tone})`, border: `1px solid var(--status-${tone}-border)` }}>
      {status || 'Saved'}
    </span>
  );
};

/**
 * KRA Block: every client from the Client Information page (one row per PAN), a "Trigger KRA" button that
 * fetches the client's KYC from CVL KRA, and the saved KRA PDF on the server to view or download.
 * Access comes from the Feature Access block; each user sees only the clients they can see elsewhere.
 */
export const KraBlock = () => {
  const { authToken, sales = [] } = useCRM();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [records, setRecords] = useState([]);
  const [connectorReady, setConnectorReady] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busySaleId, setBusySaleId] = useState(null);

  const api = useCallback(async (path, options = {}) => {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${authToken}` }
    });
    if (!res.ok) throw new Error(await readErrorDetail(res, `Server returned ${res.status}`));
    return res;
  }, [authToken]);

  const load = useCallback(async () => {
    if (!authToken || !isBackendEnabled()) return;
    setLoading(true);
    try {
      const data = await (await api('/kra/records')).json();
      setRecords(data.records || []);
      setConnectorReady(!!data.connectorReady);
      setLoadError('');
    } catch (err) {
      setLoadError(err.message || 'Could not load the saved KRA files.');
    } finally {
      setLoading(false);
    }
  }, [api, authToken]);

  useEffect(() => { load(); }, [load]);

  // One row per PAN: the client's most recent sale from the Client Information page
  const clients = useMemo(() => {
    const byPan = new Map();
    for (const s of sales) {
      const pan = String(s.panNumber || s.fullClientInfo?.panNumber || '').trim().toUpperCase();
      if (!pan) continue;
      const prev = byPan.get(pan);
      if (!prev || String(s.date || '') > String(prev.date || '')) byPan.set(pan, s);
    }
    return [...byPan.entries()]
      .map(([pan, s]) => ({
        pan,
        saleId: s.id,
        name: s.fullClientInfo?.clientName || s.contactPerson || s.clientName || '—',
        firm: s.fullClientInfo?.firmName || '',
        phone: s.phone1 || s.fullClientInfo?.phone1 || '',
        submittedBy: s.employeeName || ''
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sales]);

  // Latest saved KRA per PAN (records come newest first)
  const latestByPan = useMemo(() => {
    const map = new Map();
    for (const r of records) if (!map.has(r.pan)) map.set(r.pan, r);
    return map;
  }, [records]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? clients.filter(c => [c.name, c.firm, c.pan, c.phone, c.submittedBy].some(v => v && v.toLowerCase().includes(q)))
    : clients;

  const savedCount = clients.filter(c => latestByPan.has(c.pan)).length;

  const trigger = async (client) => {
    setBusySaleId(client.saleId);
    try {
      const record = await (await api(`/kra/sales/${encodeURIComponent(client.saleId)}/trigger`, { method: 'POST' })).json();
      setRecords(prev => [record, ...prev]);
      showToast(`KRA saved for ${client.name} (${client.pan})${record.kycStatus ? `: ${record.kycStatus}` : ''}.`, 'success');
    } catch (err) {
      showToast(err.message || 'Trigger KRA failed.', 'error');
    } finally {
      setBusySaleId(null);
    }
  };

  const download = async (record) => {
    try {
      const blob = await (await api(`/kra/records/${encodeURIComponent(record.id)}/pdf`)).blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = record.fileName || `KRA_${record.pan}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      showToast(err.message || 'Could not download the KRA file.', 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="directory-card" style={{ overflow: 'hidden' }}>
        <div className="directory-toolbar">
          <div className="directory-title-area">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="var(--accent)" /> KRA Block
            </h3>
            <p>
              Clients from the Client Information page, by PAN. Trigger KRA fetches the client's KYC from CVL KRA
              and saves the KRA file on the server. {clients.length} client{clients.length === 1 ? '' : 's'}, {savedCount} with a saved KRA.
            </p>
          </div>
          <button className="btn-secondary" onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {connectorReady === false && (
          <div style={{ margin: '0 20px 12px', padding: '10px 14px', borderRadius: '10px', display: 'flex', gap: '10px', alignItems: 'flex-start', background: 'var(--status-warning-bg)', color: 'var(--status-warning)', border: '1px solid var(--status-warning-border)', fontSize: '0.82rem' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>The CVL KRA connection is not set up yet (waiting for the CVL KRA API document). Trigger KRA will work once it is connected.</span>
          </div>
        )}
        {loadError && (
          <div style={{ margin: '0 20px 12px', fontSize: '0.82rem', color: 'var(--status-danger)' }}>{loadError}</div>
        )}

        <div className="paid-filters">
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by client, PAN, phone or executive..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '32px', paddingRight: search ? '32px' : '12px', width: '100%', fontSize: '0.83rem', height: '36px', boxSizing: 'border-box' }}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Clear search" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', lineHeight: 1 }}>
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
            {clients.length === 0 ? 'No clients with a PAN on the Client Information page yet.' : 'No clients match this search.'}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>PAN</th>
                  <th>Phone</th>
                  <th>Executive</th>
                  <th>KRA</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const rec = latestByPan.get(c.pan);
                  const busy = busySaleId === c.saleId;
                  return (
                    <tr key={c.pan}>
                      <td style={{ fontWeight: 600 }}>
                        {c.name}
                        {c.firm && <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 500 }}>{c.firm}</div>}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{c.pan}</td>
                      <td style={{ fontSize: '0.8rem' }}>{c.phone || '—'}</td>
                      <td style={{ fontSize: '0.8rem' }}>{c.submittedBy || '—'}</td>
                      <td style={{ fontSize: '0.78rem' }}>
                        {rec ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                            <StatusBadge status={rec.kycStatus} />
                            <span style={{ color: 'var(--text-muted)' }}>{formatTime(rec.fetchedAt)} · {rec.fetchedByName}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Not fetched</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          {rec && (
                            <button className="btn-secondary" onClick={() => download(rec)} title={rec.fileName} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
                              <Download size={13} /> KRA File
                            </button>
                          )}
                          <button
                            className="btn-primary"
                            onClick={() => trigger(c)}
                            disabled={busy || busySaleId !== null}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}
                          >
                            <PlayCircle size={13} /> {busy ? 'Fetching...' : rec ? 'Trigger KRA Again' : 'Trigger KRA'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
