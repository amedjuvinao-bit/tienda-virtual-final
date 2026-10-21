'use strict';
const assert=require('node:assert/strict');
const {createSubscribeHandler,normalizeEmail}=require('../controllers/newsletterController');
const SiteSettings=require('../models/SiteSettings');

async function response(handler,body) {
  const result={status:200};
  const res={status(code){result.status=code;return this;},json(data){result.body=data;return this;}};
  await handler({body},res);return result;
}
async function main(){
  const calls=[];
  const model={async findOneAndUpdate(...args){calls.push(args);return {_id:'subscriber-1'};}};
  const handler=createSubscribeHandler({SubscriberModel:model});
  assert.equal(normalizeEmail('  EXAMPLE@SHOP.COM '),'example@shop.com');
  for(const email of [null,{},'invalid','<a@b.com>','x'.repeat(255)+'@a.com'])assert.equal((await response(handler,{email,consent:true})).status,400);
  assert.equal((await response(handler,{email:'a@b.com'})).status,400);assert.equal(calls.length,0);
  assert.deepEqual(await response(handler,{email:' CLIENT@EXAMPLE.COM ',consent:true}),{status:200,body:{ok:true}});
  assert.deepEqual(calls[0][0],{email:'client@example.com'});
  assert.equal(calls[0][1].$setOnInsert.origen,'footer');assert.equal(calls[0][1].$set,undefined);
  assert.equal(calls[0][2].upsert,true);
  assert.equal((await response(createSubscribeHandler({SubscriberModel:{async findOneAndUpdate(){throw {code:11000};},async exists(){return {_id:'existing'};}}}),{email:'a@b.com',consent:true})).status,200);
  assert.equal((await response(createSubscribeHandler({SubscriberModel:{async findOneAndUpdate(){throw new Error('DB unavailable');}}}),{email:'a@b.com',consent:true})).status,503);
  const document=new SiteSettings({theme:{footer:{enabled:true,logoUrl:'https://example.com/logo.png',column1Title:'Explora',column1Links:[{label:'Tienda',href:'/'}],editorial:{headline:'Sigamos',brandName:'Mi negocio',depth:18,mobileNavigation:'accordion'}}}});
  const saved=JSON.parse(JSON.stringify(document.toObject()));
  assert.equal(saved.theme.footer.editorial.brandName,'Mi negocio');assert.equal(saved.theme.footer.column1Links[0].href,'/');
  const router=require('../routes/newsletter');
  assert(router.stack.some(layer=>layer.route?.path==='/subscribe' && layer.route.methods.post));
  const express=require('express'), Subscriber=require('../models/Subscriber');
  const originalUpsert=Subscriber.findOneAndUpdate;
  Subscriber.findOneAndUpdate=async()=>({_id:'test-only'});
  const app=express();app.use(express.json());app.use('/api/newsletter',router);
  const server=await new Promise(resolve=>{const current=app.listen(0,'127.0.0.1',()=>resolve(current));});
  try {
    const url='http://127.0.0.1:'+server.address().port+'/api/newsletter/subscribe';
    for(let i=0;i<12;i++){
      const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'test@example.com',consent:true})});
      assert.equal(res.status,200);assert.deepEqual(await res.json(),{ok:true});
    }
    const limited=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'test@example.com',consent:true})});
    assert.equal(limited.status,429);
  } finally {Subscriber.findOneAndUpdate=originalUpsert;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  console.log('Footer: validación, suscripción idempotente, errores y persistencia de configuración correctos.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
