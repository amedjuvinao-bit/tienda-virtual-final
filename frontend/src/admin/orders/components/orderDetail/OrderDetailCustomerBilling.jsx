// frontend/src/admin/orders/components/orderDetail/OrderDetailCustomerBilling.jsx

import { useEffect, useMemo, useState } from 'react';
import OrderCustomerBillingEditForm from './OrderCustomerBillingEditForm';
import {
  BillingSummaryPanel,
  CustomerSummaryPanel,
} from './OrderCustomerBillingSummaryPanels';
import {
  getCustomerBillingViewModel,
  getEditableCustomerBillingForm,
  isDemoOrder,
  validateCustomerBillingForm,
} from './orderCustomerBillingModel';
import { useOrderCustomerBillingGeography } from './useOrderCustomerBillingGeography';

export default function OrderDetailCustomerBilling({
  order,
  onSaveCustomerData,
  saving = false,
}) {
  const [editing, setEditing] = useState(false);
  const [syncCustomer, setSyncCustomer] = useState(false);
  const [form, setForm] = useState(() =>
    getEditableCustomerBillingForm(order)
  );
  const [formError, setFormError] = useState('');
  const demoOrder = useMemo(() => isDemoOrder(order), [order]);
  const viewModel = getCustomerBillingViewModel(order);

  useEffect(() => {
    setEditing(false);
    setSyncCustomer(false);
    setForm(getEditableCustomerBillingForm(order));
    setFormError('');
  }, [order?._id]);

  const geography = useOrderCustomerBillingGeography({
    editing,
    form,
    setForm,
  });

  const setPartyField = (party, field, value) => {
    setForm((current) => ({
      ...current,
      [party]: {
        ...current[party],
        [field]: value,
      },
    }));
  };

  const setBillingPersonType = (value) => {
    setForm((current) => ({
      ...current,
      billing: {
        ...current.billing,
        personType: value,
        documentType: value === 'juridica' ? 'NIT' : current.billing.documentType,
      },
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError('');

    const validationError = validateCustomerBillingForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      await onSaveCustomerData?.({
        customer: form.customer,
        billing: form.billing,
        syncCustomer: demoOrder ? false : syncCustomer,
      });
      setEditing(false);
    } catch {
      // El modal presenta el error del servidor; el formulario conserva los datos.
    }
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        gap: 14,
      }}
    >
      <CustomerSummaryPanel
        customer={viewModel.customer}
        editing={editing}
        onToggleEditing={() => setEditing((value) => !value)}
        canEdit={Boolean(onSaveCustomerData)}
      />

      {editing ? (
        <OrderCustomerBillingEditForm
          form={form}
          syncCustomer={syncCustomer}
          onSyncCustomerChange={setSyncCustomer}
          demoOrder={demoOrder}
          onPartyFieldChange={setPartyField}
          onBillingPersonTypeChange={setBillingPersonType}
          regions={geography.regions}
          regionsLoading={geography.regionsLoading}
          onDepartmentChange={geography.setDepartment}
          customerCities={geography.customerCities}
          customerCitiesLoading={geography.customerCitiesLoading}
          billingCities={geography.billingCities}
          billingCitiesLoading={geography.billingCitiesLoading}
          onMunicipalityChange={geography.setMunicipality}
          formError={formError}
          geoError={geography.geoError}
          saving={saving}
          onCancel={() => setEditing(false)}
          onSubmit={submit}
        />
      ) : null}

      <BillingSummaryPanel billing={viewModel.billing} />

      <style>
        {`
          @media (max-width: 900px) {
            div[style*="grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)"] {
              grid-template-columns: 1fr !important;
            }
          }

          .order-customer-edit-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 18px;
          }

          .order-customer-edit-fields {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          @media (max-width: 720px) {
            .order-customer-edit-grid,
            .order-customer-edit-fields {
              grid-template-columns: 1fr;
            }
          }
        `}
      </style>
    </div>
  );
}
