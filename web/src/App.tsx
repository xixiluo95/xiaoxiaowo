import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { resolvePage } from './ui/registry';

export default function App() {
  const ChildHome = resolvePage('child.home');
  const DiaryPage = resolvePage('child.diary');
  const CalendarPage = resolvePage('child.calendar');
  const MePage = resolvePage('child.me');
  const ParentHome = resolvePage('parent.home');
  const ParentCalendarPage = resolvePage('parent.calendar');

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ChildHome />} />
        <Route path="/diary" element={<DiaryPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/me" element={<MePage />} />
        <Route path="/parent" element={<ParentHome />} />
        <Route path="/parent/calendar" element={<ParentCalendarPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
