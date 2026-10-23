import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Star, Sparkles, ShoppingBag, ShoppingCart, Images } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useFavorites } from '../../context/FavoritesContext';
import { buildCatalogCartIntent } from '../ProductCard';
import { normalizeToCss } from './catalogColors';
import './catalogEditorialCard.css';

const fonts = { cormorant: '"Catalog Editorial", Georgia, serif', playfair: '"Catalog Editorial", Georgia, serif', jost: 'Jost, system-ui, sans-serif', inter: 'Inter, system-ui, sans-serif' };
const shadows = { none: 'none', soft: '0 8px 24px #5626330c', medium: '0 12px 28px #5626331c', strong: '0 18px 40px #5626332c' };
const money = value => Number(value || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export default function CatalogEditorialCard({ product, config, featured = false }) {
  const { addToCart } = useCart();
  const { toggleFavorite, isFavorite } = useFavorites();
  const navigate = useNavigate();
  const [failedImage, setFailedImage] = useState(false);
  const card = config.cardUiConfig, presentation = config.presentation;
  const intent = useMemo(() => buildCatalogCartIntent(product), [product]);
  const selected = isFavorite(product._id);
  const destination = `/producto/${encodeURIComponent(product.slug || product._id)}`;
  const Favorite = { heart: Heart, star: Star, sparkles: Sparkles }[card.favoriteIconName] || Heart;
  const Cart = card.cartIconName === 'shopping-cart' ? ShoppingCart : ShoppingBag;
  const gallery = Array.isArray(product.images) ? product.images : [];
  const cover = failedImage ? '/placeholder.png' : product.image || gallery[0] || '/placeholder.png';
  const count = new Set([product.image, ...gallery].filter(value => typeof value === 'string' && value.trim())).size;
  const colors = (Array.isArray(product.colors) ? product.colors : []).slice(0, 6);
  const action = intent.unavailable ? 'Agotado' : intent.requiresSelection ? 'Seleccionar opciones' : 'Agregar al carrito';
  const price = intent.payload?.price ?? product.price;
  const style = {
    '--ecard-bg': card.cardBg, '--ecard-border': card.cardBorderColor,
    '--ecard-border-width': `${card.showBorder ? card.cardBorderWidthPx : 0}px`,
    '--ecard-radius': `${card.cardRadiusPx}px`, '--ecard-padding': `${card.cardPaddingPx}px`,
    '--ecard-shadow': card.showShadow ? shadows[card.cardShadowStyle] : 'none',
    '--ecard-image-radius': `${card.imageRadiusPx}px`, '--ecard-image-bg': card.showImageBg ? card.imageBg : 'transparent',
    '--ecard-image-fit': featured ? presentation.featuredFit : card.imageFit,
    '--ecard-image-position': featured ? `center ${presentation.featuredPosition}%` : 'center',
    '--ecard-title': card.titleColor, '--ecard-price': card.priceColor, '--ecard-meta': card.metaColor,
    '--ecard-title-font': fonts[card.titleFontFamily] || 'inherit', '--ecard-price-font': fonts[card.priceFontFamily] || 'inherit',
    '--ecard-favorite-bg': card.favoriteButtonBg, '--ecard-favorite-fill': `${card.favoriteButtonOpacity * 100}%`,
    '--ecard-cart-bg': card.cartButtonBg, '--ecard-cart-fill': `${card.cartButtonOpacity * 100}%`,
    '--ecard-action-border': card.actionButtonBorderColor, '--ecard-action-border-width': `${card.actionButtonBorderWidthPx}px`,
  };
  const favorite = <button type="button" className="catalog-ecard__favorite" aria-label="Favorito" aria-pressed={selected} onClick={() => toggleFavorite(product)} style={{ color: selected ? card.favoriteActiveColor : card.favoriteIconColor }}><Favorite size={17} strokeWidth={1.5} fill={selected && card.favoriteIconName !== 'sparkles' ? 'currentColor' : 'none'}/></button>;
  return <article className={`catalog-ecard ${featured ? 'catalog-ecard--featured' : ''}`} style={style}>
    <div className="catalog-ecard__photo">
      <Link className="catalog-ecard__photo-link" to={destination} aria-label={`Ver ${product.title}`}>
        <img src={cover} alt={product.title || ''} loading={featured ? 'eager' : 'lazy'} decoding="async" onError={() => { if (!failedImage) setFailedImage(true); }}/>
      </Link>
      {!featured && favorite}
    </div>
    {intent.unavailable && <span className="catalog-ecard__availability">{product.active === false ? 'Inactivo' : 'Agotado'}</span>}
    <footer className="catalog-ecard__footer">
      <div className="catalog-ecard__info">
        <h3><Link to={destination}>{product.title}</Link></h3>
        <div className="catalog-ecard__prices">
          {Number(product.originalPrice) > Number(price) && <del style={{ color: card.oldPriceColor }}>{money(product.originalPrice)}</del>}
          <span>{money(price)}</span>
        </div>
        {presentation.showOptions && colors.length > 0 && <div className="catalog-ecard__colors" aria-label="Colores disponibles">{colors.map((color, index) => { const label = typeof color === 'string' ? color : color?.name || color?.label || color?.hex || color?.value; return <span key={index} title={label} style={{ backgroundColor: normalizeToCss(typeof color === 'string' ? color : color?.hex || color?.value || color?.name) || 'transparent' }}/>; })}</div>}
        {presentation.showDescription && product.description && <p>{product.description}</p>}
        {presentation.showPhotoCount && count > 1 && <span className="catalog-ecard__photo-count"><Images size={11}/>{count} fotos</span>}
      </div>
      <div className="catalog-ecard__actions">
        {featured && favorite}
        <button type="button" className="catalog-ecard__cart" aria-label={action} title={action} disabled={intent.unavailable} style={{ color: card.cartIconColor }} onClick={() => { if (intent.unavailable) return; if (intent.requiresSelection) navigate(destination); else addToCart(intent.payload); }}><Cart size={17} strokeWidth={1.5}/>{card.cartIconName === 'bag-heart' && <Heart size={8} className="catalog-ecard__bag-heart"/>}</button>
      </div>
    </footer>
  </article>;
}
