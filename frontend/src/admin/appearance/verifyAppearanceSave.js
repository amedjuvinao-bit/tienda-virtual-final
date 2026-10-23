import { deepEqual } from './appearanceModel';
import { normalizeStoryConfig } from '../../lib/storefrontStoryConfig';

export async function verifyAppearanceSave({ saved, changedTheme, normalizedTheme, originalTheme, fetchPublicSettings }) {
  let errorSnapshot;
  try {
      if (!Number.isSafeInteger(saved?.appearanceRevision)) {
        throw new Error('La respuesta de guardado no incluyó la revisión de Apariencia. Recarga antes de guardar de nuevo.');
      }

      // Un PUT 200 no demuestra que los ajustes lleguen a la tienda pública.
      // Lee otra vez la ruta que usa la tienda antes de confirmar el guardado.
      const cardTextSettings = [];
      for (const [templateId, template] of Object.entries(changedTheme.banner?.templateConfigs || {})) {
        for (const key of ['titleColor', 'labelColor', 'titleSizePx', 'labelSizePx', 'metallicTitle']) {
          if (template?.cardTextStyle?.[key] !== undefined) cardTextSettings.push({ templateId, index: null, key, value: template.cardTextStyle[key] });
        }
        (template?.cards || []).forEach((card, index) => {
          for (const key of ['titleColor', 'labelColor', 'titleSizePx', 'labelSizePx']) {
            if (card?.[key] !== undefined) cardTextSettings.push({ templateId, index, key, value: card[key] });
          }
        });
      }
      if (cardTextSettings.length) {
        const detail = cardTextSettings.some(({ key }) => key === 'metallicTitle') ? 'estilos de texto'
          : cardTextSettings.some(({ key }) => key.endsWith('SizePx')) ? 'colores o tamaños' : 'colores';
        const matches = (settings) => cardTextSettings.every(({ templateId, index, key, value }) =>
          String((index === null
            ? settings?.theme?.banner?.templateConfigs?.[templateId]?.cardTextStyle?.[key]
            : settings?.theme?.banner?.templateConfigs?.[templateId]?.cards?.[index]?.[key]) ?? '').toLowerCase()
            === String(value ?? '').toLowerCase()
        );
        if (!matches(saved)) {

          throw new Error(`El servidor omitió los ${detail} de las tarjetas en la respuesta de guardado. Tus cambios siguen en el editor y no se marcaron como guardados.`);
        }
        let publicSettings;
        try {
          publicSettings = await fetchPublicSettings();
        } catch (error) {

          throw new Error('El servidor respondió al guardado, pero no se pudo comprobar la lectura pública. Tus ajustes siguen en el editor; vuelve a guardar cuando haya conexión.');
        }
        if (!matches(publicSettings)) {

          throw new Error(`La tienda pública no conserva los ${detail} de las tarjetas. Tus cambios siguen en el editor y no se marcaron como guardados.`);
        }
      }

      if (changedTheme.header && normalizedTheme.header.metallicMenuText !== originalTheme.header.metallicMenuText) {
        const wanted = normalizedTheme.header.metallicMenuText;
        if (saved?.theme?.header?.metallicMenuText !== wanted) {

          throw new Error('El servidor omitió el acabado metalizado del menú. El cambio sigue pendiente en el editor.');
        }
        let publicSettings;
        try {
          publicSettings = await fetchPublicSettings();
        } catch {

          throw new Error('No se pudo comprobar el acabado del menú en la tienda pública. El cambio sigue pendiente.');
        }
        if (publicSettings?.theme?.header?.metallicMenuText !== wanted) {

          throw new Error('La tienda pública no conserva el acabado metalizado del menú. El cambio sigue pendiente.');
        }
      }

      // El backend puede seguir ejecutando un modelo antiguo y descartar campos
      // nuevos de las tarjetas aunque el PUT responda correctamente.
      const requestedCards = changedTheme.banner?.templateConfigs?.atelier?.cards || [];
      const storedCards = saved?.theme?.banner?.templateConfigs?.atelier?.cards || [];
      const positionWasLost = requestedCards.some((card, index) =>
        ['desktop', 'tablet', 'mobile'].some((device) => {
          const requested = card?.position?.[device];
          if (!requested) return false;
          const stored = storedCards[index]?.position?.[device];
          return Number(stored?.x) !== Number(requested.x) || Number(stored?.y) !== Number(requested.y);
        })
      );
      if (positionWasLost) {

        errorSnapshot = saved.theme;
        throw new Error('El servidor no conservó la posición de las tarjetas. Reinicia el backend con la versión actualizada y vuelve a guardar; los cambios siguen aquí en el editor.');
      }

      const requestedBanner = changedTheme.banner;
      const storedBanner = saved?.theme?.banner;
      if (requestedBanner) {
        const devicePositionKeys = ['posX', 'posY', 'tabletPosX', 'tabletPosY', 'mobilePosX', 'mobilePosY'];
        const singlePositionKeys = ['imagePosX', 'imagePosY', 'imageTabletPosX', 'imageTabletPosY', 'imageMobilePosX', 'imageMobilePosY'];
        const imageKeys = ['image', 'imageTablet', 'imageMobile'];
        const singleImageKeys = ['imageUrl', 'imageTabletUrl', 'imageMobileUrl'];
        const mismatches = [];
        const checkFields = (requested, stored, keys, label) => {
          for (const key of keys) {
            if (requested?.[key] === undefined) continue;
            const expected = key.toLowerCase().includes('pos') ? Number(requested[key]) : String(requested[key] || '');
            const actual = key.toLowerCase().includes('pos') ? Number(stored?.[key]) : String(stored?.[key] || '');
            if (!Object.is(actual, expected)) mismatches.push(label);
          }
        };
        if (requestedBanner.type === 'slider') {
          const wanted = requestedBanner.slides || [];
          const received = storedBanner?.slides || [];
          if (received.length !== wanted.length) mismatches.push('galería');
          wanted.forEach((slide, index) => checkFields(slide, received[index], [...devicePositionKeys, ...imageKeys], `slide ${index + 1}`));
        } else if (requestedBanner.type === 'image') {
          checkFields(requestedBanner, storedBanner, [...singlePositionKeys, ...singleImageKeys], 'imagen principal');
        }
        for (const [templateId, template] of Object.entries(requestedBanner.templateConfigs || {})) {
          (template?.cards || []).forEach((card, index) => {
            const storedCard = storedBanner?.templateConfigs?.[templateId]?.cards?.[index];
            if (card?.image && storedCard?.image !== card.image) {
              mismatches.push(`miniatura de tarjeta ${index + 1} (${templateId})`);
            }
            if (card?.imageSource && storedCard?.imageSource !== card.imageSource) {
              mismatches.push(`origen de imagen de tarjeta ${index + 1} (${templateId})`);
            }
          });
        }
        if (mismatches.length) {

          errorSnapshot = saved.theme;
          throw new Error(`El servidor no conservó el encuadre o las imágenes de ${[...new Set(mismatches)].join(', ')}. El ajuste sigue en el editor. Sincroniza y reinicia el backend con esta versión, luego vuelve a guardar.`);
        }
      }

      if(changedTheme.global?.sectionMotion && !deepEqual(normalizedTheme.global?.sectionMotion,originalTheme.global?.sectionMotion)) {
        const expected=normalizeStoryConfig(changedTheme.global.sectionMotion), received=saved?.theme?.global?.sectionMotion;
        if(!received || !deepEqual(expected,normalizeStoryConfig(received))) {

          errorSnapshot = saved.theme;
          throw new Error('El servidor no conservó la animación global. Tus ajustes siguen en el panel; vuelve a guardar con la versión actualizada.');
        }
      }
  } catch (error) {
    if (Number.isSafeInteger(saved?.appearanceRevision)) error.appearanceRevision = saved.appearanceRevision;
    if (errorSnapshot) error.appearanceSnapshot = errorSnapshot;
    throw error;
  }
}
