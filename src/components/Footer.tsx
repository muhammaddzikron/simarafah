import { Home, LogIn, UserPlus, ShieldCheck, HelpCircle } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { User } from '../types';
import { cn } from '../lib/utils';

export default function Footer({ user }: { user: User | null }) {
  const navigate = useNavigate();
  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full bg-white border-t border-neutral-100 flex justify-around items-center h-[65px] z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] md:max-w-md md:left-1/2 md:-translate-x-1/2 md:rounded-t-[32px]">
      <NavLink 
        to="/" 
        className={({ isActive }) => cn(
          "flex-1 flex flex-col items-center justify-center gap-1 transition-all h-full",
          isActive ? "text-primary border-t-2 border-primary" : "text-neutral-400"
        )}
      >
        <Home className={cn("w-5 h-5", !user && "w-6 h-6")} />
        <span className="text-[10px] font-black uppercase tracking-widest">Home</span>
      </NavLink>

      <NavLink 
        to="/register" 
        className={({ isActive }) => cn(
          "flex-1 flex flex-col items-center justify-center gap-1 transition-all h-full",
          isActive ? "text-primary border-t-2 border-primary" : "text-neutral-400"
        )}
      >
        <UserPlus className="w-5 h-5" />
        <span className="text-[10px] font-black uppercase tracking-widest">Daftar</span>
      </NavLink>

      {!user ? (
        <>
          <NavLink 
            to="/login" 
            className={({ isActive }) => cn(
              "flex-1 flex flex-col items-center justify-center gap-1 transition-all h-full",
              isActive ? "text-primary border-t-2 border-primary" : "text-neutral-400"
            )}
          >
            <LogIn className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Login</span>
          </NavLink>
          <button 
            onClick={() => navigate('/?view=kontak')}
            className="flex-1 flex flex-col items-center justify-center gap-1 text-neutral-400 hover:text-primary transition-all h-full"
          >
            <HelpCircle className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Bantuan</span>
          </button>
        </>
      ) : (
        <>
          <NavLink 
            to={user.role === 'jemaah' ? '/' : '/admin'} 
            className={({ isActive }) => cn(
              "flex-1 flex flex-col items-center justify-center gap-1 transition-all h-full",
              isActive ? "text-primary border-t-2 border-primary" : "text-neutral-400"
            )}
          >
            <ShieldCheck className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Dasbor</span>
          </NavLink>
          <button 
            onClick={() => {
              navigate('/?view=kontak');
            }}
            className="flex-1 flex flex-col items-center justify-center gap-1 text-neutral-400 hover:text-primary transition-all h-full"
          >
            <HelpCircle className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Bantuan</span>
          </button>
        </>
      )}
    </nav>
  );
}
