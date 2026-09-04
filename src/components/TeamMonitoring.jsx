import React from 'react';
import { useCRM } from '../context/CRMContext';
import { TrendingUp, Users, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const TeamMonitoring = () => {
  const { users, leads, sales } = useCRM();

  const teammates = users.filter(u => u.role === 'Executive');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-info">
            <h4>Teammates Supervised</h4>
            <div className="value">{teammates.length}</div>
          </div>
          <div className="metric-icon">
            <Users size={18} />
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <h4>Team Sales Registered</h4>
            <div className="value">{sales.length}</div>
          </div>
          <div className="metric-icon">
            <TrendingUp size={18} />
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <h4>Audit Compliance Score</h4>
            <div className="value" style={{ color: 'var(--status-success)' }}>98%</div>
          </div>
          <div className="metric-icon" style={{ backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success)', borderColor: 'var(--status-success-border)' }}>
            <ShieldCheck size={18} />
          </div>
        </div>
      </div>

      <div className="directory-card">
        <div className="directory-toolbar">
          <div className="directory-title-area">
            <h3>Team Performance & Compliance Monitoring Dashboard</h3>
            <p>Monitor teammates, active lead workloads, eKYC verification, and compliance status.</p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Teammate Name</th>
                <th>Employee ID</th>
                <th>Mobile Number</th>
                <th>Reporting Manager</th>
                <th>Active Leads</th>
                <th>Sales Registered</th>
                <th>eKYC Status</th>
                <th>Compliance Status</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {teammates.map(tm => {
                const teamLeadsCount = leads.filter(l => l.assignedToId === tm.id).length;
                const teamSalesCount = sales.filter(s => s.employeeId === tm.id || s.employeeName === tm.name).length;

                return (
                  <tr key={tm.id}>
                    <td style={{ fontWeight: 600 }}>{tm.name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{tm.employeeId || 'EMP-100'}</td>
                    <td>{tm.mobile}</td>
                    <td>{tm.reportingTo || 'Priya Nair'}</td>
                    <td><span className="badge badge-role">{teamLeadsCount} Leads</span></td>
                    <td><span className="badge badge-disposition">{teamSalesCount} Sales</span></td>
                    <td>
                      <div className="status-indicator">
                        <span className="status-dot active" />
                        <span>Verified</span>
                      </div>
                    </td>
                    <td>
                      <div className="status-indicator">
                        <span className="status-dot active" />
                        <span>Compliant</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem' }}>
                        {teamSalesCount > 0 ? 'A+' : 'A'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
