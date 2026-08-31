import React from 'react';
import FooterSection from '../../components/FooterSection';
import Header from '../../components/Header';
import ModalContacto from '../../components/ModalContacto';
import ModalEnvio from '../../components/ModalEnvio';
import ModalPrivacidad from '../../components/ModalPrivacidad';
import ModalReembolso from '../../components/ModalReembolso';
import ModalTerminos from '../../components/ModalTerminos';
import WhatsAppButton from '../../components/WhatsAppButton';
import CheckoutContactSection from './CheckoutContactSection';
import CheckoutDeliverySection from './CheckoutDeliverySection';
import CheckoutFormActions from './CheckoutFormActions';
import CheckoutOrderSummary from './CheckoutOrderSummary';
import CheckoutPaymentSection from './CheckoutPaymentSection';
import { GLOBAL_STYLES } from './checkoutPageStyles';

function CheckoutProgress() {
  return (
    <div className="co-step-indicator" style={{ justifyContent: 'center' }}>
      <div className="co-step done">
        <div className="co-step-num">
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span>Carrito</span>
      </div>
      <div className="co-step-sep" />
      <div className="co-step active">
        <div className="co-step-num">2</div>
        <span>Datos</span>
      </div>
      <div className="co-step-sep" />
      <div className="co-step">
        <div className="co-step-num">3</div>
        <span>Confirmación</span>
      </div>
    </div>
  );
}

function CheckoutHeading({ checkoutConfig }) {
  return (
    <>
      {checkoutConfig.showBreadcrumb && (
        <div className="co-breadcrumb" style={{ color: checkoutConfig.style.breadcrumbTextColor }}>
          <a href="/" style={{ color: checkoutConfig.style.breadcrumbLinkColor, fontWeight: 500 }}>
            {checkoutConfig.breadcrumbHomeText}
          </a>
          <span style={{ color: '#d1d5db' }}>›</span>
          <span>{checkoutConfig.breadcrumbCurrentText}</span>
        </div>
      )}

      <div style={{ marginBottom: '28px', textAlign: 'center' }}>
        {checkoutConfig.titleMode === 'image' && checkoutConfig.titleImage ? (
          <img
            src={checkoutConfig.titleImage}
            alt={checkoutConfig.titleImageAlt || 'Checkout'}
            style={{
              height: `${checkoutConfig.style.titleImageHeightPx}px`,
              objectFit: 'contain',
              margin: '0 auto',
              display: 'block',
            }}
          />
        ) : (
          <h1
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: `${checkoutConfig.style.titleFontSizePx}px`,
              fontWeight: 400,
              color: checkoutConfig.style.titleTextColor,
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            {checkoutConfig.titleText}
          </h1>
        )}
      </div>

      <CheckoutProgress />
    </>
  );
}

function CheckoutModals({ state }) {
  return (
    <>
      {state.showModal && <ModalReembolso visible={true} onClose={() => state.setShowModal(false)} />}
      <ModalEnvio visible={state.showEnvioModal} onClose={() => state.setShowEnvioModal(false)} />
      <ModalPrivacidad visible={state.showPrivacidadModal} onClose={() => state.setShowPrivacidadModal(false)} />
      <ModalTerminos visible={state.showTerminosModal} onClose={() => state.setShowTerminosModal(false)} />
      <ModalContacto visible={state.showContactoModal} onClose={() => state.setShowContactoModal(false)} />
    </>
  );
}

export default function CheckoutPageView({ state, derived, actions }) {
  const { checkoutConfig } = state;

  return (
    <>
      <style>{GLOBAL_STYLES}</style>

      <div className="co-page" style={derived.cssVars}>
        {checkoutConfig.showHeader && <Header />}

        {state.errors.length > 0 && (
          <div
            style={{
              maxWidth: `${checkoutConfig.style.contentMaxWidthPx}px`,
              margin: '0 auto',
              padding: '0 16px',
            }}
          >
            <div className="co-error-banner" style={{ marginTop: '88px', marginBottom: '0' }}>
              <strong>Por favor corrige los siguientes puntos:</strong>
              <ul>
                {state.errors.map((message, index) => <li key={index}>{message}</li>)}
              </ul>
            </div>
          </div>
        )}

        <div
          style={{
            maxWidth: `${checkoutConfig.style.contentMaxWidthPx}px`,
            margin: '0 auto',
            padding: `${state.errors.length > 0 ? 20 : Math.max(checkoutConfig.style.contentTopPaddingPx, 88)}px 16px 40px`,
          }}
        >
          <CheckoutHeading checkoutConfig={checkoutConfig} />

          <div className="co-layout">
            <div className="co-form-col">
              <CheckoutContactSection state={state} />
              <CheckoutDeliverySection state={state} derived={derived} />
              <CheckoutPaymentSection
                state={state}
                derived={derived}
                onPreviewStoreCredit={actions.handlePreviewStoreCredit}
              />
              <CheckoutFormActions
                state={state}
                derived={derived}
                onPlaceOrder={actions.handlePlaceOrder}
              />
            </div>

            <CheckoutOrderSummary
              state={state}
              derived={derived}
              onApplyCoupon={actions.handleApplyCoupon}
            />
          </div>
        </div>

        <CheckoutModals state={state} />
        {checkoutConfig.showFooter && <FooterSection />}
        {checkoutConfig.showWhatsAppButton && <WhatsAppButton />}
      </div>
    </>
  );
}
