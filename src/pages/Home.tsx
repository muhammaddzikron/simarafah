import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo, cloneElement, ReactElement, ReactNode } from 'react';
import { 
  UserCircle, Video, Calendar, BookOpen, 
  Share2, Contact, ChevronRight, MapPin,
  Clock, Languages, Volume2, RefreshCw,
  Banknote, ArrowRightLeft, TrendingUp,
  X, Download, ExternalLink, Heart, Play, FileText,
  Smartphone, Youtube, Map as MapIcon, Instagram,
  CheckCircle2, Search, ArrowLeft, ChevronLeft, LogOut,
  Building2, UserPlus, Loader2, AlertCircle, Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Jemaah, AdminContent, MateriItem } from '../types';
import { GoogleGenAI } from "@google/genai";
import { fetchJemaah, getAdminContent, defaultAdminContent } from '../services/api';
import { cn } from '../lib/utils';
import { Phone } from 'lucide-react';
import { db, dbDefault } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const DetailItem = ({ label, value }: { label: string, value: any }) => {
  const isPositive = typeof value === 'string' && (value.toUpperCase().includes('YA') || value.toUpperCase().includes('AWAL') || value.toUpperCase().includes('1'));
  return (
    <div className="flex flex-col p-3 bg-neutral-50/50 rounded-2xl border border-neutral-100">
      <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest mb-1 italic leading-none">{label}</span>
      <span className={cn(
        "text-[10px] font-black uppercase tracking-tight",
        isPositive ? "text-emerald-600" : "text-neutral-700"
      )}>{value || '-'}</span>
    </div>
  );
};

const HealthBadge = ({ label, active }: { label: string, active: boolean }) => (
  <div className={cn(
    "flex items-center gap-2 px-4 py-3 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all shadow-sm",
    active 
      ? "bg-rose-50 border-rose-100 text-rose-600" 
      : "bg-neutral-50 border-neutral-100 text-neutral-400 opacity-60"
  )}>
    <div className={cn("w-2 h-2 rounded-full", active ? "bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.5)]" : "bg-neutral-300")} />
    {label}
  </div>
);

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    return new GoogleGenAI({ apiKey });
  } catch (e) {
    console.error("Failed to initialize Gemini AI:", e);
    return null;
  }
};

const menuItems = [
  { emoji: '🕋', label: 'Profil KBIHU', id: 'profil' },
  { emoji: '👤', label: 'Data Pribadi', id: 'data_pribadi' },
  { emoji: '📅', label: 'Jadwal Kegiatan', id: 'agenda' },
  { emoji: '📖', label: 'Materi & Doa', id: 'materi' },
  { emoji: '🧳', label: 'Ceklist Perbekalan', id: 'checklist' },
  { emoji: '💰', label: 'Info Keuangan', id: 'payments' },
  { emoji: '🎞️', label: 'Galeri Video', id: 'galeri' },
  { emoji: '📞', label: 'Kontak Kami', id: 'kontak' },
];

const prayerTimesIndo = [
  { name: 'Subuh', time: '04:29' },
  { name: 'Zuhur', time: '11:36' },
  { name: 'Ashar', time: '14:58' },
  { name: 'Maghrib', time: '17:33' },
  { name: 'Isya', time: '18:44' },
];

const prayerTimesSaudi = [
  { name: 'Subuh', time: '04:39' },
  { name: 'Zuhur', time: '12:20' },
  { name: 'Ashar', time: '15:42' },
  { name: 'Maghrib', time: '18:42' },
  { name: 'Isya', time: '20:12' },
];

