import { useEffect, useState } from 'react';
import api from '../../../../lib/api';
import { findUniqueByName } from './orderCustomerBillingModel';

export function useOrderCustomerBillingGeography({ editing, form, setForm }) {
  const [regions, setRegions] = useState([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [customerCities, setCustomerCities] = useState([]);
  const [billingCities, setBillingCities] = useState([]);
  const [customerCitiesLoading, setCustomerCitiesLoading] = useState(false);
  const [billingCitiesLoading, setBillingCitiesLoading] = useState(false);
  const [geoError, setGeoError] = useState('');

  useEffect(() => {
    if (!editing) return undefined;

    let cancelled = false;
    setRegionsLoading(true);
    setGeoError('');

    api.get('/api/geo/regions', { params: { country: 'CO' } })
      .then((response) => {
        if (!cancelled) {
          setRegions(Array.isArray(response?.data) ? response.data : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRegions([]);
          setGeoError(
            'No fue posible cargar los departamentos. Intenta nuevamente.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setRegionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editing]);

  useEffect(() => {
    if (!editing || !regions.length) return;

    setForm((current) => {
      let changed = false;
      const next = {
        ...current,
        customer: { ...current.customer },
        billing: { ...current.billing },
      };

      ['customer', 'billing'].forEach((party) => {
        if (next[party].departmentCode || !next[party].department) return;
        const region = findUniqueByName(regions, next[party].department);
        if (!region?.code) return;

        next[party].departmentCode = String(region.code);
        next[party].department = region.name || next[party].department;
        changed = true;
      });

      return changed ? next : current;
    });
  }, [editing, regions, setForm]);

  useEffect(() => {
    const departmentCode = String(form.customer.departmentCode || '').trim();
    if (!editing || !departmentCode) {
      setCustomerCities([]);
      return undefined;
    }

    let cancelled = false;
    setCustomerCitiesLoading(true);

    api.get('/api/geo/cities', {
      params: { country: 'CO', region: departmentCode, limit: 10000 },
    })
      .then((response) => {
        if (!cancelled) {
          setCustomerCities(Array.isArray(response?.data) ? response.data : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCustomerCities([]);
          setGeoError(
            'No fue posible cargar los municipios. Intenta nuevamente.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setCustomerCitiesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editing, form.customer.departmentCode]);

  useEffect(() => {
    const departmentCode = String(form.billing.departmentCode || '').trim();
    if (!editing || !departmentCode) {
      setBillingCities([]);
      return undefined;
    }

    let cancelled = false;
    setBillingCitiesLoading(true);

    api.get('/api/geo/cities', {
      params: { country: 'CO', region: departmentCode, limit: 10000 },
    })
      .then((response) => {
        if (!cancelled) {
          setBillingCities(Array.isArray(response?.data) ? response.data : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBillingCities([]);
          setGeoError(
            'No fue posible cargar los municipios. Intenta nuevamente.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setBillingCitiesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editing, form.billing.departmentCode]);

  useEffect(() => {
    if (!editing || !customerCities.length || form.customer.municipalityCode) {
      return;
    }
    const city = findUniqueByName(customerCities, form.customer.city);
    if (!city?.code) return;

    setForm((current) => ({
      ...current,
      customer: {
        ...current.customer,
        city: city.name || current.customer.city,
        municipalityCode: String(city.code),
      },
    }));
  }, [
    customerCities,
    editing,
    form.customer.city,
    form.customer.municipalityCode,
    setForm,
  ]);

  useEffect(() => {
    if (!editing || !billingCities.length || form.billing.municipalityCode) {
      return;
    }
    const city = findUniqueByName(billingCities, form.billing.city);
    if (!city?.code) return;

    setForm((current) => ({
      ...current,
      billing: {
        ...current.billing,
        city: city.name || current.billing.city,
        municipalityCode: String(city.code),
        cityCode: String(city.code),
      },
    }));
  }, [
    billingCities,
    editing,
    form.billing.city,
    form.billing.municipalityCode,
    setForm,
  ]);

  const setDepartment = (party, code) => {
    const region = regions.find(
      (item) => String(item?.code || '') === String(code || '')
    );

    setForm((current) => ({
      ...current,
      [party]: {
        ...current[party],
        departmentCode: String(code || ''),
        department: region?.name || '',
        city: '',
        municipalityCode: '',
        ...(party === 'billing' ? { cityCode: '' } : {}),
      },
    }));
    setGeoError('');
  };

  const setMunicipality = (party, code) => {
    const cities = party === 'billing' ? billingCities : customerCities;
    const city = cities.find(
      (item) => String(item?.code || '') === String(code || '')
    );

    setForm((current) => ({
      ...current,
      [party]: {
        ...current[party],
        city: city?.name || '',
        municipalityCode: String(code || ''),
        ...(party === 'billing' ? { cityCode: String(code || '') } : {}),
      },
    }));
    setGeoError('');
  };

  return {
    regions,
    regionsLoading,
    customerCities,
    customerCitiesLoading,
    billingCities,
    billingCitiesLoading,
    geoError,
    setDepartment,
    setMunicipality,
  };
}
