import React from 'react';
import { getBannerHeightSettings } from '../../../lib/bannerHeight';
import BannerTemplateView from '../../../components/BannerTemplateView';

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
  const mediaUrl = type === 'slider' ? slide?.image : type === 'image' ? banner?.imageUrl : banner?.videoUrl;
  const fit = type === 'slider' ? slide?.fit : banner?.imageFit;
  const x = type === 'slider' ? slide?.posX : banner?.imagePosX;
  const y = type === 'slider' ? slide?.posY : banner?.imagePosY;
  const many = type === 'slider' ? slide?.buttons : type === 'image' ? banner?.imageButtons : banner?.videoButtons;
  const one = type === 'slider' ? slide?.button : type === 'image' ? banner?.imageButton : banner?.videoButton;
  const buttons = Array.isArray(many) && many.length ? many : one ? [one] : [];
  // Un marco de 1200 px deja ver alturas personalizadas y el contenido posterior
  // aunque la portada se extienda más allá del alto visible del dispositivo.
  const frameHeight = 1200;
  const heightSettings = getBannerHeightSettings(banner, device);
  const heroHeight = heightSettings.mode === 'fullscreen' ? viewport.height : heightSettings.heightPx;
  return {
    viewport,
    type,
    mediaUrl: String(mediaUrl || '').trim(),
    fit: fit === 'contain' ? 'contain' : 'cover',
    objectPosition: `${percent(x)}% ${percent(y)}%`,
    heroHeight,
    heightPercent: (heroHeight / frameHeight) * 100,
    foldPercent: (viewport.height / frameHeight) * 100,
    buttons: buttons.filter((button) => button && button.enabled !== false),
  };
}

export default function BannerDevicePreview({ banner, sections, slides, selectedIdx, device, onEdit, onTemplateSelect, selectedTemplatePart }) {
  const model = getBannerPreviewModel(banner, slides, selectedIdx, device);
  const { viewport, type, mediaUrl, fit, objectPosition, heroHeight, heightPercent, foldPercent, buttons } = model;
  const noMediaText = type === 'video' ? 'Agrega un video para verlo aquí' : 'Agrega una imagen para verla aquí';
  const useTemplate = ['discovery', 'editorial', 'atelier'].includes(banner?.templateId);
  const media = mediaUrl ? type === 'video' ? (
    <video src={mediaUrl} muted playsInline controls preload="metadata" className="banner-preview-media" />
  ) : <img src={mediaUrl} alt={type === 'slider' ? `Slide ${selectedIdx + 1}` : 'Imagen de portada'} className="banner-preview-media" style={{ objectFit: fit, objectPosition }} />
    : <span className="banner-preview-empty">{noMediaText}</span>;

  return (
    <div className="banner-preview-shell" data-device={device}>
      <div className="banner-preview-viewport" data-device={device} aria-label={`Vista previa ${viewport.label}: ${viewport.width} por ${viewport.height} píxeles`}>
        <div className="banner-preview-mini-header"><span>ROSA BOUTIQUE</span><span>⌕ · ≡</span></div>
        <div className="banner-preview-hero" style={{ height: `${heightPercent}%` }}>
          {useTemplate ? <BannerTemplateView banner={banner} sections={sections} preview device={device} onSelect={onTemplateSelect} selectedPart={selectedTemplatePart}>{media}</BannerTemplateView> : media}
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
          {type === 'slider' && slides.length > 1 && <div className="banner-preview-dots" aria-hidden="true">{slides.map((_, index) => <i key={index} data-active={index === selectedIdx} />)}</div>}
        </div>
        {foldPercent < 100 && <div className="banner-preview-fold" style={{ top: `${foldPercent}%` }}><span>{viewport.height} px visibles</span></div>}
        {heightPercent < 100 && <div className="banner-preview-below" style={{ top: `${heightPercent}%` }}>Contenido debajo de la portada</div>}
      </div>
      <p className="banner-preview-caption">{viewport.label} · {viewport.width} × {viewport.height} px · portada {heroHeight} px</p>
    </div>
  );
}
