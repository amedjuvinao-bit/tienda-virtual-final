// frontend/src/admin/pos/PosSalesPage.js

import React, { useEffect } from 'react';
import Page from './PosSalesPage.jsx';
import { attachPosConfirmController } from './posConfirmSaleDom';

export default function PosSalesPage() {
  useEffect(() => attachPosConfirmController(), []);
  return React.createElement(Page);
}
