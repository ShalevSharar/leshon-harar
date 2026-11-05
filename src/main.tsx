import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import VolunteerForm from './pages/VolunteerForm';
import VolunteerQr from './pages/VolunteerQr';
import NotFound from './pages/NotFound';
import Survey from './pages/Survey';
// import AdminGate from './pages/admin/AdminGate'; // זמני
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import Lectures from './pages/admin/Lectures';
import LectureResults from './pages/admin/LectureResults';
import Schools from './pages/admin/Schools';
import SchoolCard from './pages/admin/SchoolCard';
import LectureRequests from './pages/admin/LectureRequests';
import Volunteers from './pages/admin/Volunteers';
import './styles.css';
import { initTheme } from './lib/theme';

initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/volunteer" replace />} />
        <Route path="/volunteer" element={<VolunteerForm />} />
        <Route path="/volunteer/qr" element={<VolunteerQr />} />
        <Route path="/survey/:token" element={<Survey />} />
        {/* זמני: בלי כניסה לתצוגה. להחזיר AdminGate לפני שמכניסים נתונים אמיתיים */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="lectures" element={<Lectures />} />
          <Route path="lectures/:id" element={<LectureResults />} />
          <Route path="schools" element={<Schools />} />
          <Route path="schools/:id" element={<SchoolCard />} />
          <Route path="requests" element={<LectureRequests />} />
          <Route path="volunteers" element={<Volunteers />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
