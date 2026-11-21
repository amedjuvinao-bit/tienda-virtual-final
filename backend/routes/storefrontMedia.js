'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const { createMediaRelay } = require('../lib/socialMediaRelay');
const { createPublishedMediaAccess } = require('../services/publishedSocialMedia');
const router = express.Router();
router.get('/', rateLimit({ windowMs: 60000, limit: 240, standardHeaders: true, legacyHeaders: false }),
  createMediaRelay({ authorize: createPublishedMediaAccess() }));
module.exports = router;
