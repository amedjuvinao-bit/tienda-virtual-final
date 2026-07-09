import React from 'react';
import AdminCustomersPageEditable from './AdminCustomersPageEditable.jsx';
import CustomerFollowUpsVisualPatch from './CustomerFollowUpsVisualPatch.jsx';

export default function AdminCustomersPageEditView() {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(CustomerFollowUpsVisualPatch),
    React.createElement(AdminCustomersPageEditable)
  );
}
