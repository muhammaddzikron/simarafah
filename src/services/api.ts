import { Jemaah, AdminContent, User, PaymentData, UserRole, Registration, MateriItem } from '../types';
import Papa from 'papaparse';
import { db, dbDefault, auth, handleFirestoreError, testFirebaseConnection } from '../lib/firebase';

export { testFirebaseConnection };
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs, query, orderBy, deleteDoc, updateDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/14W48hU9eYzxZ5EkjGGSTs1WCTzITV02QooOoo7lYix0/export?format=csv&gid=9046765';
const SPREADSHEET_CONTENT_URL = 'https://docs.google.com/spreadsheets/d/14W48hU9eYzxZ5EkjGGSTs1WCTzITV02QooOoo7lYix0/export?format=csv&gid=1724714709';

// Storage keys with versioning to force refresh on logic change
const STORAGE_VER = 'v4';
const KEY_JEMAAH = `jemaah_data_${STORAGE_VER}`;
const KEY_CONTENT = `admin_content_${STORAGE_VER}`;
const KEY_USERS = `admin_users_${STORAGE_VER}`;

// Helper to get from local storage
const getStorage = <T>(key: string, initial: T): T => {
  const saved = localStorage.getItem(key);
  if (!saved) return initial;
  try {
    const data = JSON.parse(saved);
    return (data === null || data === undefined) ? initial : data;
  } catch {
    return initial;
  }
};

