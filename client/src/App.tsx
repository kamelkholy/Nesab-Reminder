import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import ZakatPage from './pages/ZakatPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <BrowserRouter>
      <div className="app">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard showToast={showToast} />} />
            <Route path="/assets" element={<Assets showToast={showToast} />} />
            <Route path="/zakat" element={<ZakatPage showToast={showToast} />} />
            <Route path="/settings" element={<SettingsPage showToast={showToast} />} />
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
