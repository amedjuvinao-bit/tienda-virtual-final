import { useEffect, useState } from 'react';
import WhatsAppGlyph from './WhatsAppGlyph';

export default function WhatsAppMenuIcon({ config, size = 25, slotSize = size }) {
  const imageUrl = config?.useCustomImage ? String(config.imageUrl || '').trim() : '';
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [imageUrl]);

  return <span className="whatsapp-menu-icon" aria-hidden="true"
    style={{ display: 'grid', placeItems: 'center', width: slotSize, height: slotSize, '--whatsapp-icon-size': `${size}px` }}>
    {imageUrl && !imageFailed
      ? <img src={imageUrl} alt="" width={size} height={size}
          style={{ display: 'block', width: size, height: size, maxWidth: 'none', objectFit: 'contain' }} onError={() => setImageFailed(true)} />
      : <WhatsAppGlyph size={size} />}
  </span>;
}