// Helper to save to local storage
const saveStorage = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// In-memory cache for jemaah data to speed up repeated access and login
let cachedJemaah: Jemaah[] | null = null;
let cachedAdminContent: AdminContent | null = null;
let lastFetchTime = 0;
let lastContentFetchTime = 0;
let successfulContentPath: any = getStorage<{db: any, path: string[], label: string} | null>('successful_content_path', null); 
const CACHE_TTL = 3 * 60 * 1000; // Reduced to 3 minutes cache

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
  profil: `KBIHU Arafah Muhammadiyah Klaten (Kelompok Bimbingan Ibadah Haji dan Umrah Arafah Muhammadiyah Klaten) merupakan lembaga bimbingan ibadah haji dan umrah yang berada di bawah naungan Lembaga Pembinaan Haji dan Umrah (LPHU) Pimpinan Daerah Muhammadiyah (PDM) Klaten. Sebagai mitra resmi Kementerian Agama, KBIHU Arafah Klaten memiliki peran penting dalam memberikan pembinaan, bimbingan manasik, serta pendampingan bagi calon jamaah haji dan umrah.

Selama lebih dari 26 tahun berdiri, KBIHU Arafah Muhammadiyah Klaten telah konsisten membersamai dan membimbing jamaah dalam mempersiapkan ibadah secara optimal, baik dari segi pemahaman syariat, kesiapan fisik, maupun kematangan mental dan spiritual. Lembaga ini terus berkomitmen memberikan pelayanan terbaik demi tercapainya ibadah haji dan umrah yang mandiri, tertib, dan mabrur.

Dalam pelayanannya, KBIHU Arafah Muhammadiyah Klaten menyelenggarakan berbagai kegiatan, di antaranya bimbingan manasik haji secara intensif dan simulasi manasik massal, yang bertujuan memperkuat pemahaman jamaah terhadap rukun dan tata cara ibadah haji. Selain itu, lembaga ini juga memberikan pendampingan langsung kepada jamaah, baik saat di tanah air maupun selama pelaksanaan ibadah di Tanah Suci. Pada musim haji 2026, KBIHU Arafah Klaten tercatat mendampingi sekitar 726 calon jamaah haji yang terbagi dalam beberapa kelompok terbang (kloter).

Seiring perkembangan zaman, KBIHU Arafah Muhammadiyah Klaten juga mengadopsi transformasi digital dalam memberikan layanan bimbingan, sehingga lebih praktis, terjangkau, dan mudah diakses oleh jamaah. Hal ini menjadi bagian dari upaya meningkatkan kualitas pelayanan yang profesional and berkelanjutan.

Saat ini, KBIHU Arafah Muhammadiyah Klaten dipimpin oleh Dr. dr. H. Husen Prabowo, M.Kes, yang terus mendorong inovasi dan penguatan pelayanan demi mewujudkan jamaah yang mandiri, berilmu, dan meraih haji mabrur.`,
  galeri: ['https://www.youtube.com/watch?v=zcgRIpUf6S0'],
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
    ig: 'arafahklaten',
    tiktok: 'arafahklaten',
    yt: '@arafahklaten'
  },
  kontak: {
    wa1: '6285225881780',
    wa2: '6285225881780',
    alamat: 'Dadimulyo, Gergunung, Klaten Utara, Klaten, jawa Tengah',
    peta: 'https://maps.app.goo.gl/iY1dhxG4RfydVYnC8'
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

// Helper to ensure auth is ready
async function ensureAuth() {
  if (!auth.currentUser) {
    try {
      console.log("Firebase: Attempting anonymous authentication...");
      const cred = await signInAnonymously(auth);
      console.log("Firebase: Anonymous authentication successful. UID:", cred.user.uid);
    } catch (e: any) {
      // auth/admin-restricted-operation means Anonymous Auth is disabled in Firebase Console
      if (e.code === 'auth/admin-restricted-operation') {
        console.warn("Firebase Auth Error: 'Anonymous' provider is disabled in Firebase Console. Please enable it under Authentication > Sign-in method.");
      } else {
        console.error("Firebase Auth Error:", e.code, e.message);
      }
    }
  }
}

export function forceResetLocalData() {
  localStorage.removeItem(KEY_JEMAAH);
  localStorage.removeItem(KEY_CONTENT);
  localStorage.removeItem(KEY_USERS);
  localStorage.removeItem('successful_content_path');
  window.location.reload();
}

export async function fetchJemaah(shouldSync: boolean = false): Promise<Jemaah[]> {
  const now = Date.now();
  if (!shouldSync && cachedJemaah && (now - lastFetchTime < CACHE_TTL)) {
    return cachedJemaah;
  }

  try {
    await ensureAuth();

    // 1. Try Spreadsheet first (Master Data)
    const url = shouldSync ? `${SPREADSHEET_URL}&t=${now}` : SPREADSHEET_URL;
    const response = await fetch(url).catch(e => {
        console.warn("Spreadsheet fetch network error:", e);
        return null;
    });

    if (response && response.ok) {
      const text = await response.text();
      const jemaahList = await new Promise<Jemaah[]>((resolve, reject) => {
        Papa.parse(text, {
          header: false,
          skipEmptyLines: true,
          complete: (results) => {
            const data = results.data as any[];
            if (!data || data.length === 0) {
              resolve([]);
              return;
            }
            
            // ... (keep all the indexing logic)
            let hIdx = -1;
            for(let i=0; i<Math.min(data.length, 15); i++) {
                const rowStr = JSON.stringify(data[i]).toLowerCase();
                if ((rowStr.includes('nama') || rowStr.includes('lengkap')) && (rowStr.includes('porsi') || rowStr.includes('kloter') || rowStr.includes('no'))) {
                    hIdx = i;
                    break;
                }
            }

            const headerRow = hIdx !== -1 ? data[hIdx].map((h: any) => String(h || '').toLowerCase().trim()) : [];
            const findC = (keys: string[], def: number) => {
              if (hIdx === -1) return def;
              const lowerKeys = keys.map(k => k.toLowerCase());
              for (const k of lowerKeys) {
                const exactIdx = headerRow.findIndex(h => h === k);
                if (exactIdx !== -1) return exactIdx;
              }
              const preciseIdx = headerRow.findIndex(h => {
                return lowerKeys.some(k => {
                  if (k === 'nama' && (h.includes('ketua') || h.includes('karom') || h.includes('pendamping'))) return false;
                  if (k === 'rombongan' && (h.includes('ketua') || h.includes('karom') || h.includes('nama'))) return false;
                  if (k === 'wa' && (h.includes('karom') || h.includes('ketua') || h.includes('pendamping') || h.includes('petugas'))) return false;
                  return h.includes(k);
                });
              });
              if (preciseIdx !== -1) return preciseIdx;
              const anyIdx = headerRow.findIndex(h => lowerKeys.some(k => h.includes(k)));
              return anyIdx !== -1 ? anyIdx : def;
            };

            const idx = {
              nama: findC(['nama lengkap', 'jemaah', 'nama'], 8), 
              porsi: findC(['nomor porsi', 'porsi hq', 'porsi'], 5), 
              kloter: findC(['kloter'], 1),
              romb: findC(['rombongan'], 2),
              asrama: findC(['asrama', 'masuk'], 3),
              karom: findC(['ketua rombongan', 'karom', 'ketua'], 4),
              waKarom: findC(['wa karom', 'wa ketua'], 28), 
              waPetugas: findC(['wa petugas', 'admin', 'petugas'], 29), 
              umur: findC(['umur'], 9),
              jk: findC(['jenis kelamin', 'jk'], 10),
              alamat: findC(['alamat'], 11),
              desa: findC(['desa', 'kelurahan'], 12),
              kec: findC(['kecamatan'], 13),
              kab: findC(['kabupaten'], 14),
              wa: findC(['wa jemaah', 'whatsapp jemaah', 'nomor wa', 'wa'], 15),
              hotel: findC(['hotel mekah'], 31), 
              peta: findC(['link peta', 'peta hotel'], 32), 
              tanazul: findC(['tanazul'], 16),
              murur: findC(['murur'], 17),
              nafar: findC(['nafar'], 18),
              dam: findC(['jalur dam', 'dam'], 19),
              gel: findC(['umrah gel', 'gelombang'], 20),
              badal: findC(['badal'], 21),
              roda: findC(['kursi roda', 'roda'], 22),
              tongkat: findC(['tongkat', 'kruk'], 23),
              penTubuh: findC(['pen tubuh', 'pen'], 24), 
              ringJantung: findC(['ring jantung', 'ring'], 25), 
              pendamping: findC(['pendamping lansia', 'pendamping'], 26), 
              waPendamping: findC(['wa pendamping'], 27), 
              paspor: findC(['paspor'], 6), 
              visa: findC(['visa'], 7) 
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
            resolve(jemaahList);
          },
          error: (err: any) => reject(err)
        });
      });

      if (shouldSync && jemaahList.length > 0) {
        saveJemaah(jemaahList).catch(console.error);
      } else {
        saveStorage(KEY_JEMAAH, jemaahList);
      }
      
      cachedJemaah = jemaahList;
      lastFetchTime = now;
      return jemaahList;
    }

    // 2. Fallback to Firestore if Spreadsheet fail
    const possiblePaths = [
      { db: db, path: ['settings', 'jemaah_data'], label: 'DB-Config: settings/jemaah_data' },
      { db: db, path: ['jemaah_data'], label: 'DB-Config: root/jemaah_data' },
      { db: dbDefault, path: ['settings', 'jemaah_data'], label: 'DB-Default: settings/jemaah_data' },
      { db: dbDefault, path: ['jemaah_data'], label: 'DB-Default: root/jemaah_data' },
    ];

    for (const p of possiblePaths) {
      try {
        let snap;
        if (p.path.length === 2) {
          snap = await getDoc(doc(p.db, p.path[0], p.path[1])).catch(() => null);
        } else {
          // If it's single length, it's likely a root collection named as the doc should be,
          // but if it's meant to be a doc, we can't reliably guess the ID.
          // However, many users store a single doc in a collection.
          const colSnap = await getDocs(collection(p.db, p.path[0])).catch(() => null);
          if (colSnap && !colSnap.empty) {
            // Try to find if any doc in this collection has the jemaah array
            for (const d of colSnap.docs) {
              const dData = d.data() as { jemaah: Jemaah[] };
              if (dData.jemaah && dData.jemaah.length > 0) {
                console.log(`✅ Success! Recovered jemaah data from collection ${p.label}. Count: ${dData.jemaah.length}`);
                return dData.jemaah;
              }
            }
          }
          continue;
        }

        if (snap && snap.exists()) {
          const data = snap.data() as { jemaah: Jemaah[] };
          if (data.jemaah && data.jemaah.length > 0) {
            console.log(`✅ Success! Recovered jemaah data from document ${p.label}. Count: ${data.jemaah.length}`);
            return data.jemaah;
          }
        }
      } catch (e) {
        console.warn(`Probing jemaah at ${p.label} failed:`, e);
      }
    }

    // Try collection 'jemaah' (root level)
    const collectionsToTry = [
      { db: db, name: 'jemaah', label: 'DB-Config: jemaah (col)' },
      { db: dbDefault, name: 'jemaah', label: 'DB-Default: jemaah (col)' }
    ];
    for (const col of collectionsToTry) {
      try {
        const colSnap = await getDocs(collection(col.db, col.name)).catch(() => null);
        if (colSnap && !colSnap.empty) {
          console.log(`✅ Success! Found legacy jemaah collection in ${col.label}. Items: ${colSnap.size}`);
          return colSnap.docs.map(d => ({ id: d.id, ...d.data() } as any as Jemaah));
        }
      } catch (e) {
        console.warn(`Probing jemaah collection ${col.label} failed:`, e);
      }
    }

    return getStorage(KEY_JEMAAH, defaultJemaah);
  } catch (error) {
    console.error('fetchJemaah overall failure:', error);
    return getStorage(KEY_JEMAAH, defaultJemaah);
  }
}

export async function saveJemaah(jemaah: Jemaah[]) {
  try {
    await ensureAuth();
    await setDoc(doc(db, 'settings', 'jemaah_data'), {
      jemaah,
      updatedAt: serverTimestamp()
    }).catch(e => handleFirestoreError(e, 'write', 'settings/jemaah_data'));
    saveStorage(KEY_JEMAAH, jemaah);
  } catch (e) {
    console.error("Error saving jemaah to Firebase:", e);
    saveStorage(KEY_JEMAAH, jemaah);
  }
}

export async function getAdminContent(forceSync = false): Promise<AdminContent> {
  const now = Date.now();
  if (!forceSync && cachedAdminContent && (now - lastContentFetchTime < CACHE_TTL)) {
    return cachedAdminContent;
  }

  try {
    await ensureAuth();
    
    // Most likely paths first
    const possiblePaths = successfulContentPath ? [successfulContentPath] : [
      { db: db, path: ['settings', 'admin_content'], label: 'DB-Config: settings/admin_content' },
      { db: dbDefault, path: ['settings', 'admin_content'], label: 'DB-Default: settings/admin_content' },
      { db: db, path: ['settings', 'admin-content'], label: 'DB-Config: settings/admin-content' },
      { db: db, path: ['admin_content'], label: 'DB-Config: root/admin_content' },
    ];

    let recoveredData: AdminContent | null = null;

    console.log("--- Starting Deep Search for Recovery ---");
    for (const p of possiblePaths) {
      try {
        let snap;
        if (p.path.length === 2) {
          snap = await getDoc(doc(p.db, p.path[0], p.path[1])).catch(() => null);
        } else {
          // Single segment path probe
          const colSnap = await getDocs(collection(p.db, p.path[0])).catch(() => null);
          if (colSnap && !colSnap.empty) {
            for (const d of colSnap.docs) {
              const dData = d.data() as AdminContent;
              if (dData.materi && dData.materi.length > 0) {
                 console.log(`✅ Success! Recovered content from collection ${p.label}. Materials: ${dData.materi.length}`);
                 recoveredData = dData;
                 break;
              }
            }
          }
          if (recoveredData) break;
          continue;
        }

        if (snap && snap.exists()) {
          const data = snap.data() as AdminContent;
          if (data.materi && data.materi.length > 0) {
            console.log(`✅ Success! Recovered data from document ${p.label}. Materials: ${data.materi.length}`);
            recoveredData = data;
            successfulContentPath = p; // Cache the successful path
            saveStorage('successful_content_path', p);
            break;
          }
          console.log(`ℹ️ Found document at ${p.label}, but it has no materials.`);
          recoveredData = recoveredData || data; 
          successfulContentPath = p;
          saveStorage('successful_content_path', p);
        }
      } catch (e) {
        console.warn(`Probing ${p.label} failed:`, e);
      }
    }

    // Individual Collection Probing
    if (!recoveredData || !recoveredData.materi || recoveredData.materi.length === 0) {
      const collectionsToTry = [
        { db: db, name: 'materi', label: 'DB-Config: materi (col)' },
        { db: dbDefault, name: 'materi', label: 'DB-Default: materi (col)' },
        { db: db, name: 'admin_content', label: 'DB-Config: admin_content (col)' },
        { db: dbDefault, name: 'admin_content', label: 'DB-Default: admin_content (col)' }
      ];

      for (const col of collectionsToTry) {
        try {
          const colSnap = await getDocs(collection(col.db, col.name)).catch(() => null);
          if (colSnap && !colSnap.empty) {
            console.log(`✅ Success! Found legacy collection '${col.name}' in ${col.label}. Items: ${colSnap.size}`);
            const items = colSnap.docs.map(d => ({ id: d.id, ...d.data() } as MateriItem));
            if (!recoveredData) recoveredData = { ...defaultAdminContent };
            recoveredData.materi = items;
            break;
          }
        } catch (e) {
          console.warn(`Probing collection ${col.label} failed:`, e);
        }
      }
    }

    if (recoveredData) {
      console.log("--- End of Deep Search: Success ---");
      // Result must be merged with defaults to prevent crashes (e.g. missing sosmed)
      const finalContent = {
        ...defaultAdminContent,
        ...recoveredData,
        sosmed: { ...defaultAdminContent.sosmed, ...(recoveredData.sosmed || {}) },
        kontak: { ...defaultAdminContent.kontak, ...(recoveredData.kontak || {}) },
        agenda: recoveredData.agenda || defaultAdminContent.agenda,
        materi: recoveredData.materi || defaultAdminContent.materi,
        galeri: recoveredData.galeri || defaultAdminContent.galeri,
        pembayaran: recoveredData.pembayaran || defaultAdminContent.pembayaran,
        kontakPetugas: recoveredData.kontakPetugas || defaultAdminContent.kontakPetugas,
        perlengkapan: recoveredData.perlengkapan || defaultAdminContent.perlengkapan
      };
      cachedAdminContent = finalContent;
      lastContentFetchTime = now;
      saveStorage(KEY_CONTENT, finalContent);
      return finalContent;
    }

    console.log("--- End of Deep Search: No Firestore data found. Using fallback source. ---");

    // 2. Fallback to Spreadsheet
    const response = await fetch(`${SPREADSHEET_CONTENT_URL}&t=${Date.now()}`).catch(e => {
        console.warn("Spreadsheet content fetch error:", e);
        return null;
    });
    
    if (response && response.ok) {
      const text = await response.text();
      return new Promise((resolve) => {
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const rows = results.data as any[];
            if (rows.length === 0) {
              resolve(getStorage(KEY_CONTENT, defaultAdminContent));
              return;
            }
            // ... (keep mapping logic)
            const content: AdminContent = {
              profil: '', galeri: [], agenda: [], materi: [],
              sosmed: { ig: '', tiktok: '', yt: '' },
              kontak: { wa1: '', wa2: '', alamat: '', peta: '' },
              pengumuman: '', perlengkapan: [], pembayaran: [], kontakPetugas: []
            };

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
              // Mapping MATERI from Spreadsheet
              if (['MATERI', 'PUSTAKA', 'DOA', 'VIDEO', 'TEKS', 'DOWNLOAD'].includes(type)) {
                const subTipe = type === 'MATERI' || type === 'PUSTAKA' 
                  ? (getV(['SUBTIPE', 'SUBKATEGORI', 'JENIS_MATERI']) || 'teks').toLowerCase() 
                  : type.toLowerCase();
                
                content.materi.push({
                  id: Math.random().toString(36).substr(2, 9),
                  judul: getV(['JUDUL', 'NAMA', 'TITLE']),
                  tipe: subTipe as any,
                  link: getV(['LINK', 'URL', 'DRIVE']),
                  isi: {
                    arab: getV(['ARAB']),
                    latin: getV(['LATIN']),
                    terjemahan: getV(['TERJEMAHAN', 'ART']),
                    konten: getV(['ISI', 'KONTEN', 'TEXT'])
                  }
                });
              }
            });

            if (!content.profil) content.profil = defaultAdminContent.profil;
            if (content.galeri.length === 0) content.galeri = defaultAdminContent.galeri;
            if (content.agenda.length === 0) content.agenda = defaultAdminContent.agenda;
            
            cachedAdminContent = content;
            lastContentFetchTime = now;
            saveStorage(KEY_CONTENT, content);
            resolve(content);
          },
          error: () => resolve(getStorage(KEY_CONTENT, defaultAdminContent))
        });
      });
    }
    return getStorage(KEY_CONTENT, defaultAdminContent);
  } catch (error) {
    console.error('getAdminContent overall failure:', error);
    return getStorage(KEY_CONTENT, defaultAdminContent);
  }
}

