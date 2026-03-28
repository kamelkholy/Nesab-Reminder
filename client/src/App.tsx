import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import ZakatPage from './pages/ZakatPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import { verifyToken } from './services/api';

export default function App() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setAuthenticated(false);
      return;
    }
    verifyToken().then((valid) => setAuthenticated(valid));
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setAuthenticated(false);
  };

  if (authenticated === null) {
    return <div className="login-page"><p>Loading...</p></div>;
  }

  if (!authenticated) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage onLogin={() => setAuthenticated(true)} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <div className="app">
        <Sidebar onLogout={handleLogout} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard showToast={showToast} />} />
            <Route path="/assets" element={<Assets showToast={showToast} />} />
            <Route path="/zakat" element={<ZakatPage showToast={showToast} />} />
            <Route path="/settings" element={<SettingsPage showToast={showToast} />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        {toast && (
          <div className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        )}
      </div>
    </BrowserRouter>
  );
}
