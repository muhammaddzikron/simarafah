import { Jemaah, AdminContent, User, PaymentData, UserRole, Registration } from '../types';
import Papa from 'papaparse';
import { db, auth, handleFirestoreError } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs, query, orderBy, deleteDoc, updateDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/14W48hU9eYzxZ5EkjGGSTs1WCTzITV02QooOoo7lYix0/export?format=csv&gid=9046765';
const SPREADSHEET_CONTENT_URL = 'https://docs.google.com/spreadsheets/d/14W48hU9eYzxZ5EkjGGSTs1WCTzITV02QooOoo7lYix0/export?format=csv&gid=1724714709';

// Helper to get from local storage
const getStorage = <T>(key: string, initial: T): T => {
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : initial;
};

// Helper to save to local storage
const saveStorage = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Mock data based on the requirements
export const defaultJemaah: Jemaah[] = [
  {
    no: '1',
    namaLengkap: 'Budi Santoso',
    kloter: '12',
    rombongan: '3',
    jadwalMasukAsrama: '2024-05-10',
    namaKetuaRombongan: 'H. Ahmad',
    waKarom: '08123456789',
    umur: '45',
    jenisKelamin: 'L',
    alamat: 'Jl. Merdeka No. 1',
    desa: 'Klaten Tengah',
    kecamatan: 'Klaten',
    kabupaten: 'Klaten',
    wa: '081222333444',
    tanazul: 'TIDAK',
    murur: 'YA',
    nafar: 'AWAL',
    jalurDam: 'KOLEKTIF',
    umrahGelombang: '1',
    badal: 'TIDAK',
    kursiRoda: 'TIDAK',
    tongkat: 'TIDAK',
    penTubuh: 'TIDAK',
    ringJantung: 'TIDAK',
    pendampingLansia: 'ADA',
    waPendamping: '081555666777',
    hotelMekah: 'Hotel Grand Al Saha',
    linkPetaHotel: 'https://maps.google.com',
    nomorPorsi: '1300012345',
    keteranganKhusus: 'Sehat'
  }
];

