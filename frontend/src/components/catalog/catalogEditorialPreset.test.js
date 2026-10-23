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

it('reemplaza una vez el título gráfico anterior y luego respeta las elecciones del editor', () => {
  const old = { title:'Últimas tendencias', titleMode:'image', titleImage:'/title-western.png', presentation:{ layout:'glass-grid', styleVersion:3, titleFont:'inherit' } };
  const config = buildSafeCatalogConfig(old);
  expect(config).toMatchObject({ title:old.title, titleMode:'text', titleImage:old.titleImage, presentation:{ headerVersion:1, titleFont:'serif', titleSize:44 } });
  expect(buildSafeCatalogConfig(config)).toEqual(config);
  expect(buildSafeCatalogConfig({ ...config, titleMode:'image', presentation:{ ...config.presentation, titleFont:'sans', titleSize:32 } })).toMatchObject({ titleMode:'image', presentation:{ titleFont:'sans', titleSize:32 } });
});

it('calibra la paleta una vez, conserva los colores previos y respeta ajustes posteriores', () => {
  const old = { title:'Mi catálogo', sourceMode:'manual', manualProductIdsText:'p1', presentation:{styleVersion:3,headerVersion:1,headerTint:'#f8b4d9',textColor:'#ffc4d5',accentColor:'#ffc4d5',headerReflection:0,headerHeight:164,headerIcon:'none',backgroundImage:'/my-background.webp'} };
  const config=buildSafeCatalogConfig(old);
  expect(buildSafeCatalogConfig({...old,presentation:{...old.presentation,styleVersion:1}}).cardUiConfig.titleColor).toBe('#562633');
  expect(config.presentation).toMatchObject({glassPaletteVersion:1,headerTint:'#ffffff',textColor:'#562633',headerHeight:164,headerIcon:'none',backgroundImage:'/my-background.webp'});
  expect(config.glassPaletteBackup).toMatchObject({headerTint:'#f8b4d9',textColor:'#ffc4d5',headerReflection:0});
  expect(config).toMatchObject({title:old.title,sourceMode:'manual',manualProductIdsText:'p1'});
  expect(buildSafeCatalogConfig(config)).toEqual(config);
  const customized=buildSafeCatalogConfig({...config,presentation:{...config.presentation,headerTint:'#123456',textColor:'#345678',headerMaterialOpacity:0,headerReflection:0}});
  expect(customized.presentation).toMatchObject({headerTint:'#123456',textColor:'#345678',headerMaterialOpacity:0,headerReflection:0});
  expect(customized.glassPaletteBackup).toEqual(config.glassPaletteBackup);
});
