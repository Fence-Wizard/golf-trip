import { useState, useEffect } from 'react';
import './Leaderboard.css';

function Leaderboard() {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/scores')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load scores');
        return res.json();
      })
      .then((data) => {
        // Aggregate total strokes per player (keyed by ID to handle duplicate names)
        const totals = data.reduce((acc, score) => {
          const id = score.player?.id ?? 'unknown';
          if (!acc[id]) {
            acc[id] = { name: score.player?.name ?? 'Unknown', total: 0 };
          }
          acc[id].total += score.strokes;
          return acc;
        }, {});

        const sorted = Object.entries(totals)
          .map(([id, { name, total }]) => ({ id, name, total }))
          .sort((a, b) => a.total - b.total);

        setScores(sorted);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="status-msg">Loading leaderboard...</p>;
  if (error) return <p className="status-msg error">Error: {error}</p>;

  return (
    <div className="leaderboard-page">
      <h1>Leaderboard</h1>

      {scores.length === 0 ? (
        <p className="status-msg">No scores recorded yet.</p>
      ) : (
        <div className="leaderboard-table card">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Total Strokes</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((entry, i) => (
                <tr key={entry.id} className={i === 0 ? 'leader' : ''}>
                  <td>{i + 1}</td>
                  <td>{i === 0 ? '🏆 ' : ''}{entry.name}</td>
                  <td>{entry.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Leaderboard;
