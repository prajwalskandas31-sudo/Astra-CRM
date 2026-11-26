import React, { Suspense, useState } from 'react';
import { CRMProvider, useCRM } from './context/CRMContext';
import { ToastProvider, useToast } from './components/ToastNotification';
import { ConfirmDialogHost } from './components/ConfirmDialog';
import { LoginDisclaimerModal } from './components/LoginDisclaimerModal';
import { Navbar } from './components/Navbar';
import { Sidebar, ALL_TAB_IDS, buildNavTree } from './components/Sidebar';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('UI Runtime Error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="directory-card" style={{ padding: '32px', textAlign: 'center', margin: '30px auto', maxWidth: '640px' }}>
          <h3 style={{ color: '#ef4444', marginBottom: '8px' }}>Module Render Error</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
            {this.state.error?.message || 'An unexpected error occurred while loading this view.'}
          </p>
          <button className="btn-primary" onClick={() => this.setState({ hasError: false, error: null })}>
            Retry Loading View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

import { isRealLeegalityDispatch } from './services/leegalityService';
import { useEKycDeepLink } from './services/clientInfoTelegramService';

import { lazyNamed } from './lib/lazyNamed';

// Screens, the sign-in page and the global modals load on first use, so the first download is only the
// app shell. Each becomes its own file; shared libraries (xlsx, motion) load with the first screen needing them.
const LoginPage = lazyNamed(() => import('./components/LoginPage'), 'LoginPage');
const CRMDashboard = lazyNamed(() => import('./components/CRMDashboard'), 'CRMDashboard');
const UserDirectory = lazyNamed(() => import('./components/UserDirectory'), 'UserDirectory');
const DispositionsManager = lazyNamed(() => import('./components/DispositionsManager'), 'DispositionsManager');
const LeadUploadModule = lazyNamed(() => import('./components/LeadUploadModule'), 'LeadUploadModule');
const LeadSummarySuperAdmin = lazyNamed(() => import('./components/LeadSummarySuperAdmin'), 'LeadSummarySuperAdmin');
const TeamMonitoring = lazyNamed(() => import('./components/TeamMonitoring'), 'TeamMonitoring');
const TeamPerformanceBlock = lazyNamed(() => import('./components/TeamPerformanceBlock'), 'TeamPerformanceBlock');
const SaleApprovalWorkflow = lazyNamed(() => import('./components/SaleApprovalWorkflow'), 'SaleApprovalWorkflow');
const LeadReassignmentView = lazyNamed(() => import('./components/LeadReassignmentView'), 'LeadReassignmentView');
const SystemSettings = lazyNamed(() => import('./components/SystemSettings'), 'SystemSettings');
const CustomRolesBuilder = lazyNamed(() => import('./components/CustomRolesBuilder'), 'CustomRolesBuilder');
const FeatureAccessBlock = lazyNamed(() => import('./components/FeatureAccessBlock'), 'FeatureAccessBlock');
const LeadHistoryBlock = lazyNamed(() => import('./components/LeadHistoryBlock'), 'LeadHistoryBlock');
const ESignManagementBlock = lazyNamed(() => import('./components/ESignManagementBlock'), 'ESignManagementBlock');
const PaidBlock = lazyNamed(() => import('./components/PaidBlock'), 'PaidBlock');
const KraBlock = lazyNamed(() => import('./components/KraBlock'), 'KraBlock');
const ClientMasterBlock = lazyNamed(() => import('./components/ClientMasterBlock'), 'ClientMasterBlock');
const InvoiceBlock = lazyNamed(() => import('./components/InvoiceBlock'), 'InvoiceBlock');
const RunningAccountBlock = lazyNamed(() => import('./components/RunningAccountBlock'), 'RunningAccountBlock');
const AuditReportBlock = lazyNamed(() => import('./components/AuditReportBlock'), 'AuditReportBlock');
const RaPeriodicReportBlock = lazyNamed(() => import('./components/RaPeriodicReportBlock'), 'RaPeriodicReportBlock');
const AnnexureASaasBlock = lazyNamed(() => import('./components/AnnexureASaasBlock'), 'AnnexureASaasBlock');
const RaComplianceBlock = lazyNamed(() => import('./components/RaComplianceBlock'), 'RaComplianceBlock');
const ServiceMasterBlock = lazyNamed(() => import('./components/ServiceMasterBlock'), 'ServiceMasterBlock');
const ResearchRecommendationsBlock = lazyNamed(() => import('./components/ResearchRecommendationsBlock'), 'ResearchRecommendationsBlock');
const SalaryBlock = lazyNamed(() => import('./components/SalaryBlock'), 'SalaryBlock');
const PayslipBlock = lazyNamed(() => import('./components/PayslipBlock'), 'PayslipBlock');
const TelegramControlBlock = lazyNamed(() => import('./components/TelegramControlBlock'), 'TelegramControlBlock');
const CompanyProfileBlock = lazyNamed(() => import('./components/CompanyProfileBlock'), 'CompanyProfileBlock');
const BranchProfilesBlock = lazyNamed(() => import('./components/BranchProfilesBlock'), 'BranchProfilesBlock');
const EmailBlock = lazyNamed(() => import('./components/EmailBlock'), 'EmailBlock');
const SendWelcomeKitBlock = lazyNamed(() => import('./components/SendWelcomeKitBlock'), 'SendWelcomeKitBlock');
const ExtendedServiceBlock = lazyNamed(() => import('./components/ExtendedServiceBlock'), 'ExtendedServiceBlock');
const ResearchReportsBlock = lazyNamed(() => import('./components/ResearchReportsBlock'), 'ResearchReportsBlock');
const SuperAdminEmailReviewModal = lazyNamed(() => import('./components/SuperAdminEmailReviewModal'), 'SuperAdminEmailReviewModal');
const VoiceAgentCallModal = lazyNamed(() => import('./components/VoiceAgentCallModal'), 'VoiceAgentCallModal');
const LiveLeegalityDispatchModal = lazyNamed(() => import('./components/LiveLeegalityDispatchModal'), 'LiveLeegalityDispatchModal');

const ScreenLoading = () => (
  <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading…</div>
);

/** Page titles (header and browser tab) are the sidebar labels, so the two never disagree. */
const TAB_TITLES = Object.fromEntries(
  buildNavTree()
    .flatMap(n => (n.children ? n.children : [n, ...(n.subItems || [])]))
    .filter(n => n.id)
    .map(n => [n.id, n.label])
);

/** The open page lives in the URL hash (#paid-block, #team-performance/teams) so refresh and Back keep it. */
const readHash = () => {
  try {
    const [tab, section] = decodeURIComponent(window.location.hash.replace(/^#/, '')).split('/');
    return ALL_TAB_IDS.includes(tab) ? { tab, section: section || null } : null;
  } catch {
    return null;
  }
};

const AppContent = () => {
  const {
    authToken, currentUser, simulatedRole, hasPermission, userPermissions, triggerEKycAndESign, sales,
    loginDisclaimer, loginDisclaimerPending, loginDisclaimerReady, acknowledgeLoginDisclaimer, handleLogout, companyProfile
  } = useCRM();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState(() => readHash()?.tab || 'dashboard');
  // A sub-block of the open page picked in the sidebar (Team Performance Tracking), or null for the whole page
  const [activeSection, setActiveSection] = useState(() => readHash()?.section || null);
  const openTab = (tab, section = null) => {
    setActiveTab(tab);
    setActiveSection(section);
  };
  const [globalReviewSale, setGlobalReviewSale] = useState(null);
  const [globalVoiceSale, setGlobalVoiceSale] = useState(null);
  const [globalLiveDispatchData, setGlobalLiveDispatchData] = useState(null);

  // Keep the URL hash in step with the open page (a new history entry per page, so Back returns to it)
  React.useEffect(() => {
    if (!currentUser) return;
    const hash = `#${activeTab}${activeSection ? `/${activeSection}` : ''}`;
    if (window.location.hash === hash) return;
    const url = `${window.location.pathname}${window.location.search}${hash}`;
    if (window.location.hash) window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
  }, [activeTab, activeSection, currentUser?.id]);

  // Back / Forward (or a pasted link) open the page named in the hash
  React.useEffect(() => {
    const onHash = () => {
      const target = readHash();
      if (target) { setActiveTab(target.tab); setActiveSection(target.section); }
    };
    window.addEventListener('popstate', onHash);
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('popstate', onHash);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  // A newly opened page starts at its top, not at the previous page's scroll position
  React.useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector('.page-body')?.scrollTo?.(0, 0);
  }, [activeTab, activeSection]);

  // Browser tab title follows the open page
  React.useEffect(() => {
    document.title = currentUser ? `${TAB_TITLES[activeTab] || 'CRM'} · Astra CRM` : 'Sign in · Astra CRM';
  }, [activeTab, currentUser?.id]);

  // After signing out, the next person to sign in starts on the dashboard (a refresh keeps the page)
  const lastUserId = React.useRef(currentUser?.id);
  React.useEffect(() => {
    if (lastUserId.current && !currentUser) {
      setActiveTab('dashboard');
      setActiveSection(null);
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
    lastUserId.current = currentUser?.id;
  }, [currentUser?.id]);

  // Enforce permission-based tab guards: user roles do not inherently restrict availability
  React.useEffect(() => {
    if (!currentUser) return;

    const allTabs = ALL_TAB_IDS;

    if (!hasPermission(activeTab)) {
      const fallbackTab = allTabs.find(t => hasPermission(t)) || 'dashboard';
      setActiveTab(fallbackTab);
    }
  }, [currentUser?.id, simulatedRole, activeTab, userPermissions]);

  // The e-KYC link at the end of the Client Information message in Telegram (?ekyc=<saleId>):
  // runs the same "Trigger e-KYC & E-Sign" as Sale Approvals once the user has signed in.
  useEKycDeepLink({
    signedIn: !!authToken && !!currentUser && !loginDisclaimerPending,
    sales,
    onStart: async (sale) => {
      setActiveTab('sale-approvals');
      if (sale.clientType === 'Old Client') {
        showToast(`'${sale.clientName}' is an Old Client: no e-KYC & E-Sign. Approve it from its review link in Telegram.`, 'info');
        return;
      }
      if (currentUser?.role !== 'Super Admin') {
        showToast('Only a Super Admin can start e-KYC & E-Sign. Sign in as Super Admin and open the link again.', 'error');
        return;
      }
      if (isRealLeegalityDispatch(sale) && !['Rejected by Client', 'Invitation Expired'].includes(sale.eSignStatus)) {
        showToast(`e-KYC & E-Sign was already sent for '${sale.clientName}'. Showing its Leegality status.`, 'info');
        setGlobalLiveDispatchData({ sale, result: sale.eSignDetails?.documentId ? sale.eSignDetails : { documentId: sale.eSignDocumentId } });
        return;
      }
      showToast(`Starting e-KYC & E-Sign for '${sale.clientName}' from the Telegram link...`, 'info');
      try {
        const res = await triggerEKycAndESign(sale.id);
        setGlobalLiveDispatchData({ sale, result: res.apiResult });
        showToast(`Leegality created document ${res.apiResult.documentId} for '${sale.clientName}'.`, 'success');
      } catch (err) {
        showToast(`Leegality Dispatch Notice: ${err.message}`, 'error');
      }
    },
    onMissing: (saleId) => showToast(`The e-KYC link's sale (${saleId}) was not found in the CRM. It may have been deleted.`, 'error')
  });

  if (!authToken || !currentUser) {
    return <Suspense fallback={<ScreenLoading />}><LoginPage /></Suspense>;
  }

  // Mandatory Login Disclaimer: the CRM is not rendered at all until it is accepted
  if (loginDisclaimerPending) {
    return (
      <LoginDisclaimerModal
        title={loginDisclaimer?.title}
        message={loginDisclaimer?.message}
        companyName={companyProfile?.companyName}
        userName={currentUser?.name}
        ready={loginDisclaimerReady}
        onAccept={acknowledgeLoginDisclaimer}
        onSignOut={handleLogout}
      />
    );
  }



  // Real Leegality status for dispatched sales; anything else is sent from Sale Approvals
  const openLeegalityForSale = (sale) => {
    if (sale && isRealLeegalityDispatch(sale)) {
      setGlobalLiveDispatchData({ sale, result: sale.eSignDetails });
      return;
    }
    setActiveTab('sale-approvals');
    showToast('Send the agreement with "Trigger e-KYC & E-Sign" in Sale Approvals.', 'info');
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <CRMDashboard onOpenBlock={openTab} />;
      case 'lead-history':
        return <LeadHistoryBlock />;
      case 'directory':
        return <UserDirectory />;
      case 'dispositions':
        return <DispositionsManager />;
      case 'lead-upload':
        return <LeadUploadModule />;
      case 'lead-summary':
        return <LeadSummarySuperAdmin />;
      case 'team-monitoring':
        return <TeamMonitoring />;
      case 'team-performance':
        return <TeamPerformanceBlock section={activeSection} />;
      case 'sale-approvals':
        return <SaleApprovalWorkflow />;
      case 'esign-block':
        return (
          <ESignManagementBlock />
        );
      case 'paid-block':
        return <PaidBlock />;
      case 'send-welcome-kit':
        return <SendWelcomeKitBlock />;
      case 'extended-service':
        return <ExtendedServiceBlock />;
      case 'salary-block':
        return <SalaryBlock />;
      case 'payslip-block':
        return <PayslipBlock />;
      case 'kra-block':
        return <KraBlock />;
      case 'client-master':
        return <ClientMasterBlock />;
      case 'invoice-block':
        return <InvoiceBlock />;
      case 'running-account':
        return <RunningAccountBlock />;
      case 'audit-reports':
        return <AuditReportBlock />;
      case 'ra-periodic-report':
        return <RaPeriodicReportBlock />;
      case 'annexure-a-saas':
        return <AnnexureASaasBlock />;
      case 'ra-compliance':
        return <RaComplianceBlock />;
      case 'telegram-control':
        return <TelegramControlBlock />;
      case 'lead-reassignment':
        return <LeadReassignmentView />;
      case 'research-reports':
        return <ResearchReportsBlock />;
      case 'research-recommendations':
        return <ResearchRecommendationsBlock />;
      case 'service-master':
        return <ServiceMasterBlock />;
      case 'company-profile':
        return <CompanyProfileBlock />;
      case 'branch-profiles':
        return <BranchProfilesBlock />;
      case 'email-block':
        return <EmailBlock />;
      case 'system-settings':
        return <SystemSettings />;
      case 'custom-roles':
        return <CustomRolesBuilder />;
      case 'feature-access':
        return <FeatureAccessBlock />;
      default:
        return <CRMDashboard onOpenBlock={openTab} />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} activeSection={activeTab === 'team-performance' ? activeSection : null} setActiveTab={openTab} />
      <div className="main-content">
        <Navbar 
          currentTabTitle={TAB_TITLES[activeTab] || 'Astra CRM'} 
          onOpenReviewModal={(sale) => setGlobalReviewSale(sale)}
          onOpenESignModal={openLeegalityForSale}
        />
        <main className="page-body">
          <ErrorBoundary key={activeTab}>
            <Suspense fallback={<ScreenLoading />}>
              {renderTabContent()}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {/* Global modals: mounted (and their code loaded) only while open */}
      <Suspense fallback={null}>
      {/* Global Super Admin Email Review Modal */}
      {!!globalReviewSale && <SuperAdminEmailReviewModal
        isOpen={!!globalReviewSale}
        sale={globalReviewSale}
        onClose={() => setGlobalReviewSale(null)}
        onExecuteVoiceCall={(sale) => setGlobalVoiceSale(sale)}
        onSkipVoiceCall={async (sale) => {
          try {
            const res = await triggerEKycAndESign(sale.id);
            setGlobalLiveDispatchData({ sale, result: res.apiResult });
          } catch (err) {
            showToast(`Leegality Dispatch Notice: ${err.message}`, 'error');
          }
        }}
        onTriggerEKycAndESign={async (sale) => {
          try {
            const res = await triggerEKycAndESign(sale.id);
            setGlobalLiveDispatchData({ sale, result: res.apiResult });
          } catch (err) {
            showToast(`Leegality Dispatch Notice: ${err.message}`, 'error');
          }
        }}
      />}

      {/* Global Automated Voice Agent Verification Modal */}
      {!!globalVoiceSale && <VoiceAgentCallModal
        isOpen={!!globalVoiceSale}
        sale={globalVoiceSale}
        onClose={() => setGlobalVoiceSale(null)}
        onProceedToESign={async (sale) => {
          try {
            const res = await triggerEKycAndESign(sale.id);
            setGlobalLiveDispatchData({ sale, result: res.apiResult });
          } catch (err) {
            showToast(`Leegality Dispatch Notice: ${err.message}`, 'error');
          }
        }}
      />}

      {/* Leegality e-KYC & E-Sign status modal (live data via CRM backend) */}
      {!!globalLiveDispatchData && <LiveLeegalityDispatchModal
        isOpen
        sale={globalLiveDispatchData?.sale}
        dispatchResult={globalLiveDispatchData?.result}
        onClose={() => setGlobalLiveDispatchData(null)}
      />}
      </Suspense>

    </div>
  );
};

export function App() {
  return (
    <ToastProvider>
      <CRMProvider>
        <AppContent />
        <ConfirmDialogHost />
      </CRMProvider>
    </ToastProvider>
  );
}

export default App;
