# SIM ARAFAH Muhammadiyah Klaten

Sistem Informasi Manajemen KBIHU Arafah Muhammadiyah Klaten. 
Aplikasi ini dirancang untuk memudahkan manajemen data jemaah haji, pendaftaran baru, dan penyebaran konten bimbingan haji.

## Fitur Utama
- **Dashboard Admin**: Manajemen data jemaah (Sinkronisasi Google Sheets).
- **Pendaftaran Mandiri**: Jemaah baru dapat mendaftar dan mengunggah dokumen (KTP, SPPH, Pas Foto).
- **Dasbor Jemaah**: Ceklist perbekalan, materi bimbingan (video/artikel), dan info jadwal.
- **Translate & AI**: Fitur terjemahan dan bantuan informasi berbasis AI.
- **Optimasi Firestore**: Implementasi debounce dan manajemen kuota tulis harian.

## Teknologi
- **Frontend**: React (Vite) + Tailwind CSS + Framer Motion.
- **Backend/Database**: Firebase (Firestore & Auth).
- **Spreadsheet Sync**: Integrasi Google Sheets API via PapaParse.
- **Icons**: Lucide React.

## Cara Sinkronisasi GitHub dari AI Studio
Untuk sinkronisasi berkala dari lingkungan Build AI Studio ke repositori GitHub:
1. Klik ikon **Settings** (roda gigi) di pojok kiri bawah AI Studio.
2. Pilih menu **"Export to GitHub"**.
3. Hubungkan akun GitHub Anda dan pilih repositori yang diinginkan.
4. Klik **"Push to GitHub"** setiap kali Anda selesai melakukan perubahan di sini.

## Pengembangan Lokal
1. Clone repositori ini.
2. Jalankan `npm install`.
3. Buat file `.env` berdasarkan `.env.example`.
4. Jalankan `npm run dev`.

---
© 2026 KBIHU Arafah Muhammadiyah Klaten.
