import { Link } from 'react-router-dom';
import './Home.css';

function Home() {
  return (
    <div className="home">
      <section className="home-hero">
        <h1>Welcome to Golf Trip</h1>
        <p>Plan your golf getaway, track scores, and see who reigns supreme on the leaderboard.</p>
        <div className="home-hero__actions">
          <Link to="/trips" className="btn btn-primary">View Trips</Link>
          <Link to="/leaderboard" className="btn btn-secondary">Leaderboard</Link>
        </div>
      </section>

      <section className="home-features">
        <div className="feature-card card">
          <span className="feature-icon">🗺️</span>
          <h3>Plan Trips</h3>
          <p>Organise multi-day golf trips with courses, dates, and your group.</p>
        </div>
        <div className="feature-card card">
          <span className="feature-icon">🏌️</span>
          <h3>Track Players</h3>
          <p>Manage player profiles, handicaps, and participation across trips.</p>
        </div>
        <div className="feature-card card">
          <span className="feature-icon">📊</span>
          <h3>Score Tracking</h3>
          <p>Record hole-by-hole scores and automatically calculate standings.</p>
        </div>
      </section>
    </div>
  );
}

export default Home;
