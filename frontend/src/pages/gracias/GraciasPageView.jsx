import Header from '../../components/Header';
import FooterSection from '../../components/FooterSection';
import WhatsAppButton from '../../components/WhatsAppButton';
import GraciasSummaryPanel from './GraciasSummaryPanel';
import GraciasVisualPanel from './GraciasVisualPanel';
import { GRACIAS_STYLES } from './graciasPageStyles';

export default function GraciasPageView(controller) {
  const { thanksConfig: config, viewModel: model, presentationStyle } = controller;
  const style = config.style;
  return <>
    <style>{GRACIAS_STYLES}</style>
    <div className="gp-page min-h-screen flex flex-col" style={{ backgroundColor: style.pageBg, color: style.textPrimaryColor }}>
      {config.showHeader && <Header />}
      <div className="flex-1 mx-auto px-4 sm:px-6 pb-16" style={{
        maxWidth: `${style.contentMaxWidthPx}px`, width: '100%',
        paddingTop: `${style.contentTopPaddingPx}px`,
      }}>
        <div className="gp-layout">
          <GraciasVisualPanel
            config={config}
            slides={controller.slides}
            currentSlide={controller.currentSlide}
            setCurrentSlide={controller.setCurrentSlide}
            shadowClass={presentationStyle.shadowClass}
          />
          <GraciasSummaryPanel
            config={config}
            model={model}
            accessError={controller.thanksAccessError}
            returnAccessEnabled={controller.thanksOrderData?.returnAccess?.enabled === true}
            openReturnsPortal={controller.openReturnsPortal}
            continueShopping={controller.continueShopping}
            shadowClass={presentationStyle.shadowClass}
            buttonRadius={presentationStyle.buttonRadius}
          />
        </div>
      </div>
      {config.showFooter && <FooterSection />}
      {config.showWhatsAppButton && <WhatsAppButton />}
    </div>
  </>;
}
