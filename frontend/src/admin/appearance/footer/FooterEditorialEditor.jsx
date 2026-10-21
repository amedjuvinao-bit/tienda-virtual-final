import React, { useState } from 'react';
import SectionEditorSteps from '../sections/ui/SectionEditorSteps';
import SectionEditorCardTabs from '../sections/ui/SectionEditorCardTabs';
import StorefrontSectionPreview from '../sections/ui/StorefrontSectionPreview';
import { ColorField } from '../sections/ui/SectionsPanelUI';
import { INFO_FONT_OPTIONS } from '../sections/info/infoSectionHelpers';
import { FOOTER_EDITORIAL_DEFAULTS, FOOTER_SOCIALS, footerColumns, footerLegalText, normalizeEditorialOptions, safeFooterImage, safeFooterLink } from '../../../components/footer/footerEditorialConfig';
import { TextField, NumberField, SelectField, CheckField, ImageField, FooterLinkEditor } from './FooterEditorFields';
import './footerEditor.css';

const sizes={
  composition:[['maxWidth','Ancho máximo (px)',640,2200],['minHeight','Alto mínimo en escritorio (px)',0,1400],['paddingX','Margen lateral (px)',12,160],['paddingTop','Espacio superior (px)',0,180],['paddingBottom','Espacio inferior (px)',0,120],['contentGap','Separación entre bloques (px)',16,120]],
  glass:[['materialOpacity','Intensidad de la textura (%)',0,100],['glassOpacity','Tinte del vidrio (%)',0,80],['blur','Desenfoque (px)',0,32],['depth','Profundidad de las capas (px)',0,30],['radius','Esquinas (px)',12,50]],
  typography:[['headlineSize','Título principal (px)',28,110],['brandSize','Nombre de la marca (px)',24,100],['columnTitleSize','Títulos de columna (px)',18,42],['bodySize','Texto y enlaces (px)',12,24],['watermarkSize','Tamaño del grabado (px)',80,400],['watermarkOpacity','Intensidad del grabado (%)',0,90]],
  mobile:[['mobilePadding','Margen lateral en móvil (px)',14,40],['mobileHeadlineSize','Título en móvil (px)',26,60],['mobileBrandSize','Marca en móvil (px)',24,64],['mobileWatermarkSize','Grabado en móvil (px)',48,140]],
};
export default function FooterEditorialEditor({theme,store,setPath,uploadToCloudinaryViaBackend,uploading,setUploading}) {
  const footer=theme?.footer || {}, c=normalizeEditorialOptions(footer,{theme,store}), columns=footerColumns(footer);
  const [step,setStep]=useState('content'), [column,setColumn]=useState('column1'), [social,setSocial]=useState('instagram');
  const [pending,setPending]=useState(false), [error,setError]=useState(''), [restored,setRestored]=useState(false);
  const write=(field,value)=>setPath?.('footer.'+field,value);
  // Persist the presentation shown by the editor before a content change can
  // revive the legacy text mode or the removed heavy social relief.
  const edit=(field,value)=>write('editorial',{...footer.editorial,brandMode:c.brandMode,socialIconStyle:c.socialIconStyle,[field]:value});
  const col=columns.find(item=>item.id===column) || columns[0], links=Array.isArray(footer[column+'Links'])?footer[column+'Links']:col.links;
  async function upload(field,file) {
    if(!file || !uploadToCloudinaryViaBackend)return;
    setPending(true);setUploading?.(true);setError('');
    try {const url=await uploadToCloudinaryViaBackend(file,'image');if(!safeFooterImage(url))throw new Error('No se recibió una imagen válida.');write(field,url);}
    catch(e){setError(e?.message || 'No se pudo cargar la imagen.');}finally{setPending(false);setUploading?.(false);}
  }
  const image=(label,field)=><ImageField label={label} value={field.startsWith('editorial.')?(footer.editorial?.[field.split('.')[1]]??c[field.split('.')[1]]):footer[field] || ''} onChange={value=>write(field,value)} pending={pending||uploading} onUpload={file=>upload(field,file)}/>;
  const numbers=group=><div className="footer-editor__grid">{sizes[group].map(([key,label,min,max])=><NumberField key={key} label={label} min={min} max={max} value={footer.editorial?.[key]??c[key]} onChange={value=>edit(key,value)}/>)}</div>;
  const colors=entries=><div className="footer-editor__grid">{entries.map(([key,label])=><ColorField key={key} label={label} value={c[key]} onChange={value=>edit(key,value)}/>)}</div>;
  function restore(){const next={...FOOTER_EDITORIAL_DEFAULTS};for(const key of ['headline','description','brandName','brandTagline','watermarkText','successMessage','errorMessage',...Object.keys(next).filter(k=>k.endsWith('Enabled'))])next[key]=c[key];write('editorial',next);setRestored(true);}
  return <div className="footer-editor section-editor-layout">
    <div className="section-editor-layout__form footer-editor__form">
      <div className="footer-editor__card"><div className="footer-editor__heading"><div><strong>Pie de página · Firma editorial</strong><p>Modelo 3 · Textos, cristal y enlaces configurables.</p></div><CheckField label="Mostrar footer" checked={footer.enabled!==false} onChange={value=>write('enabled',value)}/></div>
        <button type="button" className="footer-editor__restore" onClick={restore}>Aplicar apariencia del modelo aprobado</button>
        {restored && <p role="status">Apariencia aplicada con el logo y las redes configuradas de la tienda. Guarda los cambios para publicarla. Se conservaron tus enlaces.</p>}
        <SectionEditorSteps sectionName="Pie de página" value={step} onChange={setStep} items={[{value:'content',label:'Contenido',hint:'Edita un grupo a la vez. Todos los textos de la tienda son configurables.'},{value:'design',label:'Diseño',hint:'Ajusta el material, los colores y los tamaños. Comprueba cada dispositivo en la vista previa.'}]}/>
      </div>
      {error && <p role="alert">{error}</p>}
      {step==='content'?<SectionEditorCardTabs label="Contenido del footer" labels={['Suscripción','Marca','Redes','Enlaces','Legal','Mensajes']}>
        <div className="footer-editor__card">
          <CheckField label="Mostrar suscripción" checked={c.newsletterEnabled} onChange={value=>edit('newsletterEnabled',value)}/>
          <TextField label="Título principal" area value={c.headline} onChange={value=>edit('headline',value)}/>
          <TextField label="Descripción de la suscripción" area value={c.description} onChange={value=>edit('description',value)}/>
          <TextField label="Texto del campo de correo" value={footer.inputPlaceholder??'Tu correo electrónico'} onChange={value=>write('inputPlaceholder',value)}/>
          <TextField label="Texto del botón" value={footer.buttonText??'Suscribirme'} onChange={value=>write('buttonText',value)}/>
          <p>El formulario guarda los correos en la base de suscriptores de la tienda. En la vista previa puedes probarlo sin registrar datos.</p>
        </div>
        <div className="footer-editor__card">
          <CheckField label="Mostrar marca" checked={c.brandEnabled} onChange={value=>edit('brandEnabled',value)}/>
          <TextField label="Nombre de la marca" value={footer.editorial?.brandName===''?'':c.brandName} placeholder={store?.name || ''} onChange={value=>edit('brandName',value)}/>
          <SelectField label="Presentación de la marca" value={c.brandMode} onChange={value=>edit('brandMode',value)} options={[["store","Logo configurado de la tienda"],["text","Nombre de la tienda"],["image","Solo logo"],["both","Logo y nombre"]]}/>
          {c.brandMode!=='text' && <>{image('Imagen del logo','logoUrl')}<NumberField label="Ancho del logo (px)" value={footer.logoSizePx??220} min={60} max={260} onChange={value=>write('logoSizePx',value)}/><p>Si no eliges otro logo, se utiliza el del encabezado. El nombre se toma de Configuración → Tienda cuando este campo queda vacío.</p></>}
          <TextField label="Texto bajo la marca (opcional)" area value={c.brandTagline} onChange={value=>edit('brandTagline',value)}/>
          <CheckField label="Mostrar nombre grabado al fondo" checked={c.watermarkEnabled} onChange={value=>edit('watermarkEnabled',value)}/>
          <TextField label="Texto del grabado (vacío usa la marca)" value={c.watermarkText} onChange={value=>edit('watermarkText',value)}/>
        </div>
        <div className="footer-editor__card">
          <CheckField label="Mostrar redes sociales" checked={c.socialsEnabled} onChange={value=>edit('socialsEnabled',value)}/>
          <SelectField label="Estilo de los iconos sociales" value={c.socialIconStyle} onChange={value=>edit('socialIconStyle',value)} options={[["custom","Logos configurados de la tienda"],["minimal","Iconos simples"]]}/>
          <SelectField label="Configurar red social" value={social} onChange={setSocial} options={FOOTER_SOCIALS.map(item=>[item.key,item.label])}/>
          <TextField label={'Enlace de '+FOOTER_SOCIALS.find(item=>item.key===social).label} value={footer[social] || ''} onChange={value=>write(social,value)} placeholder="https://…"/>
          {footer[social] && !/^https?:\/\//i.test(safeFooterLink(footer[social])) && <p role="alert">Introduce un enlace http o https válido para mostrar esta red.</p>}
          {c.socialIconStyle==='custom' && image('Imagen del icono (opcional)',social+'Icon')}
          <p>Se usan las imágenes de cada red sin relieve añadido. Si no hay imagen, aparece un icono simple. Las redes sin un enlace válido se ocultan.</p>
          <div className="footer-editor__grid"><NumberField label="Tamaño de los iconos (px)" min={36} max={90} value={c.socialSize} onChange={value=>edit('socialSize',value)}/><NumberField label="Separación entre iconos (px)" min={4} max={32} value={c.socialGap} onChange={value=>edit('socialGap',value)}/></div>
        </div>
        <div className="footer-editor__card">
          <SelectField label="Configurar columna" value={column} onChange={setColumn} options={columns.map((item,i)=>[item.id,'Columna '+(i+1)+' · '+item.title])}/>
          <CheckField label="Mostrar esta columna" checked={c[column+'Enabled']} onChange={value=>edit(column+'Enabled',value)}/>
          <TextField label="Título de la columna" value={col.title} onChange={value=>write(column+'Title',value)}/>
          <FooterLinkEditor key={column} links={links} onChange={value=>write(column+'Links',value)}/>
          {links.some(link=>link.href && !safeFooterLink(link.href)) && <p role="alert">Hay un destino inválido. Ese enlace se ocultará hasta que lo corrijas.</p>}
        </div>
        <div className="footer-editor__card">
          <CheckField label="Mostrar texto legal" checked={c.legalEnabled} onChange={value=>edit('legalEnabled',value)}/>
          <TextField label="Texto legal inferior" area value={footerLegalText(footer,c.brandName)} onChange={value=>write('copyright',value)}/>
          <CheckField label="Mostrar botón para volver arriba" checked={c.backToTopEnabled} onChange={value=>edit('backToTopEnabled',value)}/>
          <TextField label="Nombre accesible del botón" value={c.backToTopLabel} onChange={value=>edit('backToTopLabel',value)}/>
        </div>
        <div className="footer-editor__card">
          <TextField label="Mensaje de confirmación" value={c.successMessage} onChange={value=>edit('successMessage',value)}/>
          <TextField label="Mensaje si falla el guardado" value={c.errorMessage} onChange={value=>edit('errorMessage',value)}/>
          <p>Estos mensajes aparecen después de intentar guardar el correo.</p>
        </div>
      </SectionEditorCardTabs>:<SectionEditorCardTabs label="Diseño del footer" labels={['Composición','Cristal','Fondo','Tipografía','Móvil','Animación']}>
        <div className="footer-editor__card">{numbers('composition')}<div className="footer-editor__grid"><NumberField label="Ancho del botón de suscripción (px)" min={100} max={320} value={c.buttonWidth} onChange={value=>edit('buttonWidth',value)}/><NumberField label="Alto del botón de suscripción (px)" min={44} max={80} value={c.buttonHeight} onChange={value=>edit('buttonHeight',value)}/></div><button type="button" className="footer-editor__restore" onClick={restore}>Restaurar apariencia de la referencia</button></div>
        <div className="footer-editor__card">
          <SelectField label="Material del cristal" value={c.material} onChange={value=>edit('material',value)} options={[["texture","Textura de la referencia"],["css","Cristal con color libre"]]}/>
          {numbers('glass')}{colors([['glassTint','Tinte del cristal'],['edgeColor','Bordes y reflejos'],['accentColor','Detalles e iconos'],['buttonColor','Fondo del botón'],['buttonTextColor','Texto del botón']])}
          <p>La textura mantiene el rosa y el dorado de la referencia. El material con color libre permite cambiar completamente el tono.</p>
        </div>
        <div className="footer-editor__card">
          <SelectField label="Fondo del footer" value={c.backgroundMode} onChange={value=>edit('backgroundMode',value)} options={[["satin","Satén de la referencia"],["inherit","Continuar el fondo de la página"],["color","Color liso"],["image","Imagen personalizada"]]}/>
          {colors([['backgroundColor','Color de fondo']])}{c.backgroundMode==='image' && image('URL de la imagen de fondo','editorial.backgroundImage')}
          <div className="footer-editor__grid">{[['backgroundX','Posición horizontal (%)',0,100],['backgroundY','Posición vertical (%)',0,100],['backgroundZoom','Zoom del fondo (%)',100,180]].map(([key,label,min,max])=><NumberField key={key} label={label} min={min} max={max} value={c[key]} onChange={value=>edit(key,value)}/>)}</div>
        </div>
        <div className="footer-editor__card">
          {numbers('typography')}{colors([['headingColor','Color de los títulos'],['textColor','Color del texto']])}
          <SelectField label="Fuente de títulos y marca" value={c.titleFont} onChange={value=>edit('titleFont',value)} options={[[FOOTER_EDITORIAL_DEFAULTS.titleFont,"Bodoni · Modelo aprobado"],["Georgia, serif","Georgia"],...INFO_FONT_OPTIONS.filter(item=>![FOOTER_EDITORIAL_DEFAULTS.titleFont,'Georgia, serif'].includes(item.value)).map(item=>[item.value,item.label])]}/>
          <SelectField label="Fuente de los textos" value={c.bodyFont} onChange={value=>edit('bodyFont',value)} options={[["Inter, system-ui, sans-serif","Inter de la referencia"],...INFO_FONT_OPTIONS.map(item=>[item.value,item.label])]}/>
        </div>
        <div className="footer-editor__card">{numbers('mobile')}<SelectField label="Enlaces en móvil" value={c.mobileNavigation} onChange={value=>edit('mobileNavigation',value)} options={[["accordion","Grupos desplegables"],["open","Todos los enlaces visibles"]]}/><p>La suscripción se apila y los iconos se adaptan al ancho. Usa Móvil o Tablet en la vista previa para comprobar el resultado.</p></div>
        <div className="footer-editor__card"><SelectField label="Animación al pasar el cursor" value={c.hoverMotion} onChange={value=>edit('hoverMotion',value)} options={[["lift","Elevar el cristal"],["shine","Reflejo de luz"],["tilt","Perspectiva suave"],["none","Sin animación"]]}/><NumberField label="Duración de las animaciones (ms)" value={c.animationDuration} min={150} max={1000} onChange={value=>edit('animationDuration',value)}/><p>Se respeta la preferencia de movimiento reducido del dispositivo.</p></div>
      </SectionEditorCardTabs>}
    </div>
    <aside className="section-editor-layout__preview"><StorefrontSectionPreview section={{id:'footer',enabled:footer.enabled!==false}} theme={theme} store={store}/></aside>
  </div>;
}