export default function Home({ user, onLogout }: { user: User | null, onLogout?: () => void }) {
  const navigate = useNavigate();
  const ai = useMemo(() => getAI(), []);
  const [content, setContent] = useState<AdminContent>(defaultAdminContent);
  const [jemaah, setJemaah] = useState<Jemaah[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = searchParams.get('view');
  
  const setActiveView = (view: string | null) => {
    if (view) {
      setSearchParams({ view });
    } else {
      setSearchParams({});
    }
  };
  const [materiTab, setMateriTab] = useState<'all' | 'doa' | 'teks' | 'video' | 'download'>('all');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [dbStatus, setDbStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchQuery(q);
  }, [searchParams]);

  useEffect(() => {
    async function load() {
      setDbStatus('loading');
      try {
        // Run sequentially for better resilience against partial quota errors
        try {
          const data = await getAdminContent();
          if (data) setContent(data);
        } catch (e) {
          console.error("Home: Content load failed", e);
        }

        try {
          const dataJ = await fetchJemaah();
          setJemaah(dataJ || []);
        } catch (e) {
          console.error("Home: Jemaah load failed", e);
        }
        
        setDbStatus('ok');
      } catch (err) {
        console.error("Critical error in Home load:", err);
        setDbStatus('error');
      }
    }
    load();
  }, []);
  
  // Translation State
  const [transInput, setTransInput] = useState('');
  const [transOutput, setTransOutput] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [sourceLang, setSourceLang] = useState('Indonesia');
  const [targetLang, setTargetLang] = useState('Arab');
  
  // Currency State
  const [idrAmount, setIdrAmount] = useState<string>('');
  const [isRupiahBase, setIsRupiahBase] = useState(true);

  // Quran States
  const [surahs, setSurahs] = useState<any[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<number | null>(null);
  const [surahDetail, setSurahDetail] = useState<any>(null);
  const [loadingSurah, setLoadingSurah] = useState(false);
  const [quranSearch, setQuranSearch] = useState('');
  const [quranView, setQuranView] = useState<'list' | 'detail'>('list');

  useEffect(() => {
    fetchSurahs();
  }, []);

  const fetchSurahs = async () => {
    try {
      const resp = await fetch('https://equran.id/api/v2/surat');
      const json = await resp.json();
      if (json.code === 200) {
        setSurahs(json.data);
      }
    } catch (err) {
      console.error("Error fetching surahs:", err);
    }
  };

  const handleSelectSurah = async (nomor: number) => {
    try {
      setLoadingSurah(true);
      setQuranView('detail');
      setSelectedSurah(nomor);
      const resp = await fetch(`https://equran.id/api/v2/surat/${nomor}`);
      const json = await resp.json();
      if (json.code === 200) {
        setSurahDetail(json.data);
      }
    } catch (err) {
      console.error("Error fetching surah detail:", err);
    } finally {
      setLoadingSurah(false);
    }
  };

  const filteredSurahs = useMemo(() => {
    if (!quranSearch) return surahs;
    return surahs.filter(s => 
      s.namaLatin.toLowerCase().includes(quranSearch.toLowerCase()) || 
      s.nomor.toString().includes(quranSearch)
    );
  }, [surahs, quranSearch]);
  const [userChecklist, setUserChecklist] = useState<Record<string, boolean>>({});
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'error' | 'quota-exceeded' | null>(null);
  const skipSyncRef = useRef(false);

  useEffect(() => {
    if (user?.role === 'jemaah' && user.porsi) {
      setLoadingChecklist(true);
      const loadChecklist = async () => {
        try {
          const docRef = doc(db, 'checklists', user.porsi!);
          let docSnap;
          try {
            docSnap = await getDoc(docRef);
          } catch (fetchError: any) {
            if (fetchError.code === 'resource-exhausted') {
               setSyncStatus('quota-exceeded');
            }
            if (fetchError.message?.includes('client is offline')) {
              console.warn("Firestore is offline, trying to load from cache...");
            } else {
              throw fetchError;
            }
          }
          
          if (docSnap && !docSnap.exists()) {
            try {
              const legacyRef = doc(dbDefault, 'checklists', user.porsi!);
              const legacySnap = await getDoc(legacyRef);
              if (legacySnap.exists()) {
                  docSnap = legacySnap;
                  console.log("Checklist recovered from legacy (default) database.");
              }
            } catch (legacyError) {
              console.warn("Legacy checklist fetch skipped due to connectivity.");
            }
          }

          if (docSnap && docSnap.exists()) {
            skipSyncRef.current = true; // Prevents triggering save effect immediately
            setUserChecklist(docSnap.data().checkedItems || {});
          }
        } catch (e) {
          console.error("Error loading checklist:", e);
        } finally {
          setLoadingChecklist(false);
        }
      };
      loadChecklist();
    }
  }, [user]);

  // Debounced Checklist Save
  useEffect(() => {
    if (!user?.porsi || Object.keys(userChecklist).length === 0) return;
    
    // If this change was from initial load, skip saving
    if (skipSyncRef.current) {
        skipSyncRef.current = false;
        setSyncStatus('synced');
        return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setSyncStatus('saving');
        await setDoc(doc(db, 'checklists', user.porsi!), {
          porsi: user.porsi,
          checkedItems: userChecklist,
          updatedAt: serverTimestamp()
        }, { merge: true });
        console.log("Checklist synced to cloud");
        setSyncStatus('synced');
      } catch (e: any) {
        if (e?.code === 'resource-exhausted' || (e?.message && e.message.includes('Quota'))) {
          console.warn("Cloud quota exceeded, checklist saved locally only.");
          setSyncStatus('quota-exceeded');
        } else {
          console.error("Error saving checklist:", e);
          setSyncStatus('error');
        }
      }
    }, 2000); // Wait 2 seconds of inactivity before saving

    return () => clearTimeout(timeoutId);
  }, [userChecklist, user?.porsi]);

  const toggleChecklistItem = (itemName: string) => {
    if (!user?.porsi) return;
    const newChecklist = { ...userChecklist, [itemName]: !userChecklist[itemName] };
    setUserChecklist(newChecklist);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Translation Debounce Effect
  useEffect(() => {
    if (!transInput.trim()) {
      setTransOutput('');
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsTranslating(true);
      try {
        if (!ai) throw new Error("AI not initialized (missing API key)");
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Terjemahkan teks berikut dari Bahasa ${sourceLang} ke Bahasa ${targetLang}. Cukup berikan hasil terjemahannya saja tanpa penjelasan tambahan: "${transInput}"`,
        });
        setTransOutput(response.text || '');
      } catch (error) {
        console.error('Translation error:', error);
      } finally {
        setIsTranslating(false);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [transInput, sourceLang, targetLang]);

  const handleSwapTranslation = () => {
    const temp = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(temp);
    setTransInput(transOutput);
    setTransOutput(transInput);
  };

  const handleSpeak = (text: string, lang: string) => {
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'Arab' ? 'ar-SA' : 'id-ID';
    window.speechSynthesis.speak(utterance);
  };

  const formatTime = (date: Date, offsetHours = 0) => {
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const newDate = new Date(utc + (3600000 * offsetHours));
    return newDate.toLocaleTimeString('en-GB', { hour12: false });
  };

  const formatWA = (num: string) => {
    const clean = num.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) return '62' + clean.slice(1);
    if (clean.startsWith('8')) return '62' + clean;
    return clean;
  };

  const indoTimeStr = formatTime(currentTime, 7);
  const saudiTimeStr = formatTime(currentTime, 3);
  const optionsCust: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const dateStr = currentTime.toLocaleDateString('id-ID', optionsCust).replace('Minggu', 'Ahad');

  // Simple Hijri Calculation for Zulkaidah 1447 H (KHGT Muhammadiyah)
  const getHijriDate = (date: Date) => {
    // Today 2026-04-19 is 2 Zulkaidah 1447 H
    const refDate = new Date(2026, 3, 19); 
    const diffDays = Math.floor((date.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
    let day = 2 + diffDays;
    let month = "Zulkaidah";
    let year = 1447;
    
    if (day > 30) {
      day -= 30;
      month = "Zulhijah";
    } else if (day <= 0) {
      day += 29; // Syawal has 29 days in 1447
      month = "Syawal";
    }
    return `${day} ${month} ${year} H`;
  };

  // Currency Logic
  const SAR_RATE = 0.000219;
  const USD_RATE = 0.000058;
  const numValue = parseFloat(idrAmount.replace(/[^\d-]/g, "")) || 0;
  
  const resultSAR = isRupiahBase ? numValue * SAR_RATE : numValue / SAR_RATE;
  const resultUSD = isRupiahBase ? numValue * USD_RATE : numValue / USD_RATE;

  const kontakPetugas = useMemo(() => {
    const uniqueKaromsMap = new Map<string, { nama: string; wa: string; kloter: string; rombongan: string }>();
    jemaah.forEach(j => {
      if (j.namaKetuaRombongan && !uniqueKaromsMap.has(j.namaKetuaRombongan)) {
        uniqueKaromsMap.set(j.namaKetuaRombongan, {
          nama: j.namaKetuaRombongan,
          wa: j.waKarom,
          kloter: j.kloter,
          rombongan: j.rombongan
        });
      }
    });
    return Array.from(uniqueKaromsMap.values());
  }, [jemaah]);

  const currentUserData = useMemo(() => {
    if (!user || user.role !== 'jemaah') return null;
    const userPorsi = user.porsi?.trim();
    if (!userPorsi) return null;
    
    const toDigits = (v: string) => v.replace(/\D/g, '');
    const userPorsiDigits = toDigits(userPorsi);

    return jemaah.find(j => {
      const dbPorsi = j.nomorPorsi?.trim() || '';
      return dbPorsi === userPorsi || (userPorsiDigits.length > 5 && toDigits(dbPorsi) === userPorsiDigits);
    });
  }, [jemaah, user]);

  const dynamicChecklistItems = useMemo(() => {
    if (!content?.ceklistTemplates) return [];
    
    const { pria, wanita, tambahan } = content.ceklistTemplates;
    const jk = currentUserData?.jenisKelamin?.toLowerCase() || '';
    const isMale = jk.includes('laki') || jk.includes('pria') || jk === 'l';
    
    const genderList = isMale ? (pria || '') : (wanita || '');
    const combined = `${genderList}\n${tambahan || ''}`;
    
    return combined
      .split('\n')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }, [content?.ceklistTemplates, currentUserData?.jenisKelamin]);

  const checklistCompletion = useMemo(() => {
    if (!dynamicChecklistItems || dynamicChecklistItems.length === 0) return 0;
    const checkedCount = dynamicChecklistItems.filter(item => userChecklist[item]).length;
    return Math.round((checkedCount / dynamicChecklistItems.length) * 100);
  }, [dynamicChecklistItems, userChecklist]);

  const userPayments = useMemo(() => {
    if (!content?.pembayaran) return [];
    if (!currentUserData) return content.pembayaran;

    return content.pembayaran.map(p => {
      let dibayar = p.dibayar;
      const cleanNum = (v: any) => {
        if (typeof v === 'number') return v;
        if (!v) return 0;
        const s = String(v).trim();
        // Remove all non-numeric characters EXCEPT the negative sign
        // This handles "5.875.000", "5,875,000", and "Rp 5.875.000"
        return parseFloat(s.replace(/[^\d-]/g, "")) || 0;
      };

      if (p.jenis.toLowerCase().includes('pendaftaran')) {
        dibayar = cleanNum(currentUserData.bayarArafah);
      } else if (p.jenis.toLowerCase().includes('dam') || p.jenis.toLowerCase().includes('tarwiyah')) {
        dibayar = cleanNum(currentUserData.bayarLainnya);
      }
      return { ...p, dibayar };
    });
  }, [content?.pembayaran, currentUserData]);

  const searchResults = useMemo(() => {
    if (searchQuery.length < 2) return [];
    const query = searchQuery.toLowerCase();
    
    // Search Jemaah
    const jemaahMatches = jemaah.filter(j => 
      j.namaLengkap.toLowerCase().includes(query) || 
      j.nomorPorsi?.toLowerCase().includes(query) ||
      j.no?.toLowerCase().includes(query) ||
      j.kloter?.toLowerCase().includes(query) ||
      j.rombongan?.toLowerCase().includes(query) ||
      j.alamat?.toLowerCase().includes(query) ||
      j.desa?.toLowerCase().includes(query) ||
      j.kecamatan?.toLowerCase().includes(query)
    ).map(j => ({ ...j, searchType: 'jemaah' as const }));

    // Search Materi
    const materiMatches = (content?.materi || []).filter(m => 
      m.judul.toLowerCase().includes(query) ||
      m.isi?.terjemahan?.toLowerCase().includes(query) ||
      m.isi?.latin?.toLowerCase().includes(query) ||
      m.isi?.konten?.toLowerCase().includes(query) ||
      m.tipe.toLowerCase().includes(query)
    ).map(m => ({ ...m, searchType: 'materi' as const }));

    // Combine and limit
    return [...jemaahMatches, ...materiMatches].slice(0, 8);
  }, [jemaah, content, searchQuery]);

  // Sub-view component for consistent styling
  const ViewHeader = ({ title, icon }: { title: string, icon: ReactNode }) => (
    <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-100">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setActiveView(null)}
          className="p-2.5 bg-white border border-neutral-100 rounded-2xl text-neutral-400 hover:text-primary active:scale-95 transition-all shadow-sm"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/5 text-primary rounded-xl flex items-center justify-center">
            {icon}
          </div>
          <h2 className="text-lg font-black text-neutral-800 uppercase tracking-tight">{title}</h2>
        </div>
      </div>
    </div>
  );

  const DataItem = ({ label, value }: { label: string, value?: string }) => (
    <div className="space-y-1">
      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{label}</p>
      <p className="text-[13px] font-bold text-neutral-800 leading-tight">{value || '-'}</p>
    </div>
  );

  const StatusItem = ({ label, status }: { label: string, status?: string }) => {
    const isYa = status?.toUpperCase().includes('YA');
    return (
      <div className="flex items-center justify-between bg-neutral-50/50 px-4 py-3 rounded-xl border border-neutral-100">
        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{label}</span>
        <span className={cn(
          "text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-tighter",
          isYa ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-neutral-100 text-neutral-400"
        )}>
          {isYa ? 'Ya' : 'Tidak'}
        </span>
      </div>
    );
  };

  if (activeView) {
    return (
      <div className="bg-white">
        <div className="px-5 py-6 max-w-md mx-auto">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-6"
        >
          {activeView === 'data_pribadi' && currentUserData && (
            <>
              <ViewHeader title="Data Pribadi" icon={<UserCircle className="w-5 h-5" />} />
              <div className="space-y-6">
                {/* Header Information Box */}
                <div className="bg-primary rounded-[32px] p-8 text-white shadow-xl shadow-emerald-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                  <div className="relative">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-black">
                        {currentUserData.no || '0'}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Jemaah ARAFAH</p>
                        <h3 className="text-xl font-black uppercase tracking-tight leading-tight">{currentUserData.namaLengkap}</h3>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/20">
                        <p className="text-[8px] font-black uppercase tracking-widest opacity-60 mb-0.5">Nomor Porsi</p>
                        <p className="text-sm font-black tracking-tight">{currentUserData.nomorPorsi || '-'}</p>
                      </div>
                      <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/20">
                        <p className="text-[8px] font-black uppercase tracking-widest opacity-60 mb-0.5">Kloter / Romb</p>
                        <p className="text-sm font-black tracking-tight">{currentUserData.kloter || '-'} / {currentUserData.rombongan || '-'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Data Content */}
                <div className="bg-white rounded-[32px] border border-neutral-100 shadow-sm overflow-hidden divide-y divide-neutral-50">
                  {/* Keberangkatan */}
                  <div className="p-6 space-y-5">
                    <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">Informasi Keberangkatan</h4>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                      <DataItem label="Masuk Asrama" value={currentUserData.jadwalMasukAsrama} />
                      <DataItem label="Umur" value={`${currentUserData.umur} Tahun`} />
                      <DataItem label="Jenis Kelamin" value={currentUserData.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'} />
                      <DataItem label="Nafar" value={currentUserData.nafar} />
                    </div>
                  </div>

                  {/* Penanggung Jawab / Karom */}
                  <div className="p-6 space-y-5">
                    <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">Ketua Rombongan (Karom)</h4>
                    <div className="bg-neutral-50 rounded-2xl p-5 border border-neutral-100 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-neutral-800">{currentUserData.namaKetuaRombongan || '-'}</p>
                        <p className="text-[10px] font-medium text-neutral-400 mt-1">{(currentUserData.waKarom || '-').replace(/[^0-9]/g, '')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <a href={`https://wa.me/${formatWA(currentUserData.waKarom || '')}`} target="_blank" className="p-2.5 bg-white text-emerald-600 rounded-xl shadow-sm border border-emerald-100 active:scale-95 transition-all">
                          <Smartphone className="w-3.5 h-3.5" />
                        </a>
                        <a href={`tel:${(currentUserData.waKarom || '').replace(/[^0-9]/g, '')}`} className="p-2.5 bg-white text-blue-600 rounded-xl shadow-sm border border-blue-100 active:scale-95 transition-all">
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Dokumen & Identitas */}
                  <div className="p-6 space-y-5">
                    <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">Dokumen & Identitas</h4>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                      <DataItem label="Nomor Paspor" value={currentUserData.paspor} />
                      <DataItem label="Nomor Visa" value={currentUserData.visa} />
                      <div className="col-span-2">
                        <DataItem label="Alamat Lengkap" value={`${currentUserData.alamat}, Desa ${currentUserData.desa}, Kec. ${currentUserData.kecamatan}, ${currentUserData.kabupaten}`} />
                      </div>
                      <DataItem label="Nomor WhatsApp" value={currentUserData.wa} />
                    </div>
                  </div>

                  {/* Status & Layanan Khusus */}
                  <div className="p-6 space-y-5">
                    <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">Layanan & Kondisi Khusus</h4>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      <StatusItem label="Tanazul" status={currentUserData.tanazul} />
                      <StatusItem label="Murur" status={currentUserData.murur} />
                      <StatusItem label="Badal" status={currentUserData.badal} />
                      <StatusItem label="Kursi Roda" status={currentUserData.kursiRoda} />
                      <StatusItem label="Tongkat" status={currentUserData.tongkat} />
                      <StatusItem label="Pen Tubuh" status={currentUserData.penTubuh} />
                      <StatusItem label="Ring Jantung" status={currentUserData.ringJantung} />
                      <DataItem label="Jalur DAM" value={currentUserData.jalurDam} />
                      <DataItem label="Umrah Gel" value={currentUserData.umrahGelombang} />
                    </div>
                  </div>

                  {/* Pendamping Lansia */}
                  {currentUserData.pendampingLansia && (
                    <div className="p-6 bg-indigo-50/30">
                      <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">Pendamping Lansia</h4>
                      <div className="bg-white rounded-2xl p-5 border border-indigo-100 flex items-center justify-between shadow-sm">
                        <div>
                          <p className="text-sm font-bold text-indigo-900">{currentUserData.pendampingLansia}</p>
                          <p className="text-[10px] font-medium text-indigo-400 mt-1">{currentUserData.waPendamping || '-'}</p>
                        </div>
                        {currentUserData.waPendamping && (
                          <div className="flex items-center gap-2">
                            <a href={`https://wa.me/${formatWA(currentUserData.waPendamping)}`} target="_blank" className="p-2.5 bg-white text-emerald-600 rounded-xl shadow-sm border border-emerald-100 active:scale-95 transition-all">
                              <Smartphone className="w-3.5 h-3.5" />
                            </a>
                            <a href={`tel:${currentUserData.waPendamping.replace(/[^0-9]/g, '')}`} className="p-2.5 bg-white text-blue-600 rounded-xl shadow-sm border border-blue-100 active:scale-95 transition-all">
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Hotel Information */}
                  <div className="p-6 space-y-5 bg-emerald-50/20">
                    <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">Akomodasi Makkah</h4>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm border border-neutral-100">
                          <Building2 className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-neutral-800 leading-tight">{currentUserData.hotelMekah || 'Menunggu Update'}</p>
                          <p className="text-[10px] font-medium text-neutral-400 mt-0.5">Hotel Penempatan Resmi</p>
                        </div>
                      </div>
                      {currentUserData.linkPetaHotel && (
                        <a 
                          href={currentUserData.linkPetaHotel} 
                          target="_blank" 
                          className="flex items-center justify-center gap-3 w-full py-4 bg-primary text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100 transition-all active:scale-95"
                        >
                          <MapPin className="w-4 h-4" /> Buka Peta Hotel (GPS)
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeView === 'data_pribadi_full' && currentUserData && (
            <>
              <ViewHeader title="Data Pribadi Saya" icon={<UserCircle className="w-5 h-5" />} />
              <div className="space-y-6">
                {/* Special Header Box: Nama Lengkap */}
                <div className="bg-emerald-600 rounded-[32px] p-8 text-center relative overflow-hidden shadow-xl shadow-emerald-100">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <UserCircle className="w-24 h-24 text-white" />
                  </div>
                  <div className="relative z-10 space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-[9px] font-black text-white uppercase tracking-widest italic border border-white/10">
                      IDENTITAS JEMAAH HAJI
                    </div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight italic drop-shadow-md">
                      {currentUserData.namaLengkap}
                    </h3>
                    <p className="text-[10px] font-bold text-emerald-200 tracking-[0.2em] uppercase">No. Porsi: {currentUserData.nomorPorsi}</p>
                  </div>
                </div>

                {/* Section 1: Data Pokok */}
                <div className="grid grid-cols-2 gap-4">
                  <DetailItem label="Nomor (A)" value={currentUserData.no} />
                  <DetailItem label="Kloter (B)" value={currentUserData.kloter} />
                  <DetailItem label="Rombongan (C)" value={currentUserData.rombongan} />
                  <DetailItem label="Masuk Asrama (D)" value={currentUserData.jadwalMasukAsrama} />
                </div>

                {/* Section 2: Ketua Rombongan (Karom) */}
                <div className="bg-amber-50/50 rounded-[32px] p-6 border border-amber-100 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-amber-600 shadow-sm border border-amber-100 italic font-black text-lg">
                      {currentUserData.rombongan}
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">Ketua Rombongan (E)</p>
                      <p className="text-md font-black text-neutral-800 uppercase tracking-tight leading-tight">{currentUserData.namaKetuaRombongan || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-amber-100">
                    <div className="space-y-0.5">
                      <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest leading-none">WhatsApp Karom (AC)</p>
                      <p className="text-xs font-bold text-amber-600">{currentUserData.waKarom || '-'}</p>
                    </div>
                    {currentUserData.waKarom && (
                      <div className="flex gap-2">
                        <a href={`https://wa.me/${formatWA(currentUserData.waKarom)}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-emerald-100 transition-all active:scale-95">
                          <Smartphone className="w-4 h-4" /> WA
                        </a>
                        <a href={`tel:${currentUserData.waKarom.replace(/[^0-9]/g, '')}`} className="p-2.5 bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-100 transition-all active:scale-95">
                          <Phone className="w-4 h-4" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 3: Data Fisik & Kontak */}
                <div className="grid grid-cols-2 gap-4">
                  <DetailItem label="Umur (J)" value={`${currentUserData.umur} Tahun`} />
                  <DetailItem label="Jenis Kelamin (K)" value={currentUserData.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'} />
                  <DetailItem label="Paspor (G)" value={currentUserData.paspor} />
                  <DetailItem label="Visa (H)" value={currentUserData.visa} />
                  <div className="col-span-2">
                    <div className="p-5 bg-neutral-50 rounded-[28px] border border-neutral-100 italic space-y-2">
                      <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest leading-none">Alamat Lengkap (L,M,N,O)</p>
                      <p className="text-xs font-bold text-neutral-700 leading-relaxed uppercase">
                        {currentUserData.alamat}, {currentUserData.desa}, {currentUserData.kecamatan}, {currentUserData.kabupaten}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 4: Kontak Jemaah */}
                <div className="bg-blue-50/50 rounded-[32px] p-6 border border-blue-100 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">WhatsApp Saya (P)</p>
                    <p className="text-md font-black text-neutral-800 tracking-tight">{currentUserData.wa || '-'}</p>
                  </div>
                  {currentUserData.wa && (
                    <div className="flex gap-2">
                      <a href={`tel:${currentUserData.wa.replace(/[^0-9]/g, '')}`} className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100 transition-all active:scale-95">
                        <Phone className="w-5 h-5" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Section 5: Status Layanan */}
                <div className="grid grid-cols-2 gap-3">
                  <DetailItem label="Tanazul (Q)" value={currentUserData.tanazul} />
                  <DetailItem label="Murur (R)" value={currentUserData.murur} />
                  <DetailItem label="Nafar (S)" value={currentUserData.nafar} />
                  <DetailItem label="Jalur DAM (T)" value={currentUserData.jalurDam} />
                  <DetailItem label="Umrah Gel (U)" value={currentUserData.umrahGelombang} />
                  <DetailItem label="Badal (V)" value={currentUserData.badal} />
                </div>

                {/* Section 6: Kesehatan (W, X, Y, Z) */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                    <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Informasi Kesehatan</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <HealthBadge label="Kursi Roda (W)" active={currentUserData.kursiRoda === 'YA'} />
                    <HealthBadge label="Tongkat/Kruk (X)" active={currentUserData.tongkat === 'YA'} />
                    <HealthBadge label="Pen Tubuh (Y)" active={currentUserData.penTubuh === 'YA'} />
                    <HealthBadge label="Ring Jantung (Z)" active={currentUserData.ringJantung === 'YA'} />
                  </div>
                </div>

                {/* Section 7: Pendamping (AA, AB) */}
                <div className="bg-purple-50 rounded-[32px] p-6 border border-purple-100 space-y-4 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-purple-600 shadow-sm border border-purple-100">
                      <UserPlus className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-purple-500 uppercase tracking-widest leading-none mb-1">Pendamping Lansia (AA)</p>
                      <p className="text-md font-black text-neutral-800 uppercase tracking-tight leading-tight">{currentUserData.pendampingLansia || '-'}</p>
                    </div>
                  </div>
                  {currentUserData.waPendamping && (
                    <div className="flex items-center justify-between pt-4 border-t border-purple-100">
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest leading-none">WA Pendamping (AB)</p>
                        <p className="text-xs font-bold text-purple-600">{currentUserData.waPendamping}</p>
                      </div>
                      <div className="flex gap-2">
                        <a href={`https://wa.me/${formatWA(currentUserData.waPendamping)}`} target="_blank" rel="noreferrer" className="p-3 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-100 transition-all active:scale-95">
                          <Smartphone className="w-4 h-4" />
                        </a>
                        <a href={`tel:${currentUserData.waPendamping.replace(/[^0-9]/g, '')}`} className="p-3 bg-purple-600 text-white rounded-xl shadow-lg shadow-purple-100 transition-all active:scale-95">
                          <Phone className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 8: Hotel Mekah & Madinah (AF, AG, AH, AI) */}
                <div className="space-y-4">
                  <div className="bg-indigo-600 rounded-[40px] p-8 shadow-xl shadow-indigo-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                      <MapPin className="w-24 h-24 text-white" />
                    </div>
                    <div className="relative z-10 space-y-6">
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest italic flex items-center gap-2">
                          <MapPin className="w-3 h-3" /> Hotel Makkah (AF)
                        </p>
                        <h4 className="text-xl font-black text-white italic tracking-tight leading-tight">{currentUserData.hotelMekah || 'Menunggu Update'}</h4>
                      </div>
                      {currentUserData.linkPetaHotel && (
                        <a 
                          href={currentUserData.linkPetaHotel} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-5 bg-white text-indigo-600 rounded-[24px] text-[12px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 hover:bg-neutral-50"
                        >
                          <MapIcon className="w-4 h-4" /> Buka Penunjuk Peta (AG)
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="bg-amber-600 rounded-[40px] p-8 shadow-xl shadow-amber-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                      <MapPin className="w-24 h-24 text-white" />
                    </div>
                    <div className="relative z-10 space-y-6">
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-amber-200 uppercase tracking-widest italic flex items-center gap-2">
                          <MapPin className="w-3 h-3" /> Hotel Madinah (AH)
                        </p>
                        <h4 className="text-xl font-black text-white italic tracking-tight leading-tight">{currentUserData.hotelMadinah || 'Menunggu Update'}</h4>
                      </div>
                      {currentUserData.linkPetaHotelMadinah && (
                        <a 
                          href={currentUserData.linkPetaHotelMadinah} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-5 bg-white text-amber-600 rounded-[24px] text-[12px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 hover:bg-neutral-50"
                        >
                          <MapIcon className="w-4 h-4" /> Buka Penunjuk Peta (AI)
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeView === 'checklist' && (
            <>
              <ViewHeader title="Ceklist Perbekalan Haji" icon={<CheckCircle2 className="w-5 h-5" />} />
              <div className="space-y-6">
                <div className="bg-primary rounded-[32px] p-6 text-white shadow-xl shadow-emerald-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black uppercase tracking-widest">Progress Kelengkapan</h3>
                    <span className="text-xs font-black bg-white/20 px-3 py-1 rounded-full">{checklistCompletion}%</span>
                  </div>
                  <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${checklistCompletion}%` }}
                      className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                    />
                  </div>
                  <p className="text-[10px] font-medium opacity-70 mt-4 italic text-center">Centang item yang sudah Anda siapkan</p>
                </div>

                {syncStatus === 'quota-exceeded' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-rose-50 border border-rose-100 p-4 rounded-[24px] flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm">
                      <AlertCircle className="w-5 h-5 text-rose-600" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-black text-rose-800 uppercase leading-none">⚠️ Kuota Sinkronisasi Penuh</p>
                      <p className="text-[10px] font-medium text-rose-600 leading-tight">Data disimpan sementara di aplikasi ini saja. Database pusat akan aktif kembali besok pagi.</p>
                    </div>
                  </motion.div>
                )}
                
                <div className="space-y-3">
                  {dynamicChecklistItems.map((item, i) => (
                    <button
                      key={`${item}-${i}`}
                      onClick={() => toggleChecklistItem(item)}
                      className={cn(
                        "w-full flex items-center justify-between p-5 rounded-[24px] border transition-all active:scale-[0.98]",
                        userChecklist[item] 
                          ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
                          : "bg-white border-neutral-100 text-neutral-600 shadow-sm"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center border transition-colors",
                          userChecklist[item] ? "bg-emerald-500 border-emerald-500 text-white" : "bg-neutral-50 border-neutral-200 text-transparent"
                        )}>
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-bold tracking-tight text-left">{item}</span>
                      </div>
                      {userChecklist[item] && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Selesai</span>
                      )}
                    </button>
                  ))}
                  {dynamicChecklistItems.length === 0 && (
                    <div className="text-center py-12 px-6">
                      <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-8 h-8 text-neutral-300" />
                      </div>
                      <p className="text-sm font-bold text-neutral-400">Belum ada daftar perbekalan.</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeView === 'hotel' && (
            <>
              <ViewHeader title="Informasi Hotel" icon={<Building2 className="w-5 h-5" />} />
              <div className="space-y-6">
                <div className="bg-white p-7 rounded-[40px] border border-neutral-100 shadow-xl shadow-neutral-100/50 space-y-6">
                  <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-[24px] flex items-center justify-center mx-auto shadow-sm">
                    <Building2 className="w-10 h-10" />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Akomodasi Makkah</p>
                    <h3 className="text-2xl font-black text-neutral-800 tracking-tight">{currentUserData?.hotelMekah || 'Menunggu Update'}</h3>
                  </div>
                  
                  <div className="pt-6 border-t border-neutral-50 space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Status Booking</span>
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 uppercase tracking-widest">Terkonfirmasi</span>
                    </div>
                    {currentUserData?.linkPetaHotel && (
                      <a 
                        href={currentUserData.linkPetaHotel} 
                        target="_blank" 
                        className="flex items-center justify-center gap-2 w-full py-4 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100 transition-all active:scale-95"
                      >
                        <MapPin className="w-4 h-4" /> Penunjuk Jalan (GPS)
                      </a>
                    )}
                  </div>
                </div>

                <div className="bg-blue-600 p-7 rounded-[40px] text-white shadow-xl shadow-blue-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-3xl" />
                  <div className="relative space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] opacity-80">
                      <MapIcon className="w-4 h-4" /> Lokasi Strategis
                    </div>
                    <p className="text-sm font-bold leading-relaxed">
                      Hotel berjarak cukup dekat dengan Masjidil Haram, memudahkan Jemaah untuk beribadah setiap waktu.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeView === 'payments' && (
            <>
              <ViewHeader title="Informasi Keuangan" icon={<Banknote className="w-5 h-5" />} />
              <div className="space-y-4">
                {userPayments.map((p, i) => (
                  <div key={i} className="bg-white p-6 rounded-[32px] border border-neutral-100 shadow-sm space-y-4 overflow-hidden relative">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-black text-neutral-800 uppercase tracking-widest bg-neutral-50 px-3 py-1 rounded-lg">{p.jenis}</h4>
                      <span className={cn(
                        "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest",
                        p.dibayar >= p.total ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {p.dibayar >= p.total ? 'Lunas' : 'Belum Lunas'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Tagihan</p>
                        <p className="text-sm font-black text-neutral-800">Rp {p.total.toLocaleString('id-ID')}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Dibayar</p>
                        <p className="text-sm font-black text-emerald-600">Rp {p.dibayar.toLocaleString('id-ID')}</p>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-neutral-50 flex items-center justify-between">
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Kekurangan</p>
                      <p className="text-sm font-black text-rose-600">Rp {(p.total - p.dibayar).toLocaleString('id-ID')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeView === 'profil' && (
            <>
              <ViewHeader title="Profil KBIHU" icon={<BookOpen className="w-5 h-5" />} />
              <div className="bg-white p-6 rounded-[32px] border border-neutral-100 shadow-sm space-y-4">
                <div className="prose prose-sm text-neutral-600 font-medium leading-relaxed whitespace-pre-wrap text-justify">
                  {content?.profil}
                </div>
              </div>
            </>
          )}

          {activeView === 'pengumuman' && (
            <>
              <ViewHeader title="Pengumuman Terbaru" icon={<Smartphone className="w-5 h-5" />} />
              <div className="bg-primary p-7 rounded-[32px] text-white shadow-xl shadow-emerald-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-3xl" />
                <div className="relative space-y-4">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] opacity-80">
                    <Smartphone className="w-4 h-4" /> Update Informasi
                  </div>
                  <p className="text-[17px] font-bold leading-relaxed">{content?.pengumuman}</p>
                  <div className="pt-4 border-t border-white/10">
                    <p className="text-[10px] font-medium opacity-60 italic">Sesuai update terakhir dari Admin SIM ARAFAH</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeView === 'galeri' && (
            <>
              <ViewHeader title="Galeri Video" icon={<Youtube className="w-5 h-5" />} />
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <Youtube className="w-4 h-4 text-red-600" />
                    <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Dokumentasi Video</h4>
                  </div>
                  <div className="grid grid-cols-1 gap-6">
                    {content?.galeri && content.galeri.length > 0 ? (
                      content.galeri.map((link, i) => {
                        const getYoutubeId = (url: string) => {
                          if (!url) return null;
                          const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
                          const match = url.match(regExp);
                          return (match && match[2].length === 11) ? match[2] : null;
                        };

                        const videoId = getYoutubeId(link);
                        const embedLink = videoId ? `https://www.youtube.com/embed/${videoId}` : link;
                        
                        return (
                          <motion.div 
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="bg-white rounded-[32px] border border-neutral-100 p-6 shadow-sm space-y-4"
                          >
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-black text-neutral-800 italic">Video Dokumentasi #{i+1}</h4>
                              <Youtube className="w-5 h-5 text-red-600" />
                            </div>

                            <div className="bg-neutral-50 rounded-2xl p-3 flex items-center gap-3 border border-neutral-100/50">
                              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                                <Youtube className="w-4 h-4" />
                              </div>
                              <p className="text-[10px] font-bold text-neutral-400 truncate flex-1">{link}</p>
                            </div>

                            <div className="aspect-video bg-neutral-900 rounded-3xl overflow-hidden shadow-inner border border-neutral-100">
                              {videoId ? (
                                <iframe 
                                  src={embedLink} 
                                  className="w-full h-full border-none"
                                  allowFullScreen
                                  title={`Video Dokumentasi ${i+1}`}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-white/50 text-[10px] font-bold uppercase tracking-widest">
                                  Invalid YouTube Link
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })
                    ) : (
                      <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-neutral-200">
                        <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Belum ada video dokumentasi</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeView === 'agenda' && (
            <>
              <ViewHeader title="Agenda Kegiatan" icon={<Calendar className="w-5 h-5" />} />
              <div className="space-y-3">
                {content?.agenda.map((a, i) => (
                  <div key={i} className="bg-white p-4 rounded-2xl border border-neutral-100 flex items-center gap-4 shadow-sm">
                    <div className="flex flex-col items-center justify-center w-14 h-14 bg-primary/5 rounded-xl border border-primary/10">
                      <span className="text-[10px] font-black text-primary uppercase">{new Date(a.tanggal).toLocaleDateString('id-ID', { month: 'short' })}</span>
                      <span className="text-lg font-black text-neutral-800 leading-none">{new Date(a.tanggal).getDate()}</span>
                    </div>
                    <div>
                      <p className="text-sm font-black text-neutral-800 tracking-tight">{a.kegiatan}</p>
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">
                        {new Date(a.tanggal).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeView === 'materi' && (
            <>
              <ViewHeader title="Materi & Doa" icon={<BookOpen className="w-5 h-5" />} />
              <div className="space-y-6">
                {/* Search Bar */}
                <div className="relative">
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari materi atau doa..."
                    className="w-full bg-white border border-neutral-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300" />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-2 px-2 no-scrollbar">
                  <button 
                    onClick={async () => {
                      const data = await getAdminContent();
                      setContent(data);
                    }}
                    className="p-2 bg-neutral-100 text-neutral-400 rounded-lg hover:bg-neutral-200 transition-all active:scale-95"
                    title="Refresh Materi"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  {[
                    { id: 'all', label: 'Semua' },
                    { id: 'doa', label: 'Doa' },
                    { id: 'teks', label: 'Materi Artikel' },
                    { id: 'video', label: 'Video' },
                    { id: 'download', label: 'Drive' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setMateriTab(tab.id as any)}
                      className={cn(
                        "px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border",
                        materiTab === tab.id 
                          ? "bg-primary text-white border-primary shadow-lg shadow-emerald-100" 
                          : "bg-white text-neutral-400 border-neutral-100 hover:border-neutral-200"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  {content?.materi
                    .filter(m => (materiTab === 'all' || m.tipe === materiTab) && (
                      m.judul.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      (m.tipe === 'teks' && m.isi?.konten?.toLowerCase().includes(searchQuery.toLowerCase()))
                    )).length > 0 ? (
                    content?.materi
                      .filter(m => (materiTab === 'all' || m.tipe === materiTab) && (
                        m.judul.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        (m.tipe === 'teks' && m.isi?.konten?.toLowerCase().includes(searchQuery.toLowerCase()))
                      ))
                      .map((m) => (
                        <div key={m.id} className="bg-white rounded-3xl border border-neutral-100 overflow-hidden shadow-sm">
                            <div className={cn(
                              "p-4 flex items-center justify-between",
                              m.tipe === 'doa' ? "bg-amber-50/30" : (m.tipe === 'video' ? "bg-rose-50/30" : (m.tipe === 'teks' ? "bg-indigo-50/30" : "bg-blue-50/30"))
                            )}>
                              <div className="flex items-center gap-3">
                                {m.tipe === 'doa' && <Heart className="w-4 h-4 text-amber-600" />}
                                {m.tipe === 'teks' && <BookOpen className="w-4 h-4 text-indigo-600" />}
                                {m.tipe === 'video' && <Video className="w-4 h-4 text-rose-600" />}
                                {m.tipe === 'download' && <Download className="w-4 h-4 text-blue-600" />}
                                <span className="text-xs font-black text-neutral-800 tracking-tight">{m.judul}</span>
                              </div>
                              <span className="text-[9px] font-black uppercase tracking-widest opacity-50">
                                {m.tipe === 'download' ? 'Drive' : (m.tipe === 'teks' ? 'Artikel' : m.tipe)}
                              </span>
                            </div>
                            <div className="p-5">
                              {m.tipe === 'teks' && m.isi?.konten && (
                                <div className="p-4 bg-neutral-50/50 rounded-2xl border border-neutral-100/50">
                                  <p className="text-sm font-medium text-neutral-600 leading-relaxed text-justify whitespace-pre-wrap">
                                    {m.isi.konten}
                                  </p>
                                </div>
                              )}
                              {m.tipe === 'doa' && m.isi && (
                              <div className="space-y-6">
                                <div className="bg-neutral-50/50 p-6 md:p-8 rounded-[32px] border border-neutral-100/50">
                                  <p className="text-4xl md:text-5xl font-arabic text-neutral-900 text-right leading-[1.8] md:leading-[2] mb-2 drop-shadow-sm" dir="rtl">{m.isi.arab}</p>
                                </div>
                                <div className="space-y-3 px-2">
                                  <p className="text-[12px] md:text-[13px] italic font-medium text-emerald-700 leading-relaxed border-l-3 border-emerald-200 pl-4">{m.isi.latin}</p>
                                  <p className="text-xs md:text-sm font-bold text-neutral-600 leading-relaxed bg-white/50 border border-neutral-100 p-5 rounded-[28px] shadow-sm">{m.isi.terjemahan}</p>
                                </div>
                              </div>
                            )}
                            {(m.tipe === 'video') && (
                              <div className="space-y-4">
                                {(() => {
                                  const getYoutubeId = (url: string) => {
                                    if (!url) return null;
                                    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
                                    const match = url.match(regExp);
                                    return (match && match[2].length === 11) ? match[2] : null;
                                  };

                                  const videoId = getYoutubeId(m.link || '');
                                  const embedLink = videoId ? `https://www.youtube.com/embed/${videoId}` : (m.link || '');
                                  
                                  if (!embedLink || embedLink === '#') return (
                                    <div className="p-8 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Link video tidak valid</p>
                                    </div>
                                  );

                                  return (
                                    <div className="space-y-4">
                                      <div className="bg-neutral-50 rounded-2xl p-3 flex items-center gap-3 border border-neutral-100/50">
                                        <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                                          <Youtube className="w-4 h-4" />
                                        </div>
                                        <p className="text-[10px] font-bold text-neutral-400 truncate flex-1">{m.link}</p>
                                      </div>
                                      <div className="aspect-video bg-neutral-900 rounded-2xl overflow-hidden shadow-lg border border-neutral-100">
                                        <iframe 
                                          src={embedLink} 
                                          className="w-full h-full border-none"
                                          allowFullScreen
                                          title={m.judul}
                                        />
                                      </div>
                                    </div>
                                  );
                                })()}
                                <a href={m.link} target="_blank" className="flex items-center justify-center gap-2 w-full py-3 bg-neutral-50 text-neutral-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-neutral-100 transition-all">
                                  <ExternalLink className="w-3.5 h-3.5" /> Buka di YouTube
                                </a>
                              </div>
                            )}
                            {(m.tipe === 'download') && (
                              <a href={m.link} target="_blank" className="flex items-center justify-center gap-2 w-full py-4 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 transition-all active:scale-95">
                                <Download className="w-4 h-4" /> Buka Materi Drive
                              </a>
                            )}
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-neutral-200">
                      <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest leading-loose">
                        Materi "{searchQuery}" tidak ditemukan.<br/>
                        <span className="opacity-60">Coba kata kunci lain atau pilih kategori yang berbeda.</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeView === 'sosmed' && content && (
            <>
              <ViewHeader title="Media Sosial" icon={<Smartphone className="w-5 h-5" />} />
              <div className="grid grid-cols-1 gap-4">
                <a href={`https://instagram.com/${content?.sosmed.ig}`} target="_blank" className="flex items-center justify-between p-5 bg-white rounded-3xl border border-neutral-100 shadow-sm group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-pink-50 text-pink-500 rounded-2xl flex items-center justify-center">
                      <Instagram className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[13px] font-black text-neutral-800 uppercase tracking-tight">Instagram</p>
                      <p className="text-[10px] text-pink-600 font-bold tracking-widest uppercase">@{content?.sosmed.ig}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:translate-x-1 transition-transform" />
                </a>
                <a href={`https://tiktok.com/@${content?.sosmed.tiktok}`} target="_blank" className="flex items-center justify-between p-5 bg-neutral-900 text-white rounded-3xl shadow-lg shadow-neutral-100 group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                      <Smartphone className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-[13px] font-black uppercase tracking-tight">TikTok</p>
                      <p className="text-[10px] text-neutral-400 font-bold tracking-widest uppercase">@{content?.sosmed.tiktok}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/30 group-hover:translate-x-1 transition-transform" />
                </a>
                <a href={content?.sosmed?.yt && (content.sosmed.yt.startsWith('http') ? content.sosmed.yt : `https://youtube.com/${content.sosmed.yt.startsWith('@') ? content.sosmed.yt : '@' + content.sosmed.yt}`)} target="_blank" className="flex items-center justify-between p-5 bg-white rounded-3xl border border-neutral-100 shadow-sm group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center">
                      <Youtube className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[13px] font-black text-neutral-800 uppercase tracking-tight">YouTube</p>
                      <p className="text-[10px] text-red-600 font-bold tracking-widest uppercase">{content?.sosmed?.yt ? (content.sosmed.yt.startsWith('@') ? content.sosmed.yt : '@' + content.sosmed.yt) : ''}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:translate-x-1 transition-transform" />
                </a>
              </div>
            </>
          )}

          {activeView === 'kontak' && (
            <>
              <ViewHeader title="Kontak & Lokasi" icon={<Contact className="w-5 h-5" />} />
              <div className="space-y-6">
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">Admin Pusat SIM ARAFAH</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <a href={`https://wa.me/${content?.kontak.wa1}`} className="flex flex-col items-center gap-2 p-5 bg-emerald-50 rounded-[30px] border border-emerald-100 shadow-sm transition-all active:scale-95 group">
                      <Smartphone className="w-8 h-8 text-emerald-600 group-hover:scale-110 transition-transform" />
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest text-center">Admin 1</span>
                        <span className="text-[10px] font-bold text-emerald-600">{content?.kontak.wa1}</span>
                      </div>
                    </a>
                    <a href={`https://wa.me/${content?.kontak.wa2}`} className="flex flex-col items-center gap-2 p-5 bg-emerald-50 rounded-[30px] border border-emerald-100 shadow-sm transition-all active:scale-95 group">
                      <Smartphone className="w-8 h-8 text-emerald-600 group-hover:scale-110 transition-transform" />
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest text-center">Admin 2</span>
                        <span className="text-[10px] font-bold text-emerald-600">{content?.kontak.wa2}</span>
                      </div>
                    </a>
                  </div>
                </div>

                <div className="p-7 bg-neutral-900 text-white rounded-[40px] space-y-4 text-center shadow-xl">
                  <MapPin className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-xs font-bold leading-relaxed px-4">{content?.kontak.alamat}</p>
                  <a href={content?.kontak.peta} target="_blank" className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all border border-white/10">
                    <ExternalLink className="w-3.5 h-3.5" /> Google Maps
                  </a>
                </div>

                {/* Kontak Karom Section */}
                {kontakPetugas.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 px-1">
                      <div className="w-1.5 h-4 bg-primary rounded-full" />
                      <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Kontak Ketua Rombongan (Karom)</h4>
                    </div>
                    <div className="space-y-3">
                      {kontakPetugas.map((karom, i) => (
                        <div key={i} className="bg-white rounded-[24px] p-5 border border-neutral-100 shadow-sm flex items-center justify-between group hover:border-emerald-100 transition-colors">
                          <div className="space-y-1">
                            <h5 className="text-sm font-black text-neutral-800 uppercase tracking-tight">{karom.nama}</h5>
                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">
                              Kloter {karom.kloter} • Rombongan {karom.rombongan}
                            </p>
                          </div>
                          {karom.wa && (
                            <a 
                              href={`https://wa.me/${formatWA(karom.wa)}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-emerald-100 transition-all active:scale-95"
                            >
                              <Smartphone className="w-3.5 h-3.5" /> Chat WA
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
    );
  }

  return (
    <div className="px-5 py-6 space-y-8 pb-24 max-w-md mx-auto">
      {dbStatus === 'loading' && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-[10px] font-bold text-emerald-800 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <span className="uppercase tracking-widest">Sinkronisasi Cloud Arafah...</span>
          </div>
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
        </div>
      )}

      {dbStatus === 'error' && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-[10px] font-bold text-amber-800 flex items-center gap-3">
          <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />
          <span>Gagal sinkronisasi database. Menampilkan data cadangan.</span>
        </div>
      )}

      {/* A. HEADER SECTION */}
      {user ? (
        <motion.section 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-emerald-600 to-primary rounded-[32px] p-6 text-white shadow-xl shadow-emerald-200 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-emerald-200 uppercase tracking-[0.2em]">Assalamu'alaikum,</p>
              <h2 className="text-2xl font-black tracking-tight leading-tight">{currentUserData?.namaLengkap || user.nama}</h2>
              {user.role === 'jemaah' ? (
                <div className="mt-2 flex items-center gap-2">
                  <div className="px-2 py-0.5 bg-white/20 rounded-lg text-[9px] font-black uppercase tracking-widest border border-white/10">
                    Porsi: {user.porsi || 'Menunggu'}
                  </div>
                  {currentUserData?.kloter && (
                    <div className="px-2 py-0.5 bg-emerald-900/30 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-400/20">
                      Kloter {currentUserData.kloter}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-2 inline-block px-3 py-1 bg-white/20 text-white rounded-full text-[10px] font-black uppercase tracking-tight border border-white/10">
                  {user.role === 'super_admin' ? 'Super Admin' : 'Admin Petugas'}
                </div>
              )}
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center border border-white/10 shadow-inner">
                <UserCircle className="w-8 h-8" />
              </div>
              {onLogout && (
                <button 
                  onClick={onLogout}
                  className="px-3 py-1 bg-rose-500/20 text-rose-200 rounded-lg text-[8px] font-black uppercase hover:bg-rose-500/40 transition-colors border border-rose-500/20"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        </motion.section>
      ) : null}

      {/* B. SEARCH SECTION */}
      {(!user || user.role !== 'jemaah') && (
        <section className="space-y-4">
          <h2 className="text-xs font-black text-emerald-800 uppercase tracking-widest text-center">PENCARIAN JEMAAH</h2>
          <div className="relative group">
            <input 
              type="text" 
              placeholder="Masukkan Nama atau Porsi..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-neutral-200 rounded-xl py-4 px-6 text-sm font-bold text-neutral-800 placeholder:text-neutral-300 focus:outline-none focus:border-primary transition-all shadow-sm text-center"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
              >
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            )}
          </div>
          
          <AnimatePresence>
            {searchQuery && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {searchResults.filter(j => j.searchType === 'jemaah').map((j: any, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-[40px] border border-neutral-100 shadow-xl shadow-neutral-100 overflow-hidden"
                  >
                    {/* Header: Nama Lengkap */}
                    <div className="bg-emerald-600 p-6 text-center relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                         <UserCircle className="w-16 h-16 text-white" />
                      </div>
                      <div className="relative z-10">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-[9px] font-black text-white uppercase tracking-widest italic mb-2 border border-white/10">
                          NO: {j.no} • PORSI: {j.nomorPorsi}
                        </div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight italic drop-shadow-md">
                          {j.namaLengkap}
                        </h3>
                      </div>
                    </div>

                    <div className="p-6 space-y-6">
                      {/* Section 1: Basic Info */}
                      <div className="grid grid-cols-2 gap-3">
                        <DetailItem label="Kloter (B)" value={j.kloter} />
                        <DetailItem label="Rombongan (C)" value={j.rombongan} />
                        <div className="col-span-2">
                           <DetailItem label="Jadwal Masuk Asrama (D)" value={j.jadwalMasukAsrama} />
                        </div>
                      </div>

                      {/* Section 2: Kontak Jemaah */}
                      <div className="space-y-3">
                        <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">Kontak Jemaah</p>
                        <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100 flex items-center justify-between">
                           <div>
                              <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest mb-1">WhatsApp Jemaah (P)</p>
                              <p className="text-xs font-black text-neutral-800">{j.wa || '-'}</p>
                           </div>
                           {j.wa && (
                             <div className="flex gap-2">
                                <a href={`https://wa.me/${formatWA(j.wa)}`} target="_blank" rel="noreferrer" className="p-2 bg-white text-emerald-600 rounded-xl border border-emerald-100 shadow-sm active:scale-95 transition-all">
                                   <Smartphone className="w-4 h-4" />
                                </a>
                                <a href={`tel:${j.wa.replace(/[^0-9]/g, '')}`} className="p-2 bg-emerald-600 text-white rounded-xl shadow-sm active:scale-95 transition-all">
                                   <Phone className="w-4 h-4" />
                                </a>
                             </div>
                           )}
                        </div>
                      </div>

                      {/* Section 3: Personal Details */}
                      <div className="grid grid-cols-2 gap-3">
                         <DetailItem label="Umur (J)" value={`${j.umur} Tahun`} />
                         <DetailItem label="Kelamin (K)" value={j.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'} />
                         <div className="col-span-2">
                            <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 italic">
                               <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest mb-1">Alamat Domisili (L,M,N,O)</p>
                               <p className="text-[10px] font-bold text-neutral-700 leading-relaxed uppercase">
                                 {j.alamat}, {j.desa}, {j.kecamatan}, {j.kabupaten}
                               </p>
                            </div>
                         </div>
                      </div>

                      {/* Section 4: Ketua Rombongan */}
                      <div className="space-y-3">
                        <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">Ketua Rombongan</p>
                        <div className="bg-amber-50/50 rounded-3xl p-5 border border-amber-100 space-y-4">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-600 shadow-sm border border-amber-100 italic font-black">
                                 {j.rombongan}
                              </div>
                              <div>
                                 <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">Nama Karom (E)</p>
                                 <p className="text-sm font-black text-neutral-800 uppercase tracking-tight">{j.namaKetuaRombongan || '-'}</p>
                              </div>
                           </div>
                           <div className="flex items-center justify-between pt-3 border-t border-amber-100">
                              <div className="space-y-0.5">
                                 <p className="text-[8px] font-black text-amber-400 uppercase tracking-widest leading-none">WhatsApp Karom (AC)</p>
                                 <p className="text-[10px] font-bold text-amber-600">{j.waKarom || '-'}</p>
                              </div>
                              {j.waKarom && (
                                <div className="flex gap-2">
                                   <a href={`https://wa.me/${formatWA(j.waKarom)}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase shadow-sm">
                                      <Smartphone className="w-3.5 h-3.5" /> WA
                                   </a>
                                   <a href={`tel:${j.waKarom.replace(/[^0-9]/g, '')}`} className="p-2 bg-amber-500 text-white rounded-xl shadow-sm">
                                      <Phone className="w-3.5 h-3.5" />
                                   </a>
                                </div>
                              )}
                           </div>
                        </div>
                      </div>

                      {/* Section 5: Status Layanan */}
                      <div className="grid grid-cols-2 gap-2">
                        <DetailItem label="Tanazul (Q)" value={j.tanazul} />
                        <DetailItem label="Murur (R)" value={j.murur} />
                        <DetailItem label="Nafar (S)" value={j.nafar} />
                        <DetailItem label="Jalur DAM (T)" value={j.jalurDam} />
                        <DetailItem label="Umrah Gel (U)" value={j.umrahGelombang} />
                        <DetailItem label="Badal (V)" value={j.badal} />
                      </div>

                      {/* Section 6: Kesehatan */}
                      <div className="space-y-3">
                        <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">Kondisi Kesehatan</p>
                        <div className="grid grid-cols-2 gap-2">
                           <HealthBadge label="Kursi Roda (W)" active={j.kursiRoda === 'YA'} />
                           <HealthBadge label="Tongkat (X)" active={j.tongkat === 'YA'} />
                           <HealthBadge label="Pen Tubuh (Y)" active={j.penTubuh === 'YA'} />
                           <HealthBadge label="Ring Jantung (Z)" active={j.ringJantung === 'YA'} />
                        </div>
                      </div>

                      {/* Section 7: Pendamping */}
                      <div className="p-5 bg-purple-50/50 rounded-3xl border border-purple-100 space-y-4">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-purple-600 shadow-sm border border-purple-100">
                               <UserPlus className="w-5 h-5" />
                            </div>
                            <div>
                               <p className="text-[8px] font-black text-purple-500 uppercase tracking-widest leading-none mb-1">Pendamping Lansia (AA)</p>
                               <p className="text-sm font-black text-neutral-800 uppercase tracking-tight">{j.pendampingLansia || '-'}</p>
                            </div>
                         </div>
                         {j.waPendamping && (
                           <div className="flex items-center justify-between pt-3 border-t border-purple-100">
                              <div className="space-y-0.5">
                                 <p className="text-[8px] font-black text-purple-400 uppercase tracking-widest leading-none">WhatsApp Pendamping (AB)</p>
                                 <p className="text-[10px] font-bold text-purple-600">{j.waPendamping}</p>
                              </div>
                              <div className="flex gap-2">
                                 <a href={`https://wa.me/${formatWA(j.waPendamping)}`} target="_blank" rel="noreferrer" className="p-2 bg-emerald-500 text-white rounded-xl shadow-sm">
                                    <Smartphone className="w-3.5 h-3.5" />
                                 </a>
                                 <a href={`tel:${j.waPendamping.replace(/[^0-9]/g, '')}`} className="p-2 bg-purple-500 text-white rounded-xl shadow-sm">
                                    <Phone className="w-3.5 h-3.5" />
                                 </a>
                              </div>
                           </div>
                         )}
                      </div>

                      {/* Section 8: Hotel Makkah */}
                      <div className="bg-indigo-600 rounded-3xl p-6 shadow-xl shadow-indigo-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                           <MapPin className="w-16 h-16 text-white" />
                        </div>
                        <div className="relative z-10 space-y-4">
                          <div>
                            <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-1 italic">Hotel Makkah (AF)</p>
                            <h4 className="text-lg font-black text-white italic tracking-tight leading-tight">{j.hotelMekah || 'Menunggu Update'}</h4>
                          </div>
                          {j.linkPetaHotel && (
                            <a 
                              href={j.linkPetaHotel} 
                              target="_blank" 
                              rel="noreferrer"
                              className="flex items-center justify-center gap-2 w-full py-4 bg-white text-indigo-600 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95"
                            >
                              <MapPin className="w-4 h-4" /> Buka Penunjuk Peta (AG)
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Section 9: Hotel Madinah */}
                      <div className="bg-amber-600 rounded-3xl p-6 shadow-xl shadow-amber-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                           <MapPin className="w-16 h-16 text-white" />
                        </div>
                        <div className="relative z-10 space-y-4">
                          <div>
                            <p className="text-[9px] font-black text-amber-200 uppercase tracking-widest mb-1 italic">Hotel Madinah (AH)</p>
                            <h4 className="text-lg font-black text-white italic tracking-tight leading-tight">{j.hotelMadinah || 'Menunggu Update'}</h4>
                          </div>
                          {j.linkPetaHotelMadinah && (
                            <a 
                              href={j.linkPetaHotelMadinah} 
                              target="_blank" 
                              rel="noreferrer"
                              className="flex items-center justify-center gap-2 w-full py-4 bg-white text-amber-600 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95"
                            >
                              <MapIcon className="w-4 h-4" /> Buka Penunjuk Peta (AI)
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {searchResults.filter(j => j.searchType === 'materi').map((m: any, i) => (
                  <motion.div 
                    key={`m-${i}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white rounded-[24px] border border-neutral-100 p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner",
                        m.tipe === 'doa' ? "bg-emerald-50 text-emerald-600" :
                        m.tipe === 'video' ? "bg-rose-50 text-rose-600" :
                        m.tipe === 'download' ? "bg-amber-50 text-amber-600" :
                        "bg-indigo-50 text-indigo-600"
                      )}>
                        {m.tipe === 'doa' ? <Heart className="w-6 h-6" /> :
                         m.tipe === 'video' ? <Play className="w-6 h-6" /> :
                         m.tipe === 'download' ? <Download className="w-6 h-6" /> :
                         <FileText className="w-6 h-6" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.1em] mb-1 opacity-40">
                          {m.tipe === 'teks' ? 'Artikel' : m.tipe}
                        </p>
                        <h4 className="text-sm font-black text-neutral-800 truncate pr-2 italic">
                          {m.judul}
                        </h4>
                      </div>
                    </div>
                    <div className="flex gap-2">
                       {m.link && (
                         <a 
                           href={m.link} 
                           target="_blank" 
                           rel="noreferrer"
                           className="w-10 h-10 bg-neutral-50 text-neutral-400 rounded-xl flex items-center justify-center border border-neutral-100"
                         >
                           <ExternalLink className="w-4 h-4" />
                         </a>
                       )}
                       <button 
                        onClick={() => setActiveView('materi')}
                        className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center border border-primary/20"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}

                {searchResults.length === 0 && searchQuery.length > 2 && (
                  <p className="text-center text-[10px] font-bold text-neutral-400 uppercase tracking-widest italic py-4">Data tidak ditemukan</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* C. NAVIGATION MENU - GUEST / ADMIN ONLY */}
      {(!user || user.role !== 'jemaah') && (
        <>
          <section className="space-y-6">
            <div className="flex items-center justify-center gap-3">
               <div className="h-4 w-1 bg-primary rounded-full" />
               <h2 className="text-xs font-black text-neutral-800 uppercase tracking-widest text-center">Menu Layanan Arafah</h2>
               <div className="h-4 w-1 bg-primary rounded-full" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'profil', icon: <BookOpen />, label: 'Profil KBIHU', color: 'bg-blue-50 text-blue-600' },
                { id: 'galeri', icon: <Video />, label: 'Dokumentasi', color: 'bg-rose-50 text-rose-600' },
                { id: 'agenda', icon: <Calendar />, label: 'Kegiatan', color: 'bg-orange-50 text-orange-600' },
                { id: 'materi', icon: <BookOpen />, label: 'Materi', color: 'bg-indigo-50 text-indigo-600' },
                { id: 'sosmed', icon: <Share2 />, label: 'Media Sosial', color: 'bg-sky-50 text-sky-600' },
                { id: 'kontak', icon: <Phone />, label: 'Bantuan', color: 'bg-emerald-50 text-emerald-600' },
              ].map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className="bg-white p-4 rounded-[24px] border border-neutral-100 shadow-sm flex flex-col items-center gap-3 active:scale-95 transition-all"
                >
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", item.color)}>
                    {cloneElement(item.icon as ReactElement<any>, { className: "w-5 h-5" })}
                  </div>
                  <span className="text-[9px] font-black text-neutral-600 uppercase text-center leading-tight">{item.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Running Announcement (Pengumuman Berjalan) */}
          {content?.pengumuman && (
            <div className="bg-emerald-50 border-y border-emerald-100 overflow-hidden py-2.5 relative shadow-sm rounded-2xl">
              <div className="flex animate-marquee whitespace-nowrap">
                <div className="flex shrink-0 items-center gap-4 pr-10">
                  <span className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-100/50 px-3 py-1 rounded-full">
                    <Bell className="w-3.5 h-3.5" /> INFORMASI
                  </span>
                  <p className="text-[11px] font-bold text-emerald-800 tracking-tight italic">
                    {content.pengumuman}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4 pr-10">
                  <span className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-100/50 px-3 py-1 rounded-full">
                    <Bell className="w-3.5 h-3.5" /> INFORMASI
                  </span>
                  <p className="text-[11px] font-bold text-emerald-800 tracking-tight italic">
                    {content.pengumuman}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* D. JEMAAH CONTENT (Dashboard) - Only for Logged In Jemaah */}
      {user?.role === 'jemaah' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* Panel 1: Ringkasan Tagihan & Keuangan */}
          <section className="bg-white rounded-[40px] border border-neutral-100 shadow-xl shadow-neutral-100 overflow-hidden">
            <div className="bg-orange-600 p-6 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <Banknote className="w-5 h-5 text-orange-200" />
                <h2 className="text-sm font-black uppercase tracking-widest">Ringkasan Tagihan & Keuangan</h2>
              </div>
            </div>
            <div className="p-5 space-y-3">
              {userPayments.map((p, i) => (
                <div key={i} className="bg-neutral-50/50 border border-neutral-100 rounded-3xl p-5 space-y-3 relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-black text-neutral-800 uppercase tracking-tight">{p.jenis}</h3>
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                      p.dibayar >= p.total ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                    )}>
                      {p.dibayar >= p.total ? 'LUNAS' : 'DALAM PROSES'}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-0.5">
                      <p className="text-[8px] font-bold text-neutral-400 uppercase">Target Tagihan</p>
                      <p className="text-xs font-black">Rp {p.total.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[8px] font-bold text-neutral-400 uppercase">Sudah Dibayar</p>
                      <p className="text-xs font-black text-emerald-600">Rp {p.dibayar.toLocaleString('id-ID')}</p>
                    </div>
                  </div>
                  {p.total > p.dibayar && (
                    <div className="pt-3 mt-1 border-t border-neutral-200/50 flex justify-between items-center">
                      <span className="font-bold text-neutral-400 uppercase text-[9px]">Sisa Pelunasan</span>
                      <span className="font-black text-rose-600 text-xs">Rp {(p.total - p.dibayar).toLocaleString('id-ID')}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Panel 2: Prosentase Kesiapan Berangkat */}
          <section className="bg-white rounded-[40px] border border-neutral-100 shadow-xl shadow-neutral-100 overflow-hidden">
            <div className="bg-emerald-600 p-6 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-emerald-200" />
                <h2 className="text-sm font-black uppercase tracking-widest">Kesiapan Berangkat</h2>
              </div>
              <span className="text-sm font-black bg-emerald-900/30 px-4 py-2 rounded-2xl border border-emerald-400/30 uppercase tracking-widest italic">
                {checklistCompletion}%
              </span>
            </div>
            <div className="p-6 space-y-6">
              <div className="h-4 bg-neutral-100 rounded-full overflow-hidden shadow-inner">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${checklistCompletion}%` }}
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-lg relative"
                >
                  <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[shimmer_2s_linear_infinite]" />
                </motion.div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'PASPOR', value: currentUserData?.paspor || 'Proses', color: 'text-blue-600' },
                  { label: 'VISA', value: currentUserData?.visa || 'Proses', color: 'text-indigo-600' },
                  { label: 'HOTEL', value: currentUserData?.hotelMekah ? 'OK' : 'Proses', color: 'text-emerald-600' },
                ].map((item, idx) => (
                  <div key={idx} className="bg-neutral-50/80 border border-neutral-100 rounded-2xl p-4 text-center">
                    <p className="text-[8px] font-black text-neutral-400 uppercase mb-1.5 tracking-widest">{item.label}</p>
                    <p className={cn("text-[10px] font-black uppercase tracking-tight", item.color)}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Grid Menu Pribadi Jemaah */}
          <section className="space-y-4">
            <div className="flex items-center justify-center gap-3">
               <div className="h-4 w-1 bg-primary rounded-full" />
               <h2 className="text-xs font-black text-neutral-800 uppercase tracking-widest text-center">Menu Akun Saya</h2>
               <div className="h-4 w-1 bg-primary rounded-full" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'data_pribadi_full', icon: <UserCircle />, label: 'Data Pribadi', color: 'bg-emerald-50 text-emerald-600' },
                { id: 'checklist', icon: <CheckCircle2 />, label: 'Perlengkapan', color: 'bg-blue-50 text-blue-600' },
                { id: 'payments', icon: <Banknote />, label: 'Keuangan', color: 'bg-orange-50 text-orange-600' },
                { id: 'materi', icon: <BookOpen />, label: 'Materi', color: 'bg-indigo-50 text-indigo-600' },
                { id: 'agenda', icon: <Calendar />, label: 'Agenda', color: 'bg-amber-50 text-amber-600' },
                { id: 'kontak', icon: <Smartphone />, label: 'Bantuan', color: 'bg-rose-50 text-rose-600' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className="bg-white p-4 rounded-[28px] border border-neutral-100 shadow-sm flex flex-col items-center gap-3 active:scale-95 transition-all text-center"
                >
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", item.color)}>
                    {cloneElement(item.icon as ReactElement<any>, { className: "w-6 h-6" })}
                  </div>
                  <span className="text-[9px] font-black text-neutral-600 uppercase leading-tight tracking-tight">{item.label}</span>
                </button>
              ))}
            </div>
          </section>
        </motion.div>
      )}

      {/* E. SHARED UTILITIES - LOGOUT ONLY */}
      {(!user) && (
        <section className="space-y-6 pt-6 border-t border-neutral-100">
        {/* Jam Dunia & Jadwal Salat */}
        <section className="bg-white rounded-[40px] border border-neutral-100 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-center gap-3">
             <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                <Clock className="w-5 h-5 text-emerald-600" />
             </div>
             <h2 className="text-lg font-black text-neutral-800 tracking-tight">Jam Dunia & Jadwal Salat</h2>
          </div>

          <div className="bg-emerald-50/50 border border-emerald-100 rounded-3xl p-4 text-center space-y-1">
             <div className="flex items-center justify-center gap-2 text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                <MapPin className="w-3 h-3" />
                <span>Grogol, Indonesia</span>
             </div>
             <div className="space-y-0.5">
                <p className="text-sm font-black text-emerald-900 tracking-tight">{getHijriDate(currentTime)}</p>
                <p className="text-[8px] font-bold text-emerald-600/60 uppercase tracking-[0.2em]">*Berdasarkan KHGT Muhammadiyah</p>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* INDONESIA CARD */}
            <div className="bg-emerald-50/30 border border-emerald-100 rounded-[32px] p-6 space-y-4">
              <div className="text-center space-y-1">
                <p className="text-[10px] font-black text-emerald-700 uppercase tracking-[0.2em]">INDONESIA (WIB)</p>
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  <p className="text-xl sm:text-2xl font-black text-emerald-600 tabular-nums leading-none tracking-tight">
                    {indoTimeStr.replace(/:/g, '.')} 
                  </p>
                  <span className="text-sm font-black text-emerald-600">WIB</span>
                </div>
                <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">{dateStr}</p>
              </div>

              <div className="space-y-2">
                {prayerTimesIndo.map((p, i) => (
                  <div key={i} className="bg-white px-4 py-2.5 rounded-2xl border border-emerald-100/50 flex items-center justify-between shadow-sm">
                    <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">{p.name}</p>
                    <p className="text-xs font-black text-emerald-700 tabular-nums">{p.time}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* SAUDI CARD */}
            <div className="bg-amber-50/30 border border-amber-100 rounded-[32px] p-6 space-y-4">
              <div className="text-center space-y-1">
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-[0.2em]">ARAB SAUDI (WAS)</p>
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  <p className="text-xl sm:text-2xl font-black text-amber-600 tabular-nums leading-none tracking-tight">
                    {saudiTimeStr.replace(/:/g, '.')} 
                  </p>
                  <span className="text-sm font-black text-amber-600">WAS</span>
                </div>
                <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">{dateStr}</p>
              </div>

              <div className="space-y-2">
                {prayerTimesSaudi.map((p, i) => (
                  <div key={i} className="bg-white px-4 py-2.5 rounded-2xl border border-amber-100/50 flex items-center justify-between shadow-sm">
                    <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">{p.name}</p>
                    <p className="text-xs font-black text-amber-700 tabular-nums">{p.time}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Al-Qur'an Digital */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <div className="flex flex-col">
                <h2 className="text-sm font-black text-neutral-800 uppercase tracking-tight">Al-Qur'an Digital</h2>
                <p className="text-[10px] text-neutral-400 font-medium italic">Baca Surah & Terjemahan Lengkap</p>
              </div>
            </div>
            {quranView === 'detail' && (
              <button 
                onClick={() => setQuranView('list')}
                className="flex items-center gap-1 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-full text-[10px] font-black transition-all active:scale-95"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Kembali
              </button>
            )}
          </div>

          <div className="bg-white border border-neutral-100 rounded-[32px] overflow-hidden shadow-sm">
            {quranView === 'list' ? (
              <div className="p-6 space-y-6">
                <div className="relative group">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300" />
                   <input
                    type="text"
                    placeholder="Cari Surah (contoh: Al-Baqarah)..."
                    value={quranSearch}
                    onChange={(e) => setQuranSearch(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-neutral-50 rounded-2xl border border-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold"
                   />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                  {filteredSurahs.map((s: any) => (
                    <button
                      key={s.nomor}
                      onClick={() => handleSelectSurah(s.nomor)}
                      className="flex items-center justify-between p-4 bg-white hover:bg-emerald-50 border border-neutral-100 rounded-2xl transition-all group active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-neutral-50 group-hover:bg-white flex items-center justify-center text-[10px] font-black text-neutral-400 group-hover:text-primary border border-neutral-100 transition-colors">
                          {s.nomor}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-black text-neutral-800 group-hover:text-primary transition-colors">{s.namaLatin}</p>
                          <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">{s.arti}</p>
                        </div>
                      </div>
                      <div className="text-right">
                         <p className="text-xl font-arabic text-emerald-700">{s.nama}</p>
                       </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-[500px]">
                <div className="p-6 bg-emerald-700 text-white flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-black">{surahDetail?.namaLatin}</h3>
                    <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest">{surahDetail?.arti} • {surahDetail?.jumlahAyat} AYAT</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-arabic">{surahDetail?.nama}</p>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-10 custom-scrollbar bg-neutral-50/50">
                  {loadingSurah ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                       <Loader2 className="w-8 h-8 text-primary animate-spin" />
                       <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Memuat Ayat...</p>
                    </div>
                  ) : (
                    surahDetail?.ayat.map((a: any) => (
                      <div key={a.nomorAyat} className="space-y-6">
                        <div className="flex justify-between items-start gap-4">
                           <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[10px] font-black text-primary shrink-0">
                             {a.nomorAyat}
                           </div>
                           <p className="text-xl sm:text-2xl md:text-3xl font-arabic text-right leading-[1.8] text-neutral-800 break-words w-full" dir="rtl">{a.teksArab}</p>
                        </div>
                        <div className="space-y-2 pl-12">
                          <p className="text-xs text-neutral-500 font-medium leading-relaxed italic">{a.teksLatin}</p>
                          <p className="text-sm text-neutral-700 font-bold leading-relaxed">{a.teksIndonesia}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            
            <div className="bg-neutral-100/50 p-4 flex items-center justify-center gap-3 border-t border-neutral-100 text-neutral-400 pb-10">
              <BookOpen className="w-3.5 h-3.5" />
              <span className="text-[9px] font-black uppercase tracking-widest italic">Source Data: API kementerian Agama RI</span>
            </div>
          </div>
        </section>

        {/* Penerjemah Cerdas */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Languages className="w-5 h-5 text-primary" />
              <div className="flex flex-col">
                <h2 className="text-sm font-black text-neutral-800 uppercase tracking-tight">Penerjemah Cerdas</h2>
                <p className="text-[10px] text-neutral-400 font-medium italic">Ketik teks untuk menerjemahkan otomatis</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-2 py-1 bg-emerald-50 rounded-lg border border-emerald-100 text-[9px] font-black text-primary">
                TUJUAN: {targetLang} {targetLang === 'Arab' ? '🇸🇦' : '🇮🇩'}
              </div>
              <button 
                onClick={handleSwapTranslation}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/10 hover:bg-secondary/20 text-primary-light rounded-full border border-secondary/20 transition-all active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black">Tukar Posisi</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative group">
              <label className="absolute -top-1.5 left-4 px-1.5 bg-white text-[9px] font-black text-primary uppercase tracking-wider z-10">
                {sourceLang === 'Indonesia' ? '🇮🇩 INDONESIA' : '🇸🇦 ARAB'}
              </label>
              <textarea
                value={transInput}
                onChange={(e) => setTransInput(e.target.value)}
                placeholder="Ketik teks di sini..."
                className="w-full h-32 p-4 pt-6 bg-white border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm transition-all shadow-sm"
              />
            </div>
            
            <div className="relative group">
              <label className="absolute -top-1.5 left-4 px-1.5 bg-white text-[9px] font-black text-amber-600 uppercase tracking-wider z-10">
                {targetLang === 'Arab' ? '🇸🇦 ARAB' : '🇮🇩 INDONESIA'}
              </label>
              <div className="w-full min-h-32 p-4 pt-6 bg-amber-50/30 border border-amber-100 rounded-2xl relative shadow-sm">
                <p className={`text-sm ${!transOutput ? 'text-neutral-400 italic' : 'text-neutral-800 font-medium'} font-arabic`}>
                  {isTranslating ? 'Sedang menerjemahkan...' : transOutput || 'Terjemahan akan muncul di sini...'}
                </p>
                
                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                  <button 
                    onClick={() => handleSpeak(transOutput, targetLang)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-50 text-neutral-600 rounded-full border border-neutral-200 shadow-sm transition-all active:scale-95 text-[10px] font-bold"
                  >
                    <Volume2 className="w-3.5 h-3.5" /> Putar Suara
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Kalkulator Kurs Mata Uang */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-primary" />
              <div className="flex flex-col">
                <h2 className="text-sm font-black text-neutral-800 uppercase tracking-tight">Kalkulator Kurs Mata Uang</h2>
                <p className="text-[10px] text-neutral-400 font-medium italic">Ubah Rupiah ke Riyal (atau sebaliknya)</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-[9px] font-black text-primary bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">UPDATE: {dateStr}</span>
              <button 
                onClick={() => setIsRupiahBase(!isRupiahBase)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-primary rounded-full border border-emerald-100 transition-all active:scale-95"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black tracking-tight">Tukar Posisi</span>
              </button>
            </div>
          </div>

          <div className="bg-white border border-neutral-100 rounded-2xl p-6 shadow-md space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                {isRupiahBase ? '🇮🇩 NOMINAL RUPIAH (IDR)' : '🇸🇦 NOMINAL RIYAL (SAR)'}
              </label>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-black text-neutral-800">{isRupiahBase ? 'Rp' : 'SAR'}</span>
                <input
                  type="number"
                  value={idrAmount}
                  onChange={(e) => setIdrAmount(e.target.value)}
                  placeholder="0"
                  className="w-full text-4xl font-black text-primary outline-none placeholder:text-neutral-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-50">
              <div className="bg-amber-50/30 rounded-xl p-4 border border-amber-100 space-y-1">
                <div className="flex justify-between items-center text-[9px] font-black text-amber-700 uppercase tracking-wider">
                  <span>🇸🇦 {isRupiahBase ? 'RIYAL (SAR)' : 'RUPIAH (IDR)'}</span>
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
                <div className="text-xl font-black text-neutral-800">
                  {isRupiahBase ? resultSAR.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : resultSAR.toLocaleString('id-ID')}
                </div>
                <p className="text-[8px] text-amber-600 font-bold opacity-70">1 IDR = {SAR_RATE} SAR</p>
              </div>
              
              <div className="bg-sky-50/30 rounded-xl p-4 border border-sky-100 space-y-1">
                <div className="flex justify-between items-center text-[9px] font-black text-sky-700 uppercase tracking-wider">
                  <span>🇺🇸 DOLAR (USD)</span>
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
                <div className="text-xl font-black text-neutral-800">
                  {resultUSD.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-[8px] text-sky-600 font-bold opacity-70">1 IDR = {USD_RATE} USD</p>
              </div>
            </div>
          </div>
        </section>
      </section>
    )}
    </div>
  );
}
