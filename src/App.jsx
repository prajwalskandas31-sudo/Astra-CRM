import React, { useState } from 'react';
import { CRMProvider, useCRM } from './context/CRMContext';
import { ToastProvider, useToast } from './components/ToastNotification';
import { ConfirmDialogHost } from './components/ConfirmDialog';
import { LoginPage } from './components/LoginPage';
import { LoginDisclaimerModal } from './components/LoginDisclaimerModal';
import { Navbar } from './components/Navbar';
import { Sidebar, ALL_TAB_IDS, buildNavTree } from './components/Sidebar';
import { CRMDashboard } from './components/CRMDashboard';
import { UserDirectory } from './components/UserDirectory';
import { DispositionsManager } from './components/DispositionsManager';
import { LeadUploadModule } from './components/LeadUploadModule';
import { LeadSummarySuperAdmin } from './components/LeadSummarySuperAdmin';
import { TeamMonitoring } from './components/TeamMonitoring';
import { TeamPerformanceBlock } from './components/TeamPerformanceBlock';
import { SaleApprovalWorkflow } from './components/SaleApprovalWorkflow';
import { LeadReassignmentView } from './components/LeadReassignmentView';
import { SystemSettings } from './components/SystemSettings';
import { CustomRolesBuilder } from './components/CustomRolesBuilder';

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

import { FeatureAccessBlock } from './components/FeatureAccessBlock';
import { LeadHistoryBlock } from './components/LeadHistoryBlock';
import { ESignManagementBlock } from './components/ESignManagementBlock';
import { PaidBlock } from './components/PaidBlock';
import { KraBlock } from './components/KraBlock';
import { ClientMasterBlock } from './components/ClientMasterBlock';
import { InvoiceBlock } from './components/InvoiceBlock';
import { RunningAccountBlock } from './components/RunningAccountBlock';
import { AuditReportBlock } from './components/AuditReportBlock';
import { RaPeriodicReportBlock } from './components/RaPeriodicReportBlock';
import { AnnexureASaasBlock } from './components/AnnexureASaasBlock';
import { RaComplianceBlock } from './components/RaComplianceBlock';
import { ServiceMasterBlock } from './components/ServiceMasterBlock';
import { ResearchRecommendationsBlock } from './components/ResearchRecommendationsBlock';
import { SalaryBlock } from './components/SalaryBlock';
import { TelegramControlBlock } from './components/TelegramControlBlock';
import { CompanyProfileBlock } from './components/CompanyProfileBlock';
import { BranchProfilesBlock } from './components/BranchProfilesBlock';
import { EmailBlock } from './components/EmailBlock';
import { SendWelcomeKitBlock } from './components/SendWelcomeKitBlock';
import { ExtendedServiceBlock } from './components/ExtendedServiceBlock';
import { ResearchReportsBlock } from './components/ResearchReportsBlock';
import { SuperAdminEmailReviewModal } from './components/SuperAdminEmailReviewModal';
import { VoiceAgentCallModal } from './components/VoiceAgentCallModal';
import { isRealLeegalityDispatch } from './services/leegalityService';
import { LiveLeegalityDispatchModal } from './components/LiveLeegalityDispatchModal';
import { useEKycDeepLink } from './services/clientInfoTelegramService';

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
    return <LoginPage />;
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
            {renderTabContent()}
          </ErrorBoundary>
        </main>
      </div>

      {/* Global Super Admin Email Review Modal */}
      <SuperAdminEmailReviewModal
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
      />

      {/* Global Automated Voice Agent Verification Modal */}
      <VoiceAgentCallModal
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
      />

      {/* Leegality e-KYC & E-Sign status modal (live data via CRM backend) */}
      <LiveLeegalityDispatchModal
        isOpen={!!globalLiveDispatchData}
        sale={globalLiveDispatchData?.sale}
        dispatchResult={globalLiveDispatchData?.result}
        onClose={() => setGlobalLiveDispatchData(null)}
      />

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
