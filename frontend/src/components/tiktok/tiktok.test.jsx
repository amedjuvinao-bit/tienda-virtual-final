import React, {useState} from 'react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import TiktokSection from '../TiktokSection';
import TiktokPlayer from './TiktokPlayer';
import {TiktokEditorFeed} from './TiktokEditorFeed';
import TiktokSectionUI from '../../admin/appearance/sections/tiktok/TiktokSectionUI';
import TiktokSettings from '../../admin/configuracion/sections/TiktokSection';
import {normalizeStage,stagePosts,stagePlan,safeTiktokLink} from '../../admin/appearance/sections/tiktok/tiktokStageHelpers';
import {normalizeTiktokSection} from '../../admin/appearance/sections/tiktok/tiktokSectionHelpers';
import api from '../../lib/api';
import {isStorefrontSectionVisible} from '../../lib/storefrontSectionVisibility';
import {getSectionOverview} from '../../admin/appearance/sections/sectionsOverviewModel';
import StorefrontSectionPreview from '../../admin/appearance/sections/ui/StorefrontSectionPreview';
vi.mock('../../lib/api',()=>({default:{get:vi.fn(),put:vi.fn(),post:vi.fn(),defaults:{baseURL:'https://api.example.test'}}}));
const post=n=>({id:`tt_700000000000000000${n}`,tiktokId:`700000000000000000${n}`,title:`Video ${n}`,image:`https://cdn.example.test/${n}.jpg`,link:`https://www.tiktok.com/@test/video/700000000000000000${n}`,duration:30});
const account={id:'account',name:'Mi negocio',avatar:'https://cdn.example.test/avatar.jpg',username:'',url:''};
const feed={connected:true,loaded:true,loading:false,error:'',posts:[post(1),post(2)],account,nextCursor:'',refresh:vi.fn(),loadMore:vi.fn(),retry:vi.fn()};
const theme=config=>({sections:[{id:'tiktok',enabled:true,config}]});
beforeEach(()=>{vi.clearAllMocks();api.get.mockResolvedValue({data:{connected:false,posts:[],nextCursor:''}});});
afterEach(cleanup);
it('keeps a connected section visible without manual posts and supports video-only manual content',()=>{
  const t=theme({stageSource:'connected',posts:[]});expect(isStorefrontSectionVisible(t,'tiktok')).toBe(true);
  expect(getSectionOverview(t.sections[0],t.sections)).toMatchObject({status:'ready',detail:'Publicaciones de la cuenta conectada'});
  expect(isStorefrontSectionVisible(theme({posts:[{id:'own',videoUrl:'https://cdn.example.test/own.mp4'}]}),'tiktok')).toBe(true);
  expect(isStorefrontSectionVisible(theme({posts:null}),'tiktok')).toBe(false);
  expect(isStorefrontSectionVisible({sections:[{...t.sections[0],enabled:false}]},'tiktok')).toBe(false);
});
it('allows selection inside the actual section preview and exposes desktop/mobile devices',async()=>{
  const t=theme({stageSource:'connected',posts:[]});
  render(<TiktokEditorFeed.Provider value={feed}><StorefrontSectionPreview section={t.sections[0]} theme={t}/></TiktokEditorFeed.Provider>);
  expect(screen.getByRole('button',{name:'Vista móvil'})).toBeTruthy();expect(screen.getByRole('button',{name:'Vista escritorio amplio'})).toBeTruthy();
  fireEvent.click(await screen.findByRole('button',{name:'Seleccionar video: Video 2'}));expect(await screen.findByTitle('Video de TikTok: Video 2')).toBeTruthy();
});
it('retains existing post metadata and clamps presentation settings',()=>{
  const c=normalizeTiktokSection({config:{posts:[{...post(1),positionX:24}]}}).config;
  expect(c.posts[0].title).toBe('Video 1');expect(c.posts[0].positionX).toBe(24);
  expect(normalizeStage({stageListSize:100,stageGlassColor:'url(evil)'})).toMatchObject({stageListSize:6,stageGlassColor:'#fff5ef'});
});
it('uses real TikTok URLs and never executes a URL from a media field',()=>{
  expect(safeTiktokLink('https://www.tiktok.com.evil.test/@test')).toBe('');
  const posts=stagePosts([{...post(1),image:'javascript:alert(1)',videoUrl:'data:text/html,unsafe'}]);
  expect(posts[0].image).toBe('');expect(posts[0].videoUrl).toBe('');expect(posts[0].tiktokId).toBe('7000000000000000001');
});
it('keeps independent video actions and switches the selected central player',()=>{
  render(<TiktokSection theme={theme({posts:[post(1),post(2)]})}/>);
  expect(screen.getAllByRole('link',{name:/Ver en TikTok: Video/})).toHaveLength(3);
  fireEvent.click(screen.getByRole('button',{name:'Seleccionar video: Video 2'}));
  expect(screen.getByTitle('Video de TikTok: Video 2')).toHaveAttribute('src',expect.stringContaining('7000000000000000002'));
  expect(screen.getByRole('button',{name:'Seleccionar video: Video 2'})).toHaveAttribute('aria-pressed','true');
});
it('ignores player messages from a foreign origin or frame',()=>{
  render(<TiktokPlayer post={post(1)} settings={normalizeStage()} requestPlay/>);
  const frame=screen.getByTitle('Video de TikTok: Video 1');
  fireEvent(window,new MessageEvent('message',{origin:'https://evil.test',source:frame.contentWindow,data:{'x-tiktok-player':true,type:'onStateChange',value:1}}));
  expect(screen.queryByRole('button',{name:'Pausar video'})).toBeNull();
  fireEvent(window,new MessageEvent('message',{origin:'https://www.tiktok.com',source:frame.contentWindow,data:{'x-tiktok-player':true,type:'onStateChange',value:1}}));
  expect(screen.getByRole('button',{name:'Pausar video'})).toBeTruthy();
});
it('uses the official player message API for play, seeking and sound',()=>{
  render(<TiktokPlayer post={post(1)} settings={normalizeStage()} requestPlay/>);
  const frame=screen.getByTitle('Video de TikTok: Video 1'),send=vi.spyOn(frame.contentWindow,'postMessage');
  fireEvent(window,new MessageEvent('message',{origin:'https://www.tiktok.com',source:frame.contentWindow,data:{'x-tiktok-player':true,type:'onPlayerReady'}}));
  expect(send).toHaveBeenCalledWith(expect.objectContaining({type:'play'}),'https://www.tiktok.com');
  fireEvent.change(screen.getByLabelText('Avance del video'),{target:{value:'12'}});
  expect(send).toHaveBeenCalledWith(expect.objectContaining({type:'seekTo',value:12}),'https://www.tiktok.com');
  fireEvent.click(screen.getByLabelText('Silenciar video'));
  expect(send).toHaveBeenCalledWith(expect.objectContaining({type:'mute'}),'https://www.tiktok.com');
});
it('does not fall back to manual sample posts while a connected feed is unavailable',async()=>{
  render(<TiktokSection theme={theme({stageSource:'connected',posts:[post(9)]})}/>);
  await screen.findAllByText('Pronto compartiremos nuevos videos.');
  expect(screen.queryByAltText('Video 9')).toBeNull();
});
it('loads a saved principal from a later page before showing another video',async()=>{
  let finish;const pending=new Promise(resolve=>{finish=resolve;});
  api.get.mockResolvedValueOnce({data:{...feed,nextCursor:'page2'}}).mockImplementationOnce(()=>pending);
  render(<TiktokSection theme={theme({stageSource:'connected',stageFeaturedId:post(3).id,stageFeaturedAccount:'account'})}/>);
  await waitFor(()=>expect(api.get).toHaveBeenCalledTimes(2));expect(screen.queryByAltText('Video 1')).toBeNull();
  finish({data:{...feed,posts:[post(3)]}});await screen.findByAltText('Video 3');
  expect(api.get.mock.calls[1][1].params).toEqual({cursor:'page2'});
});
it('ignores a hidden or different-account principal when planning the initial view',()=>{
  expect(stagePlan({stageFeaturedId:post(3).id,stageFeaturedAccount:'other'},'account',[]).preferred).toBe('');
  expect(stagePlan({stageFeaturedId:post(3).id,stageSelection:{accountId:'account',mode:'all',excluded:[post(3).id]}},'account',[]).preferred).toBe('');
});
it('applies connected visibility, order, title overrides and real profile identity',()=>{
  render(<TiktokEditorFeed.Provider value={{...feed,posts:[post(1),post(2),post(3)]}}><TiktokSection theme={theme({stageSource:'connected',stageSelection:{accountId:'account',mode:'all',excluded:[post(2).id]},stageOrder:{accountId:'account',mode:'manual',ids:[post(3).id,post(1).id]},stageOverrides:{accountId:'account',byId:{[post(3).id]:{title:'Mi título'}}}})}/></TiktokEditorFeed.Provider>);
  expect(screen.queryByRole('button',{name:'Seleccionar video: Video 2'})).toBeNull();
  expect(screen.getByAltText('Mi título')).toBeTruthy();expect(screen.getByText('Mi negocio')).toBeTruthy();expect(screen.queryByText('@undefined')).toBeNull();
});
function EditorHarness(){const[t,setT]=useState(theme({stageSource:'connected'}));return <TiktokEditorFeed.Provider value={feed}><TiktokSectionUI theme={t} setPath={(key,value)=>setT({...t,[key]:value})}/><TiktokSection theme={t}/></TiktokEditorFeed.Provider>;}
it('edits the title in short tabs and immediately updates the real preview',()=>{
  render(<EditorHarness/>);fireEvent.click(screen.getByRole('button',{name:'Textos',exact:true}));fireEvent.change(screen.getByLabelText('Título principal'),{target:{value:'Nuevo título'}});expect(screen.getByRole('heading',{name:'Nuevo título'})).toBeTruthy();
});
it('lets the administrator choose, hide and reorder connected posts',()=>{
  render(<EditorHarness/>);fireEvent.click(screen.getByRole('button',{name:'Videos',exact:true}));
  fireEvent.click(screen.getByRole('button',{name:'Usar como principal: Video 2'}));expect(screen.getByAltText('Video 2')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Ocultar publicación: Video 2'}));expect(screen.queryByRole('button',{name:'Seleccionar video: Video 2'})).toBeNull();
  fireEvent.change(screen.getByLabelText('Orden de las publicaciones'),{target:{value:'manual'}});expect(screen.getByRole('button',{name:'Mover antes: Video 1'})).toBeDisabled();
});
it('shows private credential save and clears the secret only after successful saving',async()=>{
  const settings={revision:1,clientKey:'',redirectUri:'',enabled:false,connected:false,encryptionReady:true,hasClientSecret:false};
  api.get.mockResolvedValue({data:{settings}});api.put.mockResolvedValue({data:{settings:{...settings,revision:2,clientKey:'client-key',redirectUri:'https://api.example.test/api/tiktok/callback',hasClientSecret:true}}});
  render(<TiktokSettings/>);await screen.findByRole('button',{name:'Credenciales',exact:true});fireEvent.click(screen.getByRole('button',{name:'Credenciales',exact:true}));
  fireEvent.change(screen.getByLabelText('Client Key'),{target:{value:'client-key'}});fireEvent.change(screen.getByLabelText('Client Secret'),{target:{value:'private-secret'}});fireEvent.change(screen.getByLabelText('URL de retorno del backend'),{target:{value:'https://api.example.test/api/tiktok/callback'}});
  expect(screen.getByLabelText('Client Secret')).toHaveAttribute('type','password');fireEvent.click(screen.getByRole('button',{name:'Guardar ajustes'}));
  await waitFor(()=>expect(api.put).toHaveBeenCalledWith('/api/admin/tiktok-settings',expect.objectContaining({clientSecret:'private-secret',revision:1}),expect.any(Object)));
  await waitFor(()=>expect(screen.getByLabelText('Client Secret')).toHaveValue(''));
});
