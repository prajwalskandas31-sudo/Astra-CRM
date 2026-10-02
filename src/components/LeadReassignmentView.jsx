import React, { useState, useMemo } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import * as XLSX from 'xlsx';
import { 
  Layers, ArrowRight, Calendar, Hash, Globe, Filter, CheckCircle2, Search, 
  RotateCcw, X, BookmarkCheck, FileSpreadsheet, Download, Printer, 
  Copy, Check, BarChart3, TrendingUp, Users, DollarSign, Clock, ShieldCheck, 
  Activity, Eye, ExternalLink, RefreshCw, ChevronRight, Sparkles, Building2
} from 'lucide-react';

export const LeadReassignmentView = () => {
  const { users, leads, dispositions, reassignLeadsFiltered, simulatedRole } = useCRM();
  const { showToast } = useToast();

  const [fromUser, setFromUser] = useState('');
  const [toUser, setToUser] = useState('');
  const [reassignQty, setReassignQty] = useState('');
  const [reassignLang, setReassignLang] = useState('ALL');
  const [reassignDisposition, setReassignDisposition] = useState('ALL');
  const [dateMode, setDateMode] = useState('single'); // 'single' | 'range'
  const [reassignDate, setReassignDate] = useState('');
  const [reassignStartDate, setReassignStartDate] = useState('');
  const [reassignEndDate, setReassignEndDate] = useState('');

  // Table directory search and disposition filter state
  const [tableSearch, setTableSearch] = useState('');
  const [tableDispositionFilter, setTableDispositionFilter] = useState('ALL');

  // Extract available languages from leads
  const availableLanguages = useMemo(() => {
    const langs = new Set(['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Marathi']);
    leads.forEach(l => l.language && langs.add(l.language));
    return Array.from(langs);
  }, [leads]);

  // Extract available dispositions from context and leads
  const availableDispositions = useMemo(() => {
    const dispSet = new Set((dispositions || []).map(d => d.name));
    leads.forEach(l => {
      if (l.disposition) dispSet.add(l.disposition);
    });
    ['New Lead', 'Interested', 'Call Back Later', 'Give Demo Call', 'Follow Up', 'Not Interested', 'Commitment', 'Paid / Converted'].forEach(d => dispSet.add(d));
    return Array.from(dispSet);
  }, [dispositions, leads]);

  // Preview count of matching leads based on selected criteria
  const matchingLeadsCount = useMemo(() => {
    if (!fromUser) return 0;
    return leads.filter(l => {
      if (fromUser !== 'ALL' && l.assignedToId !== fromUser) return false;
      if (reassignLang !== 'ALL' && (l.language || '').toLowerCase() !== reassignLang.toLowerCase()) return false;
      if (reassignDisposition !== 'ALL') {
        const leadDisp = (l.disposition || 'New Lead').trim().toLowerCase();
        if (leadDisp !== reassignDisposition.trim().toLowerCase()) return false;
      }
      
      if (dateMode === 'single') {
        if (reassignDate) {
          const hasMatchingDate = (l.history || []).some(h => (h.date || '').includes(reassignDate)) || 
                                  (l.date && String(l.date).includes(reassignDate)) ||
                                  (l.assignedDate && String(l.assignedDate).includes(reassignDate));
          if (!hasMatchingDate) return false;
        }
      } else {
        if (reassignStartDate || reassignEndDate) {
          const dates = [];
          if (l.assignedDate) dates.push(l.assignedDate);
          if (l.date) dates.push(l.date);
          (l.history || []).forEach(h => {
            if (h.date) dates.push(h.date);
          });
          if (dates.length === 0) return false;
          const matchesRange = dates.some(d => {
            const dStr = String(d).slice(0, 10);
            if (reassignStartDate && dStr < reassignStartDate) return false;
            if (reassignEndDate && dStr > reassignEndDate) return false;
            return true;
          });
          if (!matchesRange) return false;
        }
      }
      return true;
    }).length;
  }, [leads, fromUser, reassignLang, reassignDisposition, dateMode, reassignDate, reassignStartDate, reassignEndDate]);

  // Filtered leads for the Active Lead Directory table
  const filteredTableLeads = useMemo(() => {
    return leads.filter(l => {
      // Disposition filter
      if (tableDispositionFilter !== 'ALL') {
        const leadDisp = (l.disposition || 'New Lead').trim().toLowerCase();
        if (leadDisp !== tableDispositionFilter.trim().toLowerCase()) return false;
      }
      // Text search filter
      if (tableSearch.trim()) {
        const q = tableSearch.trim().toLowerCase();
        const contact = (l.contactPerson || '').toLowerCase();
        const client = (l.clientName || '').toLowerCase();
        const phone = (l.phone || '').toLowerCase();
        const owner = (l.assignedToName || '').toLowerCase();
        const lang = (l.language || '').toLowerCase();
        const disp = (l.disposition || 'New Lead').toLowerCase();
        if (!contact.includes(q) && !client.includes(q) && !phone.includes(q) && !owner.includes(q) && !lang.includes(q) && !disp.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [leads, tableDispositionFilter, tableSearch]);

  // --- END OF DAY (EOD) REPORT GENERATION ENGINE ---
  const [blockView, setBlockView] = useState('directory'); // 'directory' | 'eod-report'
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  // Available unique dates extracted from history logs & creation dates
  const availableHistoryDates = useMemo(() => {
    const dates = new Set();
    dates.add(todayStr);
    leads.forEach(l => {
      (l.history || []).forEach(h => {
        if (h.date) {
          const dStr = String(h.date).trim().slice(0, 10);
          if (dStr) dates.add(dStr);
        }
      });
      if (l.date) dates.add(String(l.date).trim().slice(0, 10));
      if (l.assignedDate) dates.add(String(l.assignedDate).trim().slice(0, 10));
    });
    return Array.from(dates).filter(Boolean).sort().reverse();
  }, [leads, todayStr]);

  // Selected date for End of Day Report
  const [selectedEodDate, setSelectedEodDate] = useState(() => {
    return todayStr;
  });

  const [eodOwnerFilter, setEodOwnerFilter] = useState('ALL');
  const [eodReportSubTab, setEodReportSubTab] = useState('matrix'); // 'matrix' | 'audit-trail'
  const [eodAuditSearch, setEodAuditSearch] = useState('');
  const [eodActionTypeFilter, setEodActionTypeFilter] = useState('ALL');
  const [isCopied, setIsCopied] = useState(false);

  // Helper to parse currency strings like "₹4,00,000" into numeric value
  const parseLeadValue = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const num = parseInt(String(val).replace(/[^0-9]/g, ''), 10);
    return isNaN(num) ? 0 : num;
  };

  const formatINR = (amount) => {
    return '₹' + Number(amount || 0).toLocaleString('en-IN');
  };

  // Extract all daily audit events occurring on selectedEodDate (or all dates if 'ALL')
  const dailyAuditEvents = useMemo(() => {
    const events = [];
    leads.forEach(l => {
      if (eodOwnerFilter !== 'ALL' && l.assignedToId !== eodOwnerFilter && l.assignedToName !== eodOwnerFilter) {
        return;
      }
      (l.history || []).forEach(h => {
        const hDate = String(h.date || '').trim().slice(0, 10);
        const matchesDate = selectedEodDate === 'ALL' || hDate === selectedEodDate;
        if (matchesDate) {
          const lowerText = (h.text || '').toLowerCase();
          let actionType = 'General Update';
          let badgeColor = 'var(--text-secondary)';
          let badgeBg = 'var(--bg-input)';
          let badgeBorder = 'var(--border-default)';

          if (lowerText.includes('reassign')) {
            actionType = 'Reassignment';
            badgeColor = '#818cf8';
            badgeBg = 'rgba(129, 140, 248, 0.15)';
            badgeBorder = 'rgba(129, 140, 248, 0.3)';
          } else if (lowerText.includes('allocate') || lowerText.includes('assignment engine')) {
            actionType = 'Engine Allocation';
            badgeColor = '#38bdf8';
            badgeBg = 'rgba(56, 189, 248, 0.15)';
            badgeBorder = 'rgba(56, 189, 248, 0.3)';
          } else if (lowerText.includes('bulk upload') || lowerText.includes('uploaded')) {
            actionType = 'Bulk Inflow';
            badgeColor = '#34d399';
            badgeBg = 'rgba(52, 211, 153, 0.15)';
            badgeBorder = 'rgba(52, 211, 153, 0.3)';
          } else if (lowerText.includes('disposition')) {
            actionType = 'Stage Shift';
            badgeColor = '#fbbf24';
            badgeBg = 'rgba(251, 191, 36, 0.15)';
            badgeBorder = 'rgba(251, 191, 36, 0.3)';
          }

          events.push({
            id: l.id + '-' + (h.date || '') + '-' + events.length,
            leadId: l.id,
            contactPerson: l.contactPerson || l.clientName || 'Lead #' + l.id,
            clientName: l.clientName || l.contactPerson || '-',
            phone: l.phone || '-',
            language: l.language || 'English',
            currentOwner: l.assignedToName || 'Unassigned',
            currentOwnerId: l.assignedToId,
            value: l.value || '₹4,00,000',
            numericValue: parseLeadValue(l.value),
            disposition: l.disposition || 'New Lead',
            date: h.date || selectedEodDate,
            time: h.time || '',
            by: h.by || '',
            text: h.text,
            actionType,
            badgeColor,
            badgeBg,
            badgeBorder
          });
        }
      });
    });
    return events;
  }, [leads, selectedEodDate, eodOwnerFilter]);

  // Filtered daily audit events for search/filter in Tab 2
  const filteredDailyAuditEvents = useMemo(() => {
    return dailyAuditEvents.filter(ev => {
      if (eodActionTypeFilter !== 'ALL' && ev.actionType !== eodActionTypeFilter) {
        return false;
      }
      if (eodAuditSearch.trim()) {
        const q = eodAuditSearch.trim().toLowerCase();
        const contact = ev.contactPerson.toLowerCase();
        const phone = ev.phone.toLowerCase();
        const owner = ev.currentOwner.toLowerCase();
        const text = ev.text.toLowerCase();
        const type = ev.actionType.toLowerCase();
        if (!contact.includes(q) && !phone.includes(q) && !owner.includes(q) && !text.includes(q) && !type.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [dailyAuditEvents, eodActionTypeFilter, eodAuditSearch]);

  // Executive / Owner Breakdown Matrix for EOD
  const eodOwnerBreakdown = useMemo(() => {
    const ownerMap = new Map();
    
    users.forEach(u => {
      ownerMap.set(u.id, {
        id: u.id,
        name: u.name,
        role: u.role,
        status: u.status,
        leadCount: 0,
        totalValue: 0,
        todayActionsCount: 0,
        dispositions: {}
      });
    });

    ownerMap.set('unassigned', {
      id: 'unassigned',
      name: 'Unassigned',
      role: 'System Pool',
      status: 'Active',
      leadCount: 0,
      totalValue: 0,
      todayActionsCount: 0,
      dispositions: {}
    });

    leads.forEach(l => {
      const ownerId = l.assignedToId && ownerMap.has(l.assignedToId) ? l.assignedToId : 'unassigned';
      const rec = ownerMap.get(ownerId);
      if (rec) {
        rec.leadCount += 1;
        rec.totalValue += parseLeadValue(l.value);
        const disp = l.disposition || 'New Lead';
        rec.dispositions[disp] = (rec.dispositions[disp] || 0) + 1;
      }
    });

    dailyAuditEvents.forEach(ev => {
      if (ev.currentOwnerId && ownerMap.has(ev.currentOwnerId)) {
        ownerMap.get(ev.currentOwnerId).todayActionsCount += 1;
      } else if (ev.currentOwner === 'Unassigned') {
        ownerMap.get('unassigned').todayActionsCount += 1;
      } else {
        for (const rec of ownerMap.values()) {
          if (ev.text.toLowerCase().includes(rec.name.toLowerCase())) {
            rec.todayActionsCount += 1;
            break;
          }
        }
      }
    });

    return Array.from(ownerMap.values()).filter(o => o.leadCount > 0 || o.todayActionsCount > 0);
  }, [users, leads, dailyAuditEvents]);

  // Dispositions Breakdown Matrix for EOD
  const eodDispositionBreakdown = useMemo(() => {
    const dispMap = {};
    leads.forEach(l => {
      const disp = l.disposition || 'New Lead';
      if (!dispMap[disp]) {
        dispMap[disp] = { name: disp, count: 0, totalValue: 0, todayActions: 0 };
      }
      dispMap[disp].count += 1;
      dispMap[disp].totalValue += parseLeadValue(l.value);
    });

    dailyAuditEvents.forEach(ev => {
      if (dispMap[ev.disposition]) {
        dispMap[ev.disposition].todayActions += 1;
      }
    });

    return Object.values(dispMap).sort((a, b) => b.count - a.count);
  }, [leads, dailyAuditEvents]);

  // Aggregated EOD Metrics
  const totalDirectoryValue = useMemo(() => {
    return leads.reduce((acc, l) => acc + parseLeadValue(l.value), 0);
  }, [leads]);

  const todayReassignmentsCount = useMemo(() => {
    return dailyAuditEvents.filter(e => e.actionType === 'Reassignment' || e.actionType === 'Engine Allocation').length;
  }, [dailyAuditEvents]);

  const todayInflowsCount = useMemo(() => {
    return dailyAuditEvents.filter(e => e.actionType === 'Bulk Inflow').length;
  }, [dailyAuditEvents]);

  const activeEngagedOwnersCount = useMemo(() => {
    return eodOwnerBreakdown.filter(o => o.id !== 'unassigned' && (o.leadCount > 0 || o.todayActionsCount > 0)).length;
  }, [eodOwnerBreakdown]);

  // EXPORT HANDLER: Excel (.xlsx)
  const exportEodToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Executive KPI Summary
      const summaryRows = [
        { Parameter: 'Report Title', Value: 'Astra CRM - End of Day (EOD) Executive Report' },
        { Parameter: 'Report Target Date', Value: selectedEodDate === 'ALL' ? 'All Historic Logs' : selectedEodDate },
        { Parameter: 'Generated Timestamp', Value: new Date().toLocaleString() },
        { Parameter: 'Generated By Role', Value: simulatedRole },
        { Parameter: 'Total Active Leads in Directory', Value: leads.length },
        { Parameter: 'Total Portfolio Pipeline Value', Value: formatINR(totalDirectoryValue) },
        { Parameter: "Selected Day's Total Audit Events", Value: dailyAuditEvents.length },
        { Parameter: 'Daily Reassignments / Transfers', Value: todayReassignmentsCount },
        { Parameter: 'Daily New Inflows / Bulk Uploads', Value: todayInflowsCount },
        { Parameter: 'Active Executives Engaged', Value: activeEngagedOwnersCount }
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'EOD_Executive_Summary');

      // Sheet 2: Owner Workload Matrix
      const ownerRows = eodOwnerBreakdown.map(o => ({
        'Owner / Executive': o.name,
        'Role': o.role,
        'Active Leads Held': o.leadCount,
        'Managed Value (INR)': o.totalValue,
        "Today's Actions Logged": o.todayActionsCount,
        'Dispositions Mix': Object.entries(o.dispositions).map(([k, v]) => `${k} (${v})`).join(', ')
      }));
      const wsOwner = XLSX.utils.json_to_sheet(ownerRows);
      XLSX.utils.book_append_sheet(wb, wsOwner, 'Executive_Workload');

      // Sheet 3: Dispositions Pipeline
      const dispRows = eodDispositionBreakdown.map(d => ({
        'Disposition Stage': d.name,
        'Lead Count': d.count,
        'Total Value (INR)': d.totalValue,
        '% of Pipeline': ((d.count / (leads.length || 1)) * 100).toFixed(1) + '%',
        'Daily Actions Logged': d.todayActions
      }));
      const wsDisp = XLSX.utils.json_to_sheet(dispRows);
      XLSX.utils.book_append_sheet(wb, wsDisp, 'Pipeline_Dispositions');

      // Sheet 4: Daily Immutable Audit Logs
      const auditRows = dailyAuditEvents.map((ev, idx) => ({
        'Sl No': idx + 1,
        'Date': ev.date,
        'Contact Name': ev.contactPerson,
        'Phone Number': ev.phone,
        'Language': ev.language,
        'Current Owner': ev.currentOwner,
        'Disposition': ev.disposition,
        'Value': ev.value,
        'Action Classification': ev.actionType,
        'Audit Trail Log Entry': ev.text
      }));
      const wsAudit = XLSX.utils.json_to_sheet(auditRows);
      XLSX.utils.book_append_sheet(wb, wsAudit, 'Daily_Audit_Logs');

      XLSX.writeFile(wb, `EOD_Report_${selectedEodDate}.xlsx`);
      showToast(`EOD Report (${selectedEodDate}) exported to Excel (.xlsx)!`, 'success');
    } catch (err) {
      showToast('Error exporting to Excel: ' + err.message, 'error');
    }
  };

  // EXPORT HANDLER: CSV (.csv)
  const exportEodToCSV = () => {
    try {
      const headers = ['Date', 'Contact Name', 'Phone Number', 'Language', 'Current Owner', 'Disposition', 'Value', 'Action Classification', 'Audit Log Trail'];
      const rows = dailyAuditEvents.map(ev => [
        `"${ev.date}"`,
        `"${ev.contactPerson}"`,
        `"${ev.phone}"`,
        `"${ev.language}"`,
        `"${ev.currentOwner}"`,
        `"${ev.disposition}"`,
        `"${ev.value}"`,
        `"${ev.actionType}"`,
        `"${(ev.text || '').replace(/"/g, '""')}"`
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `EOD_Audit_Report_${selectedEodDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`EOD Audit Report (${selectedEodDate}) exported to CSV!`, 'success');
    } catch (err) {
      showToast('Error exporting CSV: ' + err.message, 'error');
    }
  };

  // COPY HANDLER: Briefing for Slack / WhatsApp
  const copyEodBriefing = () => {
    const text = `📊 *ASTRA CRM — END OF DAY REPORT*
📅 *Report Date:* ${selectedEodDate === 'ALL' ? 'All Historic Trail' : selectedEodDate}
⏰ *Generated At:* ${new Date().toLocaleTimeString()}

📈 *KEY EXECUTIVE METRICS:*
• Total Active Leads: ${leads.length}
• Total Portfolio Value: ${formatINR(totalDirectoryValue)}
• Audit Actions Logged: ${dailyAuditEvents.length}
• Reassignments Executed: ${todayReassignmentsCount}
• Active Owners Engaged: ${activeEngagedOwnersCount}

👥 *EXECUTIVE / OWNER WORKLOAD:*
${eodOwnerBreakdown.map(o => `• ${o.name} (${o.role}): ${o.leadCount} leads | ${formatINR(o.totalValue)} | ${o.todayActionsCount} actions`).join('\n')}

🏷️ *PIPELINE DISPOSITIONS:*
${eodDispositionBreakdown.map(d => `• ${d.name}: ${d.count} leads (${formatINR(d.totalValue)})`).join('\n')}

📜 *AUDIT LOG ACTIONS TODAY (${dailyAuditEvents.length} Events):*
${dailyAuditEvents.slice(0, 10).map((ev, i) => `${i + 1}. [${ev.contactPerson} / ${ev.currentOwner}] ${ev.text}`).join('\n')}${dailyAuditEvents.length > 10 ? `\n...and ${dailyAuditEvents.length - 10} more entries.` : ''}

*Report generated from Active Lead Directory & Immutable History Logs.*`;

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    showToast('End of Day briefing copied to clipboard! Ready to paste into Slack/WhatsApp.', 'success');
    setTimeout(() => setIsCopied(false), 3000);
  };


  const handleManualReassignment = (e) => {
    e.preventDefault();
    if (!fromUser || !toUser) {
      showToast('Please select both Source User and Target User.', 'warning');
      return;
    }
    if (fromUser === toUser) {
      showToast('Source and Target user cannot be the same person.', 'warning');
      return;
    }

    if (matchingLeadsCount === 0) {
      showToast('No leads match the selected criteria (User, Language, Disposition, Date).', 'warning');
      return;
    }

    const count = reassignLeadsFiltered({
      fromUserId: fromUser,
      toUserId: toUser,
      quantity: reassignQty ? parseInt(reassignQty, 10) : undefined,
      language: reassignLang,
      disposition: reassignDisposition,
      dateMode,
      date: dateMode === 'single' ? reassignDate : undefined,
      startDate: dateMode === 'range' ? reassignStartDate : undefined,
      endDate: dateMode === 'range' ? reassignEndDate : undefined
    });

    const target = users.find(u => u.id === toUser);
    showToast(`Successfully reassigned ${count} lead(s) to ${target?.name}.`, 'success');
    
    // Reset filters
    setReassignQty('');
    setReassignLang('ALL');
    setReassignDisposition('ALL');
    setReassignDate('');
    setReassignStartDate('');
    setReassignEndDate('');
  };

  const setPresetRange = (preset) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    if (preset === 'today') {
      setReassignStartDate(todayStr);
      setReassignEndDate(todayStr);
    } else if (preset === 'last7') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setReassignStartDate(d.toISOString().split('T')[0]);
      setReassignEndDate(todayStr);
    } else if (preset === 'last30') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setReassignStartDate(d.toISOString().split('T')[0]);
      setReassignEndDate(todayStr);
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      setReassignStartDate(firstDay);
      setReassignEndDate(todayStr);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Reassignment Panel */}
      <div className="directory-card" style={{ padding: '20px 24px' }}>
        <h3 style={{ fontSize: '1.05rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={18} color="var(--accent-primary)" /> Lead Reassignment Protocol
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Super Admin and Admin can reassign leads based on <strong>Quantity</strong>, <strong>Language</strong>, <strong>Disposition</strong>, and <strong>Date</strong> (Single Date or Date Range) filters.
        </p>

        {simulatedRole === 'Super Admin' || simulatedRole === 'Admin' ? (
          <form onSubmit={handleManualReassignment}>
            <div className="form-grid" style={{ marginBottom: '16px' }}>
              {/* Source User */}
              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '0.82rem' }}>Reassign From (Source User) *</label>
                <select value={fromUser} onChange={(e) => setFromUser(e.target.value)} required>
                  <option value="">-- Choose Source User --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.status}) - {u.role}</option>
                  ))}
                </select>
              </div>

              {/* Target User */}
              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '0.82rem' }}>Reassign To (Target User) *</label>
                <select value={toUser} onChange={(e) => setToUser(e.target.value)} required>
                  <option value="">-- Choose Active Target User --</option>
                  {users.filter(u => u.status === 'Active' && u.id !== fromUser).map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              {/* 3-Column Filter Row: Quantity, Language, Disposition */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', gridColumn: 'span 2' }}>
                {/* Quantity */}
                <div className="form-group">
                  <label style={{ fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Hash size={13} /> Quantity (Optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={reassignQty}
                    onChange={(e) => setReassignQty(e.target.value)}
                    placeholder="e.g. 15 (leave empty for all)"
                  />
                </div>

                {/* Language */}
                <div className="form-group">
                  <label style={{ fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Globe size={13} /> Language Filter
                  </label>
                  <select value={reassignLang} onChange={(e) => setReassignLang(e.target.value)}>
                    <option value="ALL">All Languages</option>
                    {availableLanguages.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>

                {/* Disposition Filter */}
                <div className="form-group">
                  <label style={{ fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <BookmarkCheck size={13} color="var(--accent-primary)" /> Disposition Filter
                  </label>
                  <select value={reassignDisposition} onChange={(e) => setReassignDisposition(e.target.value)}>
                    <option value="ALL">All Dispositions</option>
                    {availableDispositions.map(d => {
                      const countInSource = fromUser && fromUser !== 'ALL'
                        ? leads.filter(l => l.assignedToId === fromUser && (l.disposition || 'New Lead').toLowerCase() === d.toLowerCase()).length
                        : null;
                      return (
                        <option key={d} value={d}>
                          {d} {countInSource !== null ? `(${countInSource})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Date Filter (Calendar Picker) */}
              <div className="form-group" style={{ gridColumn: 'span 2', background: 'var(--bg-card, rgba(255,255,255,0.02))', padding: '14px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                  <label style={{ fontWeight: 700, fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '6px', margin: 0, color: 'var(--text-primary)' }}>
                    <Calendar size={15} color="var(--accent-primary)" /> Date Filter (Calendar Picker)
                  </label>
                  
                  {/* Mode Selector Tabs */}
                  <div style={{ display: 'inline-flex', background: 'var(--bg-app)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setDateMode('single')}
                      style={{
                        padding: '4px 12px',
                        fontSize: '0.78rem',
                        fontWeight: dateMode === 'single' ? 600 : 500,
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        background: dateMode === 'single' ? 'var(--accent-primary)' : 'transparent',
                        color: dateMode === 'single' ? '#fff' : 'var(--text-secondary)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      📅 Single Date
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateMode('range')}
                      style={{
                        padding: '4px 12px',
                        fontSize: '0.78rem',
                        fontWeight: dateMode === 'range' ? 600 : 500,
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        background: dateMode === 'range' ? 'var(--accent-primary)' : 'transparent',
                        color: dateMode === 'range' ? '#fff' : 'var(--text-secondary)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      📆 Range of Dates (From - To)
                    </button>
                  </div>
                </div>

                {dateMode === 'single' ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <input
                        type="date"
                        value={reassignDate}
                        onChange={(e) => setReassignDate(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
                      />
                    </div>
                    {reassignDate && (
                      <button
                        type="button"
                        onClick={() => setReassignDate('')}
                        className="btn-secondary"
                        style={{ padding: '8px 14px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                        title="Clear Date"
                      >
                        Clear Date
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px', fontWeight: 600 }}>From (Start Date):</label>
                        <input
                          type="date"
                          value={reassignStartDate}
                          onChange={(e) => setReassignStartDate(e.target.value)}
                          style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px', fontWeight: 600 }}>To (End Date):</label>
                        <input
                          type="date"
                          value={reassignEndDate}
                          onChange={(e) => setReassignEndDate(e.target.value)}
                          style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>
                    
                    {/* Quick Preset Range Filters */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', paddingTop: '4px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Quick Presets:</span>
                        <button type="button" onClick={() => setPresetRange('today')} className="btn-secondary" style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: '4px' }}>Today</button>
                        <button type="button" onClick={() => setPresetRange('last7')} className="btn-secondary" style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: '4px' }}>Last 7 Days</button>
                        <button type="button" onClick={() => setPresetRange('last30')} className="btn-secondary" style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: '4px' }}>Last 30 Days</button>
                        <button type="button" onClick={() => setPresetRange('thisMonth')} className="btn-secondary" style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: '4px' }}>This Month</button>
                      </div>
                      {(reassignStartDate || reassignEndDate) && (
                        <button
                          type="button"
                          onClick={() => { setReassignStartDate(''); setReassignEndDate(''); }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#f87171',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: '2px 6px'
                          }}
                        >
                          Clear Date Range
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Matching leads live badge */}
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Matching Pool:</span>
                <span className="badge" style={{ padding: '6px 12px', fontSize: '0.82rem', background: matchingLeadsCount > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.1)', color: matchingLeadsCount > 0 ? '#10b981' : '#ef4444', width: 'fit-content' }}>
                  {fromUser ? `${matchingLeadsCount} matching lead(s) found` : 'Select Source User'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={!fromUser || !toUser || matchingLeadsCount === 0}
                style={{ padding: '10px 20px', fontSize: '0.85rem' }}
              >
                Execute Filtered Reassignment <ArrowRight size={15} />
              </button>
            </div>
          </form>
        ) : (
          <div className="alert-box alert-warning">
            Lead reassignment protocol is restricted to Super Admin and Admin roles.
          </div>
        )}
      </div>

      {/* Active Leads Directory & Audit Logs Table */}
      <div className="directory-card eod-printable-report">
        <div className="directory-toolbar no-print" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div className="directory-title-area">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {blockView === 'directory' ? 'Active Lead Directory & History Logs' : 'End of Day (EOD) Report Generation'}
              <span style={{ fontSize: '0.74rem', background: 'var(--accent-soft)', color: 'var(--accent-primary)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid var(--accent-border)' }}>
                {blockView === 'directory' ? `${filteredTableLeads.length} leads` : `${selectedEodDate === 'ALL' ? 'All Historic' : selectedEodDate}`}
              </span>
            </h3>
            <p>
              {blockView === 'directory' 
                ? 'Immutable audit trail maintained across reassignment transfers.'
                : 'Comprehensive end-of-day reconciliation derived from active lead directory & immutable history logs.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginLeft: 'auto' }}>
            {/* View Switcher: Directory vs EOD Report */}
            <div style={{ display: 'flex', background: 'var(--bg-input)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
              <button
                type="button"
                className={`btn-secondary ${blockView === 'directory' ? 'active' : ''}`}
                onClick={() => setBlockView('directory')}
                style={{
                  padding: '5px 12px',
                  fontSize: '0.78rem',
                  border: 'none',
                  background: blockView === 'directory' ? 'var(--accent-primary)' : 'transparent',
                  color: blockView === 'directory' ? '#fff' : 'var(--text-secondary)',
                  fontWeight: blockView === 'directory' ? 600 : 500,
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                📋 Directory & Logs
              </button>
              <button
                type="button"
                className={`btn-secondary ${blockView === 'eod-report' ? 'active' : ''}`}
                onClick={() => setBlockView('eod-report')}
                style={{
                  padding: '5px 12px',
                  fontSize: '0.78rem',
                  border: 'none',
                  background: blockView === 'eod-report' ? 'var(--accent-primary)' : 'transparent',
                  color: blockView === 'eod-report' ? '#fff' : 'var(--text-secondary)',
                  fontWeight: blockView === 'eod-report' ? 600 : 500,
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Sparkles size={13} /> End of Day Report
              </button>
            </div>

            {blockView === 'directory' ? (
              <>
                {/* Search Input */}
                <div className="search-input-wrapper">
                  <Search className="search-icon" size={15} />
                  <input
                    type="text"
                    placeholder="Search contact, phone, owner..."
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                  />
                  {tableSearch && (
                    <button
                      type="button"
                      onClick={() => setTableSearch('')}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Table Disposition Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Filter size={15} color="var(--text-muted)" />
                  <select
                    className="select-filter"
                    value={tableDispositionFilter}
                    onChange={(e) => setTableDispositionFilter(e.target.value)}
                    style={{ minWidth: '150px' }}
                  >
                    <option value="ALL">All Dispositions</option>
                    {availableDispositions.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {(tableSearch || tableDispositionFilter !== 'ALL') && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => { setTableSearch(''); setTableDispositionFilter('ALL'); }}
                    title="Reset Directory Filters"
                    style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <RotateCcw size={13} /> Reset
                  </button>
                )}

                {/* Primary Trigger Button for EOD Generation */}
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setBlockView('eod-report')}
                  style={{
                    padding: '7px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'linear-gradient(135deg, var(--accent-primary), #6366f1)',
                    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)'
                  }}
                  title="Generate End of Day Report based on Active Lead Directory & History Logs"
                >
                  <FileSpreadsheet size={15} /> Generate EOD Report
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={exportEodToExcel}
                  style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Export complete report to Excel (.xlsx)"
                >
                  <FileSpreadsheet size={14} color="#10b981" /> Export Excel
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={exportEodToCSV}
                  style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Export audit logs to CSV (.csv)"
                >
                  <Download size={14} color="#38bdf8" /> Export CSV
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={copyEodBriefing}
                  style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Copy briefing to clipboard for WhatsApp / Slack"
                >
                  {isCopied ? <Check size={14} color="#10b981" /> : <Copy size={14} />} {isCopied ? 'Copied!' : 'Copy Brief'}
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => window.print()}
                  style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Print or Save as PDF"
                >
                  <Printer size={14} /> Print / PDF
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setBlockView('directory')}
                  style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                >
                  ← Directory Table
                </button>
              </div>
            )}
          </div>
        </div>

        {/* BLOCK VIEW 1: DIRECTORY TABLE & HISTORY LOGS */}
        {blockView === 'directory' ? (
          <>
            {/* Quick EOD Snapshot Bar */}
            <div style={{
              padding: '10px 20px',
              background: 'var(--bg-table-head)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <TrendingUp size={14} color="var(--accent-primary)" /> EOD Directory Snapshot:
                </span>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Total Directory Leads: <strong style={{ color: 'var(--text-primary)' }}>{leads.length}</strong>
                </span>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Pipeline Portfolio: <strong style={{ color: 'var(--accent-primary)' }}>{formatINR(totalDirectoryValue)}</strong>
                </span>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Day's Audit Logs ({selectedEodDate}): <strong style={{ color: '#10b981' }}>{dailyAuditEvents.length} actions</strong>
                </span>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Engaged Owners: <strong style={{ color: 'var(--text-primary)' }}>{activeEngagedOwnersCount}</strong>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setBlockView('eod-report')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0
                }}
              >
                View Full End of Day Report <ChevronRight size={14} />
              </button>
            </div>

            <div className="table-responsive">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Contact Name</th>
                    <th>Phone Number</th>
                    <th>Language</th>
                    <th>Disposition</th>
                    <th>Owner</th>
                    <th>Value</th>
                    <th>Audit Log Trail</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTableLeads.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        No leads found matching the selected disposition and filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTableLeads.map(l => (
                      <tr key={l.id}>
                        <td style={{ fontWeight: 600 }}>{l.contactPerson}</td>
                        <td>{l.phone}</td>
                        <td><span className="badge" style={{ background: 'var(--bg-input)' }}>{l.language || 'English'}</span></td>
                        <td>
                          <span className="badge badge-disposition" style={{ whiteSpace: 'nowrap' }}>
                            {l.disposition || 'New Lead'}
                          </span>
                        </td>
                        <td><span className="badge badge-role">{l.assignedToName}</span></td>
                        <td style={{ fontWeight: 700 }}>{l.value}</td>
                        <td>
                          <div style={{ fontSize: '0.76rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {(l.history || []).map((h, i) => (
                              <div key={i} style={{ color: 'var(--text-secondary)' }}>
                                <span style={{ color: 'var(--text-muted)' }}>[{h.date}]</span> {h.text}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          /* BLOCK VIEW 2: COMPREHENSIVE END OF DAY (EOD) REPORT GENERATOR */
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* EOD Controls Header */}
            <div style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={16} color="var(--accent-primary)" />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Report Target Date:</span>
                  </div>

                  <input
                    type="date"
                    value={selectedEodDate === 'ALL' ? '' : selectedEodDate}
                    onChange={(e) => setSelectedEodDate(e.target.value || todayStr)}
                    style={{
                      padding: '5px 10px',
                      fontSize: '0.8rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-default)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)'
                    }}
                  />

                  {/* Scope filter */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                    <Users size={15} color="var(--text-muted)" />
                    <select
                      value={eodOwnerFilter}
                      onChange={(e) => setEodOwnerFilter(e.target.value)}
                      style={{
                        padding: '5px 10px',
                        fontSize: '0.8rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-default)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <option value="ALL">All Account Owners</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                      ))}
                      <option value="unassigned">Unassigned Leads Only</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Reconciled as of: <strong style={{ color: 'var(--text-secondary)' }}>{new Date().toLocaleTimeString()}</strong>
                  </span>
                </div>
              </div>

              {/* Quick Date Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Audit Date Presets:
                </span>
                
                <button
                  type="button"
                  className={`eod-date-pill ${selectedEodDate === todayStr ? 'active' : ''}`}
                  onClick={() => setSelectedEodDate(todayStr)}
                >
                  Today ({todayStr})
                </button>

                {availableHistoryDates.filter(d => d !== todayStr).slice(0, 5).map(d => (
                  <button
                    key={d}
                    type="button"
                    className={`eod-date-pill ${selectedEodDate === d ? 'active' : ''}`}
                    onClick={() => setSelectedEodDate(d)}
                  >
                    {d}
                  </button>
                ))}

                <button
                  type="button"
                  className={`eod-date-pill ${selectedEodDate === 'ALL' ? 'active' : ''}`}
                  onClick={() => setSelectedEodDate('ALL')}
                >
                  All Historic Logs
                </button>
              </div>
            </div>

            {/* High-Impact EOD KPI Metric Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '14px'
            }}>
              <div className="eod-metric-box">
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL DIRECTORY LEADS</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {leads.length}
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  Active portfolio database
                </span>
              </div>

              <div className="eod-metric-box" style={{ borderColor: 'rgba(99, 102, 241, 0.3)' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--accent-primary)', fontWeight: 600 }}>TOTAL PIPELINE VALUE</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                  {formatINR(totalDirectoryValue)}
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  Cumulated active value
                </span>
              </div>

              <div className="eod-metric-box" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                <span style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 600 }}>
                  AUDIT ACTIONS ({selectedEodDate === 'ALL' ? 'ALL DATES' : selectedEodDate})
                </span>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981' }}>
                  {dailyAuditEvents.length}
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  Events recorded in history logs
                </span>
              </div>

              <div className="eod-metric-box" style={{ borderColor: 'rgba(56, 189, 248, 0.3)' }}>
                <span style={{ fontSize: '0.74rem', color: '#38bdf8', fontWeight: 600 }}>DAILY REASSIGNMENTS</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#38bdf8' }}>
                  {todayReassignmentsCount}
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  Transfers executed on date
                </span>
              </div>

              <div className="eod-metric-box" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                <span style={{ fontSize: '0.74rem', color: '#f59e0b', fontWeight: 600 }}>ENGAGED EXECUTIVES</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f59e0b' }}>
                  {activeEngagedOwnersCount}
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  Team members holding leads
                </span>
              </div>
            </div>

            {/* Sub-Tabs for EOD Report */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-subtle)',
              gap: '16px'
            }}>
              <button
                type="button"
                onClick={() => setEodReportSubTab('matrix')}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: eodReportSubTab === 'matrix' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  padding: '8px 4px',
                  fontSize: '0.84rem',
                  fontWeight: eodReportSubTab === 'matrix' ? 600 : 500,
                  color: eodReportSubTab === 'matrix' ? 'var(--accent-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <BarChart3 size={15} /> Executive Workload & Dispositions Matrix
              </button>

              <button
                type="button"
                onClick={() => setEodReportSubTab('audit-trail')}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: eodReportSubTab === 'audit-trail' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  padding: '8px 4px',
                  fontSize: '0.84rem',
                  fontWeight: eodReportSubTab === 'audit-trail' ? 600 : 500,
                  color: eodReportSubTab === 'audit-trail' ? 'var(--accent-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Clock size={15} /> Daily Immutable Audit Log Trail ({dailyAuditEvents.length})
              </button>
            </div>

            {/* SUB-TAB 1: EXECUTIVE WORKLOAD & DISPOSITIONS MATRIX */}
            {eodReportSubTab === 'matrix' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Executive / Owner Workload Table */}
                <div>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={16} color="var(--accent-primary)" /> Executive & Owner Workload Summary (End of Day Status)
                  </h4>

                  <div className="table-responsive">
                    <table className="crm-table">
                      <thead>
                        <tr>
                          <th>Owner / Executive</th>
                          <th>Role</th>
                          <th>Active Leads Held</th>
                          <th>Managed Portfolio (INR)</th>
                          <th>Actions Logged on Date</th>
                          <th>Primary Dispositions Mix</th>
                          <th>Account Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eodOwnerBreakdown.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                              No owner allocation activity recorded for this criteria.
                            </td>
                          </tr>
                        ) : (
                          eodOwnerBreakdown.map(o => (
                            <tr key={o.id}>
                              <td style={{ fontWeight: 600 }}>{o.name}</td>
                              <td><span className="badge badge-role">{o.role}</span></td>
                              <td>
                                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{o.leadCount}</span> leads
                              </td>
                              <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                                {formatINR(o.totalValue)}
                              </td>
                              <td>
                                <span className="badge" style={{
                                  background: o.todayActionsCount > 0 ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-input)',
                                  color: o.todayActionsCount > 0 ? '#10b981' : 'var(--text-muted)',
                                  fontWeight: 600
                                }}>
                                  {o.todayActionsCount} event(s)
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {Object.entries(o.dispositions).length === 0 ? (
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>None</span>
                                  ) : (
                                    Object.entries(o.dispositions).map(([k, v]) => (
                                      <span key={k} style={{
                                        fontSize: '0.7rem',
                                        padding: '1px 6px',
                                        borderRadius: 'var(--radius-sm)',
                                        background: 'var(--bg-input)',
                                        border: '1px solid var(--border-subtle)'
                                      }}>
                                        {k}: <strong>{v}</strong>
                                      </span>
                                    ))
                                  )}
                                </div>
                              </td>
                              <td>
                                <div className="status-indicator">
                                  <span className={`status-dot ${o.status === 'Active' ? 'active' : 'inactive'}`} />
                                  <span>{o.status}</span>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pipeline Dispositions Grid */}
                <div>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BookmarkCheck size={16} color="var(--accent-primary)" /> Pipeline Disposition Distribution (EOD Breakdown)
                  </h4>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px'
                  }}>
                    {eodDispositionBreakdown.map(d => (
                      <div key={d.name} style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="badge badge-disposition">{d.name}</span>
                          <span style={{ fontSize: '0.86rem', fontWeight: 700 }}>{d.count}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600, marginTop: '4px' }}>
                          {formatINR(d.totalValue)}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          <span>Share: {((d.count / (leads.length || 1)) * 100).toFixed(0)}%</span>
                          <span>Today's Actions: {d.todayActions}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB 2: DAILY IMMUTABLE AUDIT LOG TRAIL */}
            {eodReportSubTab === 'audit-trail' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
                    <div className="search-input-wrapper" style={{ flex: 1 }}>
                      <Search className="search-icon" size={15} />
                      <input
                        type="text"
                        placeholder="Search daily audit trail (contact, phone, action, text)..."
                        value={eodAuditSearch}
                        onChange={(e) => setEodAuditSearch(e.target.value)}
                      />
                    </div>

                    <select
                      className="select-filter"
                      value={eodActionTypeFilter}
                      onChange={(e) => setEodActionTypeFilter(e.target.value)}
                      style={{ minWidth: '160px' }}
                    >
                      <option value="ALL">All Event Types</option>
                      <option value="Reassignment">Reassignments Only</option>
                      <option value="Engine Allocation">Engine Allocations</option>
                      <option value="Bulk Inflow">Bulk Inflows / Uploads</option>
                      <option value="Stage Shift">Stage Shifts</option>
                      <option value="General Update">General Updates</option>
                    </select>
                  </div>

                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Showing <strong>{filteredDailyAuditEvents.length}</strong> of {dailyAuditEvents.length} daily events
                  </span>
                </div>

                <div className="table-responsive">
                  <table className="crm-table">
                    <thead>
                      <tr>
                        <th>Sl.</th>
                        <th>Date & Time</th>
                        <th>Contact Person</th>
                        <th>Phone</th>
                        <th>Language</th>
                        <th>Current Owner</th>
                        <th>Value</th>
                        <th>Action Type</th>
                        <th>Immutable Audit Log Entry Text</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDailyAuditEvents.length === 0 ? (
                        <tr>
                          <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                            No immutable audit logs found on {selectedEodDate === 'ALL' ? 'any recorded date' : selectedEodDate} matching the current filters.
                          </td>
                        </tr>
                      ) : (
                        filteredDailyAuditEvents.map((ev, index) => (
                          <tr key={ev.id}>
                            <td style={{ color: 'var(--text-muted)' }}>{index + 1}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ev.date}</span>
                              {ev.time && <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{ev.time}</span>}
                            </td>
                            <td style={{ fontWeight: 600 }}>{ev.contactPerson}</td>
                            <td>{ev.phone}</td>
                            <td><span className="badge" style={{ background: 'var(--bg-input)' }}>{ev.language}</span></td>
                            <td><span className="badge badge-role">{ev.currentOwner}</span></td>
                            <td style={{ fontWeight: 700 }}>{ev.value}</td>
                            <td>
                              <span style={{
                                fontSize: '0.72rem',
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-full)',
                                background: ev.badgeBg,
                                color: ev.badgeColor,
                                border: `1px solid ${ev.badgeBorder}`,
                                fontWeight: 600,
                                whiteSpace: 'nowrap'
                              }}>
                                {ev.actionType}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '380px', lineHeight: 1.4 }}>
                              {ev.text}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadReassignmentView;

