import { NavLink, Outlet } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const ITEMS = [
  { to: '/admin/dashboard', label: 'דשבורד', icon: '◉' },
  { to: '/admin/schools', label: 'בתי ספר', icon: '▦' },
  { to: '/admin/lectures', label: 'הרצאות', icon: '✎' },
  { to: '/admin/requests', label: 'בקשות', icon: '✉' },
  { to: '/admin/volunteers', label: 'מתנדבים', icon: '♥' },
];

// מעטפת הניהול: סרגל צד במחשב, סרגל תחתון בטלפון.
export default function AdminLayout() {
  return (
    <div className="app">
      <aside className="sidebar" aria-label="ניווט">
        <div className="brand">לשון הרע לא מדבר אליי</div>
        <nav className="sidenav">
          {ITEMS.map((i) => (
            <NavLink key={i.to} to={i.to} className="navlink">
              <span className="ico" aria-hidden="true">{i.icon}</span>{i.label}
            </NavLink>
          ))}
        </nav>
        <button type="button" className="secondary logout" onClick={() => supabase?.auth.signOut()}>יציאה</button>
      </aside>

      <main className="main">
        <Outlet />
      </main>

      <nav className="bottomnav" aria-label="ניווט מהיר">
        {ITEMS.map((i) => (
          <NavLink key={i.to} to={i.to} className="navlink">
            <span className="ico" aria-hidden="true">{i.icon}</span>{i.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
