import React, { useLayoutEffect, useRef, useState } from 'react';
import { getBannerHeightSettings } from '../../../lib/bannerHeight';
import BannerTemplateView from '../../../components/BannerTemplateView';
import SliderControls from '../../../components/SliderControls';

export const BANNER_DEVICES = Object.freeze({
  mobile: { label: 'Móvil', width: 390, height: 844 },
  tablet: { label: 'Tableta', width: 820, height: 1180 },
  desktop: { label: 'Escritorio', width: 1440, height: 900 },
});

const percent = (value, fallback = 50) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : fallback;
};

export function getBannerPreviewModel(banner, slides, selectedIdx, device) {
  const viewport = BANNER_DEVICES[device] || BANNER_DEVICES.desktop;
  const type = ['slider', 'image', 'video'].includes(banner?.type) ? banner.type : 'slider';
  const slide = slides[selectedIdx] || null;
  const mediaUrl = type === 'slider' ? (device === 'mobile' ? slide?.imageMobile || slide?.imageTablet || slide?.image : device === 'tablet' ? slide?.imageTablet || slide?.image : slide?.image) : type === 'image' ? (device === 'mobile' ? banner?.imageMobileUrl || banner?.imageTabletUrl || banner?.imageUrl : device === 'tablet' ? banner?.imageTabletUrl || banner?.imageUrl : banner?.imageUrl) : banner?.videoUrl;
  const fit = type === 'slider' ? slide?.fit : banner?.imageFit;
  const position = device === 'mobile' ? ['mobilePosX', 'mobilePosY', 'imageMobilePosX', 'imageMobilePosY'] : device === 'tablet' ? ['tabletPosX', 'tabletPosY', 'imageTabletPosX', 'imageTabletPosY'] : ['posX', 'posY', 'imagePosX', 'imagePosY'];
  const x = type === 'slider' ? slide?.[position[0]] : banner?.[position[2]];
  const y = type === 'slider' ? slide?.[position[1]] : banner?.[position[3]];
  const many = type === 'slider' ? slide?.buttons : type === 'image' ? banner?.imageButtons : banner?.videoButtons;
  const one = type === 'slider' ? slide?.button : type === 'image' ? banner?.imageButton : banner?.videoButton;
  const buttons = Array.isArray(many) && many.length ? many : one ? [one] : [];
  // Un marco de 1200 px deja ver alturas personalizadas y el contenido posterior
  // aunque la portada se extienda más allá del alto visible del dispositivo.
  const frameHeight = device === 'desktop' ? 1200 : viewport.height;
  const heightSettings = getBannerHeightSettings(banner, device);
  const heroHeight = heightSettings.mode === 'fullscreen' ? viewport.height : heightSettings.heightPx;
  return {
    viewport,
    frameHeight,
    type,
    mediaUrl: String(mediaUrl || '').trim(),
    fit: device !== 'mobile' && fit === 'contain' ? 'contain' : 'cover',
    objectPosition: `${percent(x)}% ${percent(y)}%`,
    heroHeight,
    heightPercent: (heroHeight / frameHeight) * 100,
    foldPercent: (viewport.height / frameHeight) * 100,
    buttons: buttons.filter((button) => button && button.enabled !== false),
  };
}

