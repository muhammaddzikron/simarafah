import { useState, useEffect, useMemo, cloneElement, ReactElement } from 'react';
import { 
  Users, LayoutDashboard, Settings, Search, 
  Filter, X, Download, Plus, Trash2, 
  ExternalLink, FileSpreadsheet, Eye, 
  Save, AlertCircle, CheckCircle2,
  UserPlus, UserCog, UserMinus, ShieldCheck,
  ChevronDown, ChevronUp, Clock, History,
  Database, Share2, Youtube, Instagram, MapPin,
  Smartphone, FileText, Video, Heart, Stethoscope,
  Wind, Map, Shield, MoreVertical, Key, Banknote,
  LogOut, Menu, Calendar, RefreshCw, BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Jemaah, AdminContent, Registration } from '../types';
import { 
  fetchJemaah, getAdminContent, saveAdminContent, 
  getAdminUsers, saveAdminUsers, getRegistrations,
  deleteRegistration, updateRegistrationStatus, updateRegistration,
  defaultAdminContent
} from '../services/api';
import { cn } from '../lib/utils';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type Tab = 'data' | 'registrations' | 'konten' | 'admin';

export default function AdminDashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  if (!user) return null;
  const [activeTab, setActiveTab] = useState<Tab>('registrations'); // Default to registrations for now to see it
  const [contentTab, setContentTab] = useState<'umum' | 'agenda' | 'doa' | 'teks' | 'video' | 'download' | 'galeri' | 'layanan'>('umum');
  const [jemaah, setJemaah] = useState<Jemaah[]>([]);
  const [content, setContent] = useState<AdminContent>(defaultAdminContent);
  const [admins, setAdmins] = useState<User[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingPassword, setEditingPassword] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState<Partial<User>>({
    username: '',
    password: '',
    nama: '',
    role: 'admin_petugas'
  });
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [editingRegistration, setEditingRegistration] = useState<Registration | null>(null);
  const [isSavingReg, setIsSavingReg] = useState(false);
  const [selectedRegs, setSelectedRegs] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<{ url: string; label: string } | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveContent = async () => {
    if (!content) return;
    try {
      setIsSavingContent(true);
      await saveAdminContent(content);
      setLastSaved(new Date());
      showToast('Konten berhasil disimpan ke Cloud Firebase!');
    } catch (err: any) {
      console.error("Error saving content:", err);
      if (err?.code === 'resource-exhausted') {
        showToast('Kuota Cloud JEMAAH penuh (Limit Free). Mohon coba lagi besok saat kuota direset.', 'error');
      } else {
        showToast('Gagal menyimpan ke Cloud. Periksa koneksi internet Anda.', 'error');
      }
    } finally {
      setIsSavingContent(false);
    }
  };

  // Filters State
  const [search, setSearch] = useState('');
  const [statFilter, setStatFilter] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    kloter: '',
    rombongan: '',
    karom: '',
    jk: '',
    tanazul: '',
    murur: '',
    nafar: '',
    gelombang: '',
    badal: '',
    kursiRoda: '',
    tongkat: '',
    penTubuh: '',
    ringJantung: ''
  });

  const loadAllData = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      
      const [dataJ, dataC, dataA, dataR] = await Promise.all([
        fetchJemaah(isManual),
        getAdminContent(),
        getAdminUsers(),
        getRegistrations()
      ]);
      
      setJemaah(dataJ || []);
      if (dataC) setContent(dataC);
      setAdmins(dataA || []);
      setRegistrations(dataR || []);
    } catch (err: any) {
      console.error("Critical error loading dashboard data:", err);
      if (err?.code === 'resource-exhausted') {
        showToast('Kuota Baca/Tulis Cloud Penuh. Data mungkin tidak terbaru (Limit Free).', 'error');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await updateRegistrationStatus(id, status);
      setRegistrations(prev => prev.map(r => r.id === id ? { ...r, status: status as any } : r));
      showToast('Status pendaftar berhasil diperbarui');
    } catch (err) {
      showToast('Gagal memperbarui status', 'error');
    }
  };

  const handleDeleteRegistration = async (id: string) => {
    if (!window.confirm('Hapus data pendaftar ini?')) return;
    try {
      await deleteRegistration(id);
      setRegistrations(prev => prev.filter(r => r.id !== id));
      showToast('Data pendaftar berhasil dihapus');
    } catch (err) {
      showToast('Gagal menghapus data', 'error');
    }
  };

  const handleUpdateRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRegistration) return;
    try {
      setIsSavingReg(true);
      const { id, ...data } = editingRegistration;
      await updateRegistration(id, data);
      setRegistrations(prev => prev.map(r => r.id === id ? editingRegistration : r));
      setEditingRegistration(null);
      showToast('Data pendaftar berhasil diperbarui');
    } catch (err) {
      showToast('Gagal memperbarui data', 'error');
    } finally {
      setIsSavingReg(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRegs.size === 0) return;
    if (!window.confirm(`Hapus ${selectedRegs.size} data pendaftar yang terpilih?`)) return;
    
    setIsBulkDeleting(true);
    try {
      await Promise.all(Array.from(selectedRegs).map(id => deleteRegistration(id)));
      setRegistrations(prev => prev.filter(r => !selectedRegs.has(r.id)));
      setSelectedRegs(new Set());
      showToast(`${selectedRegs.size} pendaftar berhasil dihapus`);
    } catch (err) {
      showToast('Beberapa data gagal dihapus', 'error');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedRegs.size === registrations.length) {
      setSelectedRegs(new Set());
    } else {
      setSelectedRegs(new Set(registrations.map(r => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedRegs);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRegs(next);
  };

  const handleExportRegistrations = () => {
    // Excel Export
    const ws = XLSX.utils.json_to_sheet(registrations.map((r, idx) => ({
      'No': idx + 1,
      'Porsi': r.nomorPorsi,
      'Nama': r.namaLengkap,
      'Usia': r.usia || '-',
      'Alamat': r.alamat,
      'WA': r.wa,
      'Ibu Kandung': r.namaIbu || '-',
      'Gender': r.jk,
      'Kesehatan': Object.entries(r.kesehatan).filter(([_, v]) => v).map(([k]) => k).join(', '),
      'Status': r.status || 'pending'
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pendaftar Baru");
    XLSX.writeFile(wb, "Data_Pendaftar_Baru.xlsx");
  };

  const handleExportRegistrationsPDF = () => {
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      doc.setFontSize(16);
      doc.text("Laporan Pendaftaran Jemaah Baru - SIM ARAFAH", 14, 15);
      doc.setFontSize(10);
      doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 22);
      
      const tableData = registrations.map((r, idx) => [
        idx + 1,
        r.nomorPorsi,
        r.namaLengkap,
        r.usia || '-',
        r.wa,
        r.namaIbu || '-',
        r.jk || '-',
        r.status || 'pending'
      ]);

      autoTable(doc, {
        head: [['No', 'Porsi', 'Nama', 'Usia', 'WhatsApp', 'Ibu Kandung', 'Gender', 'Status']],
        body: tableData,
        startY: 28,
        theme: 'grid',
        headStyles: { fillColor: [21, 128, 61], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 30 },
          2: { cellWidth: 60 },
          3: { cellWidth: 15 },
          4: { cellWidth: 40 },
          5: { cellWidth: 55 },
          6: { cellWidth: 30 },
          7: { cellWidth: 30 }
        }
      });

      doc.save(`Laporan_Pendaftaran_ARAFAH_${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error('PDF Export Error:', error);
      showToast('Gagal mengekspor PDF Pendaftar', 'error');
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (!file || !editingRegistration) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 800;
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        setEditingRegistration(prev => {
          if (!prev) return null;
          return {
            ...prev,
            photos: { ...(prev.photos || {}), [key]: dataUrl }
          };
        });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Load Data
  useEffect(() => {
    loadAllData();
  }, []);

  const filteredData = useMemo(() => {
    return jemaah.filter(j => {
      const matchSearch = j.namaLengkap.toLowerCase().includes(search.toLowerCase()) || 
                          j.nomorPorsi?.includes(search);
      
      const matchKloter = !filters.kloter || j.kloter === filters.kloter;
      const matchRomb = !filters.rombongan || j.rombongan === filters.rombongan;
      const matchKarom = !filters.karom || j.namaKetuaRombongan === filters.karom;
      const matchJK = !filters.jk || j.jenisKelamin === filters.jk;
      const matchTanazul = !filters.tanazul || j.tanazul === filters.tanazul;
      const matchMurur = !filters.murur || j.murur === filters.murur;
      const matchNafar = !filters.nafar || j.nafar === filters.nafar;
      const matchGel = !filters.gelombang || j.umrahGelombang === filters.gelombang;
      const matchBadal = !filters.badal || j.badal === filters.badal;
      const matchKursi = !filters.kursiRoda || j.kursiRoda === filters.kursiRoda;
      const matchTongkat = !filters.tongkat || j.tongkat === filters.tongkat;
      const matchPen = !filters.penTubuh || j.penTubuh === filters.penTubuh;
      const matchRing = !filters.ringJantung || j.ringJantung === filters.ringJantung;

      // Stat filters
      let matchStat = true;
      if (statFilter === 'male') matchStat = j.jenisKelamin === 'L';
      if (statFilter === 'female') matchStat = j.jenisKelamin === 'P';
      if (statFilter === 'murur') matchStat = j.murur === 'YA';
      if (statFilter === 'badal') matchStat = j.badal === 'YA';
      if (statFilter === 'kursi') matchStat = j.kursiRoda === 'YA';

      return matchSearch && matchKloter && matchRomb && matchKarom && matchJK && 
             matchTanazul && matchMurur && matchNafar && matchGel && 
             matchBadal && matchKursi && matchTongkat && matchPen && matchRing && matchStat;
    });
  }, [jemaah, search, filters, statFilter]);

  const stats = useMemo(() => {
    return {
      total: jemaah.length,
      male: jemaah.filter(j => j.jenisKelamin === 'L').length,
      female: jemaah.filter(j => j.jenisKelamin === 'P').length,
      kloter: [...new Set(jemaah.map(j => j.kloter).filter(Boolean))].length,
      romb: [...new Set(jemaah.map(j => j.rombongan).filter(Boolean))].length,
      murur: jemaah.filter(j => j.murur === 'YA').length,
      badal: jemaah.filter(j => j.badal === 'YA').length,
      kursi: jemaah.filter(j => j.kursiRoda === 'YA').length,
    };
  }, [jemaah]);

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredData.map((j, idx) => ({
      'No': j.no || idx + 1,
      'Nama Lengkap': j.namaLengkap,
      'WhatsApp Jemaah': j.wa,
      'Kloter': j.kloter,
      'Rombongan': j.rombongan,
      'Umur': j.umur,
      'Jenis Kelamin': j.jenisKelamin,
      'Nomor Porsi': j.nomorPorsi,
      'Nomor Paspor': j.paspor,
      'Nomor Visa': j.visa,
      'Alamat Lengkap': `${j.alamat}${j.desa ? `, ${j.desa}` : ''}${j.kecamatan ? `, Kec. ${j.kecamatan}` : ''}${j.kabupaten ? `, ${j.kabupaten}` : ''}`,
      'Ketua Rombongan': j.namaKetuaRombongan,
      'WA Karom': j.waKarom
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Jemaah");
    XLSX.writeFile(wb, "Data_Jemaah_SIM_ARAFAH.xlsx");
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF('l', 'mm', 'a4'); // Landscape A4
      doc.setFontSize(16);
      doc.text("Laporan Data Jemaah SIM ARAFAH", 14, 15);
      doc.setFontSize(10);
      doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 22);
      
      autoTable(doc, {
        head: [['No', 'Nama Lengkap', 'Porsi', 'WA', 'Kloter', 'Romb', 'Karom', 'Umur', 'JK']],
        body: filteredData.map((j, idx) => [
          j.no || idx + 1,
          j.namaLengkap,
          j.nomorPorsi,
          j.wa,
          j.kloter,
          j.rombongan,
          j.namaKetuaRombongan,
          j.umur,
          j.jenisKelamin
        ]),
        startY: 28,
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] },
        styles: { fontSize: 8 }
      });
      
      doc.save("Data_Jemaah_SIM_ARAFAH.pdf");
    } catch (error) {
      console.error('PDF Export Error:', error);
      showToast('Gagal mengekspor PDF. Silakan coba lagi.', 'error');
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
      <div className="flex flex-col items-center gap-6">
        <div className="w-24 h-24 animate-pulse flex items-center justify-center">
          <img 
            src="https://data.arafahklaten.com/logoarafah.png" 
            alt="Logo" 
            className="w-full h-full object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
             <div className="w-3 h-3 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
             <div className="w-3 h-3 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
             <div className="w-3 h-3 bg-primary rounded-full animate-bounce" />
          </div>
          <p className="text-sm font-black text-primary uppercase tracking-[0.2em] ml-2 mt-2">Memuat Sistem...</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col md:flex-row">
      {/* Mobile Navbar */}
      <div className="md:hidden bg-white border-b border-neutral-200 p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 overflow-hidden">
            <img 
              src="https://data.arafahklaten.com/logoarafah.png" 
              alt="Logo Arafah" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="font-black text-primary text-sm uppercase tracking-tight">SIM ARAFAH</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={onLogout}
            className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
            title="Keluar"
          >
            <LogOut className="w-5 h-5" />
          </button>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-neutral-500">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Sidebar - Desktop Only or Overlay Mobile */}
      <AnimatePresence>
        {(sidebarOpen) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
          />
        )}
        {(sidebarOpen || (typeof window !== 'undefined' && window.innerWidth >= 768)) && (
          <motion.aside 
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className="w-full md:w-64 bg-white border-r border-neutral-200 flex flex-col fixed md:sticky top-0 h-screen z-[51] md:z-40 shadow-xl md:shadow-none"
          >
            <div className="p-8 flex items-center justify-between">
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
                  <h1 className="font-black text-primary text-base uppercase leading-none tracking-tighter">SIM ARAFAH</h1>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1">Admin Dashboard</p>
                </div>
              </div>
              <button 
                onClick={() => setSidebarOpen(false)}
                className="md:hidden p-2 text-neutral-500 hover:bg-neutral-50 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-4 space-y-2 mt-4 md:mt-0">
              <NavItem 
                icon={<Database />} 
                label="Data Jemaah" 
                active={activeTab === 'data'} 
                onClick={() => { setActiveTab('data'); setSidebarOpen(false); }} 
              />
              <NavItem 
                icon={<UserPlus />} 
                label="Pendaftar Baru" 
                active={activeTab === 'registrations'} 
                onClick={() => { setActiveTab('registrations'); setSidebarOpen(false); }} 
              />
              {user.role !== 'admin_petugas' && (
                <NavItem 
                  icon={<LayoutDashboard />} 
                  label="Menu Konten" 
                  active={activeTab === 'konten'} 
                  onClick={() => { setActiveTab('konten'); setSidebarOpen(false); }} 
                />
              )}
              <NavItem 
                icon={<ShieldCheck />} 
                label="Panel Admin" 
                active={activeTab === 'admin'} 
                onClick={() => { setActiveTab('admin'); setSidebarOpen(false); }} 
              />
            </nav>

            <div className="p-4 border-t border-neutral-100">
              <div className="bg-neutral-50 rounded-2xl p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-xl">👤</div>
                  <div className="overflow-hidden">
                    <p className="text-[11px] font-black text-neutral-800 truncate uppercase">{user.nama}</p>
                    <p className="text-[9px] font-bold text-neutral-400 capitalize">{user.role.replace('_', ' ')}</p>
                  </div>
                </div>
                <button 
                  onClick={onLogout}
                  className="w-full py-2 bg-white border border-red-100 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" /> Keluar Sistem
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 min-w-0 p-4 md:p-10 space-y-8 pb-32 md:pb-20 overflow-x-hidden">
        {activeTab === 'data' && (
          <section className="space-y-8">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="flex items-center justify-between md:justify-start w-full md:w-auto gap-4">
                <div className="space-y-1 text-left">
                  <h2 className="text-xl md:text-2xl font-black text-primary uppercase tracking-tight">Data Jemaah Haji</h2>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Manajemen Basis Data Cloud
                  </div>
                </div>
                <button 
                  onClick={() => loadAllData(true)}
                  disabled={refreshing}
                  className={cn(
                    "p-3 rounded-2xl bg-white border border-neutral-100 shadow-sm text-primary transition-all active:scale-95",
                    refreshing && "animate-spin cursor-not-allowed opacity-50"
                  )}
                >
                  <RefreshCw className={cn("w-5 h-5", refreshing && "animate-spin")} />
                </button>
              </div>
              {user.role === 'super_admin' && (
                <a 
                  href="https://docs.google.com/spreadsheets/d/14W48hU9eYzxZ5EkjGGSTs1WCTzITV02QooOoo7lYix0/edit?gid=9046765#gid=9046765" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-primary font-black text-[10px] md:text-[11px] uppercase tracking-wide bg-white px-4 py-3 md:py-2 rounded-2xl md:rounded-full border border-neutral-200 shadow-sm hover:shadow-md transition-all"
                >
                  <Database className="w-4 h-4" /> <span className="hidden sm:inline">Link Sumber Data</span> (Spreadsheet) <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <StatBox 
                label="Total Jemaah" 
                value={stats.total} 
                icon={<Users />} 
                color="bg-primary text-white" 
                active={statFilter === null}
                onClick={() => setStatFilter(null)}
              />
              <StatBox 
                label="Laki-laki" 
                value={stats.male} 
                icon={<Stethoscope />} 
                color="bg-blue-50 text-blue-600" 
                active={statFilter === 'male'}
                onClick={() => setStatFilter('male')}
              />
              <StatBox 
                label="Perempuan" 
                value={stats.female} 
                icon={<Heart />} 
                color="bg-rose-50 text-rose-600" 
                active={statFilter === 'female'}
                onClick={() => setStatFilter('female')}
              />
              <StatBox 
                label="Kloter" 
                value={stats.kloter} 
                icon={<Map />} 
                color="bg-amber-50 text-amber-600" 
                active={false}
              />
              <StatBox 
                label="Rombongan" 
                value={stats.romb} 
                icon={<Users />} 
                color="bg-purple-50 text-purple-600" 
                active={false}
              />
              <StatBox 
                label="Murur" 
                value={stats.murur} 
                icon={<Shield />} 
                color="bg-emerald-50 text-emerald-600" 
                active={statFilter === 'murur'}
                onClick={() => setStatFilter('murur')}
              />
              <StatBox 
                label="Badal" 
                value={stats.badal} 
                icon={<History />} 
                color="bg-orange-50 text-orange-600" 
                active={statFilter === 'badal'}
                onClick={() => setStatFilter('badal')}
              />
              <StatBox 
                label="Kursi Roda" 
                value={stats.kursi} 
                icon={<Wind />} 
                color="bg-indigo-50 text-indigo-600" 
                active={statFilter === 'kursi'}
                onClick={() => setStatFilter('kursi')}
              />
            </div>

            {/* Controls */}
            <div className="bg-white rounded-3xl p-6 border border-neutral-100 shadow-md space-y-6">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                  <input 
                    type="text" 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari nama jemaah atau nomor porsi..."
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl py-3.5 pl-12 pr-12 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300" />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-neutral-300 hover:text-neutral-500">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button onClick={handleExportExcel} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-50 text-emerald-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all">
                    <Download className="w-4 h-4" /> Excel
                  </button>
                  <button onClick={handleExportPDF} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-red-50 text-red-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-red-100 transition-all">
                    <FileText className="w-4 h-4" /> PDF
                  </button>
                </div>
              </div>

              {/* Filters Accordion */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                      <Filter className="w-3.5 h-3.5" /> Filter Lanjutan
                    </div>
                    <div className="h-4 w-[1px] bg-neutral-100" />
                    <span className="text-[10px] font-black text-primary uppercase">Hasil: {filteredData.length} Data</span>
                    
                    {/* Active Filters Summary */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {statFilter && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/5 text-primary border border-primary/10 rounded-full text-[9px] font-black uppercase tracking-widest">
                          Statistik: {statFilter}
                          <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => setStatFilter(null)} />
                        </div>
                      )}
                      {Object.entries(filters).filter(([_, v]) => v !== '').map(([k, v]) => {
                        const labels: any = {
                          kloter: 'Kloter',
                          rombongan: 'Rombongan',
                          karom: 'Ketua Rombongan',
                          jk: 'Jenis Kelamin',
                          tanazul: 'Tanazul',
                          murur: 'Murur',
                          nafar: 'Nafar',
                          gelombang: 'Gelombang',
                          badal: 'Badal',
                          kursiRoda: 'Kursi Roda',
                          tongkat: 'Tongkat/Kruk',
                          penTubuh: 'Pen Tubuh',
                          ringJantung: 'Ring Jantung'
                        };
                        return (
                          <div key={k} className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[9px] font-black uppercase tracking-widest">
                            {labels[k] || k}: {v}
                            <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => setFilters({...filters, [k]: ''})} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setStatFilter(null);
                      setFilters({
                        kloter: '', rombongan: '', karom: '', jk: '', tanazul: '', murur: '',
                        nafar: '', gelombang: '', badal: '', kursiRoda: '', tongkat: '', penTubuh: '', ringJantung: ''
                      });
                    }}
                    className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline whitespace-nowrap"
                  >
                    Reset Filter
                  </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <FilterSelect label="Kloter" value={filters.kloter} options={[...new Set(jemaah.map(j => j.kloter).filter(Boolean))]} onChange={(v) => setFilters({...filters, kloter: v})} />
                  <FilterSelect label="Rombongan" value={filters.rombongan} options={[...new Set(jemaah.map(j => j.rombongan).filter(Boolean))]} onChange={(v) => setFilters({...filters, rombongan: v})} />
                  <FilterSelect label="Ketua Rombongan" value={filters.karom} options={[...new Set(jemaah.map(j => j.namaKetuaRombongan).filter(Boolean))]} onChange={(v) => setFilters({...filters, karom: v})} />
                  <FilterSelect label="Jenis Kelamin" value={filters.jk} options={['L', 'P']} onChange={(v) => setFilters({...filters, jk: v})} />
                  <FilterSelect label="Murur" value={filters.murur} options={['YA', 'TIDAK']} onChange={(v) => setFilters({...filters, murur: v})} />
                  <FilterSelect label="Tanazul" value={filters.tanazul} options={['YA', 'TIDAK']} onChange={(v) => setFilters({...filters, tanazul: v})} />
                  <FilterSelect label="Nafar" value={filters.nafar} options={['AWAL', 'TSANI']} onChange={(v) => setFilters({...filters, nafar: v})} />
                  <FilterSelect label="Badal" value={filters.badal} options={['YA', 'TIDAK']} onChange={(v) => setFilters({...filters, badal: v})} />
                  <FilterSelect label="Gelombang" value={filters.gelombang} options={['1', '2']} onChange={(v) => setFilters({...filters, gelombang: v})} />
                  <FilterSelect label="Kursi Roda" value={filters.kursiRoda} options={['YA', 'TIDAK']} onChange={(v) => setFilters({...filters, kursiRoda: v})} />
                  <FilterSelect label="Tongkat/Kruk" value={filters.tongkat} options={['YA', 'TIDAK']} onChange={(v) => setFilters({...filters, tongkat: v})} />
                  <FilterSelect label="Pen Tubuh" value={filters.penTubuh} options={['YA', 'TIDAK']} onChange={(v) => setFilters({...filters, penTubuh: v})} />
                  <FilterSelect label="Ring Jantung" value={filters.ringJantung} options={['YA', 'TIDAK']} onChange={(v) => setFilters({...filters, ringJantung: v})} />
                </div>
              </div>
            </div>

            {/* Data Table */}
            <div className="bg-white border border-neutral-100 rounded-3xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-100">
                      <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest min-w-[50px]">No</th>
                      <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest min-w-[200px]">Nama Lengkap</th>
                      <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">WA Jemaah</th>
                      <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Kloter</th>
                      <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Rombongan</th>
                      <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Umur</th>
                      <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">JK</th>
                      <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Nomor Porsi</th>
                      <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Paspor</th>
                      <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Visa</th>
                      <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest min-w-[250px]">Alamat Lengkap</th>
                      <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Ketua Rombongan</th>
                      <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest text-emerald-600">WA Karom</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {filteredData.slice(0, 100).map((j, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="px-6 py-4 text-[12px] font-mono font-bold text-neutral-400">{j.no || idx + 1}</td>
                        <td className="px-6 py-4">
                          <span className="text-[13px] font-black text-neutral-800">{j.namaLengkap}</span>
                        </td>
                        <td className="px-6 py-4">
                          <a href={`https://wa.me/${(j.wa || '').replace(/[^0-9]/g, '')}`} target="_blank" className="flex items-center gap-1.5 text-emerald-600 font-black text-[11px] hover:underline">
                            <Smartphone className="w-3.5 h-3.5" /> {j.wa || '-'}
                          </a>
                        </td>
                        <td className="px-6 py-4 text-[12px] font-bold text-neutral-600">{j.kloter}</td>
                        <td className="px-6 py-4 text-[12px] font-bold text-neutral-600">{j.rombongan}</td>
                        <td className="px-6 py-4 text-[12px] font-bold text-neutral-600">{j.umur} Thn</td>
                        <td className="px-6 py-4 text-[12px] font-black text-neutral-500">{j.jenisKelamin}</td>
                        <td className="px-6 py-4">
                          <span className="text-[11px] font-black text-primary bg-secondary px-2.5 py-1 rounded-lg">{j.nomorPorsi}</span>
                        </td>
                        <td className="px-6 py-4 text-[12px] font-mono font-bold text-neutral-600">{j.paspor || '-'}</td>
                        <td className="px-6 py-4 text-[12px] font-mono font-bold text-neutral-600">{j.visa || '-'}</td>
                        <td className="px-6 py-4">
                          <p className="text-[11px] font-medium text-neutral-500 leading-relaxed uppercase">
                            {j.alamat}{j.desa ? `, ${j.desa}` : ''}{j.kecamatan ? `, Kec. ${j.kecamatan}` : ''}{j.kabupaten ? `, ${j.kabupaten}` : ''}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-[11px] font-black text-neutral-600 uppercase tracking-tight">{j.namaKetuaRombongan || '-'}</td>
                        <td className="px-6 py-4">
                          {j.waKarom ? (
                            <a href={`https://wa.me/${j.waKarom.replace(/[^0-9]/g, '')}`} target="_blank" className="flex items-center gap-1.5 text-emerald-600 font-black text-[11px] hover:underline">
                              <Smartphone className="w-3.5 h-3.5" /> {j.waKarom}
                            </a>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredData.length > 50 && (
                <div className="p-4 bg-neutral-50 text-center">
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Menampilkan 50 data pertama dari {filteredData.length} hasil</p>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'registrations' && (
          <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-1 text-left">
                <h2 className="text-xl md:text-2xl font-black text-primary uppercase tracking-tight leading-none">Pendaftaran Jemaah Baru</h2>
                <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">
                  <UserPlus className="w-3.5 h-3.5" /> Data pendaftar mandiri via aplikasi
                </div>
              </div>
              <div className="flex items-center gap-3">
                 {selectedRegs.size > 0 && (
                   <button 
                    onClick={handleBulkDelete}
                    disabled={isBulkDeleting}
                    className="flex items-center gap-2 px-5 py-3 bg-red-50 text-red-600 border border-red-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isBulkDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Hapus {selectedRegs.size} Terpilih
                  </button>
                 )}
                 <button 
                  onClick={handleExportRegistrations}
                  className="flex items-center gap-2 px-5 py-3 bg-white border border-neutral-200 text-neutral-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-50 transition-all active:scale-95"
                >
                  <Download className="w-4 h-4" /> Excel
                </button>
                <button 
                  onClick={handleExportRegistrationsPDF}
                  className="flex items-center gap-2 px-5 py-3 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-100 transition-all active:scale-95 hover:bg-rose-700"
                >
                  <FileText className="w-4 h-4" /> PDF
                </button>
              </div>
            </header>

            <div className="bg-white rounded-[32px] border border-neutral-100 shadow-xl shadow-neutral-100/50 overflow-hidden">
              <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="bg-neutral-50/50 border-b border-neutral-100">
                      <th className="px-6 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest text-center w-16">
                        NO
                      </th>
                      <th className="px-6 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest text-center w-16">
                        <div className="flex items-center justify-center">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-neutral-300 text-primary focus:ring-primary cursor-pointer"
                            checked={registrations.length > 0 && selectedRegs.size === registrations.length}
                            onChange={toggleSelectAll}
                          />
                        </div>
                      </th>
                      <th className="px-6 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Identitas Pendaftar</th>
                      <th className="px-6 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Kontak</th>
                      <th className="px-6 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest text-center">Kesehatan</th>
                      <th className="px-6 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Identitas Nama Ibu</th>
                      <th className="px-6 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Status Data</th>
                      <th className="px-6 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Upload Data</th>
                      <th className="px-6 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {registrations.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-20 text-center">
                          <div className="flex flex-col items-center gap-3 grayscale opacity-30">
                            <Database className="w-12 h-12" />
                            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Belum ada data pendaftar</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      registrations.map((r, idx) => (
                        <tr key={r.id} className={cn(
                          "hover:bg-neutral-50/50 transition-colors group",
                          selectedRegs.has(r.id) && "bg-emerald-50/30"
                        )}>
                          <td className="px-6 py-5 text-center text-[11px] font-black text-neutral-400">
                            {(idx + 1).toString().padStart(2, '0')}
                          </td>
                          <td className="px-6 py-5 text-center">
                            <div className="flex items-center justify-center">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded border-neutral-300 text-primary focus:ring-primary cursor-pointer"
                                checked={selectedRegs.has(r.id)}
                                onChange={() => toggleSelect(r.id)}
                              />
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="space-y-1">
                              <p className="text-[13px] font-black text-neutral-800 leading-none">{r.namaLengkap}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-primary bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 italic">Porsi: {r.nomorPorsi}</span>
                                <span className="text-[9px] font-bold text-neutral-400 lowercase">{r.jk} • {r.usia || '-'} thn</span>
                              </div>
                              <p className="text-[9px] font-medium text-neutral-500 line-clamp-1">{r.alamat}</p>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <a href={`https://wa.me/${r.wa.replace(/[^0-9]/g, '')}`} target="_blank" className="inline-flex items-center gap-1.5 text-emerald-600 font-black text-[11px] hover:underline bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                              <Smartphone className="w-3.5 h-3.5" /> {r.wa}
                            </a>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <div className="flex flex-wrap justify-center gap-1">
                              {Object.entries(r.kesehatan).map(([k, v]) => v && (
                                <span key={k} className="text-[8px] font-black px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full uppercase tracking-tighter border border-rose-100">{k}</span>
                              ))}
                              {!Object.values(r.kesehatan).some(v => v) && <span className="text-[9px] text-neutral-300 italic">Normal/Sehat</span>}
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                <Heart className="w-4 h-4" />
                              </div>
                              <div className="space-y-0.5">
                                <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest leading-none">Ibu Kandung</p>
                                <p className="text-[11px] font-black text-neutral-700">{r.namaIbu || '-'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                             <div className="flex flex-col gap-1">
                               <select 
                                  value={r.status || 'pending'}
                                  onChange={(e) => handleStatusUpdate(r.id, e.target.value)}
                                  className={cn(
                                    "text-[9px] font-black uppercase px-3 py-1.5 rounded-full border outline-none transition-all cursor-pointer w-fit",
                                    r.status === 'verified' ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                                    r.status === 'rejected' ? "bg-red-50 text-red-600 border-red-200" :
                                    "bg-blue-50 text-blue-600 border-blue-200"
                                  )}
                               >
                                 <option value="pending">⏳ Pending</option>
                                 <option value="verified">✅ Verified</option>
                                 <option value="rejected">❌ Rejected</option>
                               </select>
                               {r.status === 'verified' && (
                                 <span className="text-[8px] font-bold text-emerald-500 ml-1 uppercase tracking-widest flex items-center gap-1">
                                   <CheckCircle2 className="w-2 h-2" /> Terverifikasi
                                 </span>
                               )}
                             </div>
                          </td>
                          <td className="px-6 py-5">
                             <div className="flex items-center gap-1">
                               {['KTP', 'KK', 'SPPH', 'FOTO'].map(docType => (
                                 <button
                                   key={docType}
                                   disabled={!r.photos?.[docType]}
                                   onClick={() => r.photos?.[docType] && setViewingPhoto({ url: r.photos[docType], label: docType })}
                                   className={cn(
                                     "p-2 rounded-lg transition-all",
                                     r.photos?.[docType] 
                                       ? "text-emerald-600 bg-emerald-50 hover:bg-emerald-100" 
                                       : "text-neutral-200 bg-neutral-50 cursor-not-allowed"
                                   )}
                                   title={`View ${docType}`}
                                 >
                                   <Eye className="w-3.5 h-3.5" />
                                 </button>
                               ))}
                             </div>
                          </td>
                          <td className="px-6 py-5 text-right">
                             <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => setEditingRegistration(r)}
                                  className="p-2.5 text-primary hover:bg-emerald-50 rounded-xl transition-all active:scale-95"
                                  title="Edit Data"
                                 >
                                   <UserCog className="w-4 h-4" />
                                 </button>
                                 <button 
                                   onClick={() => handleDeleteRegistration(r.id)}
                                   className="p-2.5 text-rose-500 hover:bg-rose-100 hover:text-rose-700 rounded-xl transition-all active:scale-95"
                                   title="Hapus Data"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                             </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'konten' && user.role !== 'admin_petugas' && content && (
          <section className="space-y-8 max-w-6xl">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1 text-center md:text-left">
                <h2 className="text-xl md:text-2xl font-black text-primary uppercase tracking-tight">Manajemen Konten</h2>
                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest flex items-center justify-center md:justify-start gap-1.5">
                  <LayoutDashboard className="w-3.5 h-3.5" /> Optimalisasi Konten & Layanan Aplikasi
                </p>
              </div>
            <div className="relative group">
              <div className="flex bg-neutral-100/80 backdrop-blur-sm p-1.5 rounded-2xl overflow-x-auto no-scrollbar gap-1">
                {[
                  { id: 'umum', label: 'Umum' },
                  { id: 'agenda', label: 'Agenda' },
                  { id: 'doa', label: 'Doa' },
                  { id: 'teks', label: 'Materi Artikel' },
                  { id: 'video', label: 'Video' },
                  { id: 'download', label: 'Drive' },
                  { id: 'galeri', label: 'Galeri' },
                  { id: 'layanan', label: 'Layanan' },
                ].map((tab) => (
                  <button 
                    key={tab.id}
                    onClick={() => setContentTab(tab.id as any)}
                    className={cn(
                      "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                      contentTab === tab.id ? "bg-white text-primary shadow-sm ring-1 ring-neutral-200/50" : "text-neutral-500 hover:bg-white/50"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-neutral-100/50 to-transparent pointer-events-none md:hidden" />
            </div>
            </header>

            <AnimatePresence mode="wait">
              {contentTab === 'umum' && (
                <motion.div 
                  key="umum"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="grid grid-cols-1 lg:grid-cols-2 gap-8"
                >
                  {/* Left: Profil */}
                  <div className="bg-white p-8 rounded-3xl border border-neutral-100 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <SectionHeader icon={<FileText />} title="Profil Lembaga" />
                      <button 
                        onClick={handleSaveContent}
                        disabled={isSavingContent}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" /> Simpan Cloud
                      </button>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Deskripsi Profil KBIHU</label>
                      <textarea 
                        value={content.profil}
                        onChange={(e) => setContent({...content, profil: e.target.value})}
                        placeholder="Tuliskan profil lengkap..."
                        className="w-full h-48 p-5 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                      />
                    </div>
                    
                    <div className="space-y-4 pt-4 border-t border-neutral-50">
                      <SectionHeader icon={<Clock />} title="Pengumuman Berjalan" />
                      <textarea 
                        value={content.pengumuman}
                        onChange={(e) => setContent({...content, pengumuman: e.target.value})}
                        placeholder="Tulis pengumuman baru..."
                        className="w-full h-24 p-5 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-primary/10 outline-none"
                      />
                    </div>
                  </div>

                  {/* Right: Sosmed & Kontak */}
                  <div className="space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-neutral-100 shadow-sm space-y-6">
                      <SectionHeader icon={<Share2 />} title="Media Sosial" />
                      <div className="grid grid-cols-1 gap-4">
                        <IconInput icon={<Instagram className="text-pink-500" />} value={content.sosmed.ig} onChange={(v) => setContent({...content, sosmed: {...content.sosmed, ig: v}})} label="Instagram Username" />
                        <IconInput icon={<Smartphone className="text-neutral-800" />} value={content.sosmed.tiktok} onChange={(v) => setContent({...content, sosmed: {...content.sosmed, tiktok: v}})} label="Tiktok Username" />
                        <IconInput icon={<Youtube className="text-red-500" />} value={content.sosmed.yt} onChange={(v) => setContent({...content, sosmed: {...content.sosmed, yt: v}})} label="YouTube Username / Handle" />
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-neutral-100 shadow-sm space-y-6">
                      <SectionHeader icon={<MapPin />} title="Data Kontak & Google Maps" />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <IconInput icon={<Smartphone className="text-emerald-500" />} value={content.kontak.wa1} onChange={(v) => setContent({...content, kontak: {...content.kontak, wa1: v}})} label="WA Admin 1" />
                        <IconInput icon={<Smartphone className="text-emerald-500" />} value={content.kontak.wa2} onChange={(v) => setContent({...content, kontak: {...content.kontak, wa2: v}})} label="WA Admin 2" />
                      </div>
                      <IconInput icon={<MapPin className="text-red-500" />} value={content.kontak.alamat} onChange={(v) => setContent({...content, kontak: {...content.kontak, alamat: v}})} label="Alamat Fisik Kantor" />
                      <IconInput icon={<Map className="text-blue-500" />} value={content.kontak.peta} onChange={(v) => setContent({...content, kontak: {...content.kontak, peta: v}})} label="Link Iframe/URL Google Maps" />
                    </div>
                  </div>
                </motion.div>
              )}

              {contentTab === 'agenda' && (
                <motion.div 
                  key="agenda"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white p-8 rounded-3xl border border-neutral-100 shadow-sm space-y-8"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <SectionHeader icon={<Calendar />} title="Agenda Kegiatan KBIHU" />
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1 ml-10">Jadwal kegiatan atau manasik terpusat</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setContent({...content, agenda: [{ tanggal: new Date().toISOString().split('T')[0], kegiatan: '' }, ...content.agenda]})}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100 transition-all active:scale-95"
                      >
                        <Plus className="w-4 h-4" /> Tambah Agenda
                      </button>
                      <button 
                        onClick={handleSaveContent}
                        disabled={isSavingContent}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white border border-primary text-primary rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" /> Simpan Cloud
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {content.agenda.map((a, i) => (
                      <div key={i} className="flex flex-col md:flex-row gap-4 p-5 bg-neutral-50 rounded-2xl border border-neutral-100 group">
                        <div className="w-full md:w-48">
                          <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1 block">Tanggal Kegiatan</label>
                          <input 
                            type="date" 
                            value={a.tanggal} 
                            onChange={(e) => {
                              const newAgenda = [...content.agenda];
                              newAgenda[i].tanggal = e.target.value;
                              setContent({...content, agenda: newAgenda});
                            }} 
                            className="w-full p-2.5 bg-white border border-neutral-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary/10 transition-all outline-none" 
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1 block">Nama/Deskripsi Kegiatan</label>
                          <input 
                            type="text" 
                            value={a.kegiatan} 
                            onChange={(e) => {
                              const newAgenda = [...content.agenda];
                              newAgenda[i].kegiatan = e.target.value;
                              setContent({...content, agenda: newAgenda});
                            }} 
                            placeholder="Contoh: Manasik Haji Ke-1 di Masjid Agung..." 
                            className="w-full p-2.5 bg-white border border-neutral-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary/10 transition-all outline-none" 
                          />
                        </div>
                        <div className="flex items-end">
                          <button 
                            onClick={() => {
                              const newAgenda = content.agenda.filter((_, idx) => idx !== i);
                              setContent({...content, agenda: newAgenda});
                            }} 
                            className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {contentTab === 'doa' && (
                <motion.div 
                  key="doa"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="flex items-center justify-between bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm">
                    <div>
                      <SectionHeader icon={<Heart className="text-amber-500" />} title="Koleksi Doa Manasik & Harian" />
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1 ml-10">Kelola teks arab, latin dan terjemahan doa</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setContent({...content, materi: [{ 
                          id: Math.random().toString(36).substr(2, 9), 
                          judul: '', 
                          tipe: 'doa', 
                          isi: { arab: '', latin: '', terjemahan: '' } 
                        }, ...content.materi]})}
                        className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-100 transition-all active:scale-95"
                      >
                        <Plus className="w-4 h-4" /> Tambah Doa Baru
                      </button>
                      <button 
                        onClick={handleSaveContent}
                        disabled={isSavingContent}
                        className="flex items-center gap-2 px-6 py-3 bg-white border border-amber-600 text-amber-600 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" /> Simpan Cloud
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {content.materi.filter(m => m.tipe === 'doa').map((m) => {
                      const idx = content.materi.findIndex(item => item.id === m.id);
                      return (
                        <div key={m.id} className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm space-y-6 animate-in fade-in slide-in-from-bottom-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
                                <Heart className="w-4 h-4" />
                              </div>
                              <input 
                                type="text" 
                                value={m.judul} 
                                onChange={(e) => {
                                  const newMateri = [...content.materi];
                                  newMateri[idx].judul = e.target.value;
                                  setContent({...content, materi: newMateri});
                                }}
                                placeholder="Ketik judul doa di sini..."
                                className="text-sm font-black text-neutral-800 focus:outline-none placeholder:text-neutral-300 w-full"
                              />
                            </div>
                            <button 
                              onClick={() => {
                                const newMateri = content.materi.filter(item => item.id !== m.id);
                                setContent({...content, materi: newMateri});
                              }}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 gap-5">
                            <div className="space-y-2">
                              <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">Teks Arab (Gunakan Font Arab)</label>
                              <textarea 
                                value={m.isi?.arab}
                                dir="rtl"
                                onChange={(e) => {
                                  const newMateri = [...content.materi];
                                  if (newMateri[idx].isi) newMateri[idx].isi!.arab = e.target.value;
                                  setContent({...content, materi: newMateri});
                                }}
                                className="w-full h-24 p-4 bg-neutral-50 border border-neutral-100 rounded-2xl text-2xl font-medium text-right font-serif focus:ring-4 focus:ring-amber-500/10 outline-none"
                              />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">Bacaan Latin</label>
                                <textarea 
                                  value={m.isi?.latin}
                                  onChange={(e) => {
                                    const newMateri = [...content.materi];
                                    if (newMateri[idx].isi) newMateri[idx].isi!.latin = e.target.value;
                                    setContent({...content, materi: newMateri});
                                  }}
                                  className="w-full h-20 p-4 bg-neutral-50 border border-neutral-100 rounded-2xl text-xs italic font-medium focus:ring-4 focus:ring-primary/10 outline-none"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">Terjemahan Indonesia</label>
                                <textarea 
                                  value={m.isi?.terjemahan}
                                  onChange={(e) => {
                                    const newMateri = [...content.materi];
                                    if (newMateri[idx].isi) newMateri[idx].isi!.terjemahan = e.target.value;
                                    setContent({...content, materi: newMateri});
                                  }}
                                  className="w-full h-20 p-4 bg-neutral-50 border border-neutral-100 rounded-2xl text-xs font-medium focus:ring-4 focus:ring-primary/10 outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {contentTab === 'teks' && (
                <motion.div 
                  key="teks"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="flex items-center justify-between bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm">
                    <div>
                      <SectionHeader icon={<BookOpen className="text-indigo-500" />} title="Manajemen Materi Artikel" />
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1 ml-10">Input bimbingan dalam bentuk tulisan/artikel</p>
                    </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setContent({...content!, materi: [{ 
                            id: Math.random().toString(36).substr(2, 9), 
                            judul: '', 
                            tipe: 'teks', 
                            link: '',
                            isi: { 
                              konten: '',
                              arab: '',
                              latin: '',
                              terjemahan: ''
                            }
                          }, ...content!.materi]})}
                          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all active:scale-95"
                        >
                          <Plus className="w-4 h-4" /> Tambah Materi Artikel
                        </button>
                        <button 
                          onClick={handleSaveContent}
                          disabled={isSavingContent}
                          className={cn(
                            "flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95 disabled:opacity-50",
                            isSavingContent ? "bg-neutral-100 text-neutral-400" : "bg-white border border-indigo-600 text-indigo-600 hover:bg-indigo-50"
                          )}
                        >
                          {isSavingContent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          {isSavingContent ? 'Menyimpan...' : 'Simpan Cloud'}
                        </button>
                        {lastSaved && !isSavingContent && (
                          <motion.div 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span className="text-[9px] font-black uppercase">Berhasil {lastSaved.toLocaleTimeString('id-id', { hour: '2-digit', minute: '2-digit' })}</span>
                          </motion.div>
                        )}
                      </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {content.materi.filter(m => m.tipe === 'teks').map((m) => {
                      const idx = content.materi.findIndex(item => item.id === m.id);
                      return (
                        <div key={m.id} className="bg-white p-8 rounded-[32px] border border-neutral-100 shadow-sm space-y-6 animate-in fade-in slide-in-from-bottom-2">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">Judul Artikel / Materi</label>
                              <input 
                                type="text" 
                                value={m.judul} 
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setContent((prev: any) => {
                                    if (!prev) return prev;
                                    const newMateri = [...prev.materi];
                                    const mIdx = newMateri.findIndex((item: any) => item.id === m.id);
                                    if (mIdx !== -1) {
                                      newMateri[mIdx] = { ...newMateri[mIdx], judul: val };
                                    }
                                    return { ...prev, materi: newMateri };
                                  });
                                }}
                                placeholder="Masukkan judul materi..."
                                className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl py-4 px-6 text-base font-black text-neutral-800 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                              />
                            </div>
                            <div className="pt-6">
                              <button 
                                onClick={() => {
                                  const newMateri = content.materi.filter(item => item.id !== m.id);
                                  setContent({...content, materi: newMateri});
                                }}
                                className="p-3 text-red-500 hover:bg-red-50 rounded-2xl border border-red-100 transition-all"
                                title="Hapus Materi"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">Isi Konten Materi</label>
                            <textarea 
                              value={m.isi?.konten}
                              onChange={(e) => {
                                const val = e.target.value;
                                setContent((prev: any) => {
                                  if (!prev) return prev;
                                  const newMateri = [...prev.materi];
                                  const mIdx = newMateri.findIndex((item: any) => item.id === m.id);
                                  if (mIdx !== -1) {
                                    const item = { ...newMateri[mIdx] };
                                    item.isi = { ...(item.isi || {}), konten: val };
                                    newMateri[mIdx] = item;
                                  }
                                  return { ...prev, materi: newMateri };
                                });
                              }}
                              placeholder="Ketikkan materi lengkap di sini..."
                              className="w-full h-80 bg-neutral-50 border border-neutral-200 rounded-[32px] p-8 text-sm font-medium leading-relaxed focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                            />
                            <p className="text-[9px] text-neutral-400 font-bold italic ml-2">*Teks akan otomatis ditampilkan rata kanan-kiri (justified) di aplikasi jemaah.</p>
                          </div>
                        </div>
                      );
                    })}
                    {content.materi.filter(m => m.tipe === 'teks').length === 0 ? (
                      <div className="py-20 text-center bg-white rounded-[40px] border border-dashed border-neutral-200">
                        <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4">
                          <BookOpen className="w-8 h-8 text-neutral-300" />
                        </div>
                        <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Belum ada materi teks ketikan.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-4 pt-8">
                        <button 
                          onClick={handleSaveContent}
                          disabled={isSavingContent}
                          className={cn(
                            "flex items-center gap-3 px-12 py-5 rounded-[28px] text-[13px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50",
                            isSavingContent ? "bg-neutral-100 text-neutral-400 shadow-none" : "bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700"
                          )}
                        >
                          {isSavingContent ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                          {isSavingContent ? 'Sedang Menyimpan...' : 'Simpan Semua Artikel ke Cloud'}
                        </button>

                        {lastSaved && !isSavingContent && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-2 px-6 py-2 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-[11px] font-black">SELURUH ARTIKEL BERHASIL TERSIMPAN PADA {lastSaved.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          </motion.div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {contentTab === 'video' && (
                <motion.div 
                  key="video"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="flex items-center justify-between bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm">
                    <div>
                      <SectionHeader icon={<Video className="text-rose-500" />} title="Materi Manasik Video (YouTube)" />
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1 ml-10">Koleksi video bimbingan dan dokumentasi</p>
                    </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setContent({...content, materi: [{ 
                            id: Math.random().toString(36).substr(2, 9), 
                            judul: '', 
                            tipe: 'video', 
                            link: '' 
                          }, ...content.materi]})}
                          className="flex items-center gap-2 px-6 py-3 bg-rose-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-100 transition-all active:scale-95"
                        >
                          <Plus className="w-4 h-4" /> Tambah Video Video
                        </button>
                        <button 
                          onClick={handleSaveContent}
                          disabled={isSavingContent}
                          className="flex items-center gap-2 px-6 py-3 bg-white border border-rose-600 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95 disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" /> Simpan Cloud
                        </button>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {content.materi.filter(m => m.tipe === 'video').map((m) => {
                      const idx = content.materi.findIndex(item => item.id === m.id);
                      return (
                        <div key={m.id} className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-2">
                          <div className="flex items-center justify-between gap-3">
                            <input 
                              type="text" 
                              value={m.judul} 
                              onChange={(e) => {
                                const newMateri = [...content.materi];
                                newMateri[idx].judul = e.target.value;
                                setContent({...content, materi: newMateri});
                              }}
                              placeholder="Judul video..."
                              className="text-sm font-black text-neutral-800 focus:outline-none placeholder:text-neutral-300 w-full"
                            />
                            <button 
                              onClick={() => {
                                const newMateri = content.materi.filter(item => item.id !== m.id);
                                setContent({...content, materi: newMateri});
                              }}
                              className="p-2 text-red-500 hover:bg-neutral-50 rounded-full transition-all flex-shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2">
                              <Youtube className="w-4 h-4 text-red-500" />
                            </div>
                            <input 
                              type="text" 
                              value={m.link} 
                              onChange={(e) => {
                                const newMateri = [...content.materi];
                                newMateri[idx].link = e.target.value;
                                setContent({...content, materi: newMateri});
                              }}
                              placeholder="Link YouTube (URL)..."
                              className="w-full bg-neutral-50 border border-neutral-100 rounded-2xl py-3.5 pl-12 pr-4 text-[11px] font-bold focus:ring-4 focus:ring-rose-500/10 outline-none transition-all"
                            />
                          </div>
                          
                          {/* Video Preview in Admin */}
                          {m.link && m.link !== '#' && (
                            <div className="aspect-video bg-neutral-100 rounded-2xl overflow-hidden border border-neutral-100">
                              {(() => {
                                let embedLink = m.link;
                                if (embedLink.includes('youtube.com/watch?v=')) {
                                  embedLink = embedLink.replace('watch?v=', 'embed/');
                                } else if (embedLink.includes('youtu.be/')) {
                                  const id = embedLink.split('youtu.be/')[1].split('?')[0];
                                  embedLink = `https://www.youtube.com/embed/${id}`;
                                }
                                return (
                                  <iframe 
                                    src={embedLink} 
                                    className="w-full h-full border-none"
                                    title="Preview"
                                  />
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {contentTab === 'download' && (
                <motion.div 
                  key="download"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="flex items-center justify-between bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm">
                    <div>
                      <SectionHeader icon={<Download className="text-blue-500" />} title="Materi Drive & Download" />
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1 ml-10">Input link Google Drive untuk materi bimbingan jemaah</p>
                    </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setContent({...content, materi: [{ 
                            id: Math.random().toString(36).substr(2, 9), 
                            judul: '', 
                            tipe: 'download', 
                            link: '' 
                          }, ...content.materi]})}
                          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 transition-all active:scale-95"
                        >
                          <Plus className="w-4 h-4" /> Tambah Materi Drive
                        </button>
                        <button 
                          onClick={handleSaveContent}
                          disabled={isSavingContent}
                          className="flex items-center gap-2 px-6 py-3 bg-white border border-blue-600 text-blue-600 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95 disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" /> Simpan Cloud
                        </button>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {content.materi.filter(m => m.tipe === 'download').map((m) => {
                      const idx = content.materi.findIndex(item => item.id === m.id);
                      return (
                        <div key={m.id} className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-2">
                          <div className="flex items-center justify-between gap-3">
                            <input 
                              type="text" 
                              value={m.judul} 
                              onChange={(e) => {
                                const newMateri = [...content.materi];
                                newMateri[idx].judul = e.target.value;
                                setContent({...content, materi: newMateri});
                              }}
                              placeholder="Nama file/judul..."
                              className="text-sm font-black text-neutral-800 focus:outline-none placeholder:text-neutral-300 w-full"
                            />
                            <button 
                              onClick={() => {
                                const newMateri = content.materi.filter(item => item.id !== m.id);
                                setContent({...content, materi: newMateri});
                              }}
                              className="p-2 text-red-500 hover:bg-neutral-50 rounded-full transition-all flex-shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2">
                              <ExternalLink className="w-4 h-4 text-blue-500" />
                            </div>
                            <input 
                              type="text" 
                              value={m.link} 
                              onChange={(e) => {
                                const newMateri = [...content.materi];
                                newMateri[idx].link = e.target.value;
                                setContent({...content, materi: newMateri});
                              }}
                              placeholder="Link Google Drive/Download..."
                              className="w-full bg-neutral-50 border border-neutral-100 rounded-2xl py-3.5 pl-12 pr-4 text-[11px] font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {contentTab === 'galeri' && (
                <motion.div 
                  key="galeri"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white p-8 rounded-3xl border border-neutral-100 shadow-sm space-y-8"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <SectionHeader icon={<Video />} title="Galeri Dokumentasi YouTube" />
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1 ml-10">Masukkan link embed YouTube untuk galeri beranda</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setContent({...content, galeri: ['', ...content.galeri]})}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100 transition-all active:scale-95"
                      >
                        <Plus className="w-4 h-4" /> Tambah Video
                      </button>
                      <button 
                        onClick={handleSaveContent}
                        disabled={isSavingContent}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white border border-primary text-primary rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" /> Simpan Cloud
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {content.galeri.map((link, i) => (
                      <div key={i} className="space-y-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                        <div className="flex items-center justify-between">
                          <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">YouTube Link / URL</label>
                          <button 
                            onClick={() => {
                              const newGaleri = content.galeri.filter((_, idx) => idx !== i);
                              setContent({...content, galeri: newGaleri});
                            }} 
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2">
                            <Youtube className="w-4 h-4 text-red-500" />
                          </div>
                          <input 
                            type="text" 
                            value={link} 
                            onChange={(e) => {
                              const newGaleri = [...content.galeri];
                              newGaleri[i] = e.target.value;
                              setContent({...content, galeri: newGaleri});
                            }}
                            placeholder="https://youtube.com/watch?v=..."
                            className="w-full bg-white border border-neutral-200 rounded-xl py-3 pl-12 pr-4 text-xs font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {contentTab === 'layanan' && (
                <motion.div 
                  key="layanan"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  {/* Perlengkapan */}
                  <div className="bg-white p-8 rounded-3xl border border-neutral-100 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <SectionHeader icon={<FileText />} title="Checklist Perlengkapan Haji" />
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setContent({...content, perlengkapan: [...content.perlengkapan, { item: '', selesai: false }]})}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" /> Tambah Item
                      </button>
                      <button 
                        onClick={handleSaveContent}
                        disabled={isSavingContent}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-emerald-600 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" /> Simpan Cloud
                      </button>
                    </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {content.perlengkapan.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 p-3 bg-neutral-50 rounded-xl border border-neutral-100 group">
                          <input 
                            type="checkbox" 
                            checked={p.selesai} 
                            onChange={(e) => {
                              const newP = [...content.perlengkapan];
                              newP[i].selesai = e.target.checked;
                              setContent({...content, perlengkapan: newP});
                            }}
                            className="w-4 h-4 rounded border-neutral-300 transform scale-110 accent-primary" 
                          />
                          <input 
                            type="text" 
                            value={p.item} 
                            onChange={(e) => {
                              const newP = [...content.perlengkapan];
                              newP[i].item = e.target.value;
                              setContent({...content, perlengkapan: newP});
                            }}
                            placeholder="Nama item..."
                            className="flex-1 bg-transparent text-[11px] font-bold focus:outline-none"
                          />
                          <button 
                            onClick={() => {
                              const newP = content.perlengkapan.filter((_, idx) => idx !== i);
                              setContent({...content, perlengkapan: newP});
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-100 rounded transition-all"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Ceklist Perbekalan Haji Dinamis */}
                  <div id="dynamic-checklist-editor" className="bg-white p-8 rounded-3xl border border-neutral-100 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-neutral-800 uppercase tracking-widest">Templat Ceklist Perbekalan Haji</h3>
                          <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest leading-relaxed mt-1">Otomatis Terfilter per Gender (Pria/Wanita)</p>
                        </div>
                      </div>
                      <button 
                        onClick={handleSaveContent}
                        disabled={isSavingContent}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100 transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" /> Simpan Cloud
                      </button>
                    </div>
                    
                    <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex items-start gap-4">
                      <AlertCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
                        Masukkan daftar item per baris. Sistem akan otomatis membagi daftar berdasarkan jenis kelamin jemaah yang login.
                        <br />
                        <span className="opacity-70">Contoh: Tuliskan satu perlengkapan di setiap baris baru.</span>
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Pria */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Kategori: Pria</label>
                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Laki-laki</span>
                        </div>
                        <textarea 
                          value={content.ceklistTemplates?.pria || ''}
                          onChange={(e) => setContent({
                            ...content, 
                            ceklistTemplates: { ...(content.ceklistTemplates || { pria: '', wanita: '', tambahan: '' }), pria: e.target.value }
                          })}
                          placeholder="Tas Koper Besar Pria&#10;Kain Ihrom&#10;Sarung..."
                          className="w-full h-[350px] bg-neutral-50 border border-neutral-200 rounded-2xl p-5 text-[11px] font-medium focus:ring-4 focus:ring-primary/10 outline-none transition-all resize-none leading-relaxed"
                        />
                      </div>
                      {/* Wanita */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Kategori: Wanita</label>
                          <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">Perempuan</span>
                        </div>
                        <textarea 
                          value={content.ceklistTemplates?.wanita || ''}
                          onChange={(e) => setContent({
                            ...content, 
                            ceklistTemplates: { ...(content.ceklistTemplates || { pria: '', wanita: '', tambahan: '' }), wanita: e.target.value }
                          })}
                          placeholder="Tas Tenteng Wanita&#10;Baju Muslimah&#10;Deker Tangan..."
                          className="w-full h-[350px] bg-neutral-50 border border-neutral-200 rounded-2xl p-5 text-[11px] font-medium focus:ring-4 focus:ring-primary/10 outline-none transition-all resize-none leading-relaxed"
                        />
                      </div>
                      {/* Dokumen Tambahan */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Dokumen & Lainnya</label>
                          <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Semua Gender</span>
                        </div>
                        <textarea 
                          value={content.ceklistTemplates?.tambahan || ''}
                          onChange={(e) => setContent({
                            ...content, 
                            ceklistTemplates: { ...(content.ceklistTemplates || { pria: '', wanita: '', tambahan: '' }), tambahan: e.target.value }
                          })}
                          placeholder="Pas Paspor&#10;Buku Doa&#10;Identitas Nama..."
                          className="w-full h-[350px] bg-neutral-50 border border-neutral-200 rounded-2xl p-5 text-[11px] font-medium focus:ring-4 focus:ring-primary/10 outline-none transition-all resize-none leading-relaxed"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Kontak Petugas */}
                  <div className="bg-white p-8 rounded-3xl border border-neutral-100 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <SectionHeader icon={<ShieldCheck />} title="Daftar Kontak Petugas Lapangan" />
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setContent({...content, kontakPetugas: [...content.kontakPetugas, { nama: '', jabatan: '', wa: '' }]})}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" /> Tambah Petugas
                      </button>
                      <button 
                        onClick={handleSaveContent}
                        disabled={isSavingContent}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-600 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" /> Simpan Cloud
                      </button>
                    </div>
                    </div>
                    <div className="space-y-3">
                      {content.kontakPetugas.map((k, i) => (
                        <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                          <div>
                            <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1 mb-1 block">Nama Petugas</label>
                            <input type="text" value={k.nama} onChange={(e) => {
                              const newK = [...content.kontakPetugas];
                              newK[i].nama = e.target.value;
                              setContent({...content, kontakPetugas: newK});
                            }} placeholder="Contoh: H. Ahmad" className="w-full p-2 bg-white border border-neutral-200 rounded-xl text-[11px] font-bold outline-none" />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1 mb-1 block">Jabatan/Tugas</label>
                            <input type="text" value={k.jabatan} onChange={(e) => {
                              const newK = [...content.kontakPetugas];
                              newK[i].jabatan = e.target.value;
                              setContent({...content, kontakPetugas: newK});
                            }} placeholder="Contoh: Ketua Kloter" className="w-full p-2 bg-white border border-neutral-200 rounded-xl text-[11px] font-bold outline-none" />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1 mb-1 block">Nomor WhatsApp</label>
                            <input type="text" value={k.wa} onChange={(e) => {
                              const newK = [...content.kontakPetugas];
                              newK[i].wa = e.target.value;
                              setContent({...content, kontakPetugas: newK});
                            }} placeholder="Contoh: 08123456789" className="w-full p-2 bg-white border border-neutral-200 rounded-xl text-[11px] font-bold outline-none" />
                          </div>
                          <div className="flex items-end pb-1">
                            <button 
                              onClick={() => {
                                const newK = content.kontakPetugas.filter((_, idx) => idx !== i);
                                setContent({...content, kontakPetugas: newK});
                              }}
                              className="w-full py-2 text-red-500 hover:bg-red-50 rounded-xl border border-red-100 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                              <Trash2 className="w-3 h-3" /> Hapus
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pembayaran */}
                  <div className="bg-white p-8 rounded-3xl border border-neutral-100 shadow-sm space-y-6 flex-1">
                    <div className="flex items-center justify-between">
                      <SectionHeader icon={<Banknote />} title="Pengaturan Biaya & Administrasi" />
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setContent({...content, pembayaran: [...content.pembayaran, { jenis: '', total: 0, dibayar: 0 }]})}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" /> Tambah Kategori Biaya
                      </button>
                      <button 
                        onClick={handleSaveContent}
                        disabled={isSavingContent}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-amber-600 text-amber-600 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" /> Simpan Cloud
                      </button>
                    </div>
                    </div>
                    <div className="space-y-3">
                      {content.pembayaran.map((p, i) => (
                        <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                          <div>
                            <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1 mb-1 block">Jenis Biaya</label>
                            <input type="text" value={p.jenis} onChange={(e) => {
                              const newP = [...content.pembayaran];
                              newP[i].jenis = e.target.value;
                              setContent({...content, pembayaran: newP});
                            }} placeholder="Contoh: Biaya Pelunasan" className="w-full p-2 bg-white border border-neutral-200 rounded-xl text-[11px] font-bold outline-none" />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1 mb-1 block">Total Tagihan (Rp)</label>
                            <input type="number" value={p.total} onChange={(e) => {
                              const newP = [...content.pembayaran];
                              newP[i].total = Number(e.target.value);
                              setContent({...content, pembayaran: newP});
                            }} className="w-full p-2 bg-white border border-neutral-200 rounded-xl text-[11px] font-bold outline-none" />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1 mb-1 block">Telah Dibayar (Rp)</label>
                            <input type="number" value={p.dibayar} onChange={(e) => {
                              const newP = [...content.pembayaran];
                              newP[i].dibayar = Number(e.target.value);
                              setContent({...content, pembayaran: newP});
                            }} className="w-full p-2 bg-white border border-neutral-200 rounded-xl text-[11px] font-bold outline-none" />
                          </div>
                          <div className="flex items-end pb-1">
                            <button 
                              onClick={() => {
                                const newP = content.pembayaran.filter((_, idx) => idx !== i);
                                setContent({...content, pembayaran: newP});
                              }}
                              className="w-full py-2 text-red-500 hover:bg-red-50 rounded-xl border border-red-100 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                              <Trash2 className="w-3 h-3" /> Hapus
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Float Save Button */}
            <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-neutral-100 shadow-2xl flex items-center justify-between sticky bottom-10 z-20 w-full animate-in fade-in slide-in-from-bottom-5">
              <div className="hidden md:flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[12px] font-black text-primary uppercase leading-none">Sinkronisasi Cloud</p>
                  <p className="text-[9px] text-neutral-400 font-bold mt-1 uppercase tracking-widest">Update data ke Database Firebase</p>
                </div>
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <p className="md:hidden text-[9px] font-black text-primary uppercase">SIMPAN PERUBAHAN</p>
                <button 
                  onClick={async () => {
                    try {
                      await saveAdminContent(content);
                      showToast('Konten berhasil disinkronkan ke Firebase Cloud!');
                    } catch (err) {
                      showToast('Gagal menyinkronkan data. Silakan cek koneksi internet anda.', 'error');
                    }
                  }}
                  className="flex-1 md:flex-none px-10 py-4 bg-primary text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-emerald-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" /> Publish Sekarang
                </button>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'admin' && (
          <section className="space-y-10 max-w-5xl">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-1 text-center md:text-left">
                <h2 className="text-xl md:text-2xl font-black text-primary uppercase tracking-tight">Panel Kelola Admin</h2>
                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest flex items-center justify-center md:justify-start gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" /> Manajemen Hak Akses Sistem
                </p>
              </div>
              {user.role === 'super_admin' && (
                <button 
                  onClick={() => setShowAddAdmin(true)}
                  className="flex items-center justify-center gap-2 bg-primary text-white px-6 py-4 md:py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4" /> Tambah User Admin
                </button>
              )}
            </header>

            <div className="grid grid-cols-1 gap-4">
              {admins.filter(a => user.role === 'super_admin' ? true : a.username === user.username).map((adm, i) => (
                <div key={i} className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:shadow-md transition-all">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm",
                      adm.role === 'super_admin' ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                    )}>
                      {adm.role === 'super_admin' ? <ShieldCheck className="w-7 h-7" /> : <UserCog className="w-7 h-7" />}
                    </div>
                    <div>
                      <h3 className="text-[15px] font-black text-neutral-800 uppercase tracking-tight leading-none mb-1">{adm.nama}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-500">@{adm.username}</span>
                        <div className="w-1 h-1 rounded-full bg-neutral-200" />
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-widest",
                          adm.role === 'super_admin' ? "text-amber-600" : "text-emerald-600"
                        )}>
                          {adm.role.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        setEditingPassword(adm.username);
                        setNewPassword('');
                      }}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-neutral-50 text-neutral-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-100 transition-all border border-neutral-100"
                    >
                      <Key className="w-3.5 h-3.5" /> Ganti Password
                    </button>
                    {user.role === 'super_admin' && adm.username !== 'admin' && (
                      <button 
                        onClick={() => setDeleteTarget(adm)}
                        className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Change Password Modal */}
        <AnimatePresence>
          {editingPassword && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditingPassword(null)}
                className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-sm bg-white rounded-[32px] p-8 shadow-2xl space-y-6"
              >
                <div className="flex items-center gap-3 text-primary">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center shadow-sm">
                    <Key className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight leading-none">Ganti Password</h3>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase mt-1 tracking-widest">Update Akses @{editingPassword}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Password Baru</label>
                    <input 
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Ketik password baru..."
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl py-4 px-5 text-sm font-bold focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                    />
                  </div>
                </div>

                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={async () => {
                        if (!newPassword) return;
                        try {
                          const newAdmins = admins.map(a => 
                            a.username === editingPassword ? { ...a, password: newPassword } : a
                          );
                          setAdmins(newAdmins);
                          await saveAdminUsers(newAdmins);
                          setEditingPassword(null);
                          showToast('Password berhasil diperbarui di Database Cloud!');
                        } catch (err) {
                          showToast('Gagal memperbarui password. Silakan coba lagi.', 'error');
                        }
                      }}
                      className="w-full py-4 bg-primary text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100 active:scale-95 transition-all"
                    >
                      Simpan Password Baru
                    </button>
                  <button 
                    onClick={() => setEditingPassword(null)}
                    className="w-full py-4 text-neutral-400 text-[10px] font-black uppercase tracking-widest hover:bg-neutral-50 rounded-2xl transition-all"
                  >
                    Batal
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {/* Add Admin User Modal */}
        <AnimatePresence>
          {showAddAdmin && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAddAdmin(false)}
                className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-sm bg-white rounded-[32px] p-8 shadow-2xl space-y-6"
              >
                <div className="flex items-center gap-3 text-primary">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center shadow-sm">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight leading-none">Tambah Admin</h3>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase mt-1 tracking-widest">Registrasi Petugas Baru</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Username</label>
                    <input 
                      type="text"
                      value={newAdmin.username}
                      onChange={(e) => setNewAdmin({ ...newAdmin, username: e.target.value })}
                      placeholder="Contoh: ahmad_petugas"
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl py-4 px-5 text-sm font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Nama Lengkap</label>
                    <input 
                      type="text"
                      value={newAdmin.nama}
                      onChange={(e) => setNewAdmin({ ...newAdmin, nama: e.target.value })}
                      placeholder="Contoh: H. Ahmad Sukirman"
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl py-4 px-5 text-sm font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Password Awal</label>
                    <input 
                      type="password"
                      value={newAdmin.password}
                      onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                      placeholder="Ketik password..."
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl py-4 px-5 text-sm font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Role/Akses</label>
                    <select 
                      value={newAdmin.role}
                      onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value as any })}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl py-4 px-5 text-sm font-bold outline-none appearance-none"
                    >
                      <option value="admin_petugas">Admin Petugas (Batas Akses)</option>
                      <option value="super_admin">Super Admin (Akses Penuh)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button 
                    onClick={async () => {
                      if (!newAdmin.username || !newAdmin.password || !newAdmin.nama) {
                        showToast('Mohon isi semua data admin baru.', 'error');
                        return;
                      }
                      try {
                        const adminToAdd = { 
                          ...newAdmin, 
                          id: `admin-${Date.now()}` 
                        } as User;
                        const newAdminsList = [...admins, adminToAdd];
                        setAdmins(newAdminsList);
                        await saveAdminUsers(newAdminsList);
                        setShowAddAdmin(false);
                        setNewAdmin({ username: '', password: '', nama: '', role: 'admin_petugas' });
                        showToast('Admin baru berhasil ditambahkan ke Cloud!');
                      } catch (err) {
                        showToast('Gagal menambahkan admin.', 'error');
                      }
                    }}
                    className="w-full py-4 bg-primary text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100 active:scale-95 transition-all"
                  >
                    Tambah Sekarang
                  </button>
                  <button 
                    onClick={() => setShowAddAdmin(false)}
                    className="w-full py-4 text-neutral-400 text-[10px] font-black uppercase tracking-widest hover:bg-neutral-50 rounded-2xl transition-all"
                  >
                    Batal
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation - Mobile Only */}
      <div className="md:hidden fixed bottom-6 left-6 right-6 z-[60] bg-white/90 backdrop-blur-xl border border-neutral-100 shadow-2xl rounded-[32px] p-2 flex items-center justify-around ring-1 ring-black/5">
        {[
          { id: 'data', icon: <Database />, label: 'Data' },
          { id: 'konten', icon: <LayoutDashboard />, label: 'Konten', hidden: user.role === 'admin_petugas' },
          { id: 'admin', icon: <ShieldCheck />, label: 'Admin' },
        ].filter(t => !t.hidden).map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              try {
                setActiveTab(tab.id as Tab);
                setSidebarOpen(false);
              } catch (e) {
                console.error("Tab switch error:", e);
              }
            }}
            className={cn(
              "flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300 gap-1 min-w-[70px]",
              activeTab === tab.id 
                ? "bg-primary text-white shadow-lg shadow-emerald-100 -translate-y-1" 
                : "text-neutral-400"
            )}
          >
            {tab.icon && cloneElement(tab.icon as ReactElement<any>, { className: "w-5 h-5" })}
            <span className="text-[9px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Confirmation Delete Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteTarget(null)}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-[32px] p-8 shadow-2xl space-y-6 text-center"
            >
              <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <Trash2 className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-neutral-800 uppercase tracking-tight">Konfirmasi Hapus</h3>
                <p className="text-sm text-neutral-500 font-medium">
                  Apakah Anda yakin ingin menghapus admin <span className="font-black text-neutral-800">@{deleteTarget.username}</span> ({deleteTarget.nama})? Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={async () => {
                    if (!deleteTarget) return;
                    try {
                      const newAdmins = admins.filter(a => a.username !== deleteTarget.username);
                      setAdmins(newAdmins);
                      await saveAdminUsers(newAdmins);
                      setDeleteTarget(null);
                      showToast('User admin berhasil dihapus.');
                    } catch (err) {
                      showToast('Gagal menghapus user.', 'error');
                    }
                  }}
                  className="w-full py-4 bg-rose-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-rose-100 active:scale-95 transition-all"
                >
                  Ya, Hapus Sekarang
                </button>
                <button 
                  onClick={() => setDeleteTarget(null)}
                  className="w-full py-4 text-neutral-400 text-[10px] font-black uppercase tracking-widest hover:bg-neutral-50 rounded-2xl transition-all"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingRegistration && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="bg-primary p-8 text-white relative">
                <button 
                  onClick={() => setEditingRegistration(null)}
                  className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center border border-white/20">
                    <UserCog className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight leading-none">Edit Data Pendaftar</h3>
                    <p className="text-[10px] text-emerald-100 font-bold uppercase tracking-widest mt-2">{editingRegistration.namaLengkap}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <form onSubmit={handleUpdateRegistration} id="edit-reg-form" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Nama Lengkap</label>
                      <input 
                        type="text" 
                        value={editingRegistration.namaLengkap}
                        onChange={(e) => setEditingRegistration({...editingRegistration, namaLengkap: e.target.value})}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Nomor Porsi</label>
                      <input 
                        type="text" 
                        value={editingRegistration.nomorPorsi}
                        onChange={(e) => setEditingRegistration({...editingRegistration, nomorPorsi: e.target.value})}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Nomor WA</label>
                      <input 
                        type="text" 
                        value={editingRegistration.wa}
                        onChange={(e) => setEditingRegistration({...editingRegistration, wa: e.target.value})}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Jenis Kelamin</label>
                      <select 
                        value={editingRegistration.jk}
                        onChange={(e) => setEditingRegistration({...editingRegistration, jk: e.target.value})}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                      >
                        <option value="Laki-laki">Laki-laki</option>
                        <option value="Perempuan">Perempuan</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Nama Ibu Kandung</label>
                      <input 
                        type="text" 
                        value={editingRegistration.namaIbu || ''}
                        onChange={(e) => setEditingRegistration({...editingRegistration, namaIbu: e.target.value})}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                        placeholder="Nama Ibu"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Usia (Tahun)</label>
                      <input 
                        type="number" 
                        value={editingRegistration.usia || ''}
                        onChange={(e) => setEditingRegistration({...editingRegistration, usia: e.target.value})}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                        placeholder="Usia"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Alamat Lengkap</label>
                    <textarea 
                      value={editingRegistration.alamat}
                      onChange={(e) => setEditingRegistration({...editingRegistration, alamat: e.target.value})}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all h-24"
                      required
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Kondisi Kesehatan</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { key: 'kursiRoda', label: 'Kursi Roda' },
                        { key: 'ringJantung', label: 'Ring Jantung' },
                        { key: 'penTubuh', label: 'Pen Tubuh' },
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setEditingRegistration({
                            ...editingRegistration, 
                            kesehatan: {
                              ...editingRegistration.kesehatan,
                              [item.key as any]: !editingRegistration.kesehatan[item.key as keyof typeof editingRegistration.kesehatan]
                            }
                          })}
                          className={cn(
                            "flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                            editingRegistration.kesehatan[item.key as keyof typeof editingRegistration.kesehatan]
                              ? "bg-rose-50 border-rose-200 text-rose-600"
                              : "bg-neutral-50 border-neutral-200 text-neutral-400"
                          )}
                        >
                          {editingRegistration.kesehatan[item.key as keyof typeof editingRegistration.kesehatan] ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Photo Section */}
                  <div className="space-y-4 pt-4 border-t border-neutral-100">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-primary" />
                      <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Dokumen Pendukung</h4>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {['KTP', 'KK', 'SPPH', 'FOTO'].map((label) => {
                        const src = editingRegistration.photos?.[label];
                        return (
                          <div key={label} className="space-y-2">
                            <p className="text-[9px] font-black text-neutral-500 uppercase text-center">{label}</p>
                            <div className="aspect-[4/3] rounded-xl overflow-hidden border border-neutral-200 bg-neutral-100 relative group">
                              {src ? (
                                <>
                                  <img 
                                    src={src} 
                                    alt={label} 
                                    className="w-full h-full object-cover cursor-zoom-in group-hover:scale-105 transition-transform" 
                                    onClick={() => setViewingPhoto({ url: src, label })}
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm p-2 transform translate-y-full group-hover:translate-y-0 transition-transform flex justify-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setViewingPhoto({ url: src, label })}
                                      className="p-1.5 bg-white/20 hover:bg-white/40 text-white rounded-lg transition-colors"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <div className="flex items-center justify-center h-full text-neutral-300">
                                  <AlertCircle className="w-6 h-6" />
                                </div>
                              )}
                              
                              {/* Re-upload overlay always available or on hover */}
                              <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                                <span className="p-2 bg-white text-primary rounded-full shadow-lg">
                                  <RefreshCw className="w-4 h-4" />
                                </span>
                                <input 
                                  type="file" 
                                  className="hidden" 
                                  accept="image/*,application/pdf"
                                  onChange={(e) => handlePhotoUpload(e, label)} 
                                />
                              </label>
                            </div>
                            {!src && <p className="text-[8px] text-rose-400 font-bold uppercase text-center">Belum ada file</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </form>
              </div>

              <div className="p-8 bg-neutral-50 border-t border-neutral-100 flex items-center gap-4">
                <button 
                  type="submit"
                  form="edit-reg-form"
                  disabled={isSavingReg}
                  className="flex-1 py-4 bg-primary text-white rounded-2xl text-[12px] font-black uppercase tracking-widest shadow-xl shadow-emerald-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSavingReg ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Save className="w-4 h-4" />}
                  Simpan Perubahan
                </button>
                <button 
                  onClick={() => setEditingRegistration(null)}
                  className="flex-1 py-4 bg-white border border-neutral-200 text-neutral-400 rounded-2xl text-[12px] font-black uppercase tracking-widest hover:bg-neutral-100 transition-all"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-32 md:bottom-10 left-1/2 -translate-x-1/2 z-[200] min-w-[300px] max-w-[90%]"
          >
            <div className={cn(
              "p-4 rounded-2xl shadow-2xl flex items-center gap-3 border",
              toast.type === 'success' 
                ? "bg-emerald-600 border-emerald-500 text-white" 
                : "bg-rose-600 border-rose-500 text-white"
            )}>
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <X className="w-5 h-5" />}
              </div>
              <p className="text-[12px] font-black uppercase tracking-wide flex-1 leading-tight">
                {toast.msg}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox Photo Preview */}
      <AnimatePresence>
        {viewingPhoto && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[300] flex flex-col items-center justify-center p-4 md:p-12">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full h-full flex flex-col gap-6"
            >
              <div className="flex items-center justify-between text-white">
                <div className="space-y-1">
                  <h3 className="text-xl font-black uppercase tracking-tight">{viewingPhoto.label}</h3>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Dokumen Jemaah SIM ARAFAH</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => window.open(viewingPhoto.url, '_blank')}
                    className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"
                    title="Buka di Tab Baru"
                  >
                    <ExternalLink className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={() => setViewingPhoto(null)}
                    className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="flex-1 w-full bg-neutral-900 rounded-[32px] overflow-hidden flex items-center justify-center border border-white/10 relative group">
                <img 
                  src={viewingPhoto.url} 
                  alt={viewingPhoto.label} 
                  className="max-w-full max-h-full object-contain shadow-2xl"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="flex justify-center">
                <button 
                  onClick={() => setViewingPhoto(null)}
                  className="px-8 py-4 bg-white text-black rounded-2xl text-[12px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-xl"
                >
                  Tutup Pratinjau
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: any; label: string; active: boolean; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-6 py-4 rounded-2xl transition-all duration-300 group",
        active 
          ? "bg-primary text-white shadow-lg shadow-emerald-100 -translate-y-1" 
          : "text-neutral-400 hover:bg-neutral-50 hover:text-primary"
      )}
    >
      <span className={cn("transition-transform duration-300", active ? "scale-110" : "group-hover:scale-110")}>
        {icon}
      </span>
      <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}

function StatBox({ label, value, icon, color, active, onClick }: { label: string; value: number | string; icon: any; color: string; active?: boolean; onClick?: () => void }) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      onClick={onClick}
      className={cn(
        "bg-white rounded-2xl md:rounded-3xl p-3 md:p-5 border shadow-sm flex flex-col gap-2 md:grid-cols-4 lg:grid-cols-8 md:gap-3 cursor-pointer transition-all",
        active ? "border-primary ring-4 ring-primary/5 shadow-md" : "border-neutral-100"
      )}
    >
      <div className={cn("w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0", color)}>
        {icon && cloneElement(icon as ReactElement<any>, { className: "w-4 h-4 md:w-5 md:h-5" })}
      </div>
      <div>
        <p className="text-[8px] md:text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-0.5 md:mb-1">{label}</p>
        <p className="text-sm md:text-xl font-black text-neutral-800 tracking-tight">{value}</p>
      </div>
    </motion.div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">{label}</label>
      <select 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-2.5 text-[11px] font-bold outline-none focus:border-primary transition-all capitalize"
      >
        <option value="">Semua {label}</option>
        {options.sort().map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2.5 text-primary border-b border-neutral-100 pb-2">
      <span className="p-1.5 bg-emerald-50 rounded-lg">{icon}</span>
      <h3 className="text-[11px] font-black uppercase tracking-[0.2em]">{title}</h3>
    </div>
  );
}

function IconInput({ icon, value, onChange, label, type = 'text' }: { icon: any; value: string; onChange: (v: string) => void; label: string; type?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 mt-[1px]">{icon}</div>
        <input 
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={label}
          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-3 pl-12 pr-4 text-xs font-bold focus:ring-4 focus:ring-primary/10 transition-all outline-none"
        />
        <label className="absolute -top-1.5 left-4 px-1.5 bg-white text-[9px] font-black text-primary opacity-0 group-focus-within:opacity-100 transition-opacity uppercase tracking-widest">{label}</label>
      </div>
    </div>
  );
}

function Loader2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="M4.93 4.93l2.83 2.83" />
      <path d="M16.24 16.24l2.83 2.83" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <path d="M4.93 19.07l2.83-2.83" />
      <path d="M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
