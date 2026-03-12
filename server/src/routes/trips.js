const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');

// GET /api/trips - list all trips
router.get('/', async (req, res, next) => {
  try {
    const trips = await prisma.trip.findMany({
      include: { players: true, rounds: true },
      orderBy: { startDate: 'desc' },
    });
    res.json(trips);
  } catch (err) {
    next(err);
  }
});

// GET /api/trips/:id - get a single trip
router.get('/:id', async (req, res, next) => {
  try {
    const trip = await prisma.trip.findUnique({
      where: { id: req.params.id },
      include: { players: true, rounds: { include: { scores: true } } },
    });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json(trip);
  } catch (err) {
    next(err);
  }
});

// POST /api/trips - create a trip
router.post('/', async (req, res, next) => {
  try {
    const { name, location, startDate, endDate } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!location || typeof location !== 'string' || !location.trim()) {
      return res.status(400).json({ error: 'location is required' });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'startDate and endDate must be valid dates' });
    }
    if (end <= start) {
      return res.status(400).json({ error: 'endDate must be after startDate' });
    }
    const trip = await prisma.trip.create({
      data: { name: name.trim(), location: location.trim(), startDate: start, endDate: end },
    });
    res.status(201).json(trip);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/trips/:id - update a trip
router.patch('/:id', async (req, res, next) => {
  try {
    const { name, location, startDate, endDate } = req.body;
    const data = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'name must be a non-empty string' });
      }
      data.name = name.trim();
    }
    if (location !== undefined) {
      if (typeof location !== 'string' || !location.trim()) {
        return res.status(400).json({ error: 'location must be a non-empty string' });
      }
      data.location = location.trim();
    }
    if (startDate !== undefined) {
      const d = new Date(startDate);
      if (isNaN(d.getTime())) return res.status(400).json({ error: 'startDate must be a valid date' });
      data.startDate = d;
    }
    if (endDate !== undefined) {
      const d = new Date(endDate);
      if (isNaN(d.getTime())) return res.status(400).json({ error: 'endDate must be a valid date' });
      data.endDate = d;
    }

    // Validate final date ordering against existing record when only one date is changing
    if (data.startDate || data.endDate) {
      const existing = await prisma.trip.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Trip not found' });
      const finalStart = data.startDate ?? existing.startDate;
      const finalEnd = data.endDate ?? existing.endDate;
      if (finalEnd <= finalStart) {
        return res.status(400).json({ error: 'endDate must be after startDate' });
      }
    }

    const trip = await prisma.trip.update({
      where: { id: req.params.id },
      data,
    });
    res.json(trip);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/trips/:id - delete a trip
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.trip.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
