'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
process.env.TIKTOK_ENCRYPTION_KEY='test-only-tiktok-encryption-never-use-in-production';
process.env.JWT_SECRET='test-only-tiktok-admin-auth-secret';
const credentials=require('../lib/tiktok/credentials');
const {createTiktokService,normalizeVideo,validateRedirect,safeSettings,request}=require('../services/tiktokService');
const selection=require('../../shared/tiktokSelection.cjs');
const token='private-access-token-not-for-production',refresh='private-refresh-token-not-for-production';
const video=n=>({id:`700000000000000000${n}`,title:`Video ${n}`,video_description:`Description ${n}`,cover_image_url:`https://cdn.example.com/${n}.jpg`,share_url:`https://www.tiktok.com/@test/video/700000000000000000${n}`,duration:20,create_time:1700000000});
function fixture(config={}) {
  let store={revision:0,clientKey:'',redirectUri:'',enabled:false,connectionId:'',__v:0};
  const pages=new Map(),requests=[];let reject=false,slow=null;
  const doc=value=>Object.assign(structuredClone(value),{save:async function(){if(this.__v!==store.__v)throw Object.assign(new Error('Conflict'),{name:'VersionError'});this.__v+=1;store=Object.fromEntries(Object.entries(this).filter(([,v])=>typeof v!=='function'));}});
  const Model={getSingleton:async()=>doc(store),findOneAndUpdate:(q,u)=>({select:async()=>{if(q.oauthHash!==store.oauthHash || +new Date(store.oauthExpiresAt)<=Date.now())return null;Object.assign(store,u.$set);return doc(store);}})};
  const PageModel={findOne:q=>({lean:async()=>pages.get(q.connection+q.cursorHash)||null}),updateOne:async(q,u)=>pages.set(q.connection+q.cursorHash,u.$set),deleteMany:async q=>{for(const[k,v]of pages)if(v.connection===q.connection)pages.delete(k);}};
  const fetchFn=async(url,options)=>{
    const u=new URL(url);requests.push({url:u,options});
    if(reject)return{ok:false,json:async()=>({error:{code:'access_token_invalid',message:token}})};
    const ok=data=>({ok:true,json:async()=>data});
    if(u.pathname==='/v2/oauth/token/')return ok({access_token:token,refresh_token:refresh,expires_in:86400,refresh_expires_in:31536000,scope:'user.info.basic,video.list',open_id:'account'});
    if(u.pathname==='/v2/oauth/revoke/')return ok({});
    if(u.pathname==='/v2/user/info/')return ok({data:{user:{open_id:'account',display_name:'Empresa',avatar_url:'https://cdn.example.com/avatar.jpg'}},error:{code:'ok'}});
    if(u.pathname==='/v2/video/list/'){
      if(slow)await slow;
      const body=JSON.parse(options.body);
      return ok({data:{videos:[video(body.cursor?2:1)],has_more:!body.cursor,cursor:body.cursor?0:1700000000000},error:{code:'ok'}});
    }
    throw new Error('Unexpected endpoint');
  };
  const service=createTiktokService({Model,PageModel,fetchFn,readConfig:async()=>config});
  const connect=async()=>{await service.save({revision:0,clientKey:'client-key',clientSecret:'private-secret',redirectUri:'https://api.example.com/api/tiktok/callback',enabled:true});const auth=await service.authorize({revision:1});const state=new URL(auth.url).searchParams.get('state');await service.start(state);return service.callback({state,code:'approved-code'},state);};
  return {service,connect,requests,pages,current:()=>store,mutate:v=>Object.assign(store,v),publish:v=>{config=v;},reject:()=>{reject=true;},delay:p=>{slow=p;}};
}
test('TikTok credentials are authenticated encrypted and cursors bind to connection',()=>{
  const value=credentials.protect(token);assert.ok(!value.includes(token));assert.equal(credentials.reveal(value),token);assert.throws(()=>credentials.reveal(value.slice(0,-4)+'AAAA'));
  const cursor=credentials.signCursor('1700000000000','one');assert.equal(credentials.readCursor(cursor,'one'),'1700000000000');assert.throws(()=>credentials.readCursor(cursor,'two'));assert.throws(()=>credentials.readCursor(cursor+'x','one'));
});
test('TikTok callback requires permanent HTTPS and exact backend callback path',()=>{
  assert.equal(validateRedirect('https://api.example.com/api/tiktok/callback'),'https://api.example.com/api/tiktok/callback');
  for(const value of ['http://localhost:5000/api/tiktok/callback','https://api.example.com/other','https://a:b@api.example.com/api/tiktok/callback','https://api.example.com/api/tiktok/callback?x=1'])assert.throws(()=>validateRedirect(value));
});
test('media rejects unsafe links and maintains stable per-video IDs',()=>{
  const result=normalizeVideo(video(1));assert.equal(result.id,'tt_7000000000000000001');assert.equal(result.tiktokId,'7000000000000000001');assert.equal(result.duration,20);
  assert.equal(normalizeVideo({...video(1),share_url:'https://tiktok.com.evil.test/video/123'}),null);
  assert.equal(normalizeVideo({...video(1),id:'not-an-id'}),null);
  assert.equal(normalizeVideo({...video(1),cover_image_url:'javascript:alert(1)'}).image,'');
});
test('settings whitelist masks access, refresh, app secret and OAuth state',()=>{
  const safe=JSON.stringify(safeSettings({revision:0,clientSecretEncrypted:'private-app',tokenEncrypted:token,refreshTokenEncrypted:refresh,oauthHash:'private-state'}));
  for(const secret of [token,refresh,'private-app','private-state','tokenEncrypted','refreshTokenEncrypted'])assert.ok(!safe.includes(secret));
});
test('OAuth uses correct scopes, browser state and one-time callback',async()=>{
  const f=fixture();await f.service.save({revision:0,clientKey:'client-key',clientSecret:'private-secret',redirectUri:'https://api.example.com/api/tiktok/callback',enabled:true});
  const {url}=await f.service.authorize({revision:1}),state=new URL(url).searchParams.get('state');
  const start=new URL(await f.service.start(state));assert.equal(start.origin,'https://www.tiktok.com');assert.equal(start.searchParams.get('scope'),'user.info.basic,video.list');
  await assert.rejects(()=>f.service.callback({state,code:'approved'},'different'),/navegador/);
  const result=await f.service.callback({state,code:'approved'},state);assert.equal(result.settings.connected,true);assert.equal(result.settings.account.name,'Empresa');
  await assert.rejects(()=>f.service.callback({state,code:'approved'},state),/utilizada/);
  assert.equal(f.requests.find(r=>r.url.pathname==='/v2/oauth/token/').options.headers['Content-Type'],'application/x-www-form-urlencoded');
  assert.ok(f.requests.every(r=>r.url.hostname==='open.tiktokapis.com'));
});
test('revision conflicts preserve saved configuration',async()=>{
  const f=fixture();await f.connect();await assert.rejects(()=>f.service.save({revision:0}),e=>e.status===409);assert.equal(f.current().account.id,'account');
  await assert.rejects(()=>f.service.save({revision:2,clientKey:'other-key'}),/Desconecta/);
});
test('public feed filters every cached page while admin can manage all videos',async()=>{
  const f=fixture();await f.connect();const first=await f.service.feed();assert.equal(first.posts[0].id,'tt_7000000000000000001');assert.ok(first.nextCursor);
  f.publish({stageSelection:{accountId:'account',mode:'selected',included:['tt_7000000000000000002'],excluded:[]}});
  const approved=await f.service.feed();assert.deepEqual(approved.posts.map(p=>p.id),['tt_7000000000000000002']);
  const admin=await f.service.feed('',false,true);assert.deepEqual(admin.posts.map(p=>p.id),['tt_7000000000000000001']);
  f.publish({stageSelection:{accountId:'account',mode:'selected',included:[]}});assert.equal((await f.service.feed()).nextCursor,'');
  f.publish({sectionEnabled:false});assert.deepEqual((await f.service.feed()).posts,[]);
  await assert.rejects(()=>f.service.feed(first.nextCursor+'x'),e=>e.status===400);
  assert.ok(!JSON.stringify(first).includes(token));assert.ok(!JSON.stringify(first).includes(refresh));
});
test('access refresh persists both rotated tokens before serving expired access',async()=>{
  const f=fixture();await f.connect();f.mutate({expiresAt:new Date(Date.now()-1000)});
  await Promise.all([f.service.feed('',true,true),f.service.feed('',false,true)]);
  const renew=f.requests.filter(r=>r.url.pathname==='/v2/oauth/token/' && new URLSearchParams(r.options.body).get('grant_type')==='refresh_token');
  assert.equal(renew.length,1);assert.ok(+new Date(f.current().expiresAt)>Date.now());assert.equal(credentials.reveal(f.current().refreshTokenEncrypted),refresh);
});
test('cache expires before six-hour cover URL TTL and upstream errors do not leak tokens',async()=>{
  const f=fixture();await f.connect();await f.service.feed();const before=f.requests.length;await f.service.feed();assert.equal(f.requests.length,before);
  for(const page of f.pages.values())page.fetchedAt=new Date(Date.now()-6*3600000);f.reject();
  await assert.rejects(()=>f.service.feed(),e=>/revocado/.test(e.message)&&!e.message.includes(token));
});
test('disconnect removes credentials and cached videos; no old account is published',async()=>{
  const f=fixture();await f.connect();await f.service.feed();await f.service.disconnect({revision:2});assert.equal(f.current().tokenEncrypted,'');assert.equal(f.current().refreshTokenEncrypted,'');assert.equal(f.pages.size,0);assert.equal((await f.service.feed()).connected,false);
});
test('manual selection/order applies by account and retains stable unseen IDs',()=>{
  let c={stageSelection:{accountId:'account',mode:'all',excluded:['tt_3']},stageOrder:{accountId:'account',mode:'manual',ids:['tt_9','tt_2','tt_1']}};
  assert.deepEqual(selection.visiblePosts([{id:'tt_1'},{id:'tt_2'},{id:'tt_3'}],c,'account').map(p=>p.id),['tt_2','tt_1']);
  assert.deepEqual(selection.visiblePosts([{id:'tt_1'},{id:'tt_2'},{id:'tt_3'}],c,'other').map(p=>p.id),['tt_1','tt_2','tt_3']);
  const moved=selection.movePost(c,'account',[{id:'tt_1'},{id:'tt_2'}],'tt_1',-1);assert.deepEqual(moved.ids,['tt_9','tt_1','tt_2']);
});
test('permission catalog and routes protect settings separately from media preview',()=>{
  const {findAdminRoutePermission}=require('../security/adminRoutePermissionMap');
  for(const [method,path,permission]of[['GET','/api/admin/tiktok-settings','settings:tiktok'],['PUT','/api/admin/tiktok-settings','settings:tiktok'],['POST','/api/admin/tiktok-settings/authorize','settings:tiktok'],['GET','/api/admin/tiktok-settings/feed','appearance:view'],['POST','/api/admin/tiktok-settings/refresh-feed','appearance:view']]){
    const rule=findAdminRoutePermission(method,path);assert.equal(rule.permission,permission);assert.equal(rule.knownPermission,true);
  }
});
test('private routes are mounted and reject requests without authentication',async()=>{
  const express=require('express'),app=express();app.use(express.json());require('../routes/mountTiktokRoutes')(app);
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  try{for(const [method,path]of[['GET',''],['PUT',''],['POST','/authorize'],['POST','/sync'],['POST','/disconnect'],['GET','/feed'],['POST','/refresh-feed']]){const result=await fetch(`http://127.0.0.1:${server.address().port}/api/admin/tiktok-settings${path}`,{method});assert.equal(result.status,401);}}
  finally{await new Promise(resolve=>server.close(resolve));}
});