// Recursive safer sanitization for Firebase
function sanitizePayload(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(v => sanitizePayload(v));
  } else if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        newObj[key] = sanitizePayload(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

export async function saveAdminContent(content: AdminContent) {
  try {
    await ensureAuth();
    
    // Clean data for Firestore (remove undefineds)
    const sanitized = sanitizePayload(content);
    
    console.log("Firebase Save: Attempting to write to settings/admin_content (Primary Path)...");
    const targetDoc = doc(db, 'settings', 'admin_content');
    
    await setDoc(targetDoc, {
      ...sanitized,
      updatedAt: serverTimestamp()
    }).catch(e => {
      console.error("Firestore setDoc failed:", e);
      handleFirestoreError(e, 'write', 'settings/admin_content');
    });
    
    console.log("Firebase Save: Success. Updating local cache.");
    
    // Update path cache to the one we just saved to
    successfulContentPath = { db: db, path: ['settings', 'admin_content'], label: 'DB-Config: settings/admin_content' };
    saveStorage('successful_content_path', successfulContentPath);
    
    saveStorage(KEY_CONTENT, content);
    cachedAdminContent = content;
    lastContentFetchTime = Date.now();
  } catch (e) {
    console.error("Error saving admin content to Firebase:", e);
    saveStorage(KEY_CONTENT, content);
    throw e; // Relaunch to let UI show error
  }
}

export async function getAdminUsers(): Promise<User[]> {
  try {
    await ensureAuth();
    const docRef = doc(db, 'settings', 'admin_users');
    const docSnap = await getDoc(docRef).catch(e => handleFirestoreError(e, 'get', 'settings/admin_users'));
    if (docSnap.exists()) {
      return docSnap.data().users || [];
    }
  } catch (e) {
    console.error("Error loading admin users from Firebase:", e);
  }
  return getStorage(KEY_USERS, defaultAdminUsers.map(u => ({ ...u, id: `admin-${u.username}`, role: u.role as UserRole })));
}

export async function saveAdminUsers(users: User[]) {
  try {
    await ensureAuth();
    await setDoc(doc(db, 'settings', 'admin_users'), {
      users,
      updatedAt: serverTimestamp()
    }).catch(e => handleFirestoreError(e, 'write', 'settings/admin_users'));
    saveStorage(KEY_USERS, users);
  } catch (e) {
    console.error("Error saving admin users to Firebase:", e);
    saveStorage(KEY_USERS, users);
  }
}

export async function getRegistrations(): Promise<Registration[]> {
  try {
    await ensureAuth();
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
    await ensureAuth();
    await deleteDoc(doc(db, 'registrations', id)).catch(e => handleFirestoreError(e, 'delete', `registrations/${id}`));
  } catch (err) {
    console.error("Error deleting registration:", err);
  }
}

export async function updateRegistrationStatus(id: string, status: string) {
  try {
    await ensureAuth();
    await updateDoc(doc(db, 'registrations', id), { status }).catch(e => handleFirestoreError(e, 'update', `registrations/${id}`));
  } catch (err) {
    console.error("Error updating registration status:", err);
  }
}

export async function updateRegistration(id: string, data: Partial<Registration>) {
  try {
    await ensureAuth();
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

  // Parallelize Auth and Data Fetching
  const authPromise = ensureAuth();
  
  // Fast Path for hardcoded admin
  if (uName === 'admin' && pwOrPorsi === 'adnimku') {
    await authPromise;
    return { id: 'admin-admin', username: 'admin', nama: 'Super Admin', role: 'super_admin' };
  }

  // Fetch roles and jemaah in parallel to save time
  const [admins, jemaahList] = await Promise.all([
    getAdminUsers(),
    fetchJemaah()
  ]);

  const admin = admins.find(u => u.username === uName && (u.password === pwOrPorsi || u.porsi === pwOrPorsi));
  
  if (admin) {
    return admin;
  }
  
  // LOGGING (Internal)
  if (!jemaahList || jemaahList.length === 0) {
    console.error("No jemaah loaded.");
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
