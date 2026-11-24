import React, { useEffect, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { MailCheck, AlertCircle } from 'lucide-react';
import { WelcomeKitSender } from './EmailBlock';
import { getEmailSettings } from '../services/emailService';

/**
 * Send Welcome Kit (its own sidebar block, outside Settings > Email Block): pick a client and email them every
 * Welcome Kit file and, once they have e-signed, the signed agreement and e-KYC documents. The sender and the
 * files themselves are managed in Settings > Email Block.
 */
export const SendWelcomeKitBlock = () => {
  const { sales = [] } = useCRM();
  const [sender, setSender] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    getEmailSettings()
      .then(s => live && setSender(s?.senderEmail || ''))
      .catch(err => live && setError(err.message));
    return () => { live = false; };
  }, []);

  return (
    <div className="directory-card" style={{ overflow: 'hidden' }}>
      <div className="directory-toolbar">
        <div className="directory-title-area">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MailCheck size={18} color="var(--accent)" /> Send Welcome Kit
          </h3>
          <p>
            Pick a client. The kit goes to the Email ID on their Client Information Page, from {sender || 'the Sender Email ID'}:
            every Welcome Kit file and, once they have completed the Leegality e-sign, their signed agreement and e-KYC documents.
            The sender and the files are set in Settings &gt; Email Block.
          </p>
        </div>
      </div>
      {error && (
        <p style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 20px', fontSize: '0.84rem' }}>
          <AlertCircle size={15} /> {error}
        </p>
      )}
      <WelcomeKitSender sales={sales} />
    </div>
  );
};

export default SendWelcomeKitBlock;
