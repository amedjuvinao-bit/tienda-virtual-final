import { expect, it } from 'vitest';
import { buildSafeCatalogConfig } from './catalogConfig';
import { applyCatalogEditorialPreset, restoreCatalogVisualBackup } from './catalogEditorialPreset';

it('coordina el estilo anterior una sola vez y conserva contenido, alcance y copia recuperable', () => {
  const old = { title:'Mi selección', titleImage:'/my-title.png', sourceMode:'categories', allowedCategoriesText:'Hogar', defaultSort:'price',
    presentation:{ styleVersion:1, backgroundImage:'/my-background.webp', glassOpacity:.45 },
    cardUiConfig:{ titleColor:'#0066ff', priceColor:'#ff00ff', cardPaddingPx:12, cardRadiusPx:40 }, filterUiConfig:{ panelBorderColor:'#0066ff' } };
  const config=buildSafeCatalogConfig(old);
  expect(config).toMatchObject({ title:old.title, titleImage:old.titleImage, sourceMode:'categories', allowedCategoriesText:'Hogar', defaultSort:'price', presentation:{ styleVersion:3, backgroundImage:'/my-background.webp', glassOpacity:.45 }, cardUiConfig:{ titleColor:'#562633', priceColor:'#562633', cardPaddingPx:0, cardRadiusPx:16 } });
  expect(config.visualBackup.cardUiConfig).toEqual(old.cardUiConfig);
  expect(buildSafeCatalogConfig(config)).toEqual(config);
  const custom=buildSafeCatalogConfig({ ...config, cardUiConfig:{ ...config.cardUiConfig, titleColor:'#123456', cardPaddingPx:7 } });
  expect(custom.cardUiConfig).toMatchObject({ titleColor:'#123456', cardPaddingPx:7 });
  expect(buildSafeCatalogConfig(restoreCatalogVisualBackup(custom)).cardUiConfig).toMatchObject(old.cardUiConfig);
  expect(applyCatalogEditorialPreset(custom).visualBackup).toEqual(config.visualBackup);
});
it('no migra los estilos de una cuadrícula clásica', () => {
  expect(buildSafeCatalogConfig({ presentation:{ layout:'grid' }, cardUiConfig:{ titleColor:'#0066ff' } }).cardUiConfig.titleColor).toBe('#0066ff');
});

it('convierte el diseño con arco a una cuadrícula sin fondo obligatorio y conserva personalizaciones', () => {
  const config = buildSafeCatalogConfig({ presentation: { layout:'editorial', styleVersion:2, featuredEnabled:true, featuredShape:'arch', backgroundImage:'/instagram/editorial-satin.webp' }, cardUiConfig: { titleColor:'#123456' } });
  expect(config.presentation).toMatchObject({ layout:'glass-grid', backgroundImage:'', rimStyle:'optical', imageRatio:'square', styleVersion:3 });
  expect(config.presentation).not.toHaveProperty('featuredShape');
  expect(config.cardUiConfig.titleColor).toBe('#123456');
});
