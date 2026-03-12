const express = require('express');
const router = express.Router();

const tripRoutes = require('./trips');
const playerRoutes = require('./players');
const scoreRoutes = require('./scores');

router.use('/trips', tripRoutes);
router.use('/players', playerRoutes);
router.use('/scores', scoreRoutes);

module.exports = router;
