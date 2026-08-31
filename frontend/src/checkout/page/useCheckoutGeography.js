import { useEffect } from 'react';
import api from '../../lib/api';

export default function useCheckoutGeography({ state, selectedCountry }) {
  const {
    customerCountry,
    dianCustomer,
    sameAddress,
    selectedRegion,
    setBillingCities,
    setBillingCitiesLoading,
    setBillingRegions,
    setBillingRegionsLoading,
    setCitiesList,
    setCitiesLoading,
    setCountries,
    setCountriesLoading,
    setCustomerCountry,
    setRegions,
    setRegionsLoading,
    setSelectedRegion,
  } = state;

  useEffect(() => {
    let cancel = false;
    setCountriesLoading(true);
    api
      .get('/api/geo/countries')
      .then((response) => {
        if (cancel) return;
        const list = Array.isArray(response.data) ? response.data : [];
        setCountries(list);
        const hasCurrent = list.some(
          (country) =>
            country.name?.toLowerCase() ===
            String(customerCountry).toLowerCase()
        );
        if (!hasCurrent) {
          const colombia = list.find((country) => country.code === 'CO');
          setCustomerCountry(colombia ? colombia.name : '');
        }
      })
      .catch(() => setCountries([]))
      .finally(() => !cancel && setCountriesLoading(false));
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedCountry || selectedCountry.code !== 'CO') {
      setRegions([]);
      setSelectedRegion('');
      setCitiesList([]);
      return;
    }
    let cancel = false;
    setRegionsLoading(true);
    api
      .get('/api/geo/regions', { params: { country: 'CO' } })
      .then((response) => {
        if (!cancel) {
          setRegions(Array.isArray(response.data) ? response.data : []);
        }
      })
      .catch(() => {
        if (!cancel) setRegions([]);
      })
      .finally(() => {
        if (!cancel) setRegionsLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [
    selectedCountry,
    setCitiesList,
    setRegions,
    setRegionsLoading,
    setSelectedRegion,
  ]);

  useEffect(() => {
    if (selectedCountry?.code !== 'CO' || !selectedRegion) {
      setCitiesList([]);
      return;
    }
    let cancel = false;
    setCitiesLoading(true);
    api
      .get('/api/geo/cities', {
        params: { country: 'CO', region: selectedRegion, limit: 10000 },
      })
      .then((response) => {
        if (!cancel) {
          setCitiesList(Array.isArray(response.data) ? response.data : []);
        }
      })
      .catch(() => {
        if (!cancel) setCitiesList([]);
      })
      .finally(() => {
        if (!cancel) setCitiesLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [
    selectedCountry?.code,
    selectedRegion,
    setCitiesList,
    setCitiesLoading,
  ]);

  useEffect(() => {
    const countryCode = String(dianCustomer.country || '').trim().toUpperCase();
    if (sameAddress || countryCode !== 'CO') {
      setBillingRegions([]);
      setBillingCities([]);
      return;
    }
    let cancel = false;
    setBillingRegionsLoading(true);
    api
      .get('/api/geo/regions', { params: { country: 'CO' } })
      .then((response) => {
        if (!cancel) {
          setBillingRegions(Array.isArray(response.data) ? response.data : []);
        }
      })
      .catch(() => {
        if (!cancel) setBillingRegions([]);
      })
      .finally(() => {
        if (!cancel) setBillingRegionsLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [
    sameAddress,
    dianCustomer.country,
    setBillingCities,
    setBillingRegions,
    setBillingRegionsLoading,
  ]);

  useEffect(() => {
    const countryCode = String(dianCustomer.country || '').trim().toUpperCase();
    const departmentCode = String(dianCustomer.departmentCode || '').trim();
    if (sameAddress || countryCode !== 'CO' || !departmentCode) {
      setBillingCities([]);
      return;
    }
    let cancel = false;
    setBillingCitiesLoading(true);
    api
      .get('/api/geo/cities', {
        params: { country: 'CO', region: departmentCode, limit: 10000 },
      })
      .then((response) => {
        if (!cancel) {
          setBillingCities(Array.isArray(response.data) ? response.data : []);
        }
      })
      .catch(() => {
        if (!cancel) setBillingCities([]);
      })
      .finally(() => {
        if (!cancel) setBillingCitiesLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [
    sameAddress,
    dianCustomer.country,
    dianCustomer.departmentCode,
    setBillingCities,
    setBillingCitiesLoading,
  ]);
}
