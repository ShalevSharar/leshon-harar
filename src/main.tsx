import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import VolunteerForm from './pages/VolunteerForm';
import VolunteerQr from './pages/VolunteerQr';
import NotFound from './pages/NotFound';
import AdminGate from './pages/admin/AdminGate';
import Volunteers from './pages/admin/Volunteers';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/volunteer" replace />} />
        <Route path="/volunteer" element={<VolunteerForm />} />
        <Route path="/volunteer/qr" element={<VolunteerQr />} />
        <Route path="/admin" element={<AdminGate><Volunteers /></AdminGate>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
