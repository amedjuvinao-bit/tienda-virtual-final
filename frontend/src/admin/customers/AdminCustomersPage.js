import React from 'react';
import Page from './AdminCustomersPageTabbed.jsx';
import CustomerModalPortalFix from './CustomerModalPortalFix.jsx';

export default function AdminCustomersPage() {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(CustomerModalPortalFix),
    React.createElement(Page)
  );
}
