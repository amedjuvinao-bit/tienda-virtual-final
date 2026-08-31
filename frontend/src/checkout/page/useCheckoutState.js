import { useState } from 'react';
import { dianCustomerDefaults } from '../dian/dianCustomerDefaults';
import {
  buildSafeCheckoutPageConfig,
  buildSafePaymentsConfig,
  EMPTY_STORE_CREDIT_PREVIEW,
} from './checkoutPageModel';

export default function useCheckoutState() {
  const [deliveryType, setDeliveryType] = useState('envio');
  const [discountCode, setDiscountCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponMessage, setCouponMessage] = useState('');
  const [couponError, setCouponError] = useState('');
  const [checkoutQuote, setCheckoutQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [sameAddress, setSameAddress] = useState(true);
  const [wantsNewsletter, setWantsNewsletter] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showEnvioModal, setShowEnvioModal] = useState(false);
  const [showPrivacidadModal, setShowPrivacidadModal] = useState(false);
  const [showTerminosModal, setShowTerminosModal] = useState(false);
  const [showContactoModal, setShowContactoModal] = useState(false);
  const [errors, setErrors] = useState([]);
  const [checkoutPageData, setCheckoutPageData] = useState(null);
  const [checkoutConfig, setCheckoutConfig] = useState(
    buildSafeCheckoutPageConfig({})
  );
  const [checkoutConfigLoading, setCheckoutConfigLoading] = useState(true);
  const [shippingConfig, setShippingConfig] = useState(null);
  const [shippingConfigLoading, setShippingConfigLoading] = useState(true);
  const [paymentsConfig, setPaymentsConfig] = useState(
    buildSafePaymentsConfig({})
  );
  const [paymentsConfigLoading, setPaymentsConfigLoading] = useState(true);
  const [storeCreditPreview, setStoreCreditPreview] = useState({
    ...EMPTY_STORE_CREDIT_PREVIEW,
  });
  const [useStoreCredit, setUseStoreCredit] = useState(false);
  const [storeCreditAmount, setStoreCreditAmount] = useState('');
  const [cartView, setCartView] = useState(null);
  const [serverSummary, setServerSummary] = useState(null);
  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [regions, setRegions] = useState([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [citiesList, setCitiesList] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [billingRegions, setBillingRegions] = useState([]);
  const [billingRegionsLoading, setBillingRegionsLoading] = useState(false);
  const [billingCities, setBillingCities] = useState([]);
  const [billingCitiesLoading, setBillingCitiesLoading] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerLastname, setCustomerLastname] = useState('');
  const [customerEmailOrPhone, setCustomerEmailOrPhone] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerCityCode, setCustomerCityCode] = useState('');
  const [customerPostalCode, setCustomerPostalCode] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerCountry, setCustomerCountry] = useState('Colombia');
  const [dianCustomer, setDianCustomer] = useState(dianCustomerDefaults);
  const [isPlacing, setIsPlacing] = useState(false);

  return {
    deliveryType, setDeliveryType,
    discountCode, setDiscountCode,
    appliedCoupon, setAppliedCoupon,
    couponMessage, setCouponMessage,
    couponError, setCouponError,
    checkoutQuote, setCheckoutQuote,
    quoteLoading, setQuoteLoading,
    sameAddress, setSameAddress,
    wantsNewsletter, setWantsNewsletter,
    showModal, setShowModal,
    showEnvioModal, setShowEnvioModal,
    showPrivacidadModal, setShowPrivacidadModal,
    showTerminosModal, setShowTerminosModal,
    showContactoModal, setShowContactoModal,
    errors, setErrors,
    checkoutPageData, setCheckoutPageData,
    checkoutConfig, setCheckoutConfig,
    checkoutConfigLoading, setCheckoutConfigLoading,
    shippingConfig, setShippingConfig,
    shippingConfigLoading, setShippingConfigLoading,
    paymentsConfig, setPaymentsConfig,
    paymentsConfigLoading, setPaymentsConfigLoading,
    storeCreditPreview, setStoreCreditPreview,
    useStoreCredit, setUseStoreCredit,
    storeCreditAmount, setStoreCreditAmount,
    cartView, setCartView,
    serverSummary, setServerSummary,
    countries, setCountries,
    countriesLoading, setCountriesLoading,
    regions, setRegions,
    regionsLoading, setRegionsLoading,
    selectedRegion, setSelectedRegion,
    citiesList, setCitiesList,
    citiesLoading, setCitiesLoading,
    billingRegions, setBillingRegions,
    billingRegionsLoading, setBillingRegionsLoading,
    billingCities, setBillingCities,
    billingCitiesLoading, setBillingCitiesLoading,
    customerName, setCustomerName,
    customerLastname, setCustomerLastname,
    customerEmailOrPhone, setCustomerEmailOrPhone,
    customerPhone, setCustomerPhone,
    customerAddress, setCustomerAddress,
    customerCity, setCustomerCity,
    customerCityCode, setCustomerCityCode,
    customerPostalCode, setCustomerPostalCode,
    customerId, setCustomerId,
    customerCountry, setCustomerCountry,
    dianCustomer, setDianCustomer,
    isPlacing, setIsPlacing,
  };
}
