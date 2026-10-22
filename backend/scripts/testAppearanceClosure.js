'use strict';
const assert = require('node:assert/strict');
const express = require('express');
const multer = require('multer');
const { validateAppearanceInput } = require('../services/appearanceValidation');
const { loadSettingsDocument, buildDefaultSettings } = require('../services/siteSettingsDocumentService');
const SiteSettings = require('../models/SiteSettings');
const { findAdminRoutePermission } = require('../security/adminRoutePermissionMap');
const { MEDIA_UPLOAD_LIMITS, mediaUploadOptions } = require('../lib/uploads/mediaUploadPolicy');

async function main() {
  const invalid = [
    { theme: { header: { bgOpacity: 12 } } },
    { theme: { header: { logoHeightPx: 999 } } },
    { theme: { header: { surfaceShape: 'other' } } },
    { theme: { header: { liquidGlassEnabled: 'true' } } },
    { theme: { header: { mobileMenuWidthPercent: 200 } } },
    { theme: { banner: { autoplayMs: 1 } } },
    { theme: { banner: { slides: [{ image: '/ok.webp', mobilePosX: 101 }] } } },
    { theme: { sections: [{ id: 'look' }, { id: 'look' }] } },
    { theme: { sections: [{ id: 'look', config: [] }] } },
    { theme: { colors: { background: 'wrong' } } },
    { theme: { fonts: { fontSize: -3 } } },
    { menus: { header: [{ ref: 'javascript:alert(1)' }] } },
    JSON.parse('{"theme":{"header":{"$set":1}}}'),
    JSON.parse('{"theme":{"header":{"__proto__":{"x":1}}}}'),
  ];
  invalid.forEach((patch, index) => assert(validateAppearanceInput(patch), `invalid patch ${index}`));
  assert.equal(validateAppearanceInput({ theme: { header: { bgOpacity: .62, logoHeightPx: 80, surfaceShape: 'floating' }, sections: [{ id:'look', config:{products:[]} }] }, menus:{header:[{ref:'/#tendencia'}]} }), null);

  // A configured store needs one read, without writes or repair queries.
  const originals = { findOne:SiteSettings.findOne, findByIdAndUpdate:SiteSettings.findByIdAndUpdate };
  let reads=0,writes=0;const repairs=[];
  const fixture={_id:'settings-1',...buildDefaultSettings(),appearanceRevision:8};
  SiteSettings.findOne=()=>({async lean(){reads++;return structuredClone(fixture)}});
  SiteSettings.findByIdAndUpdate=(_id, update)=>({async lean(){writes++;repairs.push(update.$set);return {...fixture, repaired:true}}});
  try {
    assert.equal((await loadSettingsDocument()).appearanceRevision,8);
    assert.equal(reads,1);assert.equal(writes,0);
    delete fixture.theme.sections;
    assert.equal((await loadSettingsDocument()).repaired,true);
    assert.equal(writes,1);
    assert.deepEqual(repairs[0], { 'theme.sections': [] });
    fixture.theme.sections=[];
    fixture.billing.fiscalInfo.nit='900123456';
    delete fixture.billing.fiscalInfo.businessName;
    await loadSettingsDocument();
    assert.equal(repairs[1]['billing.fiscalInfo.businessName'],'');
    assert(!Object.hasOwn(repairs[1],'billing.fiscalInfo.nit'));
    assert.equal(fixture.billing.fiscalInfo.nit,'900123456');
  } finally { Object.assign(SiteSettings, originals); }

  assert.equal(findAdminRoutePermission('POST','/api/uploads/many').permission,'media:upload');
  process.env.JWT_SECRET ||= 'local-test-appearance-closure';
  const uploadRouter = require('../routes/uploadRoutes');
  const app=express();app.use('/api/uploads',uploadRouter);
  const options=mediaUploadOptions(multer.memoryStorage(),multer);
  assert.equal(options.limits.fileSize,50*1024*1024);assert.equal(MEDIA_UPLOAD_LIMITS.files,5);
  // Exercise the same parser with a small byte limit, without uploading to Cloudinary.
  const parse=multer({...options,limits:{...options.limits,fileSize:16}}).array('files',5);
  app.post('/parser',(req,res)=>parse(req,res,error=>res.status(error?400:200).json({code:error?.code||'OK'})));
  const server=await new Promise(resolve=>{const listener=app.listen(0,'127.0.0.1',()=>resolve(listener))});
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ['/api/uploads','/api/uploads/many']) assert.equal((await fetch(base+path,{method:'POST'})).status,401,path);
    for (const [type,size,code] of [['image/png',3,'OK'],['text/html',3,'LIMIT_UNEXPECTED_FILE'],['image/png',17,'LIMIT_FILE_SIZE']]) {
      const body=new FormData();body.append('files',new Blob([new Uint8Array(size)],{type}),'fixture.png');
      assert.equal((await(await fetch(base+'/parser',{method:'POST',body})).json()).code,code);
    }
    const body=new FormData();for(let i=0;i<6;i++)body.append('files',new Blob(['x'],{type:'image/png'}),`${i}.png`);
    assert.equal((await(await fetch(base+'/parser',{method:'POST',body})).json()).code,'LIMIT_FILE_COUNT');
  } finally { await new Promise(resolve=>server.close(resolve)); }
  console.log(`Apariencia cierre: ${invalid.length} entradas inválidas rechazadas; carga HTTP protegida; límites de archivos; lectura única y reparación heredada: OK`);
}
main().catch(error=>{console.error(error);process.exitCode=1});
