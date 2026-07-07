import React from 'react';
import './cashReportModal.css';

import Page from './CashSessionsPageReport.jsx';
import CashMovementWithdrawalOptionPatch from './CashMovementWithdrawalOptionPatch.jsx';

export default function CashSessionsPage() {
  return (
    <>
      <CashMovementWithdrawalOptionPatch />
      <Page />
    </>
  );
}
