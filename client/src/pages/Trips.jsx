import { useState, useEffect } from 'react';
import TripCard from '../components/TripCard';
import './Trips.css';

function Trips() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/trips')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load trips');
        return res.json();
      })
      .then((data) => {
        setTrips(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="status-msg">Loading trips...</p>;
  if (error) return <p className="status-msg error">Error: {error}</p>;

  return (
    <div className="trips-page">
      <div className="trips-header">
        <h1>Trips</h1>
      </div>

      {trips.length === 0 ? (
        <p className="status-msg">No trips yet. Create your first trip!</p>
      ) : (
        <div className="trips-grid">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  );
}

export default Trips;
