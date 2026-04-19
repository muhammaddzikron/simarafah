import { HashRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
// SIM ARAFAH - Muhammadiyah Klaten (Synced with GitHub)
import { useState, useEffect } from 'react';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import Header from './components/Header';
import Footer from './components/Footer';
import { User } from './types';
import { auth } from './lib/firebase';
import { signOut, signInAnonymously } from 'firebase/auth';

import { cn } from './lib/utils';

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Simple auth check simulation
  useEffect(() => {
    const savedUser = localStorage.getItem('sim_arafah_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem('sim_arafah_user', JSON.stringify(userData));
    if (userData.role === 'jemaah') navigate('/');
    else navigate('/admin');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('sim_arafah_user');
    navigate('/');
  };

  const isAdminRoute = location.pathname.startsWith('/admin');
  const searchParams = new URLSearchParams(location.search);
  const isSubView = searchParams.has('view');
  const showHeaderFooter = true;

  return (
    <div className={cn(
      "min-h-screen bg-neutral-50 flex flex-col mx-auto transition-all w-full",
      isAdminRoute ? "max-w-none" : "md:max-w-md md:shadow-xl md:ring-1 md:ring-black/5 md:rounded-3xl md:overflow-hidden md:my-8"
    )}>
      {!isAdminRoute && showHeaderFooter && <Header user={user} />}
      <main className={cn("flex-1 overflow-y-auto", (!isAdminRoute) && "pb-20")}>
        <Routes>
          <Route path="/" element={<Home user={user} onLogout={handleLogout} />} />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin" element={user && user.role !== 'jemaah' ? <AdminDashboard user={user} onLogout={handleLogout} /> : <Login onLogin={handleLogin} />} />
        </Routes>
      </main>
      {!isAdminRoute && showHeaderFooter && <Footer user={user} />}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
