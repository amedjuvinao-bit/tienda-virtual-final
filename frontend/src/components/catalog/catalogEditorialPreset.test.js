import { expect, it } from 'vitest';
import { buildSafeCatalogConfig } from './catalogConfig';
import { applyCatalogEditorialPreset, restoreCatalogVisualBackup } from './catalogEditorialPreset';

it('coordina el estilo anterior una sola vez y conserva contenido, alcance y copia recuperable', () => {
  const old = { title:'Mi selección', titleImage:'/my-title.png', sourceMode:'categories', allowedCategoriesText:'Hogar', defaultSort:'price',
    presentation:{ styleVersion:1, backgroundImage:'/my-background.webp', glassOpacity:.45 },
    cardUiConfig:{ titleColor:'#0066ff', priceColor:'#ff00ff', cardPaddingPx:12, cardRadiusPx:40 }, filterUiConfig:{ panelBorderColor:'#0066ff' } };
  const config=buildSafeCatalogConfig(old);
  expect(config).toMatchObject({ title:old.title, titleImage:old.titleImage, sourceMode:'categories', allowedCategoriesText:'Hogar', defaultSort:'price', presentation:{ styleVersion:5, backgroundImage:'/my-background.webp', glassOpacity:.45 }, cardUiConfig:{ titleColor:'#562633', priceColor:'#562633', cardPaddingPx:0, cardRadiusPx:26 } });
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
  expect(config.presentation).toMatchObject({ layout:'glass-grid', backgroundImage:'', rimStyle:'optical', imageRatio:'square', styleVersion:5 });
  expect(config.presentation).not.toHaveProperty('featuredShape');
  expect(config.cardUiConfig.titleColor).toBe('#123456');
});

it('adopta una vez las curvas del bisel y conserva ajustes personalizados y cambios posteriores', () => {
  const old = {presentation:{styleVersion:3,headerVersion:1,glassPaletteVersion:2,radius:18,headerRadius:22},cardUiConfig:{cardRadiusPx:16,imageFit:'cover'}};
  const next = buildSafeCatalogConfig(old);
  expect(next).toMatchObject({presentation:{styleVersion:5,radius:26,headerRadius:40},cardUiConfig:{cardRadiusPx:26,imageFit:'cover'}});
  expect(next.visualBackup.cardUiConfig).toEqual(old.cardUiConfig);
  expect(buildSafeCatalogConfig(next)).toEqual(next);
  expect(buildSafeCatalogConfig({...next,presentation:{...next.presentation,radius:0,headerRadius:0},cardUiConfig:{...next.cardUiConfig,cardRadiusPx:8}})).toMatchObject({presentation:{radius:0,headerRadius:0},cardUiConfig:{cardRadiusPx:8}});
  expect(buildSafeCatalogConfig({...old,presentation:{...old.presentation,radius:12,headerRadius:12},cardUiConfig:{cardRadiusPx:12}})).toMatchObject({presentation:{radius:12,headerRadius:12},cardUiConfig:{cardRadiusPx:12}});
  expect(buildSafeCatalogConfig({...old,presentation:{...old.presentation,rimStyle:'fine'}}).cardUiConfig.cardRadiusPx).toBe(16);
});

it('reemplaza una vez el título gráfico anterior y luego respeta las elecciones del editor', () => {
  const old = { title:'Últimas tendencias', titleMode:'image', titleImage:'/title-western.png', presentation:{ layout:'glass-grid', styleVersion:3, titleFont:'inherit' } };
  const config = buildSafeCatalogConfig(old);
  expect(config).toMatchObject({ title:old.title, titleMode:'text', titleImage:old.titleImage, presentation:{ headerVersion:1, titleFont:'serif', titleSize:44 } });
  expect(buildSafeCatalogConfig(config)).toEqual(config);
  expect(buildSafeCatalogConfig({ ...config, titleMode:'image', presentation:{ ...config.presentation, titleFont:'sans', titleSize:32 } })).toMatchObject({ titleMode:'image', presentation:{ titleFont:'sans', titleSize:32 } });
});

