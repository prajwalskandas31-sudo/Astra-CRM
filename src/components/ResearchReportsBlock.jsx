import React, { useEffect, useState, useCallback } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { API_BASE_URL, isBackendEnabled, readErrorDetail } from '../services/backendConfig';
import { FileText, RefreshCw, Download, RotateCcw, KeyRound, FolderDown, PlayCircle, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';

const STATUS_TONE = { Ready: 'success', Held: 'danger', Queued: 'warning', Generating: 'warning' };

const Tone = ({ tone, children }) => (
  <span
    className="badge"
    style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone})`, border: `1px solid var(--status-${tone}-border)`, fontSize: '0.72rem', fontWeight: 700 }}
  >
    {children}
  </span>
);

const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

const formatTime = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

/**
 * Research Reports: every trade call posted in a Telegram bot becomes a 3-page PDF on the server
 * (chart from Upstox, rationale written by Claude, fixed disclosures) when the team presses Generate:
 * every call posted today in the 4 bots, downloaded as a <date>_report folder (ZIP). Held reports can be retried.
 */
export const ResearchReportsBlock = () => {
  const { authToken, currentUser, simulatedRole } = useCRM();
  const { showToast } = useToast();
  const isSuperAdmin = simulatedRole === 'Super Admin' || currentUser?.role === 'Super Admin';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [testSegment, setTestSegment] = useState('');
  const [testCall, setTestCall] = useState('');
  const [testing, setTesting] = useState(false);
  const [tokenDraft, setTokenDraft] = useState('');
  const [savingToken, setSavingToken] = useState(false);
  // True from pressing Generate until every one of today's reports is Ready or Held; then the folder downloads
  const [generating, setGenerating] = useState(false);

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
      setData(await (await api('/reports')).json());
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load the research reports.');
    } finally {
      setLoading(false);
    }
  }, [api, authToken]);

  const reports = data?.reports || [];
  const pending = reports.some(r => r.status === 'Queued' || r.status === 'Generating');
  const today = data?.status?.today;

  // Faster refresh while reports are being built, so progress shows as each one finishes
  useEffect(() => {
    load();
    const timer = setInterval(load, pending || generating ? 3000 : 30000);
    return () => clearInterval(timer);
  }, [load, pending, generating]);

  const saveFile = async (path, name) => {
    const blob = await (await api(path)).blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const downloadFolder = useCallback(async (summary) => {
    try {
      await saveFile(`/reports/folder?day=${summary.day}`, `${summary.folder}.zip`);
    } catch (err) {
      showToast(err.message || 'Could not download the folder.', 'error');
    }
  }, [api]); // eslint-disable-line react-hooks/exhaustive-deps

  const finishRun = useCallback((summary) => {
    setGenerating(false);
    if (!summary.calls) {
      showToast('No calls have been posted in the Telegram bots today.', 'info');
      return;
    }
    const held = summary.held ? ` ${summary.held} held (see the reason below and press Retry).` : '';
    showToast(`${summary.ready} of ${summary.calls} report(s) ready.${held}`, summary.held ? 'warning' : 'success');
    if (summary.ready) downloadFolder(summary);
  }, [downloadFolder, showToast]);

  // When the last of today's reports is done, download the folder
  useEffect(() => {
    if (generating && today && today.pending === 0) finishRun(today);
  }, [generating, today, finishRun]);

  const generateToday = async () => {
    setGenerating(true);
    try {
      const summary = await (await api('/reports/generate-today', { method: 'POST' })).json();
      if (summary.pending === 0) finishRun(summary);
      else load();
    } catch (err) {
      setGenerating(false);
      showToast(err.message || 'Could not start generating the reports.', 'error');
    }
  };

  const download = async (report) => {
    setBusyId(report.id);
    try {
      await saveFile(`/reports/${report.id}/pdf`, report.fileName || 'report.pdf');
    } catch (err) {
      showToast(err.message || 'Download failed.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const retry = async (report) => {
    setBusyId(report.id);
    try {
      await api(`/reports/${report.id}/retry`, { method: 'POST' });
      showToast('Report queued again.', 'info');
      load();
    } catch (err) {
      showToast(err.message || 'Retry failed.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  // The Upstox Analytics Token (read-only, valid one year) replaces the daily login, which needs an https Redirect URL
  const saveToken = async (e) => {
    e.preventDefault();
    setSavingToken(true);
    try {
      await api('/upstox/analytics-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenDraft })
      });
      setTokenDraft('');
      showToast('Upstox Analytics Token checked with Upstox and saved.', 'success');
      load();
    } catch (err) {
      showToast(err.message || 'Could not save the token.', 'error');
    } finally {
      setSavingToken(false);
    }
  };

  const sendTest = async (e) => {
    e.preventDefault();
    setTesting(true);
    try {
      const record = await (await api('/reports/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment: testSegment, call: testCall })
      })).json();
      showToast('Test report queued. It appears below in a few seconds.', 'info');
      setOpenId(record.id);
      load();
    } catch (err) {
      showToast(err.message || 'Test report failed.', 'error');
    } finally {
      setTesting(false);
    }
  };

  const status = data?.status;
  const analytics = status?.analyticsToken;
  const daysLeft = analytics?.saved ? Math.floor((new Date(analytics.expiresAt) - Date.now()) / 86400000) : null;

  return (
    <div className="directory-card" style={{ overflow: 'hidden' }}>
      <div className="directory-toolbar">
        <div className="directory-title-area">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="var(--accent)" /> Research Reports
          </h3>
          <p>
            Press <strong>Generate today's reports</strong> to make a 3-page report for every call posted today in the 4 Telegram
            bots (1-minute chart from Upstox, technical rationale written by Claude from the next template, disclosures). They
            download as one folder named after today's date. A report that cannot be completed is held, never created half-done.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && <div style={{ color: 'var(--status-danger)', fontSize: '0.85rem' }}><AlertTriangle size={14} /> {error}</div>}

        {today && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', padding: '14px 16px', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '10px' }}>
            <div style={{ flex: '1 1 260px', fontSize: '0.85rem' }}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>Today ({today.date})</div>
              <div style={{ color: 'var(--text-muted)' }}>
                {today.calls} call{today.calls === 1 ? '' : 's'} posted · {today.ready} ready · {today.held} held
                {today.pending ? ` · ${today.pending} in progress` : ''}
              </div>
            </div>
            <button type="button" className="btn-primary" onClick={generateToday} disabled={generating || !today.calls}
              title={today.calls ? '' : 'No calls have been posted in the Telegram bots today'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <PlayCircle size={15} />
              {generating ? `Generating… ${today.ready + today.held} of ${today.calls}` : "Generate today's reports"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => downloadFolder(today)} disabled={!today.ready || generating}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <FolderDown size={15} /> {today.folder}
            </button>
          </div>
        )}

        {status && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', fontSize: '0.82rem' }}>
            {analytics?.saved
              ? <Tone tone="success">Upstox token saved (…{analytics.ending}) · valid until {formatDate(analytics.expiresAt)}</Tone>
              : <Tone tone="danger">{analytics?.expired ? 'Upstox token expired' : 'Upstox token not saved'}</Tone>}
            {status.claudeReady ? <Tone tone="success">Claude ready ({status.model})</Tone> : <Tone tone="danger">Claude API key not set</Tone>}
            <span>Next template: <strong>{status.nextTemplate}</strong> of 15</span>
            {status.profileMissing.length > 0 && (
              <span style={{ color: 'var(--status-danger)' }}>
                Company Profile is missing {status.profileMissing.join(', ')}. Reports are held until it is complete.
              </span>
            )}
          </div>
        )}

        {isSuperAdmin && (!analytics?.saved || daysLeft < 30) && (
          <form onSubmit={saveToken} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', fontSize: '0.82rem' }}>
            <span style={{ flex: '1 1 100%', color: 'var(--text-muted)' }}>
              {analytics?.saved
                ? `The Upstox token expires in ${daysLeft} day(s). Generate a new one in Upstox (Apps, Analytics tab) and paste it here.`
                : 'Paste the Upstox Analytics Token (Upstox, Apps, Analytics tab). It is read-only and lasts one year, so no daily login is needed.'}
            </span>
            <input
              type="password"
              value={tokenDraft}
              onChange={e => setTokenDraft(e.target.value)}
              required
              autoComplete="off"
              placeholder="Upstox Analytics Token"
              aria-label="Upstox Analytics Token"
              style={{ flex: '1 1 260px', minWidth: 0, fontSize: '0.82rem', padding: '6px 10px', height: '36px' }}
            />
            <button type="submit" className="btn-primary" disabled={savingToken || !tokenDraft.trim()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <KeyRound size={14} /> {savingToken ? 'Checking…' : 'Save token'}
            </button>
          </form>
        )}

        {isSuperAdmin && (
          <form onSubmit={sendTest} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-start' }}>
            <select value={testSegment} onChange={e => setTestSegment(e.target.value)} required aria-label="Bot segment for the test report" style={{ fontSize: '0.82rem', padding: '6px 10px', height: '36px' }}>
              <option value="">Segment…</option>
              {['NSE DERIVATIVES', 'MCX DERIVATIVES', 'BSE DERIVATIVES', 'NSE BSE EQUITY', ...(status?.bots || [])]
                .filter((s, i, all) => all.indexOf(s) === i)
                .map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <textarea
              value={testCall}
              onChange={e => setTestCall(e.target.value)}
              required
              rows={2}
              placeholder="e.g. NIFTY 24500 CE Buy 120 SL 100 Tgt 150"
              aria-label="Trade call text for the test report"
              style={{ flex: '1 1 260px', minWidth: 0, fontSize: '0.82rem', padding: '6px 10px' }}
            />
            <button type="submit" className="btn-primary" disabled={testing} title="Builds a report without using up a template in the rotation">
              {testing ? 'Queuing…' : 'Make test report'}
            </button>
          </form>
        )}

        <div className="table-responsive">
          <table className="crm-table">
            <thead>
              <tr><th aria-label="Details" /><th>Time</th><th>Segment</th><th>Call</th><th>Status</th><th>Template</th><th>Report</th></tr>
            </thead>
            <tbody>
              {reports.length === 0 && (
                <tr><td colSpan={7} style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No reports yet. They appear here as calls are posted in the Telegram bots.</td></tr>
              )}
              {reports.map(r => (
                <React.Fragment key={r.id}>
                  <tr style={{ cursor: 'pointer' }} onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                    <td>{openId === r.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{formatTime(r.createdAt)}</td>
                    <td style={{ fontSize: '0.82rem' }}>{r.segment}</td>
                    <td style={{ fontSize: '0.82rem', maxWidth: '320px', whiteSpace: 'pre-wrap' }}>{r.call}</td>
                    <td>
                      <Tone tone={STATUS_TONE[r.status] || 'warning'}>{r.status}</Tone>
                      {r.test && <span style={{ marginLeft: 6, fontSize: '0.72rem' }}>test</span>}
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>{r.templateNumber ? `${r.templateNumber}. ${r.templateName}` : '—'}</td>
                    <td onClick={e => e.stopPropagation()}>
                      {r.status === 'Ready' && (
                        <button type="button" className="btn-secondary" onClick={() => download(r)} disabled={busyId === r.id}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                          <Download size={13} /> {r.fileName}
                        </button>
                      )}
                      {r.status === 'Held' && (
                        <button type="button" className="btn-secondary" onClick={() => retry(r)} disabled={busyId === r.id}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', fontSize: '0.78rem' }}>
                          <RotateCcw size={13} /> Retry
                        </button>
                      )}
                    </td>
                  </tr>
                  {openId === r.id && (
                    <tr>
                      <td />
                      <td colSpan={6} style={{ fontSize: '0.8rem' }}>
                        <div style={{ marginBottom: 6 }}>Posted by {r.postedBy?.name || 'Telegram user'}{r.postedBy?.phone ? ` (${r.postedBy.phone})` : ''}</div>
                        {r.reason && <div style={{ color: 'var(--status-danger)', marginBottom: 6 }}>Held: {r.reason}</div>}
                        {r.details && (
                          <div style={{ marginBottom: 6 }}>
                            {r.details.side} {r.details.symbol} {r.details.strike || ''} {r.details.optionType || ''} · entry {r.details.entry} ·
                            stop-loss {r.details.stopLoss} · target{r.details.targets.length > 1 ? 's' : ''} {r.details.targets.join(', ')} ·
                            risk {r.math?.risk} · reward {r.math?.rr?.join(', ')}
                            {r.expiry ? ` · expiry ${r.expiry}` : ''} · chart {r.chartLabel} ({r.chartDay})
                          </div>
                        )}
                        {r.page2 && <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>{r.page2.replace(/\*\*/g, '')}</div>}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
