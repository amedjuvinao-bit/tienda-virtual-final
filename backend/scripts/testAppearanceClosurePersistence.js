'use strict';
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const SiteSettings = require('../models/SiteSettings');
const router = require('../routes/siteSettings');
const { buildDefaultSettings } = require('../services/siteSettingsDocumentService');

async function main() {
  const uri=process.env.MONGODB_URI||'';
  if (process.env.NODE_ENV!=='test' || !/^mongodb:\/\/127\.0\.0\.1:27017\/appearance_/.test(uri)) throw Error('Solo MongoDB local de pruebas de Apariencia.');
  await mongoose.connect(uri);
  process.env.JWT_SECRET='appearance-local-persistence-test';process.env.ALLOW_LEGACY_ADMIN_AUTH='true';
  const app=express();app.use(express.json());app.use('/api/site-settings',router);app.use((error,_req,res,_next)=>res.status(500).json({message:error.message}));
  const server=await new Promise(resolve=>{const listener=app.listen(0,'127.0.0.1',()=>resolve(listener))});
  const base=`http://127.0.0.1:${server.address().port}/api/site-settings`;
  const token=jwt.sign({role:'admin',adminRole:'owner',username:'appearance-test'},process.env.JWT_SECRET);
  const put=patch=>fetch(base,{method:'PUT',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify(patch)});
  try {
    await SiteSettings.deleteMany({});const created=await SiteSettings.create(buildDefaultSettings());
    const initialRevision=created.appearanceRevision;
    for (const [header,banner] of [[{bgOpacity:12},undefined],[{logoHeightPx:999},undefined],[{surfaceShape:'bad'},undefined],[{bgOpacity:12},{templateConfigs:{editorial:{cardTextStyle:{titleColor:'#112233'}}}}]]) {
      const response=await put({appearanceRevision:initialRevision,theme:{header,...(banner?{banner}:{})}});
      assert.equal(response.status,400,await response.text());
      assert.equal((await SiteSettings.findById(created._id).lean()).appearanceRevision,initialRevision);
    }
    const valid={appearanceRevision:initialRevision,theme:{header:{surfaceShape:'floating',logoHeightPx:80,bgOpacity:.62,liquidGlassEnabled:true},sections:[{id:'look',enabled:true,config:{heroMode:'custom',heroImage:'/look.webp',products:[]}}]}};
    const competing=await Promise.all([put(valid),put({...valid,theme:{header:{surfaceShape:'attached'}}})]);
    assert.deepEqual(competing.map(r=>r.status).sort(),[200,409]);
    let raw=await SiteSettings.findById(created._id).lean();assert.equal(raw.appearanceRevision,initialRevision+1);
    const next=await put({appearanceRevision:raw.appearanceRevision,theme:{header:{surfaceShape:'floating',bgOpacity:.62,logoHeightPx:80},banner:{templateConfigs:{editorial:{cardTextStyle:{titleColor:'#112233',titleSizePx:22,metallicTitle:true}}}}}});
    assert.equal(next.status,200,await next.text());
    const publicSettings=await(await fetch(base)).json();
    assert.equal(publicSettings.theme.header.surfaceShape,'floating');assert.equal(publicSettings.theme.header.bgOpacity,.62);
    assert.equal(publicSettings.theme.banner.templateConfigs.editorial.cardTextStyle.titleSizePx,22);
    assert.equal(publicSettings.theme.banner.templateConfigs.editorial.cardTextStyle.titleColor,'#112233');
    assert(!Object.hasOwn(publicSettings,'appearanceRevision'));
    raw=await SiteSettings.findById(created._id).lean();assert.equal(raw.appearanceRevision,initialRevision+2);
    let settingsReads=0;
    mongoose.set('debug', (collection, method) => { if (collection===SiteSettings.collection.name && method==='findOne') settingsReads++; });
    try { await (await fetch(base)).json(); } finally { mongoose.set('debug',false); }
    assert.equal(settingsReads,1,'Una consulta pública estable realiza una sola lectura a MongoDB.');
    console.log('Apariencia HTTP + MongoDB: validación en ambas rutas de persistencia; concurrencia; lectura pública y campos nuevos: OK');
  } finally { await new Promise(resolve=>server.close(resolve));await SiteSettings.deleteMany({});await mongoose.disconnect(); }
}
main().catch(error=>{console.error(error);process.exitCode=1});
