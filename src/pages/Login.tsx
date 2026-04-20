import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { User, UserRole } from '../types';
import { login } from '../services/api';
import { auth } from '../lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { KeyRound, UserRound, ArrowLeft, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [role, setRole] = useState<UserRole>('jemaah');
  const [idValue, setIdValue] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setIdValue(q);
      setRole('jemaah');
    }
  }, [searchParams]);

  useEffect(() => {
    // Firebase Anonymous auth is restricted in some environments.
    // We rely on Firestore rules that allow read access based on the app context.
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const cleanId = idValue.trim();
    const cleanPw = password.trim();
    
    try {
      const user = await login(cleanId, role === 'jemaah' ? cleanId : cleanPw);
      if (user) {
        onLogin(user);
      } else {
        setError('Data tidak ditemukan. Silakan cek kembali Nomor Porsi/Username anda.');
      }
    } catch (err: any) {
      console.error('Login error details:', err);
      if (err.code === 'auth/unauthorized-domain' || (err.message && err.message.includes('unauthorized-domain'))) {
        setError('Domain Vercel Anda belum didaftarkan di Firebase Console. Silakan buka Firebase Console > Authentication > Settings > Authorized domains, lalu tambah domain: simarafah.vercel.app');
      } else if (err.message && err.message.includes('auth/operation-not-allowed')) {
        setError('Fitur Login belum diaktifkan di Firebase Console. Silakan aktifkan "Anonymous Auth".');
      } else if (err.message && (err.message.includes('fetch') || err.message.includes('network'))) {
        setError('Gangguan koneksi ke server data. Pastikan internet anda stabil.');
      } else {
        const detail = err.message ? `: ${err.message}` : '';
        setError('Terjadi kesalahan koneksi' + detail + '. Cek pengaturan domain di Firebase.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white flex flex-col">
      <div className="p-4">
        <button onClick={() => navigate('/')} className="p-2 -ml-2 text-neutral-400 hover:text-primary transition-colors flex items-center gap-1 font-bold text-sm">
          <ArrowLeft className="w-5 h-5" /> Kembali
        </button>
      </div>

      <div className="flex-1 px-8 py-4 space-y-10">
        <div className="text-center space-y-3">
          <div className="w-20 h-20 mx-auto flex items-center justify-center">
            <img 
              src="https://data.arafahklaten.com/logoarafah.png" 
              alt="Logo Arafah" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h2 className="text-2xl font-black text-primary tracking-tight">Masuk Sistem</h2>
            <p className="text-[13px] text-neutral-400 font-medium">SIM ARAFAH Muhammadiyah</p>
          </div>
        </div>

        <div className="flex bg-neutral-100 p-1.5 rounded-2xl">
          <button 
            onClick={() => setRole('jemaah')}
            className={cn(
              "flex-1 py-3 text-[11px] font-black uppercase rounded-xl transition-all",
              role === 'jemaah' ? "bg-white text-primary shadow-sm" : "text-neutral-400"
            )}
          >
            User Jemaah
          </button>
          <button 
            onClick={() => setRole('super_admin')}
            className={cn(
              "flex-1 py-3 text-[11px] font-black uppercase rounded-xl transition-all",
              role !== 'jemaah' ? "bg-white text-primary shadow-sm" : "text-neutral-400"
            )}
          >
            Petugas
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-primary uppercase tracking-widest ml-1">
                {role === 'jemaah' ? 'Nomor Porsi' : 'Username'}
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  value={idValue}
                  onChange={(e) => setIdValue(e.target.value)}
                  placeholder={role === 'jemaah' ? "Masukkan Nomor Porsi" : "username"}
                  className="w-full bg-white border border-neutral-200 rounded-xl py-4 flex items-center pl-12 pr-4 text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
                  required
                />
                <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300" />
              </div>
            </div>

            {role !== 'jemaah' && (
              <div className="space-y-2">
                <label className="text-[11px] font-black text-primary uppercase tracking-widest ml-1">Password</label>
                <div className="relative">
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white border border-neutral-200 rounded-xl py-4 flex items-center pl-12 pr-4 text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
                    required
                  />
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300" />
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-[11px] text-red-500 font-bold text-center bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}

          <button 
            disabled={loading}
            className="w-full bg-primary text-white rounded-xl py-4 text-[13px] font-black shadow shadow-emerald-200 hover:bg-primary-light active:scale-[0.98] transition-all disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2 uppercase tracking-widest"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Akses Sekarang'}
          </button>
        </form>

        <div className="text-center pt-4">
          <p className="text-[12px] text-neutral-400 font-medium tracking-tight">
            Calon Jemaah Haji Baru? <button onClick={() => navigate('/register')} className="text-primary font-black hover:underline">Daftar KBIHU Arafah</button>
          </p>
        </div>
      </div>
    </div>
  );
}
