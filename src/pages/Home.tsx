import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo, cloneElement, ReactElement } from 'react';
import { 
  UserCircle, Video, Calendar, BookOpen, 
  Share2, Contact, ChevronRight, MapPin,
  Clock, Languages, Volume2, RefreshCw,
  Banknote, ArrowRightLeft, TrendingUp,
  X, Download, ExternalLink, Heart, Play, FileText,
  Smartphone, Youtube, Map as MapIcon, Instagram,
  CheckCircle2, Search, ArrowLeft, ChevronLeft, LogOut,
  Building2, UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Jemaah, AdminContent, MateriItem } from '../types';
import { GoogleGenAI } from "@google/genai";
import { fetchJemaah, getAdminContent } from '../services/api';
import { cn } from '../lib/utils';
import { Phone } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    return new GoogleGenAI(apiKey);
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
  { name: 'Zuhur', time: '11:37' },
  { name: 'Ashar', time: '14:58' },
  { name: 'Maghrib', time: '17:34' },
  { name: 'Isya', time: '18:45' },
];

const prayerTimesSaudi = [
  { name: 'Subuh', time: '04:40' },
  { name: 'Zuhur', time: '12:20' },
  { name: 'Ashar', time: '15:43' },
  { name: 'Maghrib', time: '18:41' },
  { name: 'Isya', time: '20:11' },
];

