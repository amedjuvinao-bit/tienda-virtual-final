import { useEffect } from 'react';
import { API_BASE_URL } from '../../config/apiBaseUrl';
import { setSessionId as setApiSessionId } from '../../lib/api';
import { fetchSiteSettings } from '../../lib/siteSettingsApi';
import { getSessionId } from '../../utils/getSessionId';
import {
  buildSafeCheckoutPageConfig,
  buildSafePaymentsConfig,
} from './checkoutPageModel';
import { loadWompiWidgetScript } from './checkoutWompi';

export default function useCheckoutConfiguration(state) {
  const {
    paymentsConfig,
    setCheckoutConfig,
    setCheckoutConfigLoading,
    setCheckoutPageData,
    setPaymentsConfig,
    setPaymentsConfigLoading,
    setShippingConfig,
    setShippingConfigLoading,
  } = state;

  useEffect(() => {
    let cancel = false;
    const loadCheckoutConfig = async () => {
      try {
        setCheckoutConfigLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/pages/checkout`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (cancel) return;
        setCheckoutPageData(data);
        setCheckoutConfig(buildSafeCheckoutPageConfig(data?.checkoutPageConfig));
      } catch {
        if (!cancel) {
          setCheckoutPageData(null);
          setCheckoutConfig(buildSafeCheckoutPageConfig({}));
        }
      } finally {
        if (!cancel) setCheckoutConfigLoading(false);
      }
    };
    loadCheckoutConfig();
    return () => {
      cancel = true;
    };
  }, [setCheckoutConfig, setCheckoutConfigLoading, setCheckoutPageData]);

  useEffect(() => {
    let cancel = false;
    const loadSiteConfig = async () => {
      try {
        setShippingConfigLoading(true);
        setPaymentsConfigLoading(true);
        const data = await fetchSiteSettings();
        if (cancel) return;
        setShippingConfig(data?.theme?.global?.envios || null);
        setPaymentsConfig(
          buildSafePaymentsConfig(data?.theme?.global?.payments || {})
        );
      } catch (error) {
        if (!cancel) {
          console.error('Error cargando la configuración global.', {
            code:
              error?.response?.data?.error || error?.code || 'REQUEST_FAILED',
            status: Number(error?.response?.status || 0),
          });
          setShippingConfig(null);
          setPaymentsConfig(buildSafePaymentsConfig({}));
        }
      } finally {
        if (!cancel) {
          setShippingConfigLoading(false);
          setPaymentsConfigLoading(false);
        }
      }
    };
    loadSiteConfig();
    return () => {
      cancel = true;
    };
  }, [
    setPaymentsConfig,
    setPaymentsConfigLoading,
    setShippingConfig,
    setShippingConfigLoading,
  ]);

  useEffect(() => {
    const sessionId = getSessionId();
    try {
      setApiSessionId(sessionId);
    } catch {
      // La API también puede resolver la sesión en su interceptor.
    }
  }, []);

  useEffect(() => {
    if (
      paymentsConfig.provider !== 'wompi' ||
      paymentsConfig.active === false
    ) {
      return;
    }
    loadWompiWidgetScript().catch(() => {});
  }, [paymentsConfig.provider, paymentsConfig.active]);
}
