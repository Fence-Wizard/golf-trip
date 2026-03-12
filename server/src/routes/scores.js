const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');

// GET /api/scores?roundId=xxx - get scores for a round
router.get('/', async (req, res, next) => {
  try {
    const { roundId } = req.query;
    const scores = await prisma.score.findMany({
      where: roundId ? { roundId } : {},
      include: { player: true, round: true },
      orderBy: { hole: 'asc' },
    });
    res.json(scores);
  } catch (err) {
    next(err);
  }
});

// POST /api/scores - record a score
router.post('/', async (req, res, next) => {
  try {
    const { roundId, playerId, hole, strokes } = req.body;
    if (!roundId || typeof roundId !== 'string') {
      return res.status(400).json({ error: 'roundId is required' });
    }
    if (!playerId || typeof playerId !== 'string') {
      return res.status(400).json({ error: 'playerId is required' });
    }
    const parsedHole = parseInt(hole, 10);
    if (isNaN(parsedHole) || parsedHole < 1 || parsedHole > 18) {
      return res.status(400).json({ error: 'hole must be an integer between 1 and 18' });
    }
    const parsedStrokes = parseInt(strokes, 10);
    if (isNaN(parsedStrokes) || parsedStrokes < 1) {
      return res.status(400).json({ error: 'strokes must be a positive integer' });
    }
    const score = await prisma.score.create({
      data: {
        roundId,
        playerId,
        hole: parsedHole,
        strokes: parsedStrokes,
      },
    });
    res.status(201).json(score);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/scores/:id - update a score
router.patch('/:id', async (req, res, next) => {
  try {
    const { strokes } = req.body;
    const parsedStrokes = parseInt(strokes, 10);
    if (isNaN(parsedStrokes) || parsedStrokes < 1) {
      return res.status(400).json({ error: 'strokes must be a positive integer' });
    }
    const score = await prisma.score.update({
      where: { id: req.params.id },
      data: { strokes: parsedStrokes },
    });
    res.json(score);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/scores/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.score.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
