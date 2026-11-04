import { NavLink, Outlet } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

// מעטפת הניהול: ניווט ויציאה. מוצג רק אחרי התחברות (ראו AdminGate).
export default function AdminLayout() {
  return (
    <div className="page wide">
      <nav className="toolbar" aria-label="ניווט ניהול">
        <NavLink to="/admin/dashboard" className="navlink">דשבורד</NavLink>
        <NavLink to="/admin/schools" className="navlink">בתי ספר</NavLink>
        <NavLink to="/admin/lectures" className="navlink">הרצאות</NavLink>
        <NavLink to="/admin/requests" className="navlink">בקשות להרצאה</NavLink>
        <NavLink to="/admin/volunteers" className="navlink">מתנדבים</NavLink>
        <button type="button" className="secondary" onClick={() => supabase?.auth.signOut()}>יציאה</button>
      </nav>
      <Outlet />
    </div>
  );
}
