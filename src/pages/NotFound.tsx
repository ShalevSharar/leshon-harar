import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="page">
      <div className="card">
        <h1>הדף לא נמצא</h1>
        <p><Link to="/volunteer">להרשמה כמתנדבים</Link></p>
      </div>
    </div>
  );
}
