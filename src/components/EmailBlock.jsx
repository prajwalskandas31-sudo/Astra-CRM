import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import {
  Mail, AtSign, Save, RotateCcw, Send, Upload, Trash2, Download, Paperclip, FileSignature,
  CheckCircle2, Clock, AlertCircle, KeyRound, Search, FileText
} from 'lucide-react';
import {
  getEmailSettings, saveEmailSettings, clearSmtpPassword, sendTestEmail,
  listWelcomeKitFiles, uploadWelcomeKitFile, deleteWelcomeKitFile, downloadWelcomeKitFile,
  previewWelcomeKit, sendWelcomeKit, getWelcomeKitLog, describeSend
} from '../services/emailService';

const SECURITY = [
  { value: 'ssl', label: 'SSL/TLS (port 465)', port: 465 },
  { value: 'starttls', label: 'STARTTLS (port 587)', port: 587 },
  { value: 'none', label: 'None (port 25)', port: 25 }
];

const SENDER_FIELDS = ['senderEmail', 'senderName', 'replyTo', 'smtpHost', 'smtpPort', 'smtpSecurity', 'smtpUsername'];
const MESSAGE_FIELDS = ['subject', 'body'];

const formatBytes = (n) => {
  if (!n) return '0 KB';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const pick = (obj, keys) => Object.fromEntries(keys.map(k => [k, obj?.[k] ?? '']));

const SectionHeader = ({ icon: Icon, title, children }) => (
  <div style={{ padding: '20px 20px 0' }}>
    <h4 style={{ margin: 0, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Icon size={16} color="var(--accent)" /> {title}
    </h4>
    <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{children}</p>
  </div>
);

const btn = { display: 'inline-flex', alignItems: 'center', gap: '6px' };

export const EmailBlock = () => {
  const { currentUser, sales = [] } = useCRM();
  const { showToast } = useToast();
  const canEdit = currentUser?.role === 'Super Admin';

  const [settings, setSettings] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [sender, setSender] = useState(pick({}, SENDER_FIELDS));
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState(pick({}, MESSAGE_FIELDS));
  const [files, setFiles] = useState({ slots: [], totalBytes: 0, maxFileBytes: 0, maxTotalBytes: 0 });
  const [busySlot, setBusySlot] = useState(null);
  const [busy, setBusy] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [log, setLog] = useState([]);

  const load = useCallback(async () => {
    try {
      const [s, f, l] = await Promise.all([getEmailSettings(), listWelcomeKitFiles(), getWelcomeKitLog()]);
      setSettings(s);
      setSender(pick(s, SENDER_FIELDS));
      setMessage(pick(s, MESSAGE_FIELDS));
      setFiles(f);
      setLog(l);
      setLoadError('');
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const senderDirty = settings && (SENDER_FIELDS.some(k => String(sender[k]) !== String(settings[k] ?? '')) || password);
  const messageDirty = settings && MESSAGE_FIELDS.some(k => message[k] !== (settings[k] ?? ''));

  const saveSender = async (e) => {
    e.preventDefault();
    if (!sender.senderEmail.trim()) {
      showToast('Sender Email ID is required.', 'error');
      return;
    }
    setBusy('sender');
    try {
      const saved = await saveEmailSettings({ ...sender, smtpPort: Number(sender.smtpPort) || 465, smtpPassword: password || null });
      setSettings(s => ({ ...s, ...saved }));
      setSender(pick(saved, SENDER_FIELDS));
      setPassword('');
      showToast(`Sender Email ID saved. Welcome Kits will be sent from ${saved.senderEmail}.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const saveMessage = async (e) => {
    e.preventDefault();
    setBusy('message');
    try {
      const saved = await saveEmailSettings(message);
      setSettings(s => ({ ...s, ...saved }));
      setMessage(pick(saved, MESSAGE_FIELDS));
      showToast('Welcome Kit email message saved.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const handleTest = async () => {
    setBusy('test');
    try {
      const res = await sendTestEmail();
      showToast(`Test email sent from ${res.from} to ${res.to}. Check that inbox.`, 'success');
    } catch (err) {
      showToast(`Test email failed: ${err.message}`, 'error');
    } finally {
      setBusy('');
    }
  };

  const handleClearPassword = async () => {
    if (!window.confirm('Remove the saved mailbox password? No email can be sent until a new one is saved.')) return;
    try {
      const saved = await clearSmtpPassword();
      setSettings(s => ({ ...s, ...saved }));
      showToast('SMTP password removed.', 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleUpload = async (slot, file) => {
    if (!file) return;
    if (files.maxFileBytes && file.size > files.maxFileBytes) {
      showToast(`${file.name} is ${formatBytes(file.size)}; each file can be at most ${formatBytes(files.maxFileBytes)}.`, 'error');
      return;
    }
    setBusySlot(slot);
    try {
      await uploadWelcomeKitFile(slot, file);
      setFiles(await listWelcomeKitFiles());
      showToast(`${file.name} uploaded to slot ${slot}.`, 'success');
    } catch (err) {
      showToast(`Upload failed: ${err.message}`, 'error');
    } finally {
      setBusySlot(null);
    }
  };

  const handleRemove = async (s) => {
    if (!window.confirm(`Remove ${s.fileName} from slot ${s.slot}?`)) return;
    setBusySlot(s.slot);
    try {
      await deleteWelcomeKitFile(s.slot);
      setFiles(await listWelcomeKitFiles());
      showToast(`Slot ${s.slot} cleared.`, 'info');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusySlot(null);
    }
  };

  if (loadError) {
    return (
      <div className="directory-card" style={{ padding: '24px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}><Mail size={18} color="var(--accent)" /> Email Block</h3>
        <p style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertCircle size={16} /> {loadError}</p>
        <button className="btn-secondary" onClick={load}>Try again</button>
      </div>
    );
  }

  const filledCount = files.slots.filter(s => s.filled).length;
  // The mail server details are set once; keep them out of sight unless they are missing or asked for
  const showAdvanced = advancedOpen || !settings?.smtpHost;
  const fieldProps = (key, extra = {}) => ({
    id: `email-${key}`,
    value: sender[key],
    onChange: e => setSender(d => ({ ...d, [key]: e.target.value })),
    readOnly: !canEdit,
    autoComplete: 'off',
    ...extra
  });

  return (
    <div className="directory-card" style={{ overflow: 'hidden' }}>
      <div className="directory-toolbar">
        <div className="directory-title-area">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Mail size={18} color="var(--accent)" /> Email Block
          </h3>
          <p>
            The address client emails are sent from and the Welcome Kit files. "Send Welcome Kit" emails the client every uploaded
            file and, once they have completed the Leegality e-sign, their signed agreement and e-KYC documents.
          </p>
        </div>
      </div>

      {/* ─── Sender Email ID ─── */}
      <SectionHeader icon={AtSign} title="Sender Email ID">
        {canEdit
          ? 'Every Welcome Kit is sent from this address.'
          : 'The address Welcome Kits are sent from. Only a Super Admin can change it.'}
      </SectionHeader>
      <form onSubmit={saveSender} style={{ padding: '16px 20px 20px' }}>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="email-senderEmail">Sender Email ID{canEdit ? ' *' : ''}</label>
            <input type="email" required placeholder="e.g. welcome@company.com" {...fieldProps('senderEmail')} />
          </div>
          <div className="form-group">
            <label htmlFor="email-senderName">Sender Name</label>
            <input type="text" placeholder="e.g. Company Welcome Desk" {...fieldProps('senderName')} />
          </div>
          <div className="form-group">
            <label htmlFor="email-replyTo">Replies go to</label>
            <input type="email" placeholder="Company Profile email (leave blank to use it)" {...fieldProps('replyTo')} />
          </div>
          {showAdvanced && (
            <>
            <div className="form-group">
              <label htmlFor="email-smtpHost">SMTP Server{canEdit ? ' *' : ''}</label>
              <input type="text" placeholder="e.g. smtp.gmail.com" {...fieldProps('smtpHost')} />
            </div>
            <div className="form-group">
              <label htmlFor="email-smtpSecurity">Security</label>
              <select
                id="email-smtpSecurity"
                value={sender.smtpSecurity}
                disabled={!canEdit}
                onChange={e => {
                  const mode = SECURITY.find(m => m.value === e.target.value);
                  setSender(d => ({ ...d, smtpSecurity: mode.value, smtpPort: mode.port }));
                }}
              >
                {SECURITY.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="email-smtpPort">SMTP Port</label>
              <input type="number" min="1" max="65535" {...fieldProps('smtpPort')} />
            </div>
            <div className="form-group">
              <label htmlFor="email-smtpUsername">SMTP Username</label>
              <input type="text" placeholder={sender.senderEmail || 'Same as Sender Email ID'} {...fieldProps('smtpUsername')} />
            </div>
            </>
          )}
          {canEdit && (
            <div className="form-group">
              <label htmlFor="email-smtpPassword">Mailbox Password{settings?.passwordSet ? '' : ' *'}</label>
              <input
                id="email-smtpPassword"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={settings?.passwordSet ? 'Saved — leave blank to keep it' : 'Enter the mailbox password'}
                autoComplete="new-password"
              />
            </div>
          )}
        </div>
        {settings?.smtpHost && (
          <button type="button" onClick={() => setAdvancedOpen(o => !o)}
            style={{ background: 'none', border: 'none', padding: 0, marginTop: '10px', color: 'var(--text-muted)', fontSize: '0.76rem', cursor: 'pointer' }}>
            {advancedOpen ? '▾ Hide mail server settings' : '▸ Advanced mail server settings'}
          </button>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: settings?.passwordSet ? '#10b981' : 'var(--text-muted)', ...btn }}>
            <KeyRound size={13} /> {settings?.passwordSet ? 'Mailbox password saved on the server' : 'No mailbox password saved yet'}
            {canEdit && settings?.passwordSet && (
              <button type="button" onClick={handleClearPassword} className="btn-secondary" style={{ padding: '2px 8px', fontSize: '0.72rem', marginLeft: '6px' }}>
                Remove
              </button>
            )}
          </span>
          {canEdit && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" className="btn-secondary" style={btn} onClick={handleTest}
                disabled={busy === 'test' || senderDirty || !settings?.senderEmail || !settings?.passwordSet}
                title={senderDirty ? 'Save the sender settings first' : `Sends a test email to ${settings?.senderEmail || 'the Sender Email ID'}`}>
                <Send size={14} /> {busy === 'test' ? 'Sending…' : 'Send Test Email'}
              </button>
              <button type="button" className="btn-secondary" style={btn} disabled={!senderDirty}
                onClick={() => { setSender(pick(settings, SENDER_FIELDS)); setPassword(''); }}>
                <RotateCcw size={14} /> Discard
              </button>
              <button type="submit" className="btn-primary" style={btn} disabled={!senderDirty || busy === 'sender'}>
                <Save size={14} /> {busy === 'sender' ? 'Saving…' : 'Save Sender'}
              </button>
            </div>
          )}
        </div>
      </form>

      {/* ─── Welcome Kit email message ─── */}
      <div style={{ borderTop: '1px solid var(--border-color)' }}>
        <SectionHeader icon={FileText} title="Welcome Kit Email">
          The subject and message sent with the kit. {'{clientName}'} and {'{companyName}'} are replaced with the client's name and the Company Profile name.
        </SectionHeader>
        <form onSubmit={saveMessage} style={{ padding: '16px 20px 20px' }}>
          <div className="form-group">
            <label htmlFor="email-subject">Subject</label>
            <input id="email-subject" type="text" value={message.subject} readOnly={!canEdit}
              onChange={e => setMessage(m => ({ ...m, subject: e.target.value }))} />
          </div>
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label htmlFor="email-body">Message</label>
            <textarea id="email-body" rows={7} value={message.body} readOnly={!canEdit}
              onChange={e => setMessage(m => ({ ...m, body: e.target.value }))} />
          </div>
          {canEdit && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <button type="button" className="btn-secondary" style={btn} disabled={!messageDirty} onClick={() => setMessage(pick(settings, MESSAGE_FIELDS))}>
                <RotateCcw size={14} /> Discard
              </button>
              <button type="submit" className="btn-primary" style={btn} disabled={!messageDirty || busy === 'message'}>
                <Save size={14} /> Save Message
              </button>
            </div>
          )}
        </form>
      </div>

      {/* ─── Welcome Kit files ─── */}
      <div style={{ borderTop: '1px solid var(--border-color)' }}>
        <SectionHeader icon={Paperclip} title={`Welcome Kit Files (${filledCount} of ${files.slots.length || 19} uploaded)`}>
          Every uploaded file is attached to the Welcome Kit; empty slots are skipped. Up to {formatBytes(files.maxFileBytes)} per file
          and {formatBytes(files.maxTotalBytes)} in total ({formatBytes(files.totalBytes)} used), so the email stays within mail-server limits.
        </SectionHeader>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px', padding: '16px 20px 20px'
        }}>
          {files.slots.map(s => (
            <SlotCard key={s.slot} slot={s} canEdit={canEdit} busy={busySlot === s.slot}
              onUpload={file => handleUpload(s.slot, file)}
              onRemove={() => handleRemove(s)}
              onDownload={() => downloadWelcomeKitFile(s.slot, s.fileName).catch(err => showToast(err.message, 'error'))} />
          ))}
        </div>
      </div>

      {/* ─── Send Welcome Kit ─── */}
      <div style={{ borderTop: '1px solid var(--border-color)' }}>
        <SectionHeader icon={Send} title="Send Welcome Kit">
          Pick a client. The kit goes to the Email ID on their Client Information Page, from {settings?.senderEmail || 'the Sender Email ID above'}.
        </SectionHeader>
        <WelcomeKitSender sales={sales} onSent={async () => setLog(await getWelcomeKitLog())} />
      </div>

      {/* ─── Recent sends ─── */}
      {log.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-color)' }}>
          <SectionHeader icon={Clock} title="Recently Sent Welcome Kits">The last {log.length} Welcome Kit emails.</SectionHeader>
          <div style={{ overflowX: 'auto', marginTop: '12px' }}>
            <table className="crm-table">
              <thead>
                <tr><th>Sent</th><th>Client</th><th>To</th><th>From</th><th>Attachments</th><th>Signed Agreement</th><th>By</th></tr>
              </thead>
              <tbody>
                {log.map(e => (
                  <tr key={e.id}>
                    <td>{new Date(e.sentAt).toLocaleString('en-IN')}</td>
                    <td style={{ fontWeight: 600 }}>{e.clientName}</td>
                    <td>{e.to}</td>
                    <td>{e.from}</td>
                    <td title={e.attachments.join('\n')}>{e.attachments.length}</td>
                    <td>{e.agreementAttached
                      ? <span style={{ color: '#10b981', ...btn }} title={(e.kycFiles || []).join('\n')}>
                          <CheckCircle2 size={13} /> Attached{e.kycFiles?.length ? ` + ${e.kycFiles.length} e-KYC` : ''}
                        </span>
                      : <span style={{ color: 'var(--text-muted)' }}>{e.agreementDocumentId ? `Not signed yet (${e.agreementStatus || 'pending'})` : 'No e-sign sent'}</span>}
                    </td>
                    <td>{e.sentBy}</td>
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

const SlotCard = ({ slot, canEdit, busy, onUpload, onRemove, onDownload }) => {
  const input = useRef(null);
  return (
    <div style={{
      border: `1px ${slot.filled ? 'solid' : 'dashed'} var(--border-color)`,
      borderRadius: '8px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px', minHeight: '56px',
      opacity: busy ? 0.6 : 1
    }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', minWidth: '22px' }}>{slot.slot}.</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {slot.filled ? (
          <>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={slot.fileName}>
              {slot.fileName}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatBytes(slot.size)}</div>
          </>
        ) : (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{busy ? 'Uploading…' : 'Empty — skipped when sending'}</span>
        )}
      </div>
      {slot.filled && (
        <button type="button" className="btn-secondary" style={{ padding: '4px 7px' }} onClick={onDownload} title="Download">
          <Download size={13} />
        </button>
      )}
      {canEdit && (
        <>
          <input ref={input} type="file" hidden onChange={e => { onUpload(e.target.files?.[0]); e.target.value = ''; }} />
          <button type="button" className="btn-secondary" style={{ padding: '4px 7px' }} disabled={busy}
            onClick={() => input.current?.click()} title={slot.filled ? 'Replace file' : 'Upload file'}>
            <Upload size={13} />
          </button>
          {slot.filled && (
            <button type="button" className="btn-secondary" style={{ padding: '4px 7px', color: '#ef4444' }} disabled={busy}
              onClick={onRemove} title="Remove file">
              <Trash2 size={13} />
            </button>
          )}
        </>
      )}
    </div>
  );
};

const clientEmail = (s) => s.email || s.fullClientInfo?.email || s.clientInfo?.email || '';

const WelcomeKitSender = ({ sales, onSent }) => {
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [saleId, setSaleId] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [sending, setSending] = useState(false);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...sales]
      .filter(s => s.clientName)
      .filter(s => !q || s.clientName.toLowerCase().includes(q) || clientEmail(s).toLowerCase().includes(q))
      // E-signed clients first, then the newest
      .sort((a, b) => (b.eSignStatus === 'Completed') - (a.eSignStatus === 'Completed') || String(b.id).localeCompare(String(a.id)))
      .slice(0, 200);
  }, [sales, query]);

  useEffect(() => {
    setPreview(null);
    setPreviewError('');
    if (!saleId) return;
    let live = true;
    previewWelcomeKit(saleId)
      .then(p => live && setPreview(p))
      .catch(err => live && setPreviewError(err.message));
    return () => { live = false; };
  }, [saleId]);

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await sendWelcomeKit(saleId);
      showToast(describeSend(res), 'success');
      setPreview(await previewWelcomeKit(saleId));
      onSent?.();
    } catch (err) {
      showToast(`Welcome Kit not sent: ${err.message}`, 'error');
    } finally {
      setSending(false);
    }
  };

  const canSend = preview && preview.client.emailValid && preview.from && (preview.files.length > 0 || preview.agreement.documentId);

  return (
    <div style={{ padding: '16px 20px 20px' }}>
      <div className="form-grid">
        <div className="form-group">
          <label htmlFor="wk-search">Find client</label>
          <div style={{ position: 'relative' }}>
            <input id="wk-search" type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Name or email" style={{ paddingLeft: '30px' }} />
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="wk-client">Client</label>
          <select id="wk-client" value={saleId} onChange={e => setSaleId(e.target.value)}>
            <option value="">— Select a client ({options.length}) —</option>
            {options.map(s => (
              <option key={s.id} value={s.id}>
                {s.clientName}{clientEmail(s) ? ` — ${clientEmail(s)}` : ' — no email'}{s.eSignStatus === 'Completed' ? ' ✓ e-signed' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {previewError && <p style={{ color: '#ef4444', fontSize: '0.82rem' }}>{previewError}</p>}

      {preview && (
        <div style={{ marginTop: '14px', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px 16px', fontSize: '0.82rem', lineHeight: 1.7 }}>
          <div><strong>To:</strong> {preview.client.email
            ? <>{preview.client.email}{!preview.client.emailValid && <span style={{ color: '#ef4444' }}> (not a valid address)</span>}</>
            : <span style={{ color: '#ef4444' }}>No Email ID on the Client Information Page</span>}</div>
          <div><strong>From:</strong> {preview.from || <span style={{ color: '#ef4444' }}>Set the Sender Email ID first</span>}</div>
          <div><strong>Uploaded files:</strong> {preview.files.length
            ? preview.files.map(f => f.fileName).join(', ')
            : <span style={{ color: 'var(--text-muted)' }}>none uploaded</span>}</div>
          <div style={{ ...btn }}>
            <FileSignature size={14} color={preview.agreement.signed ? '#10b981' : 'var(--text-muted)'} />
            <strong>Signed agreement:</strong>{' '}
            {!preview.agreement.documentId
              ? 'not attached — no Leegality e-sign has been sent for this client'
              : preview.agreement.signed
                ? `attached (document ${preview.agreement.documentId}, fetched from Leegality when sending)`
                : `attached only if the client has completed the e-sign by then (document ${preview.agreement.documentId}, ${preview.agreement.status || 'awaiting signature'})`}
          </div>
          {preview.agreement.documentId && (
            <div style={{ ...btn }}>
              <CheckCircle2 size={14} color={preview.agreement.signed ? '#10b981' : 'var(--text-muted)'} />
              <strong>e-KYC documents:</strong>{' '}
              {preview.agreement.signed
                ? 'attached with the agreement: the Leegality audit trail, the Aadhaar e-KYC certificate (when signed with Aadhaar eSign) and any KYC documents the client uploaded'
                : 'attached once the client completes the e-sign'}
            </div>
          )}
          {preview.lastSent && (
            <div style={{ color: '#f59e0b' }}>
              Already sent on {new Date(preview.lastSent.sentAt).toLocaleString('en-IN')} by {preview.lastSent.sentBy}
              {preview.lastSent.agreementAttached ? ' (with the signed agreement)' : ''}.
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button type="button" className="btn-primary" style={btn} disabled={!canSend || sending}
              onClick={() => {
                if (preview.lastSent && !window.confirm(`A Welcome Kit was already sent to ${preview.client.email}. Send it again?`)) return;
                handleSend();
              }}>
              <Send size={14} /> {sending ? 'Sending…' : 'Send Welcome Kit'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailBlock;
