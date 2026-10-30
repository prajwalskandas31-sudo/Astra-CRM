import React, { useState } from 'react';
import { CRMProvider, useCRM } from './context/CRMContext';
import { ToastProvider, useToast } from './components/ToastNotification';
import { LoginPage } from './components/LoginPage';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { CRMDashboard } from './components/CRMDashboard';
import { UserDirectory } from './components/UserDirectory';
import { DispositionsManager } from './components/DispositionsManager';
import { LeadUploadModule } from './components/LeadUploadModule';
import { LeadSummarySuperAdmin } from './components/LeadSummarySuperAdmin';
import { TeamMonitoring } from './components/TeamMonitoring';
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
import { SuperAdminEmailReviewModal } from './components/SuperAdminEmailReviewModal';
import { VoiceAgentCallModal } from './components/VoiceAgentCallModal';
import { isRealLeegalityDispatch } from './services/leegalityService';
import { LiveLeegalityDispatchModal } from './components/LiveLeegalityDispatchModal';

const AppContent = () => {
  const { authToken, currentUser, simulatedRole, hasPermission, userPermissions, triggerEKycAndESign } = useCRM();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [globalReviewSale, setGlobalReviewSale] = useState(null);
  const [globalVoiceSale, setGlobalVoiceSale] = useState(null);
  const [globalLiveDispatchData, setGlobalLiveDispatchData] = useState(null);

  // Enforce permission-based tab guards: user roles do not inherently restrict availability
  React.useEffect(() => {
    if (!currentUser) {
      setActiveTab('dashboard');
      return;
    }

    const allTabs = [
      'dashboard',
      'lead-history',
      'directory',
      'dispositions',
      'lead-upload',
      'lead-summary',
      'team-monitoring',
      'sale-approvals',
      'esign-block',
      'paid-block',
      'lead-reassignment',
      'system-settings',
      'custom-roles',
      'feature-access'
    ];

    if (!hasPermission(activeTab)) {
      const fallbackTab = allTabs.find(t => hasPermission(t)) || 'dashboard';
      setActiveTab(fallbackTab);
    }
  }, [currentUser?.id, simulatedRole, activeTab, userPermissions]);

  if (!authToken || !currentUser) {
    return <LoginPage />;
  }

  const tabTitles = {
    dashboard: 'CRM Dashboard & Dynamic Dispositions Bar',
    'lead-history': 'Lead Assignment History (Block 5) - Full Search & Audit Timeline',
    directory: 'User Directory & Account Controls',
    dispositions: 'Dispositions & Pipeline Manager (Block 2 Settings)',
    'lead-upload': 'Lead Upload Module & Block 3 Report Sync',
    'lead-summary': 'Lead Summary & Super Admin Operations (Block 4)',
    'team-monitoring': 'Team Performance & Compliance Monitoring',
    'sale-approvals': 'Sale Approval & eKYC Workflow Queue',
    'esign-block': 'Dedicated E-Sign Block (Leegality) - Digital Signature Records',
    'paid-block': 'Paid - Clients by Service Name & Service Tenure',
    'lead-reassignment': 'Lead Reassignment & Audit Protocol',
    'system-settings': 'System Settings & UI Customization',
    'custom-roles': 'Custom Roles Builder (Annexure-I)',
    'feature-access': 'Feature Access & Permissions Master Block'
  };

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
        return <CRMDashboard />;
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
      case 'sale-approvals':
        return <SaleApprovalWorkflow />;
      case 'esign-block':
        return (
          <ESignManagementBlock />
        );
      case 'paid-block':
        return <PaidBlock />;
      case 'lead-reassignment':
        return <LeadReassignmentView />;
      case 'system-settings':
        return <SystemSettings />;
      case 'custom-roles':
        return <CustomRolesBuilder />;
      case 'feature-access':
        return <FeatureAccessBlock />;
      default:
        return <CRMDashboard />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="main-content">
        <Navbar 
          currentTabTitle={tabTitles[activeTab] || 'Astra CRM'} 
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
      </CRMProvider>
    </ToastProvider>
  );
}

export default App;