it('conserva los colores del usuario al preparar el cristal y respeta ajustes posteriores', () => {
  const old = { title:'Mi catálogo', sourceMode:'manual', manualProductIdsText:'p1', presentation:{styleVersion:3,headerVersion:1,headerTint:'#f8b4d9',textColor:'#ffc4d5',accentColor:'#ffc4d5',headerReflection:0,headerHeight:164,headerIcon:'none',backgroundImage:'/my-background.webp'} };
  const config=buildSafeCatalogConfig(old);
  expect(buildSafeCatalogConfig({...old,presentation:{...old.presentation,styleVersion:1}}).cardUiConfig.titleColor).toBe('#ffc4d5');
  expect(config.presentation).toMatchObject({glassPaletteVersion:2,headerTint:'#f8b4d9',textColor:'#ffc4d5',headerHeight:164,headerIcon:'none',backgroundImage:'/my-background.webp'});
  expect(config.glassPaletteBackup).toMatchObject({headerTint:'#f8b4d9',textColor:'#ffc4d5',headerReflection:0});
  expect(config).toMatchObject({title:old.title,sourceMode:'manual',manualProductIdsText:'p1'});
  expect(buildSafeCatalogConfig(config)).toEqual(config);
  const customized=buildSafeCatalogConfig({...config,presentation:{...config.presentation,headerTint:'#123456',textColor:'#345678',headerMaterialOpacity:0,headerReflection:0}});
  expect(customized.presentation).toMatchObject({headerTint:'#123456',textColor:'#345678',headerMaterialOpacity:0,headerReflection:0});
  expect(customized.glassPaletteBackup).toEqual(config.glassPaletteBackup);
});

it('reemplaza solo los colores cálidos del preset anterior y permite elegir dorado después', () => {
  const old = {presentation:{styleVersion:3,headerVersion:1,glassPaletteVersion:1,glassColor:'#ffffff',accentColor:'#2244cc',headerContrastColor:'#a66348',headerEdgeColor:'#e9bda3',headerReflectionColor:'#fff9f2',headerShadowColor:'#123456',headerIconColor:'#ac744c',headerReflection:0}};
  const next = buildSafeCatalogConfig(old);
  expect(next.presentation).toMatchObject({glassPaletteVersion:2,headerContrastColor:'#2244cc',headerEdgeColor:'#2244cc',headerReflectionColor:'#ffffff',headerShadowColor:'#123456',headerIconColor:'#2244cc',headerReflection:0});
  expect(next.glassPaletteBackup.headerEdgeColor).toBe('#e9bda3');
  expect(buildSafeCatalogConfig(next)).toEqual(next);
  expect(buildSafeCatalogConfig({...next,presentation:{...next.presentation,headerEdgeColor:'#e9bda3'}}).presentation.headerEdgeColor).toBe('#e9bda3');
});

it('adopta fotos a sangre y botones transparentes una sola vez sin alterar curvas personalizadas', () => {
  const raw={presentation:{styleVersion:4,headerVersion:1,glassPaletteVersion:2},cardUiConfig:{imageFit:'contain',cardRadiusPx:16,favoriteButtonOpacity:.85,cartButtonOpacity:.37}};
  const next=buildSafeCatalogConfig(raw);
  expect(next).toMatchObject({presentation:{styleVersion:5},cardUiConfig:{imageFit:'cover',cardRadiusPx:16,favoriteButtonOpacity:.18,cartButtonOpacity:.37}});
  expect(next.visualBackup.cardUiConfig).toEqual(raw.cardUiConfig);
  expect(buildSafeCatalogConfig(next)).toEqual(next);
  const changed=buildSafeCatalogConfig({...next,cardUiConfig:{...next.cardUiConfig,imageFit:'contain',favoriteButtonOpacity:0,cartButtonOpacity:1}});
  expect(changed.cardUiConfig).toMatchObject({imageFit:'contain',favoriteButtonOpacity:0,cartButtonOpacity:1});
});
