import { expect, it } from 'vitest';
import { journeyScene, placeJourneyLead } from './decorativeJourneyScenes';
import { normalizeDecorativeJourney, JOURNEY_SECTION_IDS } from './decorativeJourneyConfig';
const chapters=JOURNEY_SECTION_IDS.map((id,i)=>({id,top:i*1000,height:1000}));
it('asigna composiciones distintas según la sección y respeta su orden real',()=>{
  const config=normalizeDecorativeJourney(),poses=chapters.map(chapter=>journeyScene(chapter.top,chapters,800,1440,config));
  expect(poses.map(p=>p.id)).toEqual(JOURNEY_SECTION_IDS);
  expect(new Set(poses.map(p=>`${p.x.toFixed(0)},${p.y.toFixed(0)},${p.angle.toFixed(0)}`)).size).toBe(9);
  const reordered=[{id:'instagram',top:0,height:700},{id:'categorias',top:700,height:2200},{id:'footer',top:2900,height:900}];
  expect(journeyScene(750,reordered,800,1440,config).id).toBe('categorias');
  expect(journeyScene(2200,reordered,800,1440,config).id).toBe('categorias');
});
it('entrega la misma imagen de forma continua entre todas las secciones y al volver',()=>{
  const config=normalizeDecorativeJourney();
  for(const chapter of chapters.slice(1)){
    const boundary=chapter.top-800*.18;
    const a=journeyScene(boundary-.001,chapters,800,1440,config),b=journeyScene(boundary+.001,chapters,800,1440,config);
    expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeLessThan(.1);expect(Math.abs(a.angle-b.angle)).toBeLessThan(.1);
  }
  expect(journeyScene(1500,chapters,800,1440,config)).toEqual(journeyScene(1500,chapters,800,1440,config));
});
it('conserva los ajustes por sección, valida límites y no impone recursos a otra tienda',()=>{
  const config=normalizeDecorativeJourney({sectionSettings:{instagram:{placement:'right',scale:120,accent:40,enabled:false},footer:{scale:999,accent:-5,placement:'unknown'},unknown:{scale:120}}});
  expect(config.sectionSettings.instagram).toEqual({placement:'right',scale:120,accent:40,enabled:false});
  expect(config.sectionSettings.footer).toEqual({placement:'auto',scale:150,accent:0,enabled:true});expect(config.sectionSettings.unknown).toBeUndefined();
  const scene=journeyScene(5000,chapters,800,1440,config);expect(scene.opacity).toBe(0);expect(scene.scale).toBeCloseTo(.98*1.2);
  expect(normalizeDecorativeJourney().sectionSettings).toEqual({});expect(config.image).toBe('');
});
it('mantiene la imagen dentro de la pantalla y busca espacio alrededor de los controles',()=>{
  const obstacle={x:650,y:300,width:200,height:140},pose={x:790,y:350};
  const result=placeJourneyLead(pose,1200,800,160,[obstacle],120);
  expect(Math.hypot(result.x-pose.x,result.y-pose.y)).toBeGreaterThan(15);
  for(const [width,height,size,top] of [[1440,900,240,180],[390,844,100,140],[300,280,60,0]]){
    const p=placeJourneyLead({x:-200,y:-50},width,height,size,[],top);
    expect(p.x-size/2).toBeGreaterThanOrEqual(0);expect(p.x+size/2).toBeLessThanOrEqual(width);
    expect(p.y-size/2).toBeGreaterThanOrEqual(top);expect(p.y+size/2).toBeLessThanOrEqual(height);
  }
});

it('mantiene la continuidad con recorrido lateral e intensidad configurable',()=>{
  const config={...normalizeDecorativeJourney({path:'edges'}),intensity:100};
  for(let scroll=0;scroll<8000;scroll+=25){
    const a=journeyScene(scroll,chapters,800,1440,config),b=journeyScene(scroll+.001,chapters,800,1440,config);
    expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeLessThan(.1);
  }
  expect(journeyScene(300,chapters,800,1440,{...config,intensity:20})).not.toEqual(journeyScene(300,chapters,800,1440,config));
});

it('alcanza la composición final aunque el pie sea más corto que la pantalla',()=>{
  const short=[{id:'banner',top:0,height:1000},{id:'informacion',top:1000,height:800},{id:'footer',top:1800,height:300}];
  const config=normalizeDecorativeJourney();
  expect(journeyScene(1200,short,900,1440,config).id).toBe('footer');
  const a=journeyScene(1199.999,short,900,1440,config),b=journeyScene(1200,short,900,1440,config);
  expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeLessThan(.1);
});

it('desvía el adorno de forma local y continua cuando pasa texto por su recorrido',()=>{
  const pose={x:1050,y:500},size=200;
  for(let offset=-200;offset<200;offset+=5){
    const a=placeJourneyLead(pose,1440,900,size,[{x:990,y:400+offset,width:160,height:40}],150);
    const b=placeJourneyLead(pose,1440,900,size,[{x:990,y:400+offset+.01,width:160,height:40}],150);
    expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeLessThan(.1);
    expect(Math.hypot(a.x-pose.x,a.y-pose.y)).toBeLessThan(size*.5);
  }
});

it('adapta el recorrido a las columnas de escritorio y a las tarjetas apiladas de móvil',()=>{
  const sample=[{id:'tiktok',top:0,height:1300},{id:'footer',top:1300,height:500}],config=normalizeDecorativeJourney();
  const desktop=journeyScene(0,sample,900,1440,{...config,compact:false});
  const mobile=journeyScene(0,sample,844,390,{...config,compact:true});
  expect(desktop.x/1440).toBeGreaterThan(.55);expect(mobile.x/390).toBeLessThan(.25);
  const short=[{id:'complementos',top:0,height:500},{id:'categorias',top:500,height:900}];
  const pose=journeyScene(0,short,900,1440,config);
  expect(pose.y).toBeGreaterThanOrEqual(0);expect(pose.y).toBeLessThanOrEqual(500);expect(pose.maxY).toBe(500);
});
