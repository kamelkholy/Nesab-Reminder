import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Wallet, Calculator, Settings, Moon } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/assets', label: 'My Assets', icon: Wallet },
  { path: '/zakat', label: 'Zakat', icon: Calculator },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>
          <Moon size={22} />
          <span>Nesab Reminder</span>
        </h1>
        <p>Zakat Calculator & Tracker</p>
      </div>
      <ul className="nav-items">
        {navItems.map((item) => (
          <li
            key={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