export default function Home({ user, onLogout }: { user: User | null, onLogout?: () => void }) {
  const navigate = useNavigate();
  const ai = useMemo(() => getAI(), []);
  const [content, setContent] = useState<AdminContent | null>(null);
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

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchQuery(q);
  }, [searchParams]);

  useEffect(() => {
    async function load() {
      const [data, dataJ] = await Promise.all([
        getAdminContent(),
        fetchJemaah()
      ]);
      setContent(data);
      setJemaah(dataJ);
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

  useEffect(() => {
    if (user?.role === 'jemaah' && user.porsi) {
      setLoadingChecklist(true);
      const loadChecklist = async () => {
        try {
          const docRef = doc(db, 'checklists', user.porsi!);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
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
    
    const timeoutId = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'checklists', user.porsi!), {
          porsi: user.porsi,
          checkedItems: userChecklist,
          updatedAt: serverTimestamp()
        }, { merge: true });
        console.log("Checklist synced to cloud");
      } catch (e: any) {
        if (e?.code === 'resource-exhausted') {
          console.warn("Cloud quota exceeded, checklist saved locally only.");
        } else {
          console.error("Error saving checklist:", e);
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
        const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
        const response = await model.generateContent(`Terjemahkan teks berikut dari Bahasa ${sourceLang} ke Bahasa ${targetLang}. Cukup berikan hasil terjemahannya saja tanpa penjelasan tambahan: "${transInput}"`);
        setTransOutput(response.response.text());
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
  const numValue = parseFloat(idrAmount) || 0;
  
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
      m.isi?.latin?.toLowerCase().includes(query)
    ).map(m => ({ ...m, searchType: 'materi' as const }));

    // Combine and limit
    return [...jemaahMatches, ...materiMatches].slice(0, 8);
  }, [jemaah, content, searchQuery]);

  // Sub-view component for consistent styling
  const ViewHeader = ({ title, icon }: { title: string, icon: React.ReactNode }) => (
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
                        <p className="text-[10px] font-medium text-neutral-400 mt-1">{currentUserData.waKarom || '-'}</p>
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
                {content?.pembayaran.map((p, i) => (
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
                  <div className="grid grid-cols-1 gap-4">
                    {content?.galeri && content.galeri.length > 0 ? (
                      content.galeri.map((link, i) => {
                        let embedLink = link;
                        if (link.includes('youtube.com/watch?v=')) {
                          embedLink = link.replace('watch?v=', 'embed/');
                        } else if (link.includes('youtu.be/')) {
                          const id = link.split('youtu.be/')[1].split('?')[0];
                          embedLink = `https://www.youtube.com/embed/${id}`;
                        }
                        
                        return (
                          <div key={i} className="aspect-video bg-neutral-900 rounded-3xl overflow-hidden shadow-lg border border-neutral-100 group">
                            <iframe 
                              src={embedLink} 
                              className="w-full h-full border-none"
                              allowFullScreen
                              title={`Video Dokumentasi ${i+1}`}
                            />
                          </div>
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
                              <a href={m.link} target="_blank" className="flex items-center justify-center gap-2 w-full py-4 bg-rose-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-rose-100 transition-all active:scale-95">
                                <Play className="w-4 h-4 fill-current" /> Tonton Video Materi
                              </a>
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

          {activeView === 'sosmed' && (
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
                <a href={content?.sosmed.yt && (content.sosmed.yt.startsWith('http') ? content.sosmed.yt : `https://youtube.com/${content.sosmed.yt.startsWith('@') ? content.sosmed.yt : '@' + content.sosmed.yt}`)} target="_blank" className="flex items-center justify-between p-5 bg-white rounded-3xl border border-neutral-100 shadow-sm group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center">
                      <Youtube className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[13px] font-black text-neutral-800 uppercase tracking-tight">YouTube</p>
                      <p className="text-[10px] text-red-600 font-bold tracking-widest uppercase">{content?.sosmed.yt.startsWith('@') ? content.sosmed.yt : '@' + content.sosmed.yt}</p>
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
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
    );
  }

  return (
    <div className="px-5 py-6 space-y-8 pb-24">
      {/* Dashboard Overhaul for Jemaah */}
      {user?.role === 'jemaah' && (
        <>
          {/* Logout & Welcome Header */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest leading-none">Ahlan wa Sahlan,</p>
              <h1 className="text-lg font-black text-neutral-800 tracking-tight">{user.nama}</h1>
            </div>
            {onLogout && (
              <button 
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-full border border-rose-100 text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5" /> Log Out
              </button>
            )}
          </div>

          {currentUserData && (
            <>
              {/* Kartu Informasi Personal Jemaah */}
              <motion.section 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-primary to-emerald-700 rounded-[32px] p-6 text-white shadow-xl shadow-emerald-200/50 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 shadow-inner" />
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-black text-emerald-200 uppercase tracking-[0.2em]">Data Jemaah</p>
                      <h2 className="text-xl font-black tracking-tight leading-tight">{currentUserData.namaLengkap}</h2>
                    </div>
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0 border border-white/10">
                      <UserCircle className="w-7 h-7" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                    <div>
                      <p className="text-[9px] font-black text-emerald-200 uppercase tracking-widest mb-1">Nomor Porsi</p>
                      <p className="text-sm font-bold tracking-wider">{currentUserData.nomorPorsi}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-emerald-200 uppercase tracking-widest mb-1">Kloter / Romb</p>
                      <p className="text-sm font-bold">{currentUserData.kloter || '-'} / {currentUserData.rombongan || '-'}</p>
                    </div>
                  </div>
                  
                  {currentUserData.hotelMekah && (
                    <div className="pt-3">
                      <p className="text-[9px] font-black text-emerald-200 uppercase tracking-widest mb-1">Informasi Hotel Mekah</p>
                      <div className="flex items-center justify-between bg-white/10 rounded-xl p-3 border border-white/10">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-emerald-300" />
                          <span className="text-xs font-bold leading-tight line-clamp-1">{currentUserData.hotelMekah}</span>
                        </div>
                        {currentUserData.linkPetaHotel && (
                          <a 
                            href={currentUserData.linkPetaHotel} 
                            target="_blank" 
                            className="bg-white text-primary px-3 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-emerald-50 transition-all active:scale-95 shadow-sm shrink-0"
                          >
                            Peta
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.section>

              {/* Section 1: Kesiapan Keberangkatan */}
              <section className="bg-white rounded-[40px] border border-neutral-100 shadow-xl shadow-neutral-100 overflow-hidden">
                <div className="bg-emerald-600 p-6 flex items-center justify-between text-white">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                    <h2 className="text-sm font-black uppercase tracking-widest">Status Kesiapan Keberangkatan</h2>
                  </div>
                  <span className="text-[10px] font-black bg-emerald-900/30 px-3 py-1.5 rounded-full border border-emerald-400/30 uppercase tracking-widest">
                    {checklistCompletion}% Lengkap
                  </span>
                </div>
                <div className="px-6 py-8 space-y-8">
                  <div className="h-3.5 bg-neutral-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${checklistCompletion}%` }}
                      className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 text-center space-y-1">
                      <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">Dokumen Paspor</p>
                      <p className="text-[10px] font-black text-emerald-700 uppercase">{currentUserData.paspor || 'Proses'}</p>
                    </div>
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 text-center space-y-1">
                      <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">Dokumen Visa</p>
                      <p className="text-[10px] font-black text-emerald-700 uppercase">{currentUserData.visa || 'Proses'}</p>
                    </div>
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 text-center space-y-1">
                      <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">Pelunasan Tagihan</p>
                      <p className="text-[10px] font-black text-emerald-700 uppercase">
                        {content?.pembayaran.every(p => p.dibayar >= p.total) ? 'LUNAS' : 'BELUM'}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 2: Ringkasan Tagihan & Keuangan */}
              <section className="bg-white rounded-[40px] border border-neutral-100 shadow-xl shadow-neutral-100 overflow-hidden">
                <div className="bg-orange-500 p-6 flex items-center justify-between text-white">
                  <div className="flex items-center gap-3">
                    <Banknote className="w-5 h-5 text-orange-200" />
                    <h2 className="text-sm font-black uppercase tracking-widest">Ringkasan Tagihan & Keuangan</h2>
                  </div>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {content?.pembayaran.map((p, i) => (
                    <div key={i} className="bg-white border border-neutral-100 rounded-3xl p-5 space-y-4 shadow-sm relative overflow-hidden group">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[11px] font-black text-neutral-800 uppercase tracking-tight line-clamp-1">{p.jenis}</h3>
                        <span className={cn(
                          "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border",
                          p.dibayar >= p.total ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                        )}>
                          {p.dibayar >= p.total ? 'LUNAS' : 'PROSES'}
                        </span>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="font-bold text-neutral-400 uppercase tracking-wider">Target Tagihan</span>
                          <span className="font-black text-neutral-800">Rp {p.total.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="font-bold text-neutral-400 uppercase tracking-wider">Telah Dibayar</span>
                          <span className="font-black text-emerald-600">Rp {p.dibayar.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="pt-3 border-t border-neutral-50 flex justify-between items-center">
                          <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Kekurangan</span>
                          <span className="text-xs font-black text-rose-600">Rp {(p.total - p.dibayar).toLocaleString('id-ID')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* Section 3: Menu Utama Dasbor Grid */}
          <section className="space-y-6">
            <h2 className="text-base font-black text-neutral-800 uppercase tracking-[0.15em] text-center">Menu Utama Dasbor</h2>
            <div className="grid grid-cols-3 gap-3 md:gap-4">
              {[
                { id: 'profil', icon: <BookOpen />, label: 'Profil KBIHU', color: 'bg-blue-50 text-blue-600' },
                { id: 'data_pribadi', icon: <UserCircle />, label: 'Data Pribadi', color: 'bg-emerald-50 text-emerald-600' },
                { id: 'agenda', icon: <Calendar />, label: 'Jadwal Kegiatan', color: 'bg-orange-50 text-orange-600' },
                { id: 'materi', icon: <BookOpen />, label: 'Materi & Doa', color: 'bg-indigo-50 text-indigo-600' },
                { id: 'hotel_mekah', icon: <Building2 />, label: 'Hotel Mekah', color: 'bg-emerald-50 text-emerald-600' },
                { id: 'checklist', icon: <CheckCircle2 />, label: 'Ceklist Perbekalan', color: 'bg-emerald-50 text-emerald-600' },
                { id: 'payments', icon: <Banknote />, label: 'Info Keuangan', color: 'bg-yellow-50 text-yellow-600' },
                { id: 'galeri', icon: <Video />, label: 'Galeri Video', color: 'bg-rose-50 text-rose-600' },
                { id: 'kontak', icon: <Phone />, label: 'Kontak Kami', color: 'bg-emerald-50 text-emerald-600' },
              ].map((item, idx) => (
                <motion.button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'hotel_mekah') {
                      window.open(currentUserData?.linkPetaHotel || 'https://www.google.com/maps', '_blank');
                    } else {
                      setActiveView(item.id);
                    }
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-white p-4 rounded-[24px] border border-neutral-100 shadow-xl shadow-neutral-100/50 flex flex-col items-center justify-center gap-3 group transition-all"
                >
                  <div className={cn(
                    "w-12 h-12 rounded-[18px] flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm",
                    item.color
                  )}>
                    {cloneElement(item.icon as ReactElement<any>, { className: "w-6 h-6" })}
                  </div>
                  <span className="text-[10px] font-black text-neutral-800 uppercase tracking-tight text-center leading-tight">{item.label}</span>
                </motion.button>
              ))}
            </div>
          </section>

          {/* Pengumuman Jemaah Dashboard */}
          {content?.pengumuman && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex items-start gap-3 mt-4"
            >
              <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest">Pengumuman Baru</p>
                  <button 
                    onClick={() => setActiveView('pengumuman')}
                    className="text-[9px] font-black text-primary/60 uppercase hover:text-primary transition-colors"
                  >
                    Selengkapnya
                  </button>
                </div>
                <p className="text-xs font-bold text-neutral-700 line-clamp-2 leading-relaxed">
                  {content.pengumuman}
                </p>
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* Guest/Admin View - Components that only admins & guests see */}
      {(!user || user.role !== 'jemaah') && (
        <>
          {/* Banner / Welcome */}
          {user && (
            <section className="bg-white rounded-[32px] p-6 border border-neutral-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
              <div className="relative z-10 space-y-1">
                <p className="text-[12px] font-black text-neutral-400 uppercase tracking-[0.2em]">Assalamu'alaikum,</p>
                <h2 className="text-2xl font-black text-primary tracking-tight leading-tight">{user.nama}</h2>
                {(user.role === 'admin_petugas' || user.role === 'super_admin') && (
                  <div className="mt-2 inline-block px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-tight border border-emerald-100">
                    {user.role === 'super_admin' ? 'Super Admin' : 'Admin Pengurus'}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Pencarian Jemaah & Materi */}
          <section className="space-y-4">
            <h2 className="text-xs font-black text-emerald-800 uppercase tracking-widest text-center px-1">PENCARIAN JEMAAH/ MATERI</h2>
            <div className="relative group">
              <input 
                type="text" 
                placeholder="Cari Jemaah atau Materi..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-emerald-100 rounded-xl py-4 px-6 text-sm font-bold text-neutral-800 placeholder:text-neutral-300 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all shadow-sm text-center"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-neutral-100 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-neutral-400" />
                </button>
              )}
            </div>

            <AnimatePresence>
              {searchQuery.trim() !== '' && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  {searchResults.length === 0 ? (
                    <div className="p-12 text-center bg-white rounded-[32px] border border-neutral-100 shadow-sm">
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest leading-loose">Data tidak ditemukan.<br/>Coba kata kunci lain.</p>
                    </div>
                  ) : (
                    searchResults.map((result: any, idx: number) => {
                      if (result.searchType === 'jemaah') {
                        const j = result as Jemaah;
                        return (
                          <motion.div 
                            key={`j-${j.no}-${idx}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-[32px] border border-neutral-100 overflow-hidden shadow-xl shadow-neutral-100 flex flex-col"
                          >
                            {/* Special Header Box: No & Nama Lengkap */}
                            <div className="bg-primary p-6 text-white text-center">
                              <div className="flex flex-col items-center gap-2">
                                <div className="px-3 py-1 bg-white/20 rounded-lg font-black text-xs uppercase tracking-widest">
                                  Nomor Urut {j.no}
                                </div>
                                <h3 className="text-2xl font-black tracking-tight uppercase leading-tight">{j.namaLengkap}</h3>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Data Jemaah KBIHU Arafah</p>
                              </div>
                            </div>

                            <div className="p-6 space-y-6">
                              {/* Section 1: Kloter & Rombongan */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100">
                                  <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest mb-1">Kloter</p>
                                  <p className="text-xs font-black text-neutral-800">{j.kloter || '-'}</p>
                                </div>
                                <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100">
                                  <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest mb-1">Rombongan</p>
                                  <p className="text-xs font-black text-neutral-800">{j.rombongan || '-'}</p>
                                </div>
                              </div>

                              {/* Jadwal Asrama */}
                              <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100 flex items-center gap-4">
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                  <Calendar className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Jadwal Masuk Asrama</p>
                                  <p className="text-sm font-black text-blue-900 leading-none mt-1">{j.jadwalMasukAsrama || '-'}</p>
                                </div>
                              </div>

                              {/* Section 2: Informasi Karom */}
                              <div className="space-y-4">
                                <div className="flex items-center gap-2 px-1">
                                  <Contact className="w-3.5 h-3.5 text-emerald-600" />
                                  <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Ketua Rombongan (Karom)</h4>
                                </div>
                                <div className="bg-emerald-50/20 border-2 border-emerald-50 rounded-[32px] p-6 space-y-4">
                                  <div>
                                    <p className="text-[9px] font-bold text-neutral-400 uppercase mb-1">Nama Karom</p>
                                    <p className="text-base font-black text-emerald-900 uppercase leading-tight">{j.namaKetuaRombongan || '-'}</p>
                                  </div>
                                  <div className="flex items-center gap-4 pt-4 border-t border-emerald-50">
                                    <div className="flex-1">
                                      <p className="text-[8px] font-bold text-neutral-400 uppercase mb-0.5">WhatsApp Karom</p>
                                      <p className="text-[11px] font-black text-emerald-800">{j.waKarom || '-'}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {j.waKarom && (
                                        <>
                                          <a href={`https://wa.me/${formatWA(j.waKarom)}`} target="_blank" className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100 active:scale-95 transition-all">
                                            <Smartphone className="w-5 h-5" />
                                          </a>
                                          <a href={`tel:${j.waKarom.replace(/[^0-9]/g, '')}`} className="w-10 h-10 bg-blue-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-100 active:scale-95 transition-all">
                                            <Phone className="w-5 h-5" />
                                          </a>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Section 3: Data Pribadi & Alamat */}
                              <div className="space-y-4 pt-4 border-t border-neutral-50 luxury-data">
                                <div className="grid grid-cols-2 gap-6">
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-black text-neutral-300 uppercase tracking-widest">Umur</p>
                                    <p className="text-sm font-black text-neutral-700">{j.umur} Tahun</p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-black text-neutral-300 uppercase tracking-widest">Jenis Kelamin</p>
                                    <p className="text-sm font-black text-neutral-700 uppercase">{j.jenisKelamin === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN'}</p>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <p className="text-[10px] font-black text-neutral-300 uppercase tracking-widest italic">Alamat Lengkap</p>
                                  <div className="bg-neutral-50/50 rounded-2xl p-4 border border-neutral-100">
                                    <p className="text-[11px] font-bold text-neutral-600 leading-relaxed uppercase">
                                      {j.alamat}, {j.desa}, {j.kecamatan}, {j.kabupaten}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between bg-neutral-50 rounded-2xl p-4 border border-neutral-100">
                                  <div>
                                    <p className="text-[10px] font-black text-neutral-400 uppercase mb-0.5">WhatsApp Jemaah</p>
                                    <p className="text-xs font-black text-neutral-800 tracking-wider font-mono">{j.wa || '-'}</p>
                                  </div>
                                  <a href={`https://wa.me/${formatWA(j.wa || '')}`} target="_blank" className="bg-white px-4 py-2 rounded-xl text-emerald-600 shadow-sm border border-emerald-100 font-black text-[10px] uppercase active:scale-95 transition-all">Hubungi</a>
                                </div>
                              </div>

                              {/* Section 4: Status Keberangkatan & Layanan */}
                              <div className="space-y-3 pt-4 border-t border-neutral-50">
                                <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-4">Layanan & Status Keberangkatan</h4>
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: 'Tanazul', value: j.tanazul },
                                    { label: 'Murur', value: j.murur },
                                    { label: 'Nafar', value: j.nafar },
                                    { label: 'DAM', value: j.jalurDam },
                                    { label: 'Gelombang', value: j.umrahGelombang },
                                    { label: 'Badal', value: j.badal },
                                  ].map((item, i) => (
                                    <div key={i} className="bg-neutral-50/50 rounded-xl p-3 border border-neutral-100 flex items-center justify-between">
                                      <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-tight">{item.label}</span>
                                      <span className={cn(
                                        "text-[10px] font-black uppercase text-right leading-none",
                                        item.value === 'YA' || item.label === 'DAM' ? "text-emerald-600" : "text-neutral-700"
                                      )}>{item.value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Section 5: Kondisi Fisik & Alat Bantu */}
                              <div className="space-y-4 pt-4 border-t border-neutral-50">
                                <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Alat Bantu Medis & Fisik</h4>
                                <div className="flex flex-wrap gap-2">
                                  {[ 
                                    { label: 'Kursi Roda', value: j.kursiRoda },
                                    { label: 'Tongkat/Kruk', value: j.tongkat },
                                    { label: 'Pen Tubuh', value: j.penTubuh },
                                    { label: 'Ring Jantung', value: j.ringJantung },
                                  ].map(tool => tool.value === 'YA' && (
                                    <span key={tool.label} className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-[9px] font-black uppercase border border-rose-100 flex items-center gap-1.5 shadow-sm">
                                      <Heart className="w-3 h-3 fill-current" /> {tool.label}
                                    </span>
                                  ))}
                                  {!['kursiRoda', 'tongkat', 'penTubuh', 'ringJantung'].some(k => (j as any)[k] === 'YA') && (
                                    <p className="text-[11px] font-bold text-neutral-300 italic py-2">Tidak ada alat bantu / catatan medis khusus</p>
                                  )}
                                </div>
                              </div>

                              {/* Section 6: Informasi Pendamping */}
                              <div className="space-y-4 pt-4 border-t border-neutral-50">
                                <div className="flex items-center gap-2 px-1">
                                  <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
                                  <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Petugas Pendamping Lansia</h4>
                                </div>
                                <div className={cn(
                                  "rounded-[32px] p-6 space-y-4 shadow-sm transition-all border-2",
                                  j.pendampingLansia ? "bg-indigo-50/20 border-indigo-50" : "bg-neutral-50/50 border-neutral-100 opacity-60"
                                )}>
                                  <div>
                                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Nama Pendamping</p>
                                    <p className="text-sm font-black text-indigo-900 uppercase leading-tight">{j.pendampingLansia || 'Tidak Ada Pendamping'}</p>
                                  </div>
                                  <div className="flex items-center gap-4 pt-4 border-t border-indigo-50/50">
                                    <div className="flex-1">
                                      <p className="text-[8px] font-bold text-indigo-400 uppercase mb-0.5">WhatsApp Pendamping</p>
                                      <p className="text-[11px] font-black text-indigo-800">{j.waPendamping || '-'}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {j.waPendamping && (
                                        <>
                                          <a href={`https://wa.me/${formatWA(j.waPendamping)}`} target="_blank" className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-all">
                                            <Smartphone className="w-5 h-5" />
                                          </a>
                                          <a href={`tel:${j.waPendamping.replace(/[^0-9]/g, '')}`} className="w-10 h-10 bg-blue-500 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-all">
                                            <Phone className="w-5 h-5" />
                                          </a>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Section 7: Hotel Mekah */}
                              <div className="space-y-4 pt-4 border-t border-neutral-50 pb-2">
                                <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Informasi Hotel Di Mekah</h4>
                                <div className="bg-amber-50/50 rounded-[32px] p-6 border-2 border-amber-100/50 shadow-sm relative overflow-hidden group">
                                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-100/30 rounded-full blur-2xl -mr-12 -mt-12 transition-transform group-hover:scale-110" />
                                  <div className="relative z-10">
                                    <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-2">Akomodasi (Hotel)</p>
                                    <h5 className="text-xl font-black text-amber-900 uppercase leading-none mb-6">{j.hotelMekah || '-' || 'Informasi Menyusul'}</h5>
                                    {(j.linkPetaHotel || j.hotelMekah) && (
                                      <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => window.open(j.linkPetaHotel || 'https://www.google.com/maps', '_blank')}
                                        className="w-full bg-amber-600 text-white py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-amber-200 active:scale-95 transition-all group"
                                      >
                                        <MapIcon className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                                        <span className="text-xs font-black uppercase tracking-widest">Buka Peta Navigasi Hotel</span>
                                      </motion.button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      } else {
                        const m = result as MateriItem;
                        return (
                          <motion.div 
                            key={`m-${m.id}-${idx}`}
                            className="bg-white rounded-3xl border border-neutral-100 overflow-hidden shadow-sm"
                          >
                            <div className={cn(
                              "p-4 flex items-center justify-between",
                              m.tipe === 'doa' ? "bg-amber-50/30" : (m.tipe === 'video' ? "bg-rose-50/30" : "bg-blue-50/30")
                            )}>
                              <div className="flex items-center gap-3">
                                {m.tipe === 'doa' && <Heart className="w-4 h-4 text-amber-600" />}
                                {m.tipe === 'video' && <Video className="w-4 h-4 text-rose-600" />}
                                {m.tipe === 'download' && <Download className="w-4 h-4 text-blue-600" />}
                                <span className="text-xs font-black text-neutral-800 tracking-tight">{m.judul}</span>
                              </div>
                              <span className="text-[9px] font-black uppercase tracking-widest opacity-50">{m.tipe}</span>
                            </div>

                            <div className="p-6">
                              {m.tipe === 'doa' && m.isi && (
                                <div className="space-y-4">
                                  <p className="text-4xl font-arabic text-neutral-800 text-right leading-loose" dir="rtl">{m.isi.arab}</p>
                                  <div className="space-y-2">
                                    <p className="text-xs italic font-medium text-neutral-500 leading-relaxed border-l-2 border-indigo-200 pl-3">{m.isi.latin}</p>
                                    <p className="text-sm font-bold text-neutral-700 leading-relaxed bg-neutral-50 p-4 rounded-2xl">{m.isi.terjemahan}</p>
                                  </div>
                                </div>
                              )}
                              
                              {(m.tipe === 'video') && (
                                <a href={m.link} target="_blank" className="flex items-center justify-center gap-2 w-full py-4 bg-rose-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-rose-100 transition-all active:scale-95">
                                  <Play className="w-4 h-4 fill-current" /> Tonton Video Materi
                                </a>
                              )}
                              
                              {(m.tipe === 'download') && (
                                <a href={m.link} target="_blank" className="flex items-center justify-center gap-2 w-full py-4 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 transition-all active:scale-95">
                                  <Download className="w-4 h-4" /> Buka Materi Drive
                                </a>
                              )}

                              <button 
                                onClick={() => setActiveView('materi')}
                                className="mt-4 flex items-center justify-center gap-2 w-full py-3 bg-neutral-50 text-neutral-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-neutral-100 hover:bg-neutral-100 transition-all"
                              >
                                Lihat Di Menu Materi
                              </button>
                            </div>
                          </motion.div>
                        );
                      }
                    })
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Grid Menu Public */}
          <section className="space-y-6">
            <h2 className="text-[11px] font-black text-neutral-800 uppercase tracking-[0.2em] text-center font-display">MENU UTAMA KBIHU ARAFAH</h2>
            <div className="grid grid-cols-3 gap-3 md:gap-4">
              {[
                { id: 'profil', icon: <BookOpen />, label: 'Profil', color: 'from-blue-500 to-blue-600 shadow-blue-200' },
                { id: 'galeri', icon: <Video />, label: 'Galeri', color: 'from-rose-500 to-rose-600 shadow-rose-200' },
                { id: 'agenda', icon: <Calendar />, label: 'Agenda', color: 'from-amber-500 to-amber-600 shadow-amber-200' },
                { id: 'materi', icon: <BookOpen />, label: 'Materi', color: 'from-indigo-500 to-indigo-600 shadow-indigo-200' },
                { id: 'sosmed', icon: <Share2 />, label: 'Sosmed', color: 'from-sky-500 to-sky-600 shadow-sky-200' },
                { id: 'kontak', icon: <Phone />, label: 'Kontak', color: 'from-emerald-500 to-emerald-600 shadow-emerald-200' },
              ].map((item) => (
                <motion.button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'sosmed') {
                        setActiveView('sosmed');
                    } else if (item.id === 'kontak') {
                        setActiveView('kontak');
                    } else {
                        setActiveView(item.id);
                    }
                  }}
                  whileHover={{ scale: 1.05, y: -4 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-white p-4 rounded-[28px] border border-neutral-100 shadow-[0_10px_30px_rgba(0,0,0,0.04)] flex flex-col items-center justify-center gap-3 group transition-all relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-neutral-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className={cn(
                    "w-12 h-12 rounded-[18px] flex items-center justify-center transition-all group-hover:scale-110 shadow-lg bg-gradient-to-br text-white",
                    item.color
                  )}>
                    {cloneElement(item.icon as ReactElement<any>, { className: "w-6 h-6" })}
                  </div>
                  <span className="text-[10px] font-bold text-neutral-800 uppercase tracking-tight text-center font-display">{item.label}</span>
                </motion.button>
              ))}
            </div>
          </section>

          {/* Pengumuman Header (Public/Admin) */}
          {content?.pengumuman && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex items-start gap-3 mt-4"
            >
              <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest">Pengumuman Baru</p>
                  <button 
                    onClick={() => setActiveView('pengumuman')}
                    className="text-[9px] font-black text-primary/60 uppercase hover:text-primary transition-colors"
                  >
                    Selengkapnya
                  </button>
                </div>
                <p className="text-xs font-bold text-neutral-700 line-clamp-2 leading-relaxed">
                  {content.pengumuman}
                </p>
              </div>
            </motion.div>
          )}

          {/* Section: Pendaftaran Baru Highlight */}
          <motion.button
            onClick={() => navigate('/register')}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-gradient-to-r from-emerald-600 via-primary to-emerald-700 p-4 rounded-[24px] flex items-center justify-between shadow-lg shadow-emerald-200/50 group transition-all mt-2"
          >
            <div className="flex items-center gap-4 text-white">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <UserPlus className="w-5 h-5" />
              </div>
              <div className="text-left flex flex-col items-start">
                <h3 className="text-lg font-black uppercase tracking-tight leading-none">Pendaftaran</h3>
                <p className="text-[9px] font-bold opacity-80 italic">KBIHU Arafah Muhammadiyah Klaten</p>
              </div>
            </div>
            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-colors shrink-0">
              <ChevronRight className="w-4 h-4 text-white" />
            </div>
          </motion.button>

        </>
      )}

      {/* Shared Utilities (Visible to Everyone) */}
      <section className="space-y-6 pt-6 border-t border-neutral-100">
        <h2 className="text-xs font-black text-primary uppercase tracking-widest text-center px-1">Jam Dunia & Jadwal Salat</h2>

        <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100 text-center space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-primary font-bold text-xs uppercase tracking-wider">
            <MapPin className="w-3.5 h-3.5" /> Surakarta, Indonesia
          </div>
          <p className="text-primary font-black text-[15px]">{getHijriDate(currentTime)}</p>
          <p className="text-[9px] text-emerald-600 font-medium italic">*Kalender Hijriah Global Tunggal (KHGT)</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-50/30 rounded-2xl p-4 border border-emerald-100 space-y-3">
            <div className="text-center space-y-0.5">
              <h3 className="text-[9px] font-black text-primary tracking-[0.1em] uppercase">Indonesia (WIB)</h3>
              <div className="text-xl font-mono font-black text-primary tracking-tighter leading-none py-1">
                {indoTimeStr} <span className="text-[10px]">WIB</span>
              </div>
              <p className="text-[8px] text-neutral-400 font-bold">{dateStr.split('2026')[0]}</p>
            </div>
            <div className="space-y-1">
              {prayerTimesIndo.map((p) => (
                <div key={p.name} className="bg-white rounded-lg p-2 flex justify-between items-center shadow-sm border border-emerald-50">
                  <span className="text-[9px] font-bold text-neutral-500 tracking-tight">{p.name}</span>
                  <span className="text-[9px] font-black text-primary">{p.time}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-amber-50/30 rounded-2xl p-4 border border-amber-100 space-y-3">
            <div className="text-center space-y-0.5">
              <h3 className="text-[9px] font-black text-amber-600 tracking-[0.1em] uppercase">Arab Saudi (WAS)</h3>
              <div className="text-xl font-mono font-black text-amber-600 tracking-tighter leading-none py-1">
                {saudiTimeStr} <span className="text-[10px]">WAS</span>
              </div>
              <p className="text-[8px] text-neutral-400 font-bold">{dateStr.split('2026')[0]}</p>
            </div>
            <div className="space-y-1">
              {prayerTimesSaudi.map((p) => (
                <div key={p.name} className="bg-white rounded-lg p-2 flex justify-between items-center shadow-sm border border-amber-50">
                  <span className="text-[9px] font-bold text-neutral-500 tracking-tight">{p.name}</span>
                  <span className="text-[9px] font-black text-amber-600">{p.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Al-Qur'an Digital ARAFAH */}
      <section id="quran-section" className="space-y-6 pt-6 border-t border-neutral-100">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 bg-emerald-600 shadow-lg shadow-emerald-200 rounded-2xl flex items-center justify-center text-white mb-2">
             <BookOpen className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-neutral-800 uppercase tracking-tight">Al-Qur'an Digital</h2>
          <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-[0.2em]">KBIHU ARAFAH MUHAMMADIYAH</p>
        </div>

        <div className="bg-white border border-neutral-100 rounded-[32px] overflow-hidden shadow-xl shadow-neutral-100/50">
          {quranView === 'list' ? (
            <div className="p-6 space-y-6">
              <div className="relative group">
                <input 
                  type="text" 
                  value={quranSearch}
                  onChange={(e) => setQuranSearch(e.target.value)}
                  placeholder="Cari Surah (contoh: Al-Baqarah)..."
                  className="w-full bg-neutral-50 border border-neutral-100 rounded-2xl py-4 px-6 pl-12 text-sm font-bold text-neutral-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300" />
              </div>

              <div className="grid grid-cols-1 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredSurahs.map((s) => (
                  <button 
                    key={s.nomor}
                    onClick={() => handleSelectSurah(s.nomor)}
                    className="flex items-center justify-between p-4 bg-neutral-50/50 hover:bg-emerald-50 border border-neutral-100 rounded-2xl transition-all group active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white border border-neutral-200 rounded-xl flex items-center justify-center text-xs font-black text-neutral-400 group-hover:text-emerald-600 transition-colors">
                        {s.nomor}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-black text-neutral-800 tracking-tight">{s.namaLatin}</p>
                        <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">{s.arti} • {s.jumlahAyat} Ayat</p>
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
            <div className="flex flex-col h-full bg-neutral-50/30">
              <div className="p-4 md:p-6 bg-white border-b border-neutral-100 flex items-center gap-4 sticky top-0 z-10">
                <button 
                  onClick={() => setQuranView('list')}
                  className="w-10 h-10 rounded-xl bg-neutral-50 flex items-center justify-center text-neutral-500 hover:bg-neutral-100 transition-all"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                  <h3 className="text-sm font-black text-neutral-800 uppercase tracking-tight leading-none">{surahDetail?.namaLatin || 'Memuat...'}</h3>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">{surahDetail?.arti} • {surahDetail?.jumlahAyat || 0} Ayat</p>
                </div>
                <div className="text-right">
                   <p className="text-2xl font-arabic text-emerald-700">{surahDetail?.nama}</p>
                </div>
              </div>

              <div className="p-4 md:p-8 space-y-12 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {loadingSurah ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-4">
                    <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Memuat Ayat Al-Qur'an...</p>
                  </div>
                ) : (
                  <>
                    {surahDetail?.nomor !== 1 && surahDetail?.nomor !== 9 && (
                      <div className="text-center py-8">
                        <p className="text-3xl font-arabic text-emerald-900 mb-2">بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ</p>
                        <p className="text-[10px] text-neutral-400 font-medium italic">Dengan menyebut nama Allah Yang Maha Pengasih lagi Maha Penyayang</p>
                      </div>
                    )}
                    
                    {surahDetail?.ayat.map((a: any) => (
                      <div key={a.nomorAyat} className="bg-white p-6 md:p-8 rounded-[32px] border border-neutral-100 shadow-sm space-y-8 relative group hover:border-emerald-200 transition-all">
                        <div className="absolute top-6 left-6 w-8 h-8 bg-neutral-50 rounded-lg flex items-center justify-center text-[10px] font-black text-neutral-400 border border-neutral-100 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                          {a.nomorAyat}
                        </div>
                        
                        <p className="text-4xl md:text-5xl font-arabic text-neutral-900 text-right leading-[1.8] md:leading-[2.2]" dir="rtl">
                          {a.teksArab}
                        </p>
                        
                        <div className="space-y-4 px-2">
                           <p className="text-[12px] md:text-[13px] italic font-medium text-emerald-700 leading-relaxed border-l-3 border-emerald-200 pl-4">{a.teksLatin}</p>
                           <p className="text-xs md:text-sm font-bold text-neutral-600 leading-relaxed bg-neutral-50/50 p-5 rounded-[24px] border border-neutral-100">{a.teksIndonesia}</p>
                        </div>
                      </div>
                    ))}

                    <div className="py-12 text-center border-t border-neutral-100">
                      <button 
                        onClick={() => {
                          setQuranView('list');
                          window.scrollTo({ top: document.getElementById('quran-section')?.offsetTop || 0, behavior: 'smooth' });
                        }}
                        className="px-8 py-3 bg-neutral-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-neutral-200 transition-all active:scale-95"
                      >
                        Kembali Ke Daftar Surah
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-center gap-2 text-neutral-400 pb-10">
          <BookOpen className="w-3.5 h-3.5" />
          <span className="text-[9px] font-black uppercase tracking-widest italic">Source Data: API kementerian Agama RI</span>
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
    </div>
  );
}
