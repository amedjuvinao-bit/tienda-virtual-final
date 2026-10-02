import { useEffect, useState } from 'react';
import WhatsAppGlyph from './WhatsAppGlyph';

export default function WhatsAppMenuIcon({ config, size = 25 }) {
  const imageUrl = config?.useCustomImage ? String(config.imageUrl || '').trim() : '';
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [imageUrl]);

  return imageUrl && !imageFailed
    ? <img src={imageUrl} alt="" aria-hidden="true" width={size} height={size}
        style={{ width: size, height: size, objectFit: 'contain' }} onError={() => setImageFailed(true)} />
    : <WhatsAppGlyph size={size} />;
}
