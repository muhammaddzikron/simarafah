export interface Jemaah {
  no: string;
  namaLengkap: string;
  kloter: string;
  rombongan: string;
  jadwalMasukAsrama: string;
  namaKetuaRombongan: string;
  waKarom: string;
  umur: string;
  jenisKelamin: string;
  alamat: string;
  desa: string;
  kecamatan: string;
  kabupaten: string;
  wa: string;
  tanazul: string;
  murur: string;
  nafar: string;
  jalurDam: string;
  umrahGelombang: string;
  badal: string;
  kursiRoda: string;
  tongkat: string;
  penTubuh: string;
  ringJantung: string;
  pendampingLansia: string;
  waPendamping: string;
  hotelMekah: string;
  linkPetaHotel: string;
  nomorPorsi?: string;
  keteranganKhusus?: string; // Health info
  waPetugas?: string;
  paspor?: string;
  visa?: string;
}

export interface PaymentData {
  jenis: string;
  total: number;
  dibayar: number;
}

export interface MateriItem {
  id: string;
  judul: string;
  link?: string;
  tipe: 'download' | 'video' | 'doa' | 'teks';
  isi?: {
    arab?: string;
    latin?: string;
    terjemahan?: string;
    konten?: string;
  };
}

export interface AdminContent {
  profil: string;
  galeri: string[]; // Youtube links
  agenda: { tanggal: string; kegiatan: string }[];
  materi: MateriItem[];
  sosmed: { ig: string; tiktok: string; yt: string };
  kontak: { wa1: string; wa2: string; alamat: string; peta: string };
  pengumuman: string;
  perlengkapan: { item: string; selesai: boolean }[];
  ceklistTemplates?: {
    pria: string;
    wanita: string;
    tambahan: string;
  };
  pembayaran: PaymentData[];
  kontakPetugas: { nama: string; jabatan: string; wa: string }[];
}

export type UserRole = 'jemaah' | 'admin_petugas' | 'super_admin';

export interface User {
  id: string;
  username: string;
  nama: string;
  role: UserRole;
  porsi?: string;
  password?: string;
}

export interface Registration {
  id: string;
  nomorPorsi: string;
  namaLengkap: string;
  alamat: string;
  ttl: string;
  jk: string;
  statusNikah: string;
  namaIbu: string;
  usia: string;
  wa: string;
  kesehatan: {
    penTubuh: boolean;
    ringJantung: boolean;
    kursiRoda: boolean;
  };
  photos?: Record<string, string>;
  createdAt: any;
  status?: 'pending' | 'verified' | 'rejected';
}
