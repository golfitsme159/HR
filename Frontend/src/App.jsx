import { Navigate, Route, Routes } from 'react-router-dom';
import EmployeePage from './pages/EmployeePage.jsx';
import HrPage from './pages/HrPage.jsx';
import LandingPage from './pages/LandingPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/employee" element={<EmployeePage />} />
      <Route path="/hr" element={<HrPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