export default function BannerDevicePreview({ banner, sections, slides, selectedIdx, device, onEdit, onTemplateSelect, selectedTemplatePart, placingCard, onPlaceCard, onMoveCard, onPreviousSlide, onNextSlide }) {
  const model = getBannerPreviewModel(banner, slides, selectedIdx, device);
  const { viewport, frameHeight, type, mediaUrl, fit, objectPosition, heroHeight, heightPercent, foldPercent } = model;
  const viewportRef = useRef(null);
  const [previewWidth, setPreviewWidth] = useState(0);
  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) return undefined;
    const update = () => setPreviewWidth(element.clientWidth);
    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [device]);
  const buttons = banner?.templateId === 'plain' ? [] : model.buttons;
  const noMediaText = type === 'video' ? 'Agrega un video para verlo aquí' : 'Agrega una imagen para verla aquí';
  const useTemplate = ['discovery', 'editorial', 'atelier'].includes(banner?.templateId);
  const media = mediaUrl ? type === 'video' ? (
    <video src={mediaUrl} muted playsInline controls preload="metadata" className="banner-preview-media" />
  ) : <img src={mediaUrl} alt={type === 'slider' ? `Slide ${selectedIdx + 1}` : 'Imagen de portada'} className="banner-preview-media" style={{ objectFit: fit, objectPosition }} />
    : <span className="banner-preview-empty">{noMediaText}</span>;

  return (
    <div className="banner-preview-shell" data-device={device}>
      <div ref={viewportRef} className="banner-preview-viewport" data-device={device} style={{ aspectRatio: `${viewport.width} / ${frameHeight}` }} aria-label={`Vista previa ${viewport.label}: ${viewport.width} por ${viewport.height} píxeles`}>
        <div className="banner-preview-stage" style={{ width: viewport.width, height: frameHeight, transform: `scale(${previewWidth ? previewWidth / viewport.width : 0})` }}>
        <div className="banner-preview-mini-header"><span>ROSA BOUTIQUE</span><span>⌕ · ≡</span></div>
        <div className="banner-preview-hero" style={{ height: `${heightPercent}%` }}>
          {useTemplate ? <BannerTemplateView banner={banner} sections={sections} preview device={device} onSelect={onTemplateSelect} selectedPart={selectedTemplatePart} placingCard={placingCard} onPlaceCard={onPlaceCard} onMoveCard={onMoveCard}>{media}</BannerTemplateView> : media}
          {!useTemplate && buttons.map((button, index) => {
            const requestedWidth = Number(button.widthPx);
            const width = Number.isFinite(requestedWidth) ? Math.max(80, Math.min(520, requestedWidth)) : 200;
            const responsiveWidth = device === 'mobile' ? Math.min(220, viewport.width * .5, width) : device === 'tablet' ? Math.min(320, viewport.width * .4, width) : width;
            const widthPercent = (responsiveWidth / viewport.width) * 100;
            const left = Math.max(widthPercent / 2, Math.min(100 - widthPercent / 2, percent(button.posX)));
            const top = Math.max(5, Math.min(95, percent(button.posY, 92)));
            return (
              <button key={index} type="button" className="banner-preview-cta" style={{ left: `${left}%`, top: `${top}%`, width: `${widthPercent}%` }} onClick={() => onEdit(index)} aria-label={`Editar botón ${index + 1} de la portada`} title="Editar botón">
                {button.kind === 'text' ? <span>{button.text || 'Ver más'}</span> : <img src={button.imageUrl || '/ImgBotones/VerMas2.png'} alt="" />}
              </button>
            );
          })}
          {type === 'slider' && slides.length > 1 && banner?.sliderShowControls !== false && <SliderControls count={slides.length} current={selectedIdx} progress={.48} color={banner?.sliderControlColor} theme={banner?.sliderControlTheme} position={banner?.sliderControlPosition} size={banner?.sliderControlSize} device={device} showCounter={banner?.sliderShowCounter === true} showProgress={banner?.sliderShowProgress !== false} onPrevious={onPreviousSlide} onNext={onNextSlide} />}
        </div>
        {foldPercent < 100 && <div className="banner-preview-fold" style={{ top: `${foldPercent}%` }}><span>{viewport.height} px visibles</span></div>}
        {heightPercent < 100 && <div className="banner-preview-below" style={{ top: `${heightPercent}%` }}>Contenido debajo de la portada</div>}
        </div>
      </div>
      <p className="banner-preview-caption">{viewport.label} · {viewport.width} × {viewport.height} px · portada {heroHeight} px</p>
    </div>
  );
}
