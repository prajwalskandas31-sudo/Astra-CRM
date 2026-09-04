import React, { useState } from 'react';
import { CRMProvider, useCRM } from './context/CRMContext';
import { ToastProvider } from './components/ToastNotification';
import { LoginPage } from './components/LoginPage';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { CRMDashboard } from './components/CRMDashboard';
import { UserDirectory } from './components/UserDirectory';
import { DispositionsManager } from './components/DispositionsManager';
import { TeamMonitoring } from './components/TeamMonitoring';
import { SaleApprovalWorkflow } from './components/SaleApprovalWorkflow';
import { LeadReassignmentView } from './components/LeadReassignmentView';
import { SystemSettings } from './components/SystemSettings';

const AppContent = () => {
  const { authToken, currentUser } = useCRM();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (!authToken || !currentUser) {
    return <LoginPage />;
  }

  const tabTitles = {
    dashboard: 'CRM Dashboard & Dynamic Dispositions Bar',
    directory: 'User Directory & Account Controls',
    dispositions: 'Dispositions & Pipeline Manager (Block 2 Settings)',
    'team-monitoring': 'Team Performance & Compliance Monitoring',
    'sale-approvals': 'Sale Approval & eKYC Workflow Queue',
    'lead-reassignment': 'Lead Reassignment & Audit Protocol',
    'system-settings': 'System Settings & UI Customization',
    'custom-roles': 'Custom Roles Builder (Annexure-I)'
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <CRMDashboard />;
      case 'directory':
        return <UserDirectory />;
      case 'dispositions':
        return <DispositionsManager />;
      case 'team-monitoring':
        return <TeamMonitoring />;
      case 'sale-approvals':
        return <SaleApprovalWorkflow />;
      case 'lead-reassignment':
        return <LeadReassignmentView />;
      case 'system-settings':
      case 'custom-roles':
        return <SystemSettings />;
      default:
        return <CRMDashboard />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="main-content">
        <Navbar currentTabTitle={tabTitles[activeTab] || 'Astra CRM'} />
        <main className="page-body">
          {renderTabContent()}
        </main>
      </div>
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
