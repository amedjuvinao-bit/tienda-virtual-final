import React from 'react';
import { Instagram, ArrowUpRight } from 'lucide-react';
import { normalizeInstagramSection } from '../admin/appearance/sections/instagram/instagramSectionHelpers';
import { normalizeEditorial, photoLayout, photoCrop, safeInstagramLink, editorialPhotoSlot } from '../admin/appearance/sections/instagram/instagramEditorialHelpers';
import { categoriasBackdrop } from '../admin/appearance/sections/categorias/categoriasFanHelpers';
import './instagramEditorial.css';
export default function InstagramSection({
  theme,
  posts = []
}) {
  const section = normalizeInstagramSection(theme?.sections?.find(s => s?.id === 'instagram' || s?.type === 'instagram'));
  const c = section.config;
  const e = normalizeEditorial(c);
  const configured = Array.isArray(c.posts) ? c.posts : [];
  // An explicit empty/disabled list is intentional. Fallback feeds are used only when no list was saved.
  const rawSection = theme?.sections?.find(s => s?.id === 'instagram' || s?.type === 'instagram');
  const source = Array.isArray(rawSection?.config?.posts) ? configured : posts;
  const visible = source.filter(p => p && typeof p === 'object').map((p, index) => ({
    ...p,
    image: p.image || p.thumb,
    index
  })).filter(p => p.enabled !== false && p.image).slice(0, e.editorialVisibleCount);
  if (!section.enabled || !visible.length) return null;
  let background = e.editorialBackgroundMode === 'included' ? '/instagram/editorial-satin.webp' : e.editorialBackgroundImage;
  let color = e.editorialBackgroundColor;
  if (e.editorialBackgroundMode === 'continuity') {
    const b = categoriasBackdrop(theme, {}, {
      fanBackgroundMode: 'continuity'
    });
    background = b.image;
    color = b.color;
  }
  if (e.editorialBackgroundMode === 'color') background = '';
  if (e.editorialBackgroundMode === 'global') {
    background = '';
    color = theme?.colors?.background || '#fff';
  }
  const profile = safeInstagramLink(c.profileLink);
  const vars = {
    '--ig-bg': color,
    '--ig-backdrop': background ? `url(${JSON.stringify(background)})` : 'none',
    '--ig-mobile-backdrop': e.editorialMobileBackgroundImage ? `url(${JSON.stringify(e.editorialMobileBackgroundImage)})` : background ? `url(${JSON.stringify(background)})` : 'none',
    '--ig-wash': e.editorialBackgroundWash / 100,
    '--ig-ink': e.editorialTextColor,
    '--ig-title-color': e.editorialTitleColor,
    '--ig-font': e.editorialFont,
    '--ig-title-size': e.editorialTitleSize,
    '--ig-title-weight': e.editorialTitleWeight,
    '--ig-profile-x': `${e.editorialProfileX}%`,
    '--ig-profile-y': `${e.editorialProfileY}%`,
    '--ig-logo-size': `${e.editorialLogoSize}px`,
    '--ig-footer-x': `${e.editorialFooterX}%`,
    '--ig-footer-y': `${e.editorialFooterY}%`,
    '--ig-footer-width': `${e.editorialFooterWidth}%`,
    '--ig-subtitle-size': `${e.editorialSubtitleSize}px`,
    '--ig-background-position': `${e.editorialBackgroundX}% ${e.editorialBackgroundY}%`,
    '--ig-mobile-py': `${e.editorialMobilePaddingY}px`,
    '--ig-profile-size': `${e.editorialProfileSize}px`,
    '--ig-button-size': `${e.editorialButtonSize}px`,
    '--ig-title-top': `${e.editorialTitleTop}%`,
    '--ig-max': e.editorialWidthMode === 'full' ? 'none' : `${e.editorialMaxWidth}px`,
    '--ig-height': e.editorialHeight / 1600,
    '--ig-aspect': 1600 / e.editorialHeight,
    '--ig-px': `${e.editorialPaddingX}px`,
    '--ig-py': `${e.editorialPaddingY}px`,
    '--ig-radius': `${e.editorialRadius}px`,
    '--ig-border': e.editorialBorderColor,
    '--ig-border-width': `${e.editorialBorderWidth}px`,
    '--ig-shadow': e.editorialShadow / 100,
    '--ig-lift': `${e.editorialLift}px`,
    '--ig-zoom': e.editorialZoom,
    '--ig-duration': `${e.editorialDuration}ms`,
    '--ig-action-size': `${e.editorialActionSize}px`,
    '--ig-action': e.editorialActionColor,
    '--ig-action-text': e.editorialActionTextColor,
    '--ig-button': e.editorialButtonColor,
    '--ig-button-text': e.editorialFollowTextColor,
    '--ig-button-radius': `${e.editorialButtonRadius}px`,
    '--ig-button-blur': `${e.editorialButtonBlur}px`,
    '--ig-mobile-columns': e.editorialMobileColumns,
    '--ig-mobile-gap': `${e.editorialMobileGap}px`,
    '--ig-mobile-padding': `${e.editorialMobilePadding}px`,
    '--ig-mobile-title': `${e.editorialMobileTitleSize}px`,
    '--ig-mobile-ratio': e.editorialMobilePhotoRatio
  };
  const renderPhoto = (post, visibleIndex) => {
    const layout = photoLayout(post, editorialPhotoSlot(visible, post, e));
    const crop = photoCrop(post);
    const href = safeInstagramLink(post.link);
    const Tag = href ? 'a' : 'div';
    return <Tag key={post.id || post.index} className="ig-editorial__photo" data-extra={visibleIndex >= 5 ? 'true' : undefined} data-post-id={post.id} {...href ? {
      href,
      target: '_blank',
      rel: 'noopener noreferrer',
      'aria-label': `${e.editorialPostText}: ${post.alt || `Publicación ${post.index + 1}`}`
    } : {}} style={{
      '--photo-x': `${Math.min(layout.x, 100 - layout.width)}%`,
      '--photo-y': `${Math.min(layout.y, 100 - layout.height)}%`,
      '--photo-w': `${layout.width}%`,
      '--photo-h': `${layout.height}%`,
      '--photo-rotate': `${e.editorialTilt ? layout.rotate : 0}deg`,
      '--photo-layer': layout.layer,
      '--photo-position': `${crop.x}% ${crop.y}%`,
      '--photo-zoom': crop.zoom,
      '--photo-fit': post.imageFit === 'cover' || post.imageFit === 'contain' ? post.imageFit : e.editorialImageFit
    }}>
      <picture>
        <img className="ig-editorial__image-backdrop" src={post.image} alt="" aria-hidden="true" loading="lazy" decoding="async" />
        <img className={post.mobileImage ? "ig-editorial__image ig-editorial__desktop-image" : "ig-editorial__image"} src={post.image} alt={post.alt || `Publicación de Instagram ${post.index + 1}`} loading="lazy" decoding="async" />
        {post.mobileImage && <img className="ig-editorial__image ig-editorial__mobile-image" src={post.mobileImage} alt={post.alt || `Publicación de Instagram ${post.index + 1}`} loading="lazy" decoding="async" />}
      </picture>
      {href && e.editorialShowPostAction && <span className="ig-editorial__post-action" aria-hidden="true">{e.editorialPostText}<ArrowUpRight size={22} /></span>}
    </Tag>;
  };
  return <section className="ig-editorial" aria-label="Instagram de la tienda" style={vars} data-motion={e.editorialMotion} data-mobile-wide-last={e.editorialMobileColumns === 2 && visible.length % 2 === 1 ? 'true' : undefined}>
    <div className="ig-editorial__canvas">
      <div className="ig-editorial__scene">
        {e.editorialShowProfile && <div className="ig-editorial__profile">{profile ? <a href={profile} target="_blank" rel="noopener noreferrer">{e.editorialUseProfileLogo && c.instagramLogo ? <img className="ig-editorial__profile-logo" src={c.instagramLogo} alt="" /> : <Instagram aria-hidden="true" />}<span>{c.profileUser || '@rosaboutique33'}</span></a> : <span>{c.profileUser || '@rosaboutique33'}</span>}</div>}
        {e.editorialShowTitle && <h2 className="ig-editorial__title">{e.editorialUseTitleImage && c.titleImage ? <img src={c.titleImage} alt={c.titleAlt || e.editorialTitle} /> : e.editorialTitle}</h2>}
        <div className="ig-editorial__photos">{visible.slice(0, 5).map(renderPhoto)}</div>
        <div className="ig-editorial__footer">
          {e.editorialShowFollow && profile && <a className="ig-editorial__follow" href={profile} target="_blank" rel="noopener noreferrer">{e.editorialFollowText}<ArrowUpRight aria-hidden="true" /></a>}
          {e.editorialShowSubtitle && e.editorialSubtitle && <p>{e.editorialSubtitle}</p>}
        </div>
      </div>
      {visible.length > 5 && <div className="ig-editorial__extra">{visible.slice(5).map((p, i) => renderPhoto(p, i + 5))}</div>}
    </div>
  </section>;
}
