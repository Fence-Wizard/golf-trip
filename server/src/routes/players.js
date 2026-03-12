const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');

// GET /api/players - list all players
router.get('/', async (req, res, next) => {
  try {
    const players = await prisma.player.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(players);
  } catch (err) {
    next(err);
  }
});

// GET /api/players/:id
router.get('/:id', async (req, res, next) => {
  try {
    const player = await prisma.player.findUnique({
      where: { id: req.params.id },
      include: { scores: true, trips: true },
    });
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json(player);
  } catch (err) {
    next(err);
  }
});

// POST /api/players - create a player
router.post('/', async (req, res, next) => {
  try {
    const { name, email, handicap } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (email !== undefined && email !== null && email !== '') {
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({ error: 'email must be a valid email address' });
      }
    }
    let parsedHandicap = null;
    if (handicap !== undefined && handicap !== null && handicap !== '') {
      parsedHandicap = parseFloat(handicap);
      if (isNaN(parsedHandicap)) {
        return res.status(400).json({ error: 'handicap must be a valid number' });
      }
    }
    const player = await prisma.player.create({
      data: {
        name: name.trim(),
        email: email ? email.trim() : undefined,
        handicap: parsedHandicap,
      },
    });
    res.status(201).json(player);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/players/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { name, email, handicap } = req.body;
    const data = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'name must be a non-empty string' });
      }
      data.name = name.trim();
    }
    if (email !== undefined) {
      if (email === null || email === '') {
        data.email = null;
      } else if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({ error: 'email must be a valid email address' });
      } else {
        data.email = email.trim();
      }
    }
    if (handicap !== undefined) {
      if (handicap === null || handicap === '') {
        data.handicap = null;
      } else {
        const parsed = parseFloat(handicap);
        if (isNaN(parsed)) return res.status(400).json({ error: 'handicap must be a valid number' });
        data.handicap = parsed;
      }
    }
    const player = await prisma.player.update({
      where: { id: req.params.id },
      data,
    });
    res.json(player);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/players/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.player.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