export const defaultAdminContent: AdminContent = {
  profil: 'KBIHU Arafah Muhammadiyah Klaten adalah lembaga bimbingan haji dan umrah yang berpengalaman dan terpercaya di bawah naungan Muhammadiyah Klaten.',
  galeri: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
  agenda: [
    { tanggal: '2024-05-20', kegiatan: 'Manasik Haji Ke-5' },
    { tanggal: '2024-06-01', kegiatan: 'Pelepasan Jemaah' }
  ],
  materi: [
    { id: '1', judul: 'Doa Sebelum Berangkat', tipe: 'doa', isi: { arab: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ أَنْ أَضِلَّ أَوْ أُضَلَّ', latin: 'Allahumma inni auzubika an adilla aw udalla', terjemahan: 'Ya Allah, aku berlindung kepada-Mu dari tersesat atau disesatkan.' } },
    { id: '2', judul: 'Video Cara Berpakaian Ihram', link: 'https://youtube.com', tipe: 'video' },
    { id: '3', judul: 'File PDF Manasik', link: '#', tipe: 'download' }
  ],
  sosmed: {
    ig: 'kbihu_arafah_klaten',
    tiktok: 'kbihu_arafah',
    yt: 'KBIHU Arafah Official'
  },
  kontak: {
    wa1: '081234567890',
    wa2: '085777888999',
    alamat: 'Jl. Pemuda No. 123, Klaten',
    peta: 'https://maps.google.com'
  },
  pengumuman: 'Diberitahukan kepada seluruh jemaah untuk segera melengkapi dokumen paspor.',
  perlengkapan: [
    { item: 'Buku Panduan', selesai: true },
    { item: 'Seragam Batik', selesai: false },
    { item: 'Tas Paspor', selesai: true }
  ],
  ceklistTemplates: {
    pria: 'Tas Koper Besar Pria\n1 atau 1,5 stel kain Ihrom\nPakaian Harian\nSandal\nAlat Mandi\nSarung',
    wanita: 'Tas Tenteng Wanita\n1 stel Baju Ihram\nPakaian Harian\nSandal\nAlat Mandi\nAlat Sholat',
    tambahan: 'Tas Paspor\nBerkas Kesehatan\nPas Foto 3x4\nUang Real\nIdentitas Nama'
  },
  pembayaran: [
    { jenis: 'Pendaftaran Arafah', total: 3000000, dibayar: 200000 },
    { jenis: 'DAM, Tarwiyah, Ziarah, Dll', total: 5875000, dibayar: 5875000 }
  ],
  kontakPetugas: [
    { nama: 'H. Ahmad', jabatan: 'Ketua Rombongan', wa: '08123456789' }
  ]
};

export const defaultAdminUsers = [
  { username: 'admin', password: 'adnimku', nama: 'Super Admin', role: 'super_admin' },
  { username: 'lisda', password: 'lisdaa', nama: 'Lisda Arafah', role: 'super_admin' },
  { username: 'eka', password: 'ekaekaa', nama: 'Eka Arafah', role: 'super_admin' },
  { username: 'ari', password: 'arii', nama: 'Ari Sasongko', role: 'admin_petugas' },
  { username: 'husen', password: 'husenn', nama: 'Muhammad Husen', role: 'admin_petugas' },
  { username: 'muktiaji', password: 'muktiajii', nama: 'Muh Mukti Aji', role: 'admin_petugas' },
  { username: 'agus', password: 'aguss', nama: 'Agus Darmawan', role: 'admin_petugas' },
  { username: 'arief', password: 'arieff', nama: 'Arief Nurohman', role: 'admin_petugas' },
  { username: 'arif', password: 'ariff', nama: 'Arif', role: 'admin_petugas' },
  { username: 'edi', password: 'edii', nama: 'Edi Purwanto', role: 'admin_petugas' },
  { username: 'joko', password: 'jokoo', nama: 'Joko Karebet', role: 'admin_petugas' },
  { username: 'mughofir', password: 'mughofirr', nama: 'Mughofir', role: 'admin_petugas' },
  { username: 'mukhlis', password: 'mukhliss', nama: 'Mukhlis Aprianto', role: 'admin_petugas' },
  { username: 'mulyadi', password: 'mulyadii', nama: 'Mulyadi Satria', role: 'admin_petugas' },
  { username: 'nur', password: 'nurr', nama: 'Nur Sholikhin', role: 'admin_petugas' },
  { username: 'udin', password: 'udinn', nama: 'Muhammad Saifudin', role: 'admin_petugas' },
  { username: 'soeyito', password: 'soeyitoo', nama: 'Soeyito', role: 'admin_petugas' },
  { username: 'yusuf', password: 'yusuff', nama: 'Yusuf Masyikin', role: 'admin_petugas' },
  { username: 'iskak', password: 'iskakk', nama: 'Iskak Sulistiya', role: 'admin_petugas' },
  { username: 'mul', password: 'mull', nama: 'Mulyadi', role: 'admin_petugas' },
  { username: 'parno', password: 'parnoo', nama: 'Suparno', role: 'admin_petugas' },
];

export async function fetchJemaah(shouldSync: boolean = false): Promise<Jemaah[]> {
  try {
    // 1. Try Spreadsheet first (Master Data) with cache buster
    const response = await fetch(`${SPREADSHEET_URL}&t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Gagal mengambil data dari Spreadsheet (HTTP ${response.status}). Pastikan Spreadsheet sudah di-set "Anyone with the link can view".`);
    }
    const text = await response.text();
      return new Promise((resolve, reject) => {
        Papa.parse(text, {
          header: false, // Use indices for accuracy
          skipEmptyLines: true,
          complete: (results) => {
            const data = results.data as any[];
            if (!data || data.length === 0) {
              resolve([]);
              return;
            }
            
            // Find header row
            let hIdx = -1;
            for(let i=0; i<Math.min(data.length, 15); i++) {
                const rowStr = JSON.stringify(data[i]).toLowerCase();
                // Check if row contains key identifiers
                if ((rowStr.includes('nama') || rowStr.includes('lengkap')) && (rowStr.includes('porsi') || rowStr.includes('kloter') || rowStr.includes('no'))) {
                    hIdx = i;
                    break;
                }
            }

            const headerRow = hIdx !== -1 ? data[hIdx].map((h: any) => String(h || '').toLowerCase().trim()) : [];
            const findC = (keys: string[], def: number) => {
              if (hIdx === -1) return def;
              
              const lowerKeys = keys.map(k => k.toLowerCase());
              
              // 1. Priority 1: Exact Match
              for (const k of lowerKeys) {
                const exactIdx = headerRow.findIndex(h => h === k);
                if (exactIdx !== -1) return exactIdx;
              }

              // 2. Priority 2: Precise Partial Match (Avoid confusion)
              const preciseIdx = headerRow.findIndex(h => {
                return lowerKeys.some(k => {
                  if (k === 'nama' && (h.includes('ketua') || h.includes('karom') || h.includes('pendamping'))) return false;
                  if (k === 'rombongan' && (h.includes('ketua') || h.includes('karom') || h.includes('nama'))) return false;
                  if (k === 'wa' && (h.includes('karom') || h.includes('ketua') || h.includes('pendamping') || h.includes('petugas'))) return false;
                  return h.includes(k);
                });
              });
              if (preciseIdx !== -1) return preciseIdx;

              // 3. Fallback: Any Match
              const anyIdx = headerRow.findIndex(h => lowerKeys.some(k => h.includes(k)));
              return anyIdx !== -1 ? anyIdx : def;
            };

            const idx = {
              nama: findC(['nama lengkap', 'jemaah', 'nama'], 8), // Column I
              porsi: findC(['nomor porsi', 'porsi hq', 'porsi'], 5), // Column F (index 5)
              kloter: findC(['kloter'], 1),
              romb: findC(['rombongan'], 2),
              asrama: findC(['asrama', 'masuk'], 3),
              karom: findC(['ketua rombongan', 'karom', 'ketua'], 4),
              waKarom: findC(['wa karom', 'wa ketua'], 28), // AC
              waPetugas: findC(['wa petugas', 'admin', 'petugas'], 29), // AD
              umur: findC(['umur'], 9),
              jk: findC(['jenis kelamin', 'jk'], 10),
              alamat: findC(['alamat'], 11),
              desa: findC(['desa', 'kelurahan'], 12),
              kec: findC(['kecamatan'], 13),
              kab: findC(['kabupaten'], 14),
              wa: findC(['wa jemaah', 'whatsapp jemaah', 'nomor wa', 'wa'], 15),
              hotel: findC(['hotel mekah'], 31), // AF
              peta: findC(['link peta', 'peta hotel'], 32), // AG
              tanazul: findC(['tanazul'], 16),
              murur: findC(['murur'], 17),
              nafar: findC(['nafar'], 18),
              dam: findC(['jalur dam', 'dam'], 19),
              gel: findC(['umrah gel', 'gelombang'], 20),
              badal: findC(['badal'], 21),
              roda: findC(['kursi roda', 'roda'], 22),
              tongkat: findC(['tongkat', 'kruk'], 23),
              penTubuh: findC(['pen tubuh', 'pen'], 24), // Y
              ringJantung: findC(['ring jantung', 'ring'], 25), // Z
              pendamping: findC(['pendamping lansia', 'pendamping'], 26), // AA
              waPendamping: findC(['wa pendamping'], 27), // AB
              paspor: findC(['paspor'], 6), // G
              visa: findC(['visa'], 7) // H
            };

            const startRow = hIdx !== -1 ? hIdx + 1 : 0; 
            const rows = data.slice(startRow);
            
            const jemaahList: Jemaah[] = rows
              .filter(row => {
                const name = row[idx.nama] ? String(row[idx.nama]).trim() : '';
                const porsi = row[idx.porsi] ? String(row[idx.porsi]).trim() : '';
                return (name.length > 1) || (porsi.length > 5);
              })
              .map((row) => {
                const g = (i: number) => row[i] ? String(row[i]).trim() : '';
                return {
                  no: g(0),
                  namaLengkap: g(idx.nama),
                  kloter: g(idx.kloter),
                  rombongan: g(idx.romb),
                  jadwalMasukAsrama: g(idx.asrama),
                  namaKetuaRombongan: g(idx.karom),
                  waKarom: g(idx.waKarom),
                  waPetugas: g(idx.waPetugas),
                  umur: g(idx.umur),
                  jenisKelamin: g(idx.jk).toUpperCase().startsWith('L') ? 'L' : 'P',
                  alamat: g(idx.alamat),
                  desa: g(idx.desa),
                  kecamatan: g(idx.kec),
                  kabupaten: g(idx.kab),
                  wa: g(idx.wa),
                  tanazul: g(idx.tanazul).toUpperCase().includes('YA') ? 'YA' : 'TIDAK',
                  murur: g(idx.murur).toUpperCase().includes('YA') ? 'YA' : 'TIDAK',
                  nafar: g(idx.nafar).toUpperCase().includes('AWAL') ? 'AWAL' : (g(idx.nafar).toUpperCase().includes('TSANI') ? 'TSANI' : g(idx.nafar)),
                  jalurDam: g(idx.dam),
                  umrahGelombang: g(idx.gel),
                  badal: g(idx.badal).toUpperCase().includes('YA') ? 'YA' : 'TIDAK',
                  kursiRoda: g(idx.roda).toUpperCase().includes('YA') ? 'YA' : 'TIDAK',
                  tongkat: g(idx.tongkat).toUpperCase().includes('YA') ? 'YA' : 'TIDAK',
                  penTubuh: g(idx.penTubuh).toUpperCase().includes('YA') ? 'YA' : 'TIDAK',
                  ringJantung: g(idx.ringJantung).toUpperCase().includes('YA') ? 'YA' : 'TIDAK',
                  pendampingLansia: g(idx.pendamping),
                  waPendamping: g(idx.waPendamping),
                  hotelMekah: g(idx.hotel),
                  linkPetaHotel: g(idx.peta),
                  nomorPorsi: g(idx.porsi),
                  keteranganKhusus: g(34),
                  paspor: g(idx.paspor),
                  visa: g(idx.visa)
                };
              });
            
            // Only background sync to Firestore if explicitly requested (e.g. from Admin Dashboard)
            if (shouldSync) {
              saveJemaah(jemaahList).catch(console.error);
            } else {
              // Just cache locally
              saveStorage('jemaah_data', jemaahList);
            }
            resolve(jemaahList);
          },
          error: (err: any) => reject(err)
        });
      });
    }

    // 2. Fallback to Firestore if Spreadsheet fail
    const docRef = doc(db, 'settings', 'jemaah_data');
    const docSnap = await getDoc(docRef).catch(e => handleFirestoreError(e, 'get', 'settings/jemaah_data'));
    if (docSnap.exists()) {
      return docSnap.data().jemaah || [];
    }
    return getStorage('jemaah_data', defaultJemaah);
  } catch (error) {
    console.warn('Sync failed, using cached/mock data:', error);
    return getStorage('jemaah_data', defaultJemaah);
  }
}

