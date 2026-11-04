import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { VOLUNTEER_SOURCES } from '../config/settings';

// דף הדפסה: QR נפרד לכל מקור, כדי לדעת מאיפה הגיע כל מתנדב.
export default function VolunteerQr() {
  const [images, setImages] = useState<Record<string, string>>({});
  const base = window.location.origin;

  useEffect(() => {
    let alive = true;
    Promise.all(
      VOLUNTEER_SOURCES.map(async (s) => [
        s.value,
        await QRCode.toDataURL(`${base}/volunteer?source=${s.value}`, { width: 260, margin: 1 }),
      ] as const),
    ).then((entries) => alive && setImages(Object.fromEntries(entries)));
    return () => {
      alive = false;
    };
  }, [base]);

  return (
    <div className="page">
      {VOLUNTEER_SOURCES.map((s) => (
        <div className="card" key={s.value} style={{ marginBottom: 16, textAlign: 'center' }}>
          <h2>{s.label}</h2>
          {images[s.value] && <img src={images[s.value]} alt={`QR ${s.label}`} />}
        </div>
      ))}
    </div>
  );
}
