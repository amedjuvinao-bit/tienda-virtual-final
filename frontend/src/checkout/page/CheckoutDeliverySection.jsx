import React from 'react';

export default function CheckoutDeliverySection({ state, derived }) {
  const { checkoutConfig } = state;

  if (!derived.cartRequiresShipping) {
    return (
      <div className="co-card">
        <h2 className="co-card-title">Entrega de la compra</h2>
        <div className="co-shipping-box">
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
              Sin envío físico
            </div>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
              Recibirás por correo los enlaces digitales o las instrucciones para coordinar el servicio después de confirmar el pago.
            </div>
          </div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: checkoutConfig.style.accentColor }}>
            Gratis
          </div>
        </div>
      </div>
    );
  }

  if (!checkoutConfig.showDeliverySection) return null;

  return (
    <div className="co-card">
      <h2 className="co-card-title">{checkoutConfig.deliverySectionTitle}</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
        <label className="co-radio-option">
          <input type="radio" name="delivery" value="envio" checked={state.deliveryType === 'envio'} onChange={() => state.setDeliveryType('envio')} />
          <span>🚚</span>
          <span style={{ fontWeight: 500 }}>Envío a domicilio</span>
        </label>
        <label className="co-radio-option">
          <input type="radio" name="delivery" value="retiro" checked={state.deliveryType === 'retiro'} onChange={() => state.setDeliveryType('retiro')} />
          <span>🏪</span>
          <span style={{ fontWeight: 500 }}>Retiro en tienda</span>
        </label>
      </div>

      <label className="co-field-label">País / Región</label>
      <select
        className="co-input"
        value={state.customerCountry}
        onChange={(event) => {
          state.setCustomerCountry(event.target.value);
          state.setSelectedRegion('');
          state.setCustomerCity('');
          state.setCustomerCityCode('');
          state.setCitiesList([]);
        }}
        disabled={state.countriesLoading}
        name="country"
        autoComplete="country-name"
      >
        <option value="">{state.countriesLoading ? 'Cargando países...' : 'Selecciona país'}</option>
        {state.countries.map((country) => (
          <option key={country.code} value={country.name}>{country.name}</option>
        ))}
      </select>

      {derived.selectedCountry?.code && (
        <div className="co-mt-3">
          <label className="co-field-label">
            {derived.selectedCountry.code === 'CO' ? 'Departamento' : 'Estado / provincia'}
          </label>
          {derived.selectedCountry.code === 'CO' ? (
            <select
              className="co-input"
              value={state.selectedRegion}
              onChange={(event) => {
                state.setSelectedRegion(event.target.value);
                state.setCustomerCity('');
                state.setCustomerCityCode('');
                state.setCitiesList([]);
              }}
              disabled={state.regionsLoading}
              name="region"
              autoComplete="address-level1"
            >
              <option value="">{state.regionsLoading ? 'Cargando departamentos...' : 'Selecciona departamento'}</option>
              {state.regions.map((region) => (
                <option key={region.code} value={region.code}>{region.name}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              className="co-input"
              placeholder="Estado, provincia o región"
              value={state.selectedRegion}
              onChange={(event) => state.setSelectedRegion(event.target.value)}
              name="region"
              autoComplete="address-level1"
            />
          )}
        </div>
      )}

      <div className="co-mt-3">
        <label className="co-field-label">{checkoutConfig.cityLabelText}</label>
        {derived.selectedCountry?.code === 'CO' ? (
          <select
            className="co-input"
            value={state.customerCityCode}
            onChange={(event) => {
              const selectedCode = event.target.value;
              state.setCustomerCityCode(selectedCode);
              const selectedCity = state.citiesList.find((city) => city.code === selectedCode);
              state.setCustomerCity(selectedCity?.name || '');
            }}
            disabled={!state.selectedRegion || state.citiesLoading}
            name="city"
            autoComplete="address-level2"
          >
            <option value="">
              {!state.selectedRegion
                ? 'Selecciona un departamento primero'
                : (state.citiesLoading ? 'Cargando ciudades...' : 'Selecciona ciudad')}
            </option>
            {state.citiesList.map((city) => (
              <option key={city.code} value={city.code}>{city.name}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            className="co-input"
            placeholder="Tu ciudad"
            value={state.customerCity}
            onChange={(event) => state.setCustomerCity(event.target.value)}
            name="city"
            autoComplete="address-level2"
          />
        )}
      </div>

      <div className="co-mt-3">
        <label className="co-field-label">{checkoutConfig.addressLabelText}</label>
        <input
          type="text"
          className="co-input"
          placeholder="Calle 10 # 20-30, Apto 5"
          value={state.customerAddress}
          onChange={(event) => state.setCustomerAddress(event.target.value)}
          name="address"
          autoComplete="address-line1"
        />
      </div>

      <div className="co-grid-2 co-mt-3">
        <div>
          <label className="co-field-label">Código Postal</label>
          <input
            type="text"
            className="co-input"
            placeholder="110111"
            value={state.customerPostalCode}
            onChange={(event) => state.setCustomerPostalCode(event.target.value)}
            name="postalCode"
            autoComplete="postal-code"
          />
        </div>
        <div>
          <label className="co-field-label">{checkoutConfig.phoneLabelText}</label>
          <input
            type="tel"
            className="co-input"
            placeholder="+57 300 000 0000"
            value={state.customerPhone}
            onChange={(event) => state.setCustomerPhone(event.target.value)}
            name="phone"
            autoComplete="tel"
          />
        </div>
      </div>

      <div className="co-shipping-box">
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
            {derived.shippingLabel}
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
            {derived.shippingEta}
          </div>
        </div>
        <div style={{ fontSize: '15px', fontWeight: 700, color: checkoutConfig.style.accentColor }}>
          {derived.finalShipping === 0 ? 'Gratis' : `$ ${derived.finalShipping.toLocaleString('es-CO')}`}
        </div>
      </div>
    </div>
  );
}