export async function saveJemaah(jemaah: Jemaah[]) {
  try {
    await setDoc(doc(db, 'settings', 'jemaah_data'), {
      jemaah,
      updatedAt: serverTimestamp()
    }).catch(e => handleFirestoreError(e, 'write', 'settings/jemaah_data'));
    saveStorage('jemaah_data', jemaah);
  } catch (e) {
    console.error("Error saving jemaah to Firebase:", e);
    saveStorage('jemaah_data', jemaah);
  }
}

export async function getAdminContent(): Promise<AdminContent> {
  try {
    // 1. Try Firestore first for the most recent admin edits
    const docRef = doc(db, 'settings', 'admin_content');
    const docSnap = await getDoc(docRef).catch(e => handleFirestoreError(e, 'get', 'settings/admin_content'));
    
    if (docSnap.exists()) {
      return docSnap.data() as AdminContent;
    }

    // 2. Fallback to Spreadsheet if Firestore is empty (Initial Seed)
    const response = await fetch(SPREADSHEET_CONTENT_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const text = await response.text();
    
    return new Promise((resolve) => {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as any[];
          if (rows.length === 0) {
            resolve(getStorage('admin_content', defaultAdminContent));
            return;
          }

          const content: AdminContent = {
            profil: '',
            galeri: [],
            agenda: [],
            materi: [],
            sosmed: { ig: '', tiktok: '', yt: '' },
            kontak: { wa1: '', wa2: '', alamat: '', peta: '' },
            pengumuman: '',
            perlengkapan: [],
            pembayaran: [],
            kontakPetugas: []
          };

          // Grouping rows by type
          rows.forEach(row => {
            const getV = (keys: string[]) => {
              for (const k of keys) {
                if (row[k] || row[k.toUpperCase()]) return String(row[k] || row[k.toUpperCase()]).trim();
              }
              return '';
            };

            const type = getV(['TIPE', 'KEY', 'KATEGORI', 'JENIS']).toUpperCase();
            
            if (type === 'PROFIL') content.profil = getV(['ISI', 'VALUE', 'KONTEN']);
            if (type === 'PENGUMUMAN') content.pengumuman = getV(['ISI', 'VALUE', 'KONTEN']);
            
            if (type === 'GALERI') {
              const url = getV(['ISI', 'VALUE', 'KONTEN', 'LINK', 'URL']);
              if (url) content.galeri.push(url);
            }

            if (type === 'SOSMED') {
              content.sosmed.ig = getV(['IG', 'INSTAGRAM']) || content.sosmed.ig;
              content.sosmed.tiktok = getV(['TIKTOK']) || content.sosmed.tiktok;
              content.sosmed.yt = getV(['YT', 'YOUTUBE']) || content.sosmed.yt;
            }

            if (type === 'KONTAK') {
              content.kontak.wa1 = getV(['WA1', 'WHATSAPP1']) || content.kontak.wa1;
              content.kontak.wa2 = getV(['WA2', 'WHATSAPP2']) || content.kontak.wa2;
              content.kontak.alamat = getV(['ALAMAT', 'ADDRESS']) || content.kontak.alamat;
              content.kontak.peta = getV(['PETA', 'MAPS']) || content.kontak.peta;
            }

            if (type === 'AGENDA') {
              content.agenda.push({
                tanggal: getV(['TANGGAL', 'DATE']),
                kegiatan: getV(['KEGIATAN', 'ACTIVITY', 'ISI', 'VALUE'])
              });
            }

            if (type === 'PERLENGKAPAN') {
              content.perlengkapan.push({
                item: getV(['ITEM', 'NAMA', 'ISI']),
                selesai: getV(['SELESAI', 'STATUS', 'CHECK']).toUpperCase() === 'YA'
              });
            }

            if (type === 'PEMBAYARAN') {
              content.pembayaran.push({
                jenis: getV(['JENIS', 'NAMA', 'ITEM']),
                total: parseInt(getV(['TOTAL', 'BIAYA'])) || 0,
                dibayar: parseInt(getV(['DIBAYAR', 'BAYAR'])) || 0
              });
            }
          });

          // Fallback if empty
          if (!content.profil) content.profil = defaultAdminContent.profil;
          if (content.galeri.length === 0) content.galeri = defaultAdminContent.galeri;
          if (content.agenda.length === 0) content.agenda = defaultAdminContent.agenda;
          if (!content.sosmed.ig) content.sosmed = defaultAdminContent.sosmed;
          if (!content.kontak.wa1) content.kontak = defaultAdminContent.kontak;
          if (!content.pengumuman) content.pengumuman = defaultAdminContent.pengumuman;
          if (content.perlengkapan.length === 0) content.perlengkapan = defaultAdminContent.perlengkapan;
          if (content.pembayaran.length === 0) content.pembayaran = defaultAdminContent.pembayaran;

          resolve(content);
        },
        error: () => resolve(getStorage('admin_content', defaultAdminContent))
      });
    });
  } catch (error) {
    console.error('Failed to fetch admin content:', error);
    return getStorage('admin_content', defaultAdminContent);
  }
}

