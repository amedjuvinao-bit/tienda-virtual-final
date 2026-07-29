import React from 'react';
import { DOCUMENT_TYPES, PERSON_TYPES } from './dianCustomerOptions';

function cleanCode(value) {
  return String(value || '').trim().toUpperCase();
}

export default function CheckoutDianCustomerFields({
  value,
  onChange,
  useSameAddress = true,
  onUseSameAddressChange,
  countries = [],
  countriesLoading = false,
  regions = [],
  regionsLoading = false,
  cities = [],
  citiesLoading = false,
  title = 'Datos para facturación electrónica',
  differentAddressLabel = 'Usar una dirección de facturación diferente',
}) {
  const data = value || {};

  const updateFields = (fields) => {
    const nextValue = {
      ...data,
      ...fields,
    };

    onChange(nextValue, fields);
  };

  const updateField = (field, fieldValue) => {
    updateFields({ [field]: fieldValue });
  };

  const isNit = cleanCode(data.documentType) === 'NIT';
  const isCompany = data.personType === 'juridica';
  const countryCode = cleanCode(data.country || 'CO');
  const isColombia = countryCode === 'CO';

  const handlePersonType = (personType) => {
    const next = { personType };

    if (personType === 'juridica') {
      next.documentType = 'NIT';
      next.firstName = '';
      next.lastName = '';
    } else {
      next.businessName = '';
      if (cleanCode(data.documentType) === 'NIT') next.documentType = 'CC';
      next.dv = '';
    }

    updateFields(next);
  };

  const handleDocumentType = (documentType) => {
    updateFields({
      documentType,
      dv: documentType === 'NIT' ? data.dv || '' : '',
    });
  };

  const handleCountry = (nextCountryCode) => {
    const country = countries.find((item) => cleanCode(item?.code) === cleanCode(nextCountryCode));

    updateFields({
      country: cleanCode(nextCountryCode),
      countryName: country?.name || '',
      department: '',
      departmentCode: '',
      city: '',
      cityCode: '',
      municipalityCode: '',
    });
  };

  const handleDepartment = (departmentCode) => {
    const region = regions.find((item) => cleanCode(item?.code) === cleanCode(departmentCode));

    updateFields({
      departmentCode: cleanCode(departmentCode),
      department: region?.name || '',
      city: '',
      cityCode: '',
      municipalityCode: '',
    });
  };

  const handleCity = (cityCode) => {
    const city = cities.find((item) => cleanCode(item?.code) === cleanCode(cityCode));

    updateFields({
      cityCode: cleanCode(cityCode),
      municipalityCode: cleanCode(cityCode),
      city: city?.name || '',
    });
  };

  return (
    <div className="co-card">
      <h2 className="co-card-title">{title}</h2>
      <p style={{ fontSize: '13px', color: 'var(--co-text-secondary)', marginBottom: '18px' }}>
        Esta información aparecerá en la factura electrónica. Verifica que coincida con el documento del comprador.
      </p>

      <div className="co-grid-2">
        <div>
          <label className="co-field-label">Tipo de persona</label>
          <select
            className="co-input"
            value={data.personType || ''}
            onChange={(event) => handlePersonType(event.target.value)}
            name="billingPersonType"
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
            onChange={(event) => handleDocumentType(event.target.value)}
            name="billingDocumentType"
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

      <div className="co-grid-2 co-mt-4">
        <div>
          <label className="co-field-label">Número de documento</label>
          <input
            type="text"
            className="co-input"
            placeholder={isNit ? '900123456' : '1234567890'}
            value={data.documentNumber || ''}
            onChange={(event) => updateField('documentNumber', event.target.value)}
            name="billingDocumentNumber"
            autoComplete="off"
          />
        </div>

        {isNit ? (
          <div>
            <label className="co-field-label">Dígito de verificación (DV)</label>
            <input
              type="text"
              inputMode="numeric"
              className="co-input"
              placeholder="7"
              maxLength={1}
              value={data.dv || ''}
              onChange={(event) => updateField('dv', event.target.value.replace(/\D/g, '').slice(0, 1))}
              name="billingDv"
            />
          </div>
        ) : (
          <div>
            <label className="co-field-label">Responsabilidad tributaria</label>
            <input className="co-input" value="No aplica (ZZ)" disabled aria-label="Responsabilidad tributaria" />
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
            onChange={(event) => updateField('businessName', event.target.value)}
            name="billingBusinessName"
            autoComplete="organization"
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
              onChange={(event) => updateField('firstName', event.target.value)}
              name="billingFirstName"
              autoComplete="given-name"
            />
          </div>

          <div>
            <label className="co-field-label">Apellidos</label>
            <input
              type="text"
              className="co-input"
              placeholder="García"
              value={data.lastName || ''}
              onChange={(event) => updateField('lastName', event.target.value)}
              name="billingLastName"
              autoComplete="family-name"
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
            onChange={(event) => updateField('email', event.target.value)}
            name="billingEmail"
            autoComplete="email"
          />
        </div>

        <div>
          <label className="co-field-label">Teléfono</label>
          <input
            type="tel"
            className="co-input"
            placeholder="+57 300 000 0000"
            value={data.phone || ''}
            onChange={(event) => updateField('phone', event.target.value)}
            name="billingPhone"
            autoComplete="tel"
          />
        </div>
      </div>

      <div className="co-mt-4" style={{ display: 'grid', gap: '10px' }}>
        <label className="co-radio-option">
          <input
            type="radio"
            name="billingAddressMode"
            checked={useSameAddress}
            onChange={() => onUseSameAddressChange?.(true)}
          />
          <span>Usar la misma dirección de envío</span>
        </label>
        <label className="co-radio-option">
          <input
            type="radio"
            name="billingAddressMode"
            checked={!useSameAddress}
            onChange={() => onUseSameAddressChange?.(false)}
          />
          <span>{differentAddressLabel}</span>
        </label>
      </div>

      {useSameAddress ? (
        <div className="co-shipping-box" style={{ marginTop: '14px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#374151' }}>Dirección fiscal vinculada al envío</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>
              Si cambias la dirección de envío, la factura se actualizará antes de crear la orden.
            </div>
          </div>
        </div>
      ) : (
        <div className="co-mt-4" style={{ display: 'grid', gap: '12px' }}>
          <div>
            <label className="co-field-label">País / Región</label>
            <select
              className="co-input"
              value={countryCode}
              onChange={(event) => handleCountry(event.target.value)}
              disabled={countriesLoading}
              name="billingCountry"
              autoComplete="country"
            >
              <option value="">{countriesLoading ? 'Cargando países...' : 'Selecciona país'}</option>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>{country.name}</option>
              ))}
            </select>
          </div>

          {isColombia && (
            <div>
              <label className="co-field-label">Departamento</label>
              <select
                className="co-input"
                value={data.departmentCode || ''}
                onChange={(event) => handleDepartment(event.target.value)}
                disabled={regionsLoading}
                name="billingDepartment"
                autoComplete="address-level1"
              >
                <option value="">{regionsLoading ? 'Cargando departamentos...' : 'Selecciona departamento'}</option>
                {regions.map((region) => (
                  <option key={region.code} value={region.code}>{region.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="co-field-label">Ciudad</label>
            {isColombia ? (
              <select
                className="co-input"
                value={data.cityCode || data.municipalityCode || ''}
                onChange={(event) => handleCity(event.target.value)}
                disabled={!data.departmentCode || citiesLoading}
                name="billingCity"
                autoComplete="address-level2"
              >
                <option value="">
                  {!data.departmentCode
                    ? 'Selecciona un departamento primero'
                    : citiesLoading
                      ? 'Cargando ciudades...'
                      : 'Selecciona ciudad'}
                </option>
                {cities.map((city) => (
                  <option key={city.code} value={city.code}>{city.name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="co-input"
                placeholder="Tu ciudad"
                value={data.city || ''}
                onChange={(event) => updateField('city', event.target.value)}
                name="billingCity"
                autoComplete="address-level2"
              />
            )}
          </div>

          <div>
            <label className="co-field-label">Dirección para facturación</label>
            <input
              type="text"
              className="co-input"
              placeholder="Calle 10 # 20-30"
              value={data.address || ''}
              onChange={(event) => updateField('address', event.target.value)}
              name="billingAddress"
              autoComplete="address-line1"
            />
          </div>

          <div className="co-grid-2">
            <div>
              <label className="co-field-label">Complemento (opcional)</label>
              <input
                type="text"
                className="co-input"
                placeholder="Apto 5"
                value={data.extra || ''}
                onChange={(event) => updateField('extra', event.target.value)}
                name="billingExtra"
                autoComplete="address-line2"
              />
            </div>
            <div>
              <label className="co-field-label">Código postal (opcional)</label>
              <input
                type="text"
                className="co-input"
                placeholder="110111"
                value={data.postalCode || ''}
                onChange={(event) => updateField('postalCode', event.target.value)}
                name="billingPostalCode"
                autoComplete="postal-code"
              />
            </div>
          </div>
        </div>
      )}

      <p className="co-secure-badge">
        Tus datos fiscales se guardan con la orden y se envían al proveedor electrónico únicamente al emitir la factura.
      </p>
    </div>
  );
}
