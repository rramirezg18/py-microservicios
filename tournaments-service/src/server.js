const express = require('express');
const cors = require('cors');

const { tournaments } = require('./data/tournaments');
const { buildView, buildSummary } = require('./utils/bracket');

const app = express();
const PORT = process.env.PORT || 8083;

app.use(cors());
app.use(express.json());

function findTournament(id) {
  return tournaments.find((tournament) => tournament.id === id);
}

app.get('/api/ping', (req, res) => {
  res.json({ message: 'Tournaments Service API is running 🏆' });
});

app.get('/api/tournaments', (req, res) => {
  const summaries = tournaments.map((state) => buildSummary(buildView(state)));
  res.json(summaries);
});

app.get('/api/tournaments/:id', (req, res) => {
  const tournament = findTournament(req.params.id);

  if (!tournament) {
    return res.status(404).json({ message: 'Tournament not found' });
  }

  res.json(buildView(tournament));
});

app.put('/api/tournaments/:id/matches/:matchId', (req, res) => {
  const tournament = findTournament(req.params.id);

  if (!tournament) {
    return res.status(404).json({ message: 'Tournament not found' });
  }

  const match = tournament.matches.find((item) => item.id === req.params.matchId);

  if (!match) {
    return res.status(404).json({ message: 'Match not found' });
  }

  const { scoreA, scoreB, status } = req.body ?? {};

  if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) {
    return res.status(400).json({ message: 'Both scoreA and scoreB must be numeric values' });
  }

  match.scoreA = Number(scoreA);
  match.scoreB = Number(scoreB);

  if (status === 'scheduled' || status === 'live' || status === 'finished') {
    match.status = status;
  } else {
    match.status = 'finished';
  }

  tournament.updatedAtUtc = new Date().toISOString();

  const view = buildView(tournament);
  res.json(view);
});

app.listen(PORT, () => {
  console.log(`Tournaments service listening on port ${PORT}`);
});