export async function saveAdminContent(content: AdminContent) {
  try {
    // Sanitize to remove undefined for Firebase
    const sanitized = JSON.parse(JSON.stringify({
      ...content,
      updatedAt: new Date().toISOString() // Use ISO string as a simple fallback or let serverTimestamp work
    }));
    
    await setDoc(doc(db, 'settings', 'admin_content'), {
      ...sanitized,
      updatedAt: serverTimestamp()
    }).catch(e => handleFirestoreError(e, 'write', 'settings/admin_content'));
    saveStorage('admin_content', content);
  } catch (e) {
    console.error("Error saving admin content to Firebase:", e);
    saveStorage('admin_content', content);
    throw e; // Relaunch to let UI show error
  }
}

export async function getAdminUsers(): Promise<User[]> {
  try {
    const docRef = doc(db, 'settings', 'admin_users');
    const docSnap = await getDoc(docRef).catch(e => handleFirestoreError(e, 'get', 'settings/admin_users'));
    if (docSnap.exists()) {
      return docSnap.data().users || [];
    }
  } catch (e) {
    console.error("Error loading admin users from Firebase:", e);
  }
  return getStorage('admin_users', defaultAdminUsers.map(u => ({ ...u, id: `admin-${u.username}`, role: u.role as UserRole })));
}

