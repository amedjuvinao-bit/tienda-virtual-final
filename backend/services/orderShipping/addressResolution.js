'use strict';

const { createLogisticsError } = require('../orderLogisticsService');
const { daneColombiaDepartmentCode } = require('../shippingPayloadService');
const { resolveOrderBillingMunicipality } = require('../orderBillingMunicipalityService');
const { clean } = require('./shared');

function normalizedLocationText(value) {
  return clean(value, 180)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function locationValue(location, ...keys) {
  for (const key of keys) {
    const value = clean(location?.[key], 180);
    if (value) return value;
  }
  return '';
}

function chooseEnviaLocation(locations, address) {
  const candidates = Array.isArray(locations) ? locations.filter(Boolean) : [];
  if (candidates.length <= 1) return candidates[0] || null;
  const expected = {
    city: normalizedLocationText(address.city),
    state: normalizedLocationText(address.state),
    postalCode: normalizedLocationText(address.postalCode),
  };
  const ranked = candidates
    .map((location) => {
      const actual = {
        city: normalizedLocationText(locationValue(location, 'city', 'locality')),
        state: normalizedLocationText(locationValue(location, 'state', 'stateCode')),
        postalCode: normalizedLocationText(locationValue(location, 'zipcode', 'postalCode', 'zipCode')),
      };
      const score =
        (expected.postalCode && actual.postalCode === expected.postalCode ? 8 : 0) +
        (expected.state && actual.state === expected.state ? 4 : 0) +
        (expected.city && actual.city === expected.city ? 2 : 0);
      return { location, score };
    })
    .sort((left, right) => right.score - left.score);
  if (!ranked[0]?.score || ranked[0].score === ranked[1]?.score) return null;
  return ranked[0].location;
}

function addressRole(key, address, roles = {}) {
  const role = roles?.[key] || {};
  const origin = key === 'origin';
  return {
    place: clean(role.place, 180) || (
      origin
        ? `la sede ${clean(address.name, 120) || 'de origen'}`
        : 'la dirección de entrega'
    ),
    correction: clean(role.correction, 240) || (
      origin
        ? 'Corrige la ubicación en Configuración → Sedes.'
        : 'Corrige la dirección del cliente en la orden.'
    ),
  };
}

function unresolvedShippingAddress(key, address, message = '', roles = {}) {
  const origin = key === 'origin';
  const { place, correction } = addressRole(key, address, roles);
  return createLogisticsError(
    message ||
      `No fue posible validar ${place}: ${clean(address.city, 120)} (${clean(address.state, 80)}), ${clean(address.country, 10)}. ${correction}`,
    'SHIPPING_ADDRESS_NOT_RESOLVED',
    422,
    {
      address: key,
      country: clean(address.country, 10),
      city: clean(address.city, 120),
      state: clean(address.state, 80),
      postalCode: clean(address.postalCode, 30),
    }
  );
}

async function resolveShippingAddresses(provider, payload, roles = {}) {
  const prepared = {
    ...payload,
    origin: { ...payload.origin },
    destination: { ...payload.destination },
  };
  for (const key of ['origin', 'destination']) {
    const address = prepared[key];
    if (!/^[A-Z]{2}$/.test(clean(address.country, 10))) {
      throw unresolvedShippingAddress(
        key,
        address,
        `El país de ${addressRole(key, address, roles).place} no tiene un código ISO de dos letras válido.`,
        roles
      );
    }

    if (address.country !== 'CO') {
      if (typeof provider?.resolveAddress !== 'function') continue;
      if (address.state && typeof provider?.resolveState === 'function') {
        try {
          const state = await provider.resolveState({
            country: address.country,
            state: address.state,
          });
          address.state = locationValue(state, 'code', 'state_code', 'stateCode') || address.state;
        } catch (error) {
          const unsupportedStateCatalog =
            error?.code === 'SHIPPING_PROVIDER_HTTP_ERROR' &&
            error?.details?.operation === 'list_states' &&
            [400, 404].includes(Number(error?.details?.providerStatus));
          if (
            !unsupportedStateCatalog &&
            !['SHIPPING_PROVIDER_EMPTY_RESPONSE', 'SHIPPING_PROVIDER_REJECTED'].includes(error?.code)
          ) {
            throw error;
          }
        }
      }
      let locations;
      try {
        locations = await provider.resolveAddress({
          country: address.country,
          city: address.city,
          postalCode: address.postalCode,
        });
      } catch (error) {
        const unresolved =
          ['SHIPPING_PROVIDER_EMPTY_RESPONSE', 'SHIPPING_PROVIDER_REJECTED']
            .includes(error?.code) &&
          error?.details?.operation === 'resolve_address';
        if (!unresolved) throw error;
        throw unresolvedShippingAddress(key, address, '', roles);
      }
      const located = chooseEnviaLocation(locations, address);
      if (!located) throw unresolvedShippingAddress(key, address, '', roles);
      address.city = locationValue(located, 'city', 'locality') || address.city;
      address.state = locationValue(located, 'state', 'stateCode') || address.state;
      address.postalCode =
        locationValue(located, 'zipcode', 'postalCode', 'zipCode') || address.postalCode;
      continue;
    }

    if (/^\d{8}$/.test(clean(address.city, 20))) continue;

    const cityValue = clean(address.city, 120);
    const fiveDigitMunicipality = /^\d{5}$/.test(cityValue) ? cityValue : '';
    const municipality = resolveOrderBillingMunicipality(
      {
        billing: {
          countryCode: 'CO',
          city: fiveDigitMunicipality ? '' : cityValue,
          municipalityCode: fiveDigitMunicipality,
          departmentCode: daneColombiaDepartmentCode(address.state),
        },
      },
      { required: false }
    );
    const localDaneCity = clean(municipality?.municipalityCode, 5);
    if (/^\d{5}$/.test(localDaneCity)) {
      address.city = `${localDaneCity}000`;
      continue;
    }

    const { place, correction } = addressRole(key, address, roles);
    const unresolvedCity = () => createLogisticsError(
      `No fue posible identificar el municipio colombiano de ${place}: ${cityValue} (${clean(address.state, 20)}). ${correction}`,
      'SHIPPING_CITY_NOT_RESOLVED',
      422,
      {
        address: key,
        city: cityValue,
        state: clean(address.state, 20),
      }
    );

    if (typeof provider?.resolveColombiaCity !== 'function') {
      throw unresolvedCity();
    }
    let located;
    try {
      located = await provider.resolveColombiaCity({
        city: address.city,
        state: address.state,
        country: 'CO',
      });
    } catch (error) {
      const unresolvedLocation =
        ['SHIPPING_PROVIDER_REJECTED', 'SHIPPING_PROVIDER_EMPTY_RESPONSE']
          .includes(error?.code) &&
        error?.details?.operation === 'resolve_colombia_city';
      if (!unresolvedLocation) throw error;
      throw unresolvedCity();
    }
    const daneCity = clean(located?.city, 20);
    if (!/^\d{8}$/.test(daneCity)) {
      throw unresolvedCity();
    }
    address.city = daneCity;
    address.state = clean(located?.state || address.state, 20);
    address.postalCode = clean(
      located?.postalCode || located?.zipCode || address.postalCode,
      30
    );
  }
  return prepared;
}

module.exports = {
  chooseEnviaLocation,
  resolveShippingAddresses,
};
