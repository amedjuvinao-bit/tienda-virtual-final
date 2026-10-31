import { useEffect } from 'react';
import { API_BASE_URL } from '../../config/apiBaseUrl';
import api, { setSessionId as setApiSessionId } from '../../lib/api';
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
    const controller = new AbortController();
    const loadCheckoutConfig = async () => {
      try {
        setCheckoutConfigLoading(true);
        state.setCheckoutConfigError('');
        const response = await fetch(`${API_BASE_URL}/api/pages/checkout`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (cancel) return;
        setCheckoutPageData(data);
        setCheckoutConfig(
          buildSafeCheckoutPageConfig({
            ...(data?.enabled === false ? {} : data?.checkoutPageConfig),
            showHeader:
              data?.useHeader !== false &&
              data?.checkoutPageConfig?.showHeader !== false,
            showFooter:
              data?.useFooter !== false &&
              data?.checkoutPageConfig?.showFooter !== false,
          })
        );
      } catch {
        if (!cancel) {
          if (!state.checkoutPageData)
            setCheckoutConfig(
              buildSafeCheckoutPageConfig({
                showHeader: false,
                showFooter: false,
              })
            );
          state.setCheckoutConfigError(
            'No pudimos cargar la apariencia del checkout. Puedes reintentar.'
          );
        }
      } finally {
        if (!cancel) setCheckoutConfigLoading(false);
      }
    };
    loadCheckoutConfig();
    return () => {
      cancel = true;
      controller.abort();
    };
  }, [
    setCheckoutConfig,
    setCheckoutConfigLoading,
    setCheckoutPageData,
    state.configurationAttempt,
  ]);

  useEffect(() => {
    let cancel = false;
    const controller = new AbortController();
    const loadSiteConfig = async () => {
      try {
        state.setConfigurationError('');
        setShippingConfigLoading(true);
        setPaymentsConfigLoading(true);
        const { data } = await api.get('/api/site-settings', {
          signal: controller.signal,
        });
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
          state.setConfigurationError(
            'No pudimos cargar los medios de pago y el envío. Reintenta antes de continuar.'
          );
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
      controller.abort();
    };
  }, [
    setPaymentsConfig,
    setPaymentsConfigLoading,
    setShippingConfig,
    setShippingConfigLoading,
    state.configurationAttempt,
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
