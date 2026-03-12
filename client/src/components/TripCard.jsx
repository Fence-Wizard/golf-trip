import './TripCard.css';

function TripCard({ trip }) {
  const start = new Date(trip.startDate).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const end = new Date(trip.endDate).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="trip-card card">
      <h3 className="trip-card__name">{trip.name}</h3>
      <p className="trip-card__location">📍 {trip.location}</p>
      <p className="trip-card__dates">📅 {start} – {end}</p>
      <div className="trip-card__stats">
        <span>{trip.players?.length ?? 0} players</span>
        <span>{trip.rounds?.length ?? 0} rounds</span>
      </div>
    </div>
  );
}

export default TripCard;
