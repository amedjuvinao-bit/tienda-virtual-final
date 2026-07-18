import React from 'react';
import AdminCustomersPageTabbed from './AdminCustomersPageTabbed.jsx';
import CustomerModalPortalFix from './CustomerModalPortalFix.jsx';

export default function AdminCustomersPageEditView() {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(CustomerModalPortalFix),
    React.createElement(AdminCustomersPageTabbed)
  );
}
