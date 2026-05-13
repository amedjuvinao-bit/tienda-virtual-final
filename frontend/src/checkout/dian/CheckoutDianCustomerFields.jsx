import React from 'react';
import { DOCUMENT_TYPES, PERSON_TYPES } from './dianCustomerOptions';

export default function CheckoutDianCustomerFields({ value, onChange }) {
  const data = value || {};

  const updateField = (field, fieldValue) => {
    onChange({
      ...data,
      [field]: fieldValue,
    });
  };

  const isNit = data.documentType === 'NIT';
  const isCompany = data.personType === 'juridica';
  const isFinalConsumer = data.personType === 'consumidor_final';

  return (
    <div className="co-card">
      <h2 className="co-card-title">Datos para facturación electrónica</h2>

      <div className="co-grid-2">
        <div>
          <label className="co-field-label">Tipo de persona</label>
          <select
            className="co-input"
            value={data.personType || ''}
            onChange={(e) => updateField('personType', e.target.value)}
          >
            <option value="">Selecciona tipo de persona</option>
            {PERSON_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="co-field-label">Tipo de documento</label>
          <select
            className="co-input"
            value={data.documentType || ''}
            onChange={(e) => updateField('documentType', e.target.value)}
          >
            <option value="">Selecciona tipo de documento</option>
            {DOCUMENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!isFinalConsumer && (
        <>
          <div className="co-grid-2 co-mt-4">
            <div>
              <label className="co-field-label">Número de documento</label>
              <input
                type="text"
                className="co-input"
                placeholder={isNit ? '900123456' : '1234567890'}
                value={data.documentNumber || ''}
                onChange={(e) => updateField('documentNumber', e.target.value)}
              />
            </div>

            {isNit && (
              <div>
                <label className="co-field-label">DV</label>
                <input
                  type="text"
                  className="co-input"
                  placeholder="7"
                  maxLength={1}
                  value={data.dv || ''}
                  onChange={(e) => updateField('dv', e.target.value)}
                />
              </div>
            )}
          </div>

          {isCompany ? (
            <div className="co-mt-4">
              <label className="co-field-label">Razón social</label>
              <input
                type="text"
                className="co-input"
                placeholder="Mi Empresa S.A.S."
                value={data.businessName || ''}
                onChange={(e) => updateField('businessName', e.target.value)}
              />
            </div>
          ) : (
            <div className="co-grid-2 co-mt-4">
              <div>
                <label className="co-field-label">Nombre</label>
                <input
                  type="text"
                  className="co-input"
                  placeholder="María"
                  value={data.firstName || ''}
                  onChange={(e) => updateField('firstName', e.target.value)}
                />
              </div>

              <div>
                <label className="co-field-label">Apellidos</label>
                <input
                  type="text"
                  className="co-input"
                  placeholder="García"
                  value={data.lastName || ''}
                  onChange={(e) => updateField('lastName', e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="co-grid-2 co-mt-4">
            <div>
              <label className="co-field-label">Correo de facturación</label>
              <input
                type="email"
                className="co-input"
                placeholder="cliente@email.com"
                value={data.email || ''}
                onChange={(e) => updateField('email', e.target.value)}
              />
            </div>

            <div>
              <label className="co-field-label">Teléfono</label>
              <input
                type="tel"
                className="co-input"
                placeholder="+57 300 000 0000"
                value={data.phone || ''}
                onChange={(e) => updateField('phone', e.target.value)}
              />
            </div>
          </div>
        </>
      )}

      <div className="co-mt-4">
        <label className="co-field-label">Dirección para facturación</label>
        <input
          type="text"
          className="co-input"
          placeholder="Calle 10 # 20-30"
          value={data.address || ''}
          onChange={(e) => updateField('address', e.target.value)}
        />
      </div>

      <div className="co-grid-2 co-mt-4">
        <div>
          <label className="co-field-label">Departamento</label>
          <input
            type="text"
            className="co-input"
            placeholder="Magdalena"
            value={data.department || ''}
            onChange={(e) => updateField('department', e.target.value)}
          />
        </div>

        <div>
          <label className="co-field-label">Ciudad</label>
          <input
            type="text"
            className="co-input"
            placeholder="Santa Marta"
            value={data.city || ''}
            onChange={(e) => updateField('city', e.target.value)}
          />
        </div>
      </div>

      <p className="co-secure-badge">
        Estos datos se usarán para preparar la factura electrónica y deben coincidir con la información tributaria del comprador.
      </p>
    </div>
  );
}