export async function saveAdminUsers(users: User[]) {
  try {
    await setDoc(doc(db, 'settings', 'admin_users'), {
      users,
      updatedAt: serverTimestamp()
    }).catch(e => handleFirestoreError(e, 'write', 'settings/admin_users'));
    saveStorage('admin_users', users);
  } catch (e) {
    console.error("Error saving admin users to Firebase:", e);
    saveStorage('admin_users', users);
  }
}

export async function getRegistrations(): Promise<Registration[]> {
  try {
    const q = query(collection(db, 'registrations'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q).catch(e => handleFirestoreError(e, 'list', 'registrations'));
    return querySnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as any[];
  } catch (err) {
    console.error("Error fetching registrations:", err);
    return [];
  }
}

export async function deleteRegistration(id: string) {
  try {
    await deleteDoc(doc(db, 'registrations', id)).catch(e => handleFirestoreError(e, 'delete', `registrations/${id}`));
  } catch (err) {
    console.error("Error deleting registration:", err);
  }
}

export async function updateRegistrationStatus(id: string, status: string) {
  try {
    await updateDoc(doc(db, 'registrations', id), { status }).catch(e => handleFirestoreError(e, 'update', `registrations/${id}`));
  } catch (err) {
    console.error("Error updating registration status:", err);
  }
}

export async function updateRegistration(id: string, data: Partial<Registration>) {
  try {
    await updateDoc(doc(db, 'registrations', id), {
      ...data,
      updatedAt: serverTimestamp()
    }).catch(e => handleFirestoreError(e, 'update', `registrations/${id}`));
  } catch (err) {
    console.error("Error updating registration:", err);
    throw err;
  }
}

export async function login(username: string, passwordOrPorsi: string): Promise<User | null> {
  const cleanInput = (val: string) => val ? String(val).trim() : '';
  const uName = cleanInput(username);
  const pwOrPorsi = cleanInput(passwordOrPorsi);

  // Ensure Firebase Auth session exists before any Firestore calls
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (e) {
      console.error("Anonymous auth failed:", e);
      // We continue because spreadsheet-based login might still work if it doesn't hit Firestore fallback
    }
  }

  // Priority check for the newly requested admin password
  if (uName === 'admin' && pwOrPorsi === 'adnimku') {
    return { id: 'admin-admin', username: 'admin', nama: 'Super Admin', role: 'super_admin' };
  }

  const admins = await getAdminUsers();
  const admin = admins.find(u => u.username === uName && (u.password === pwOrPorsi || u.porsi === pwOrPorsi));
  
  if (admin) {
    if (!auth.currentUser) await signInAnonymously(auth);
    return admin;
  }

  const jemaahList = await fetchJemaah();
  
  // LOGGING (Internal)
  if (!jemaahList || jemaahList.length === 0) {
    console.error("No jemaah loaded from spreadsheet.");
  }

  // Helper for flexible matching (removes non-digits)
  const toDigits = (val: string) => val ? String(val).replace(/\D/g, '') : '';
  const uDigits = toDigits(uName);
  const pDigits = toDigits(pwOrPorsi);

  const jemaah = jemaahList.find(j => {
    const dbPorsi = cleanInput(j.nomorPorsi);
    const dbPorsiDigits = toDigits(dbPorsi);
    const dbName = cleanInput(j.namaLengkap).toLowerCase();
    
    // 1. Exact Porsi match
    if (dbPorsi && (dbPorsi === pwOrPorsi || dbPorsi === uName)) return true;
    
    // 2. Digits-only match (if long enough)
    if (uDigits && uDigits.length >= 7 && dbPorsiDigits === uDigits) return true;
    if (pDigits && pDigits.length >= 7 && dbPorsiDigits === pDigits) return true;
    
    // 3. Name match (fallback)
    const lowU = uName.toLowerCase();
    const lowP = pwOrPorsi.toLowerCase();
    if (dbName && (dbName === lowU || dbName === lowP)) return true;
    
    return false;
  });

  if (jemaah) {
    return { 
      id: jemaah.no, 
      username: jemaah.namaLengkap, 
      nama: jemaah.namaLengkap, 
      role: 'jemaah', 
      porsi: jemaah.nomorPorsi 
    };
  }
  return null;
}
