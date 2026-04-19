import { Building2, Search, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { User } from '../types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export default function Header({ user }: { user: User | null }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="bg-primary text-white pt-6 pb-6 px-6 shadow-xl sticky top-0 z-50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 overflow-hidden">
            <img 
              src="https://data.arafahklaten.com/logoarafah.png" 
              alt="Logo Arafah" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-widest font-display">SIM ARAFAH</h1>
            <p className="text-[10px] text-emerald-100/80 font-medium">Sistem Informasi Manajemen KBIHU Arafah</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-bold text-emerald-200">{format(time, 'EEEE, d MMM yyyy', { locale: id })}</div>
          <div className="text-[14px] font-black text-white">{format(time, 'HH:mm')} WIB</div>
        </div>
      </div>

    </header>
  );
}
