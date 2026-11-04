import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import VolunteerForm from './pages/VolunteerForm';
import VolunteerQr from './pages/VolunteerQr';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/volunteer" element={<VolunteerForm />} />
        <Route path="/volunteer/qr" element={<VolunteerQr />} />
        <Route path="*" element={<VolunteerForm />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
