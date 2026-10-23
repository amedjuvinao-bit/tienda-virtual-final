'use strict';

const Subscriber = require('../models/Subscriber');

function normalizeEmail(value) {
  if(typeof value!=='string')return '';
  const email=value.trim().toLowerCase();
  return email.length<=254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)?email:'';
}

function createSubscribeHandler({ SubscriberModel=Subscriber }={}) {
  return async function subscribe(req,res) {
    const email=normalizeEmail(req.body?.email);
    if(!email || req.body?.consent!==true)return res.status(400).json({ok:false,error:'INVALID_SUBSCRIPTION',message:'Escribe un correo válido y solicita la suscripción.'});
    try {
      // Insert only: repeat subscriptions preserve the existing checkout/contact metadata.
      const result=await SubscriberModel.findOneAndUpdate({email},{$setOnInsert:{email,origen:'footer',fecha:new Date()}},{upsert:true,new:true,setDefaultsOnInsert:true});
      if(!result)throw new Error('SUBSCRIPTION_NOT_PERSISTED');
      return res.status(200).json({ok:true});
    } catch(error) {
      if(Number(error?.code)===11000) {
        try { if(await SubscriberModel.exists({email}))return res.status(200).json({ok:true}); } catch { /* Return the same retry response. */ }
      }
      return res.status(503).json({ok:false,error:'SUBSCRIPTION_UNAVAILABLE',message:'No pudimos guardar tu suscripción. Intenta de nuevo.'});
    }
  };
}
module.exports={normalizeEmail,createSubscribeHandler};
