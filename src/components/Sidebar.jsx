import React, { useEffect, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import {
  LayoutDashboard, Users, Shield, TrendingUp, CheckCircle, Sliders, Layers, Command, Upload, PieChart, Key, History,
  FileSignature, BadgeIndianRupee, Send, Building2, FileText, GitBranch, Mail, Activity, ShieldCheck, Contact, Wallet,
  Tags, Receipt, BookOpen, ClipboardList, ScrollText, Cloud, ShieldAlert, NotebookPen, Settings, BarChart3, Scale,
  ChevronDown, ChevronRight, Shuffle, PackagePlus, MailCheck, PhoneCall, CalendarCheck
} from 'lucide-react';

/** The sub-blocks of Team Performance Tracking, each opened on its own from the sidebar. */
export const TEAM_PERFORMANCE_SECTIONS = [
  { section: 'teams', label: 'Teams', icon: Users },
  { section: 'executives', label: 'All Executives', icon: Contact },
  { section: 'leads', label: 'Leads by Data Set & Disposition', icon: Layers },
  { section: 'calls', label: 'Calls by Outcome', icon: PhoneCall },
  { section: 'attendance', label: 'Attendance', icon: CalendarCheck }
];

/**
 * The sidebar: stand-alone blocks plus four parent blocks (Leads, Reports, Compliance, Settings).
 * Each child keeps its own Feature Access id, so a parent shows only the children the user may open
 * and disappears when there are none.
 */
export const buildNavTree = ({ pendingSalesCount = 0, pendingRequestsCount = 0, eSignCount = 0 } = {}) => [
  {
    id: 'dashboard', label: 'CRM Dashboard', icon: LayoutDashboard,
    // Separate blocks listed under the CRM Dashboard (the dashboard's "Switch to" dropdown opens them too)
    subItems: [
      { id: 'team-monitoring', label: 'Team Monitoring', icon: TrendingUp },
      {
        id: 'team-performance', label: 'Team Performance Tracking', icon: Activity,
        // Buttons that open one sub-block of Team Performance Tracking (same page, same Feature Access id)
        sections: TEAM_PERFORMANCE_SECTIONS
      }
    ]
  },
  { id: 'lead-history', label: 'Lead History (Block 5)', icon: History },
  {
    group: 'leads', label: 'Leads', icon: Upload,
    children: [
      { id: 'lead-upload', label: 'Lead Upload & Reports', icon: Upload },
      { id: 'lead-summary', label: 'Lead Summary (Block 4)', icon: PieChart, badge: pendingRequestsCount || null },
      { id: 'lead-reassignment', label: 'Lead Re-assignment', icon: Shuffle }
    ]
  },
  { id: 'sale-approvals', label: 'Sale Approvals', icon: CheckCircle, badge: pendingSalesCount || null },
  { id: 'esign-block', label: 'E-Sign Block', icon: FileSignature, badge: eSignCount || null },
  { id: 'paid-block', label: 'Paid', icon: BadgeIndianRupee },
  { id: 'send-welcome-kit', label: 'Send Welcome Kit', icon: MailCheck },
  { id: 'extended-service', label: 'Extended Service Block', icon: PackagePlus },
  { id: 'kra-block', label: 'KRA Block', icon: ShieldCheck },
  { id: 'telegram-control', label: 'Telegram Control Block', icon: Send },
  {
    group: 'reports', label: 'Reports', icon: BarChart3,
    children: [
      { id: 'salary-block', label: 'Salary Block', icon: Wallet },
      { id: 'client-master', label: 'Client MASTER', icon: Contact },
      { id: 'research-reports', label: 'Research Reports', icon: FileText },
      { id: 'research-recommendations', label: 'Records for Research Recommendations', icon: NotebookPen },
      { id: 'running-account', label: 'Running Account Statement', icon: BookOpen }
    ]
  },
  {
    group: 'compliance', label: 'Compliance', icon: Scale,
    children: [
      { id: 'audit-reports', label: 'Audit Report Blocks', icon: ClipboardList },
      { id: 'ra-periodic-report', label: 'RA Periodic Report Block', icon: ScrollText },
      { id: 'ra-compliance', label: 'RA Monthly Compliance Tracker', icon: ShieldAlert },
      { id: 'annexure-a-saas', label: 'Annexure A for SaaS Reporting', icon: Cloud }
    ]
  },
  {
    group: 'settings', label: 'Settings', icon: Settings,
    children: [
      { id: 'company-profile', label: 'Company Profile', icon: Building2 },
      { id: 'branch-profiles', label: 'Branch Profiles', icon: GitBranch },
      { id: 'directory', label: 'User Directory', icon: Users },
      { id: 'email-block', label: 'Email Block', icon: Mail },
      { id: 'system-settings', label: 'System & UI Settings', icon: Sliders },
      { id: 'custom-roles', label: 'Custom Roles (Annexure-I)', icon: Shield },
      { id: 'feature-access', label: 'Feature Access Block', icon: Key },
      { id: 'dispositions', label: 'Dispositions (Block 2)', icon: Layers },
      { id: 'service-master', label: 'Service Master', icon: Tags },
      { id: 'invoice-block', label: 'Invoice Block', icon: Receipt }
    ]
  }
];

/** Every tab id in sidebar order (App.jsx falls back to the first one the user may open). */
export const ALL_TAB_IDS = buildNavTree().flatMap(n =>
  n.children ? n.children.map(c => c.id) : [n.id, ...(n.subItems || []).map(c => c.id)]
);

/** The blocks listed under the CRM Dashboard, for its "Switch to" dropdown. */
export const DASHBOARD_SUB_BLOCKS = buildNavTree().find(n => n.id === 'dashboard').subItems;

const OPEN_GROUPS_KEY = 'astra_sidebar_open_groups';

const readOpenGroups = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(OPEN_GROUPS_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};

export const Sidebar = ({ activeTab, activeSection = null, setActiveTab }) => {
  const { simulatedRole, sales, leadRequests, eSignRecords = [], hasPermission } = useCRM();

  const tree = buildNavTree({
    pendingSalesCount: sales.filter(s => s.status.includes('Pending')).length,
    pendingRequestsCount: leadRequests?.filter(r => r.status === 'Pending').length || 0,
    eSignCount: eSignRecords.length
  });

  // Role does not inherently restrict features; visibility is driven strictly by permissions
  const visibleTree = tree
    .map(n => (n.children ? { ...n, children: n.children.filter(c => hasPermission(c.id)) } : n))
    .map(n => (n.subItems ? { ...n, subItems: n.subItems.filter(c => hasPermission(c.id)) } : n))
    .filter(n => (n.children ? n.children.length > 0 : hasPermission(n.id) || n.subItems?.length > 0));

  const [openGroups, setOpenGroups] = useState(readOpenGroups);

  // The parent block holding the open page is always expanded
  const activeGroup = tree.find(n => n.children?.some(c => c.id === activeTab))?.group;
  useEffect(() => {
    if (activeGroup) setOpenGroups(g => (g.includes(activeGroup) ? g : [...g, activeGroup]));
  }, [activeGroup]);

  // Blocks with their own page AND a collapsible list under them (CRM Dashboard, Team Performance
  // Tracking) open when one of the pages inside them is showing
  const expandableKeys = tree
    .filter(n => n.subItems?.some(c => c.id === activeTab))
    .map(n => n.id)
    .concat(tree.flatMap(n => n.subItems || []).filter(c => c.sections && c.id === activeTab).map(c => c.id))
    .join(',');
  useEffect(() => {
    if (!expandableKeys) return;
    const keys = expandableKeys.split(',');
    setOpenGroups(g => (keys.every(k => g.includes(k)) ? g : [...new Set([...g, ...keys])]));
  }, [expandableKeys]);

  useEffect(() => {
    try { localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(openGroups)); } catch { /* storage blocked */ }
  }, [openGroups]);

  const toggleGroup = (group) =>
    setOpenGroups(g => (g.includes(group) ? g.filter(x => x !== group) : [...g, group]));

  /** A block's own button; with `expandKey` it also gets a chevron that shows/hides the list under it. */
  const renderButton = (item, nested, expandKey = null) => {
    const Icon = item.icon;
    const button = (
      <button
        key={item.id}
        className={`nav-item ${nested ? 'nav-item-nested' : ''} ${activeTab === item.id && !(item.sections && activeSection) ? 'active' : ''}`}
        onClick={() => {
          setActiveTab(item.id);
          // Opening Team Performance Tracking also shows its sub-blocks; the CRM Dashboard stays as it is
          if (expandKey && item.sections && !openGroups.includes(expandKey)) toggleGroup(expandKey);
        }}
      >
        <Icon size={nested ? 14 : 16} />
        <span>{item.label}</span>
        {item.badge && <span className="nav-badge">{item.badge}</span>}
      </button>
    );
    if (!expandKey) return button;
    const open = openGroups.includes(expandKey);
    return (
      <div key={item.id} className="nav-item-row">
        {button}
        <button
          type="button"
          className="nav-expand-toggle"
          onClick={() => toggleGroup(expandKey)}
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${item.label}`}
          title={open ? 'Collapse' : 'Expand'}
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>
    );
  };

  const renderItem = (item, nested = false) => {
    if (!item.sections) return renderButton(item, nested);
    // A block whose sub-blocks each get their own button underneath it (collapsible)
    return (
      <div key={item.id} className="nav-group">
        {renderButton(item, nested, item.id)}
        {openGroups.includes(item.id) && <div className="nav-group-children nav-section-children">
          {item.sections.map(sec => {
            const SecIcon = sec.icon;
            return (
              <button
                key={sec.section}
                className={`nav-item nav-item-nested nav-item-section ${activeTab === item.id && activeSection === sec.section ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id, sec.section)}
              >
                <SecIcon size={13} />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>}
      </div>
    );
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-logo">
          <Command size={18} />
        </div>
        <div className="brand-info">
          <h1>Astra CRM</h1>
          <span className="build-tag">Enterprise V1.0</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {visibleTree.map(node => {
          if (!node.children) {
            const subItems = node.subItems || [];
            if (subItems.length === 0) return renderItem(node);
            // A block with its own page plus separate blocks listed under it (CRM Dashboard), collapsible
            const open = openGroups.includes(node.id);
            if (!hasPermission(node.id)) {
              // No access to the page itself: the header only shows/hides the list
              const Icon = node.icon;
              return (
                <div key={node.id} className="nav-group">
                  <button className="nav-item nav-group-header" onClick={() => toggleGroup(node.id)} aria-expanded={open}>
                    <Icon size={16} />
                    <span>{node.label}</span>
                    <span className="nav-group-chevron">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                  </button>
                  {open && <div className="nav-group-children">{subItems.map(c => renderItem(c, true))}</div>}
                </div>
              );
            }
            return (
              <div key={node.id} className="nav-group">
                {renderButton(node, false, node.id)}
                {open && <div className="nav-group-children">{subItems.map(c => renderItem(c, true))}</div>}
              </div>
            );
          }
          const Icon = node.icon;
          const open = openGroups.includes(node.group);
          const badgeTotal = node.children.reduce((sum, c) => sum + (c.badge || 0), 0);
          return (
            <div key={node.group} className="nav-group">
              <button
                className={`nav-item nav-group-header ${node.group === activeGroup ? 'holds-active' : ''}`}
                onClick={() => toggleGroup(node.group)}
                aria-expanded={open}
              >
                <Icon size={16} />
                <span>{node.label}</span>
                {!open && badgeTotal > 0 && <span className="nav-badge">{badgeTotal}</span>}
                <span className="nav-group-chevron">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
              </button>
              {open && <div className="nav-group-children">{node.children.map(c => renderItem(c, true))}</div>}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div style={{
          fontSize: '0.73rem',
          color: '#9A9A96',
          textAlign: 'center',
          padding: '6px 12px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '9999px',
          border: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          Role: <strong style={{ color: 'var(--accent)', fontWeight: 600 }}>{simulatedRole}</strong>
        </div>
      </div>
    </aside>
  );
};
