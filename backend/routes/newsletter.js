'use strict';
const express=require('express');
const rateLimit=require('express-rate-limit');
const {createSubscribeHandler}=require('../controllers/newsletterController');
const router=express.Router();
router.post('/subscribe',rateLimit({windowMs:15*60*1000,limit:12,standardHeaders:'draft-7',legacyHeaders:false,message:{ok:false,error:'TOO_MANY_SUBSCRIPTIONS',message:'Espera unos minutos antes de volver a intentarlo.'}}),createSubscribeHandler());
module.exports=router;
