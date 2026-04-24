import { Jemaah, AdminContent, User, PaymentData, UserRole, Registration, MateriItem } from '../types';
import Papa from 'papaparse';
import { db, dbDefault, auth, handleFirestoreError, testFirebaseConnection } from '../lib/firebase';

export { testFirebaseConnection };
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs, query, orderBy, deleteDoc, updateDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/14W48hU9eYzxZ5EkjGGSTs1WCTzITV02QooOoo7lYix0/export?format=csv&gid=9046765';
const SPREADSHEET_CONTENT_URL = 'https://docs.google.com/spreadsheets/d/14W48hU9eYzxZ5EkjGGSTs1WCTzITV02QooOoo7lYix0/export?format=csv&gid=1724714709';

// Storage keys with versioning to force refresh on logic change
const STORAGE_VER = 'v6';
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
  galeri: [
    'https://www.youtube.com/watch?v=zcgRIpUf6S0',
    'https://www.youtube.com/watch?v=bIPRDqX-OLE',
    'https://www.youtube.com/watch?v=cDWLtQ3N5_g',
    'https://www.youtube.com/watch?v=W-Gf7Ogeyog',
    'https://www.youtube.com/watch?v=jKrOIdDJFYw',
    'https://www.youtube.com/watch?v=BOLhKvFdjfk',
    'https://www.youtube.com/watch?v=M8iqO_HjJAE',
    'https://www.youtube.com/watch?v=pTVaNbC5E-s',
    'https://www.youtube.com/watch?v=IQtXoLoeN0I',
    'https://www.youtube.com/watch?v=xC27-AXg56Q',
    'https://www.youtube.com/watch?v=abg0NcsWRZ8',
    'https://www.youtube.com/watch?v=0U7ikRmH2Ew',
    'https://www.youtube.com/watch?v=r3KFRq4s6O4',
    'https://www.youtube.com/watch?v=-14q0nn_x_8'
  ],
  agenda: [
    { tanggal: '2026-04-20', kegiatan: 'Pengambilan Koper di Gedung KBIHU Arafah Klaten' },
    { tanggal: '2026-04-28', kegiatan: 'Pamitan Haji Kabupaten Klaten di Ghra Bung karno Kabupaten Klaten' }
  ],
  materi: [
    { id: 'd1', judul: '1. BACAAN SAAT BEPERGIAN', tipe: 'doa', isi: { arab: 'بِسْمِ اللهِ تَوَكَّلْتُ عَلَى اللَّهِ وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ', latin: "BISMILLAAHI TAWAKKALTU 'ALALLAAHI WALAA HAULA WALAA QUWWATA ILLAA BILLAAH.", terjemahan: 'Artinya: Dengan asma Allah, aku berserah diri kepada Allah, dan tidak ada daya serta kekuatan kecuali dari Allah (HR. Abu Dawud)' } },
    { id: 'd2', judul: "2. DO'A SAAT DI ATAS KENDARAAN", tipe: 'doa', isi: { arab: 'اللهُ أَكْبَرُ اللهُ أَكْبَر, اللهُ أَكْبَرُ. سُبْحَانَ الَّذِي سَخَّرَلَنَا هُذَا وَمَا كُنَّا لَهُ مُقرِنِينَ وَ إِنَّا إِلَى رَبِّنَا لَمُنْقَلِبُوْنَ اللهُمَّ إِنَّا نَسْأَلُكَ فِي سَفَرِنَا هَذَا الْبِرَّ وَالتَّقْوَى وَمِنَ الْعَمَلِ مَا تَرْضَى اللَّهُمَّ هَوَنْ عَلَيْنَا سَفَرَنَا هَذَا وَاطْوِعَنَّا بُعْدَهُ اَللَّهُمَّ أَنْتَ الصَّاحِبُ فِي السَّفَرِ وَالْخَلِيفَةُ فِي الْأَهْلِ اللَّهُمَّ إِنِّي أَعُوْذُبِكَ مِنْ وَعْثَاءِ السَّفَرِ وَكَأَبَةِ الْمَنْظَرِ وَسُوْءِ الْمُنْقَلَبِ فِي الْمَالِ وَالْأَهْلِ', latin: "ALLAAHU AKBAR 3x SUBHAANALLADZII SAKHKHARA LANAA HAADZAA WA MAA KUNNAA LAHUU MUQRINIIN WA INNAA ILAA RABBINAA LAMUNQOLIBUUN, ALLAAHUMΜΑ INNAA NAS- ALUKA FII SAFARINAA HAADZAA ALBIRRA WAT TAQWAA WAMINAL 'AMALI MAA TARDHAA, ALLAAHUMMA HAWWIN 'ALAINAA SAFARANAA HAADZAA WATHWI 'ANNAA BU'DAH. ALLAAHUMMA ANTASH SHAAHIBU FIS SAFARI WAL KHALIIFAT FIL AHL. ALLAAHUMMA INNII A'UUDZUBIKA MIN WA'TSAAIS-SAFARI WAKA AABATIL MANZHARI WA SUU-IL MUNQOLABI FIL MAALI WAL AHL", terjemahan: 'Artinya: Allah Maha Besar 3X. Maha suci Allah yang telah memudahkan kendaraan ini untuk kami, sedangkan kami tidak mampu menguasainya, dan sungguh hanya kepada Allah kami akan kembali. Ya Allah, sungguh kami memohon kepada-Mu kebaikan dan taqwa dalam perjalanan kami ini serta amal yang Engkau ridhai. Ya Allah, mudahkan perjalanan kami ini dan semoga Engkau mendekatkan jaraknya. Ya Allah, Engkau adalah teman dalam perjalanan dan penjaga keluarga kami. Ya Allah, sungguh aku berlindung kepada-Mu dari kesulitan-kesulitan dalam perjalanan, kesedihan hati karena pandangan, dan aku berlindung dari hal-hal yang tidak menyenangkan dalam harta, keluarga serta anak tatkala kembali (HR Muslim dan Nasai)' } },
    { id: 'd3', judul: '3. SAAT DIATAS KENDARAAN TATKALA PULANG', tipe: 'doa', isi: { arab: 'آيبُونَ تَائِبُونَ عَابِدُونَ لِرَ بِنَا حَامِدُونَ', latin: "AAYIBUUNA TAAIBUUNA 'AABIDUUNA LIRABBINAA HAAMIDUUN", terjemahan: 'Artinya: Kami telah kembali, telah bertaubat dan telah beribadah, dan hanya kepada Allah kami memuji. (HR. Muslim)' } },
    { id: 'd4', judul: '4. BACAAN AKAN WUDHU', tipe: 'doa', isi: { arab: 'بِسْمِ اللهِ الرَّحْمنِ الرَّحِيمِ', latin: 'BISMILLLAAHIR ROHMAA NIRRAHIIM', terjemahan: 'Artinya: Dengan nama Allah yang Maha Pengasih lagi Maha Penyayang.' } },
    { id: 'd5', judul: '5. BACAAN SESUDAH WUDHU', tipe: 'doa', isi: { arab: 'أَشْهَدُ أَنْ لاَ إِلَهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ', latin: "ASYHADU ALLAA ILAAHA ILLALLAAH WAHDAHUU LAA SYARIIKA LAH WA ASYHADU ANNA MUHAMMADAN 'ABDUHUU WA RASUULUH.", terjemahan: 'Artinya: Aku bersaksi bahwa tiada Tuhan selain Allah Yang Esa tiada sekutu bagiNya dan aku bersaksi bahwa Muhammad itu hambaNya dan utusanNya- (hr Muslim)' } },
    { id: 'd6', judul: "6. DO'A SESUDAH ADZAN", tipe: 'doa', isi: { arab: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ اللَّهُمَّ رَبَّ هَذِهِ الدَّعْوَةِ التَّامَّةِ وَالصَّلَاةِ الْقَائِمَةِ أتِ مُحَمَّدًانِ الْوَسِيلَةَ وَالْفَضِيلَةَ وَابْعَثْهُ مَقَامًا مَّحْمُودًا الَّذِي وَعَدْتَهُ', latin: "ALLAAHUMMA SHALLI 'ALAA MUHAMMAD. ALLAAHUMMA RABBAHAADZIHID DA'WATIT TAAMMAH, WASH SHALAATIL QAA-IMAH AATI MUHAMMADANIL WASIILATA WAL FADHIILAH, WAB 'ATSHU MAQAAMAM MAHMUUDANIL LADZII WA'AT TAH.", terjemahan: 'Ya Allah, berilah Ramat kebahagiaan kepada Muhammad SAW. Ya Allah Tuhan pemilik seruan yang sempurna ini, dan shalat yang akan ditegakkan ini, anugerahkanlah kepada Muhammad SAW derajat yang tinggi dan kemuliaan, dan bangkitkanlah ia ditempat yang terpuji, yang telah Engkau janjikan kepdanya. (HR Bukhori dll)' } },
    { id: 'd7', judul: "7. DO'A MASUK MASJID", tipe: 'doa', isi: { arab: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ', latin: 'ALLAAHUMMA SHALLI ALAA MUHAMMAD, ALLAAHUMMAFTAHLII AB WAABA RAHMΑΤΙΚ', terjemahan: 'Artinya: Ya Allah limpahkanlah Ramat kepada Nabi Muhammad. Ya Allah bukakanlah pintu-pintu Rahmat- Mu kepadaku. (HR. Muslim)' } },
    { id: 'd8', judul: "8. DO'A KELUAR MASJID", tipe: 'doa', isi: { arab: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنْ فَضْلِكَ', latin: 'ALLAAHUMMA INNI AS-ALUKA MIN FADHLIK', terjemahan: 'Artinya : Ya Allah, aku memohon kepada-Mu anugerah-Mu. (HR. Muslim dan Abu Dawud)' } },
    { id: 'd9', judul: '9. BACAAN MULAI UMRAH', tipe: 'doa', isi: { arab: 'لَبَّيْكَ عُمْرَةً', latin: "LABBAIKA 'UMRAH", terjemahan: 'Artinya: Aku sambut panggilan-Mu ya Allah untuk Umrah.' } },
    { id: 'd10', judul: '10. TALBIYAH', tipe: 'doa', isi: { arab: 'لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ لَبَّيْكَ لَا شَرِيكَ لَكَ لَبَّيْكَ إِنَّ الْحَمْدَ وَالنِّعْمَةَ لَكَ وَالْمُلْكَ لا شَرِيكَ لَكَ', latin: '"LABBAIK, ALLAA HUMMA LABBAIK, LABBAIKA LAA SYARIIKA LAKA LABBAAIK, INNAL HAMDA WANNI\'MATA LAAKA WAL MULKA, LAA SYARIIKA LAK"', terjemahan: 'Ya Allah, aku memenuhi panggilan-Mu, tiada sekutu bagi-Mu, sesungguhnya segala puji, nikmat dan kerajaan adalah milik-Mu, dan Tiada sekutu bagi-Mu.' } },
    { id: 'd11', judul: '11. BACAAN MULAI THAWAF DAN SETIAP LEWAT HAJAR ASWAD', tipe: 'doa', isi: { arab: 'اللهُ أَكْبَرُ', latin: 'ALLAHU AKBAR', terjemahan: 'Artinya: Allah Maha Besar' } },
    { id: 'd12', judul: '12. CONTOH DZIKIR SAAT THAWAF', tipe: 'doa', isi: { arab: 'سُبْحَانَ اللهِ وَالْحَمْدُ لِلَّهِ وَلَا إِلَهَ إِلَّا اللهُ وَاللَّهُ أَكْبَرُ وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ', latin: 'SUBHAANALLAAH WAL HAMDU LILLAAH WALAA ILAAHA ILLALLAAH WALLAAHU AKBAR WALAA HAULA WALAA QUWWATA ILLAA BILLAAH', terjemahan: 'Artinya: Maha Suci Allah, segala puji bagi-Nya, Tiada Tuhan selain Allah, Allah Maha Besar, Tiada daya dan kekuatan selain dari Allah.' } },
    { id: 'd13', judul: "13. DO'A DIBACA SAAT THAWAF ANTARA RUKUN YAMANI DAN HAJAR ASWAD", tipe: 'doa', isi: { arab: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ', latin: "ROBBANAA AATINA FID DUNYA HASANAH WA FIL AAKHIROOTI HASANAH, WA QINAA 'ADZABAN-NAAR", terjemahan: 'Ya Allah Tuhan kami,berikanlah kami kebaikan di dunia dan di akhirat dan jagalah kami dari siksa api neraka.' } },
    { id: 'd14', judul: '14. BACAAN KETIKA MENUJU DIBELAKANG MAQAM IBRAHIM', tipe: 'doa', isi: { arab: 'وَاتَّخِذُوا مِنْ مَقَامِ إِبْرَاهِيمَ مُصَلَّى', latin: 'WATTAKHIDZUU MIM MAQAAMIIBRAAHIIMA MUSHALLAA.', terjemahan: 'Artinya: Jadikanlah Maqam Ibrahim itu sebagai tempat shalat.' } },
    { id: 'd15.1', judul: "15.1 BACAAN SHALAT MAQAM IBRAHIM (Iftitah, Ta'awwudz, Basmalah)", tipe: 'doa', isi: { arab: 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّحِيمِ بِسْمِ اللهِ الرَّحْمنِ الرَّحِيمِ', latin: 'A`ŪDZU BILLĀHI MINAS-SYAITĀNIR-RAJĪM. BISMILLAAHIR RAHMAANIRRAHIIM', terjemahan: 'Artinya: Aku berlindung kepada Allah dari godaan syaithan yang terkutuk. Dengan menyebut nama Allah Yang Maha Pemurah, lagi Maha Penyayang.' } },
    { id: 'd15.2', judul: '15.2 BACAAN SHALAT MAQAM IBRAHIM (Al-Fatihah)', tipe: 'doa', isi: { arab: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَلَمِينَ الرَّحْمَنِ الرَّحِيمُ مُلِكِ يَوْمِ الدِّينِ إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوْبِ عَلَيْهِمْ وَلَا الضَّالِّينَ (آمِينَ)', latin: "ALHAMDULILLAAHI RABBIL 'AALAMIIN, ARRAHMAANIR RAHIIM, MAALIKI YAUMIDDIIN, IYYAAKA NA'BUDU WA IYYAAKA NASTAIIN, IHDINASH- SHIRAATHALMUSTAQIIM, SHIRAATAL- LADZIINA 'AN 'AMTA 'ALAIHIM GHAIRIL MAGHDHUUBI ALAIHIM WALADH-DHALLIIN. AAMIIN.", terjemahan: 'Artinya: Segala puji bagi Allah, Tuhan semesta alam. Maha Pemurah lagi Maha Penyayang. Yang menguasai di hari Pembalasan. Engkaulah yang kami sembah, dan Hanya kepada Engkaulah kami meminta pertolongan. Tunjukilah kami jalan yang lurus, (yaitu) jalan orang-orang yang Telah Engkau beri nikmat kepada mereka; bukan (jalan) mereka yang dimurkai dan bukan (pula jalan) mereka yang sesat.' } },
    { id: 'd15.3', judul: "15.3 BACAAN SHALAT MAQAM IBRAHIM (Raka'at Pertama: Al-Kafirun)", tipe: 'doa', isi: { arab: 'قُلْ يَأَيُّهَا الْكَفِرُوْنَ لَا أَعْبُدُ مَا تَعْبُدُوْنَ وَلَا أَنتُمْ عَبِدُوْنَ مَا أَعْبُدُ وَلَا أَنَا عَابِدٌ مَّا عَبَدْتُمْ وَلَا أَنْتُمْ عُبِدُوْنَ مَا أَعْبُدُ لَكُمْ دِينَكُمْ وَلِيَ دِينِ', latin: "QUL YAA AYYUHAL KAAFIRUUN, LAA A'BUDU MAA TA'BUDUUN, WALA ANTUM `AABIDUUNA MAA A'BUD, WALAA ANA 'AABIDUM MAA'ABADTTUM, WALA ANTUM 'AABIDUUNA MAA A'BUD, LAKUM DIINUKUM WALIYADIIN.", terjemahan: 'Artinya: Katakanlah: "Hai orang-orang kafir, Aku tidak akan menyembah apa yang kamu sembah. Dan kamu bukan penyembah Tuhan yang Aku sembah. Dan Aku tidak pernah menjadi penyembah apa yang kamu sembah, Dan kamu tidak pernah (pula) menjadi penyembah Tuhan yang Aku sembah. Untukmu agamamu, dan untukkulah, agamaku."' } },
    { id: 'd15.4', judul: "15.4 BACAAN SHALAT MAQAM IBRAHIM (Raka'at Kedua: Al-Ikhlas)", tipe: 'doa', isi: { arab: 'قُلْ هُوَ اللهُ أَحَدٌ اللهُ الصَّمَدُ لَمْ يَلِدْ وَلَمْ يُولَدْ وَلَمْ يَكُنْ لَّهُ كُفُوًا أَحَدٌ', latin: 'QUL HUWALLAAHU AHAD, ALLAHUSH- SHAMAD, LAM YALID WALAM YUULAD, WALAM YAKULLAHUU KUFUWAN AHAD.', terjemahan: 'Artinya: "Katakanlah: "Dia-lah Allah, yang Maha Esa. Allah adalah Tuhan yang bergantung kepada-Nya segala sesuatu. Dia tiada beranak dan tidak pula diperanakkan, Dan tidak ada seorangpun yang setara dengan Dia."' } },
    { id: 'd16', judul: '16. BACAAN AKAN MAKAN / MINUM', tipe: 'doa', isi: { arab: 'بِسْمِ اللهِ - اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا وَرِزْقًا وَاسِعًا وَشِفَاءَ مِنْ كُلُّ دَاءٍ', latin: "BISMILLAAH Atau BISMLLAAHIR- RAHMAANIRRAHIIM. ALLAHUMMA INNII AS-ALUKAILMAN NAAFI'AA WA RIZQAN WAASI'AA, WA SYIFAA-AN MIN KULLIDAA IN", terjemahan: 'Artinya: Dengan nama Allah. Ya Allah, aku memohon kepada-Mu agar diberi ilmu yang bermanfaat, rezeki yang luas, dan agar disembuhkan dari segala macam penyakit.' } },
    { id: 'd17', judul: '17. BACAAN SESUDAH MAKAN / MINUM', tipe: 'doa', isi: { arab: 'الْحَمْدُ لِلَّهِ الَّذِي كَفَا نَا وَأَرْوَانَا غَيْرَ مَكْفِي وَلَا مَكْفُوْرٍ', latin: 'ALHAMDU LILLAAHIL LADZII KAFAANAA WA ARWAANAA GHAIRA MAKFIYYIW WA LAA MAKFUUR', terjemahan: 'Artinya : Segala puji bagi Allah yang telah mencukupkan kami dan telah menghilangkan dahaga kami, (Allah) bukan Dzat yang dicukupi dan bukan yang diingkari nikmat-Nya. (H.R. Bukhari)' } },
    { id: 'd18', judul: '18. BACAAN KETIKA AKAN NAIK BUKIT SHAFA', tipe: 'doa', isi: { arab: 'إِنَّ الصَّفَا وَالْمَرْوَةَ مِنْ شَعَابِرِ اللَّهِ أَبْدَأَ بِمَا بَدَأَ اللَّهُ بِهِ', latin: "INNASH SHAFAA WAL MARWATA MIN SYA'AIRILLAH ABDA-U BIMAA BADA-ALLAHU BIH.", terjemahan: 'Artinya: Sesungguhnya Shafa dan Marwah adalah sebagian dari syiar-syiar Allah. Aku mulai dengan apa yang Allah telah memulainya.' } },
    { id: 'd19', judul: '19. DZIKIR DI ATAS BUKIT SHAFA / MARWAH', tipe: 'doa', isi: { arab: 'اللهُ أَكْبَرُ ، اللهُ أَكْبَرُ ، اللهُ أَكْبَرُ لا إِلَهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ لَا إِلَهَ إِلَّا اللهُ وَحْدَهُ أَنْجَزَ وَعْدَهُ وَنَصَرَ عَبْدَهُ وَهَزَمَ الْأَحْزَابَ وَحْدَهُ', latin: "ALLAAHU AKBAR 3X LAA ILAAHA ILLALLAHU WAHDAH, LAA SYARIIKA LAH, LAHUL MULKU WA LAHUL HAMDU WAHUWA 'ALAA KULLI SYAI-IN QADIIR, LAA ILAAHA ILLALLAAHU WAHDAH, ANJAZA WA'DAH, WANASHARA 'ABDAH WAHAZAMAL AHZAABA WAHDAH.", terjemahan: 'Artinya: Allah Mahabesar, Allah Mahabesar, Allah Mahabesar. (3x). Tiada sesembahan yang berhak disembah kecuali hanya Allah semata, tidak ada sekutu bagi-Nya. Milik- Nya lah segala kerajaan dan segala pujian untuk-Nya. Dia Mahakuasa atas segala sesuatu. Tiada sesembahan yang berhak disembah kecuali hanya Allah semata. Dialah yang telah melaksanakan janji- Nya, menolong hamba-Nya dan mengalahkan tentara sekutu dengan sendirian' } },
    { id: 'd20', judul: "20. DO'A DI SELA-SELA DZIKIR DI BUKIT SHAFA / MARWAH", tipe: 'doa', isi: { arab: 'اللَّهُمَّ اجْعَلْ حَجَّنَا حَجَّا مَبْرُوْرًا وَسَعْيًا مَشْكُورًا وَذَنْبًا مَغْفُوْرًا وَتِجَارَةً لَّنْ تَبُورَ يَا عَالِمَ مَا فِي الصُّدُورِ أَخْرِجْنَا مِنَ الظُّلُمَاتِ إِلَى النُّوْرِ', latin: "ALLAHUMMAJ'AL HAJJANAA HAJJAM MABRUURAA WA SA'YAM MASYKUURA. WA DZAMBAM MAGH FUURAA WA TIJAARATAN LAN TABUUR, YAA 'AALIMA MAA FISH SHUDUUR AKHRIJNAA MIΝΑΖΗ ZHULUMAATI ILAN NUUR.", terjemahan: 'Artinya: Ya Allah, jadikanlah haji kami haji yang mabrur, perjalanan yang berpahala, dosa yang terampuni dan dagangan yang tidak merugi. Wahai Dzat yang mengetahui apapun yang berada di dalam hati, keluarkanlah kami ya Allah dari kegelapan/kesesatan menuju yang terang/benar.' } },
    { id: 'd21', judul: '21. CONTOH DZIKIR KETIKA SAI', tipe: 'doa', isi: { arab: 'لَا إِلَهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ', latin: "LAA ILAAHA ILLALLAAHU WAHDAH, LAA SYARIIKALAH, LAHUL MULKU WALAHUL HAMDU WAHUWA 'ALAA KULLI SYAIΊΝ QADIIR", terjemahan: 'Artinya: Tiada Tuhan melainkan Allah semata, tiada sekutu bagi-Nya, hanya bagi-Nya kerajaan dan segala puji, dan Dia Maha Kuasa atas segala sesuatu.' } },
    { id: 'd22', judul: "22. DO'A DIANTARA PAL HIJAU", tipe: 'doa', isi: { arab: 'رَبِّ اغْفِرْ وَارْحَمْ إِنَّكَ أَنْتَ الْأَعَزُّ الْأَكْرَمْ', latin: "RABBIGHFIR WARHAM INNAKA ANTAL A'AZZUL AKRAM", terjemahan: 'Artinya : Ya Allah berilah ampunan dan rahmat. Sungguh Engkau Maha Perkasa lagi Maha Mulia' } },
    { id: 'd23', judul: '23. BACAAN MEMULAI HAJI & TALBIYAH', tipe: 'doa', isi: { arab: 'لَبَّيْكَ حَبًّا لَبَّيْكَ اللهُمَّ لَبَّيْكَ لَبَّيْكَ لَأَشَرِيكَ لَكَ لَبَّيْكَ إِنَّ الْحَمْدَ وَالنِّعْمَةَ لَكَ وَالْمُلْكُ لَأَشَرِيكَ لَكَ', latin: 'LABBAIKA НАЈЈАА. "LABBAIK, ALLAA HUMMA LABBAIK, LABBAIKA LAA SYARIIKA LAKA LABBAAΙΚ, INNAL HAMDA WANNI\'MATA LAAKA WAL MULKA, LAA SYARIIKA LAK"', terjemahan: 'Artinya: Aku sambut panggilan-Mu ya Allah untuk Haji.' } },
    { id: 'd24', judul: '24. CONTOH DZIKIR KETIKA WUKUF', tipe: 'doa', isi: { arab: 'لَا إِلَهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ', latin: "LAA ILAAНА ILLALLAAHU WAHDAH, LAA SYARIIKALAH, LAHUL MULKU WALAHUL HAMDU WAHUWA 'ALAA KULLI SYAIΊΝ QADIIR.", terjemahan: 'Artinya: Tiada Tuhan melainkan Allah semata, tiada sekutu bagi-Nya hanya bagi-Nya kerajaan dan segala puji, dan Dia Maha Kuasa atas segala sesuatu.' } },
    { id: 'd25', judul: '25. DOA MELONTAR JAMRAH', tipe: 'doa', isi: { arab: 'اللهُ أَكْبَرُ اللَّهُمَّ اجْعَلْهُ حَبًّا مَبْرُوْرًا وَذَنْبًا مَغْفُوْرًا', latin: "ALLAAHU AKBAR ALLAHUMMAJ'ALHU HAJJAM MABRUURAA WA DZAMBAM MAGH FUURAA", terjemahan: 'Artinya: Ya Allah, jadikanlah haji kami haji yang mabrur, perjalanan yang berpahala, dosa yang terampuni' } },
    { id: 'd26', judul: "26. CONTOH DO'A KETIKA PULANG & TAMBAHAN", tipe: 'doa', isi: { arab: 'اَللَّهُمَّ اجْعَلْ حَجَّنَا حَجَّامَبْرُوْرًا وَسَعْيًا مَشْكُورًا وَذَنْبًا مَغْفُوْرًا وَتِجَارَةً لَنْ تَبُورَ يَا عَالِمَ مَا فِي الصُّدُورِ أَخْرِجْنَا مِنَ الظُّلُمَاتِ إِلَى النُّوْرِ اللَّهُمَّ ارْزُقْنَا وَهَوِنْ عَلَيْنَا وَالْحَاضِرِينَ فِي هَذَا الْمَجْلِسِ زِيَارَةَ مَكَّةَ الْمُكَرَّمَةِ وَالْمَدِينَةِ الْمُنَوَّرَةِ لِأَدَاءِ الْحَجِّ وَالْعُمْرَةِ مَرَّةً بَعْدَ مَرَّةٍ كَرَّةً بَعْدَ كَرَّةٍ بِعَوْنِكَ وَفَضْلِكَ وَرِضَاكَ إِنَّكَ عَلَى كُلِّ شَيْءٍ قَدِيرٍ', latin: "ALLAHUMMAJ'AL HAJJANAA HAJJAM MABRUURAA WA SA'YAM MASYKUURA. WA DZAMBAM MAGH FUURAA WA TIJAARATAN LAN TABUUR, YAA 'AALIMA MAA FISH SHUDUUR AKHRIJNAA MINAZH ZHULUMAATI ILAN NUUR. ALLAHUMMARZUQNAA WA HAWWIN'ALAINAA WALHAADIRIINA FII HAADZAL MAJLIS, ZIYAARAТАМАККАТAL MUKARRAМАН, WAL MADIINATIL MUNAWWARAH, LI ADAA-IL HAJJI WAL'UMRAH, MARRATAM BA'DA MARRAH, KARRATAM BA'DA KARRAH, BI'AUNIKA WA FADHLIKA WA RIDHAAKA INNAKA 'ALAA KULLI SYAI IN QADIIR.", terjemahan: 'Artinya: Ya Allah, jadikanlah haji kami haji yang mabrur, perjalanan yang berpahala, dosa yang terampuni dan dagangan yang tidak merugi. Wahai Dzat yang mengetahui apapun yang berada di dalam hati, keluarkanlah kami ya Allah dari kegelapan/kesesatan menuju yang terang/benar. Ya Allah berilah kami kemampuan dan mudahkanlah kami dan semua yang hadir di majlis ini berziarah ke Makkah al-Mukarramah dan Madinah al- Munawwarah untuk menunaikan ibadah haji dan umrah berulang kali dengan pertolongan-Mu, anugerah-Mu, dan ridha-Mu.' } },
    { id: 'v1', judul: 'Materi Manasik Video 1', link: 'https://www.youtube.com/watch?v=KCtpmbxLTus', tipe: 'video' },
    { id: 'v2', judul: 'Materi Manasik Video 2', link: 'https://www.youtube.com/watch?v=MP9-mVI5Zuc', tipe: 'video' },
    { id: 'v3', judul: 'Materi Manasik Video 3', link: 'https://www.youtube.com/watch?v=lUl1WTxSu1k', tipe: 'video' },
    { id: 'v4', judul: 'Materi Manasik Video 4', link: 'https://www.youtube.com/watch?v=0cBVaAaby6E', tipe: 'video' },
    { id: 'v5', judul: 'Materi Manasik Video 5', link: 'https://www.youtube.com/watch?v=eL9GwCFPRCU', tipe: 'video' },
    { id: 'v6', judul: 'Materi Manasik Video 6', link: 'https://www.youtube.com/watch?v=V79Lmfw_Q8c', tipe: 'video' },
    { id: 'v7', judul: 'Materi Manasik Video 7', link: 'https://www.youtube.com/watch?v=bGKLYDijNFg', tipe: 'video' },
    { id: '3', judul: 'Materi Manasik (Google Drive)', link: 'https://drive.google.com/drive/folders/1EOrDF6Dq9ItaJCl20BvTVtmCxugMycgV', tipe: 'download' },
    { 
      id: 't1', 
      judul: '1. Proses Perjalanan Ibadah Haji - Dirumah', 
      tipe: 'teks', 
      isi: { 
        konten: 'a. Niat Ikhlas (karena Allah semata), untuk melaksanakan Ibadah Haji dengan sebaik-baiknya.\nb. Berlatih sabar dalam segala urusan/tindakan.\nc. Mulai memperbaiki/menertibkan ibadah harian, khususnya Shalat, dan memperbaiki perilaku sehari-hari.\nd. Memperdalam pengetahuan tentang manasik haji dengan sungguh- sungguh, sehingga pelaksanaan hajinya benar (mabrur).\ne. Klarifikasi/berwasiat, tentang berbagai hal, khususnya soal utang piutang.\nf. Memperbaiki sillaturrokhiim/hubungan sesama manusia (tolong- menolong).\ng. Menjaga kondisi kesehatan, dengan melaksanakan olahraga yang sesuai.' 
      } 
    },
    { 
      id: 't2', 
      judul: '2. Proses Perjalanan Ibadah Haji - Berangkat', 
      tipe: 'teks', 
      isi: { 
        konten: 'Menjelang Berangkat\nMempersiapkan dan mencatat berbagai bekal yang dibawa/ secukupnya.\nDua hari sebelum keberangkatan, koper besar dikirim ke Kemenag. cantumkan identitas rombongan pada tiap koper.\nSurat-surat penting dan obat-obatan khusus dimasukkan ke tas paspor, untuk mempermudah setiap diperlukan\nPasrah, berpamitan, mohon maaf dan doa restu kepada orang tua. Sesepuh, sanak saudara dan handaitaulan, serta kerabat.\nBuku-buku yang diperlukan (Doa Dzikir. dll)\n\nBerangkat\nDengan berdoa dan bertawakal kepada Allah didahului Shalat Sunnat Safar. (doa keluar rumah)\nBerkumpul di tempat yang sudah ditentukan (GOR/ Gedung GBK). Jangan sampai terlambat, paling tidak 1 jam sebelum berangkat, sudah berada di tempat yang ditentukan.\nSambil menanti waktu keberangkatan ke Embarkasi Donohudan, bersalam-salaman dengan para penghantar.\nPelepasan dari Bupati Klaten, kemudian berangkat (dengan berdo\'a). menuju Donohudan.' 
      } 
    }
  ],
  sosmed: {
    ig: 'arafahklaten',
    tiktok: 'arafahklaten',
    yt: 'arafahklaten'
  },
  kontak: {
    wa1: '6285225881780',
    wa2: '6285225881780',
    alamat: 'Dadimulyo, Gergunung, Klaten Utara, Klaten, jawa Tengah',
    peta: 'https://maps.app.goo.gl/iY1dhxG4RfydVYnC8'
  },
  pengumuman: 'Kepada seluruh Jemaah Arafah untuk mulai mempersiapkan perbekalan dan dimasukkan dalam tas koper masing-masing.',
  perlengkapan: [
    { item: 'Buku Panduan', selesai: true },
    { item: 'Seragam Batik', selesai: false },
    { item: 'Tas Paspor', selesai: true }
  ],
  ceklistTemplates: {
    pria: `Tas Koper Besar Pria
1 atau 1,5 stel kain Ihrom.
Pakaian Harian: 2-3 Celana panjang (komprang) bahan kaos/katun, 2-3 Baju koko, kaos panjang, atau rompi, 1-2 Sarung.
Kaos kaki, jaket, dan pakaian dalam secukupnya.
Sandal jepit (cadangan).
Keperluan Logistik & Tidur
Perlengkapan Tidur: Alas tidur untuk di Muzdalifah dan bantal tiup.
Alat Makan: Piring, cangkir (besar & kecil), sendok, pisau, tisu basah & kering.
Bahan Makanan: Lauk kering, mie instan, kopi, jahe, serta suplemen/minuman penyegar (Adem Sari, CDR, dll).
Kebersihan: Perlengkapan mandi (sabun, pasta gigi, sampo), masker, gayung, dan ember.
Perlengkapan Tambahan & Kesehatan
Alat Pendukung: Payung, topi, tas sandal, tempat air (Aqua), tempat kerikil, gantungan baju (hanger), peniti, gunting, dan alat cukur.
Elektronik & Keamanan: Stop kontak, serta rantai/gembok (khusus pengguna kursi roda).
Obat-obatan: Obat batuk, flu, alergi, diare, krim pelembap, bedak gatal, obat gosok, dan Salonpas.
Ibadah
Al-Qur'an, buku manasik, dan daftar doa-doa titipan.
Tas Tentengan Pria
1 stel Baju Ihram dan Sabuk
1 stel Baju Ganti
Pakaian dalam untuk di Embarkasi
1 Tas Kecil Perlengkapan Mandi (Sabun, Shampo, Odol yang kecil) sikat gigi, Kanebo/Handuk
Sandal Jepit
Rompi Arafah
Sajadah Arafah
Sarung`,
    wanita: `Tas Koper Besar Wanita
Pakaian & Alas Kaki
Pakaian Ihram: 2 atau 3 stel.
Pakaian Harian Muslimah: 2/3 stel.
Daster: 2/3 buah (bahan menyerap keringat).
Bergo/Kerudung & Mukena: 2/3 buah.
Kaus Kaki & Pakaian Dalam: Secukupnya.
Sandal Jepit: Sebagai cadangan.
Perlengkapan Tidur & Lapangan
Alas tidur untuk di Muzdalifah & bantal tiup.
Masker (5 buah).
Tempat botol minum (Aqua) & tempat kerikil.
Topi, payung, tas sandal.
Ember & gayung.
Perlengkapan Mandi & Kebersihan
Sabun, pasta gigi, sampo (ukuran besar).
Tisu kering dan basah.
Keperluan Makan & Logistik
Peralatan: Piring, cangkir (besar & kecil), sendok, pisau.
Bahan Makanan: Lauk pauk kering, mie instan, kopi.
Minuman Kesehatan: Jahe vegeta, Adem Sari, CDR, dll.
Perlengkapan Tambahan
Tampar (tali), hanger, jepitan baju, peniti, gunting.
Stop kontak.
Rantai dan gembok (khusus bagi yang membawa kursi roda).
Kesehatan & Ibadah
Obat Pribadi: Obat batuk, flu, alergi, diare, dll.
Perawatan Kulit: Cream pelembab, bedak gatal, obat gosok, Salonpas.
Buku: Al-Qur'an, buku manasik, dan daftar doa titipan.
Tas Tenteng Wanita
1 stel Baju Ihram, Kerudung, Deker tangan
1 stel Baju Ganti, jaket tebal
Pakaian dalam untuk di Embarkasi
1 Tas Kecil Perlengkapan Mandi (Sabun, Shampo, Odol yang kecil) sikat gigi, Kanebo/Handuk
Sandal Jepit
Rompi Arafah
Sajadah Arafah
Alat Sholat`,
    tambahan: `Tas Paspor
Berkas Kesehatan, Paspor, Bukti Setor Warna Putih Pas Foto 3 x 4 = 2 lembar (muka 80%)
Kapas, tisu, tusuk gigi, catton bud, uang real
Gelang, id card
Kaos tangan, masker, spryer
Kacamata hitam bertali, gembok, tasbih tawaf
Buku Do'a, lembar do'a pulang haji, sepidol besar permanen (hitam/Biru dan putih)
Obat-obatan yang harus siap di minum, salon pas dll
Identitas Nama Semua Perbekalan
Berangkat memakai Batik Haji Nasional dan bawahan putih 
Batik Haji Nasional, Rompi Arafah diberi identitas Nama dan Bendera Merah Putih
Sajadah Arafah beri identitas Nama untuk menghindari tertukar dengan jamaah lain.`
  },
  pembayaran: [
    { jenis: 'Pendaftaran Arafah', total: 3000000, dibayar: 200000 },
    { jenis: 'DAM, Tarwiyah, Ziarah, Dll', total: 5875000, dibayar: 5875000 }
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
      console.error("Firebase Auth Error:", e.code, e.message);
      // Throw error if auth is critical for the operation
      throw new Error(`Koneksi Firebase Gagal (${e.code}). Pastikan 'Anonymous Auth' aktif dan domain sudah di-whitelist.`);
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
              nama: 8, // I
              porsi: 5, // F
              kloter: 1, // B
              romb: 2, // C
              asrama: 3, // D
              karom: 4, // E
              waKarom: 28, // AC
              bayarArafah: 29, // AD
              bayarLainnya: 30, // AE
              waPetugas: 29, // Keeping for legacy if needed, but it's redundant now
              umur: 9, // J
              jk: 10, // K
              alamat: 11, // L
              desa: 12, // M
              kec: 13, // N
              kab: 14, // O
              wa: 15, // P
              tanazul: 16, // Q
              murur: 17, // R
              nafar: 18, // S
              dam: 19, // T
              gel: 20, // U
              badal: 21, // V
              roda: 22, // W
              tongkat: 23, // X
              penTubuh: 24, // Y (Requirement said V but V is Badal, logically Y is Pen Tubuh)
              ringJantung: 25, // Z
              pendamping: 26, // AA
              waPendamping: 27, // AB
              hotel: 31, // AF
              peta: 32, // AG
              hotelMadinah: 33, // AH
              petaMadinah: 34, // AI
              tendaMina: 35, // AJ
              busShalawat: 36, // AK
              paspor: 6, // G
              visa: 7 // H
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
                  bayarArafah: g(idx.bayarArafah),
                  bayarLainnya: g(idx.bayarLainnya),
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
                  hotelMadinah: g(idx.hotelMadinah),
                  linkPetaHotelMadinah: g(idx.petaMadinah),
                  tendaMina: g(idx.tendaMina),
                  busShalawat: g(idx.busShalawat),
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
  if (isQuotaExceeded) {
    console.warn("Firestore: Write skipped (Quota Exceeded)");
    saveStorage(KEY_JEMAAH, jemaah);
    return;
  }
  try {
    await ensureAuth();
    await setDoc(doc(db, 'settings', 'jemaah_data'), {
      jemaah,
      updatedAt: serverTimestamp()
    }).catch(e => {
      if (e?.code === 'resource-exhausted') isQuotaExceeded = true;
      handleFirestoreError(e, 'write', 'settings/jemaah_data');
    });
    saveStorage(KEY_JEMAAH, jemaah);
  } catch (e) {
    console.error("Error saving jemaah to Firebase:", e);
    saveStorage(KEY_JEMAAH, jemaah);
  }
}

// Smart merging of any admin content data with defaults to prevent UI gaps
function mergeWithDefaults(incoming: Partial<AdminContent> | null): AdminContent {
  if (!incoming) return defaultAdminContent;
  
  // 1. Merge basic fields
  const base: AdminContent = {
    ...defaultAdminContent,
    ...incoming,
    sosmed: { ...defaultAdminContent.sosmed, ...(incoming.sosmed || {}) },
    kontak: { ...defaultAdminContent.kontak, ...(incoming.kontak || {}) },
  };

  // 2. Ensure Arrays are not empty if defaults have data
  const ensureArray = (field: keyof AdminContent) => {
    const list = incoming[field];
    if (Array.isArray(list) && list.length > 0) {
      (base as any)[field] = list;
    } else {
      (base as any)[field] = (defaultAdminContent as any)[field];
    }
  };

  ['agenda', 'galeri', 'pembayaran', 'perlengkapan', 'materi'].forEach((f) => ensureArray(f as any));

  // 3. Special handling for Materi: Merge by ID to allow cloud overrides while keeping static defaults
  const cloudMateri = Array.isArray(incoming.materi) ? incoming.materi : [];
  const cloudIds = new Set(cloudMateri.filter(m => m && m.id).map(m => m.id));
  
  const mergedMateri = [...cloudMateri];
  
  // Add missing defaults (keeps the 26 items even if some were deleted or not yet synced)
  defaultAdminContent.materi.forEach(defItem => {
    if (!cloudIds.has(defItem.id)) {
      mergedMateri.push(defItem);
    }
  });

  // Sort: Doas (d), then Articles (t), then others
  base.materi = mergedMateri.sort((a, b) => {
    const getPriority = (id: string) => {
      if (id.startsWith('d')) return 1;
      if (id.startsWith('t')) return 2;
      return 3;
    };
    const pA = getPriority(a.id || '');
    const pB = getPriority(b.id || '');
    if (pA !== pB) return pA - pB;
    return (a.id || '').localeCompare(b.id || '', undefined, { numeric: true, sensitivity: 'base' });
  });

  return base;
}

export async function getAdminContent(forceSync = false): Promise<AdminContent> {
  const now = Date.now();
  if (!forceSync && cachedAdminContent && (now - lastContentFetchTime < CACHE_TTL)) {
    return cachedAdminContent;
  }

  try {
    await ensureAuth();
    
    const possiblePaths = successfulContentPath ? [successfulContentPath] : [
      { db: db, path: ['settings', 'admin_content'], label: 'DB-Config: settings/admin_content' },
      { db: dbDefault, path: ['settings', 'admin_content'], label: 'DB-Default: settings/admin_content' },
      { db: db, path: ['settings', 'admin-content'], label: 'DB-Config: settings/admin-content' },
      { db: db, path: ['admin_content'], label: 'DB-Config: root/admin_content' },
    ];

    let recoveredData: Partial<AdminContent> | null = null;

    console.log("--- Starting Admin Content Recovery ---");
    for (const p of possiblePaths) {
      try {
        let snap;
        if (p.path.length === 2) {
          snap = await getDoc(doc(p.db, p.path[0], p.path[1])).catch(() => null);
        } else {
          const colSnap = await getDocs(collection(p.db, p.path[0])).catch(() => null);
          if (colSnap && !colSnap.empty) {
            recoveredData = colSnap.docs[0].data() as any;
            break;
          }
          continue;
        }

        if (snap && snap.exists()) {
          recoveredData = snap.data() as any;
          successfulContentPath = p;
          saveStorage('successful_content_path', p);
          break;
        }
      } catch (e) {
        console.warn(`Probing ${p.label} failed:`, e);
      }
    }

    if (recoveredData) {
      const final = mergeWithDefaults(recoveredData);
      cachedAdminContent = final;
      lastContentFetchTime = now;
      saveStorage(KEY_CONTENT, final);
      return final;
    }

    console.log("No Firestore data found. Trying Spreadsheet fallback...");

    const response = await fetch(`${SPREADSHEET_CONTENT_URL}&t=${Date.now()}`).catch(() => null);
    
    if (response && response.ok) {
      const text = await response.text();
      return new Promise((resolve) => {
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const rows = results.data as any[];
            if (rows.length === 0) {
              resolve(mergeWithDefaults(getStorage<any>(KEY_CONTENT, null)));
              return;
            }
            
            const spreadsheetData: Partial<AdminContent> = {
              profil: '', galeri: [], agenda: [], materi: [],
              sosmed: { ig: '', tiktok: '', yt: '' },
              kontak: { wa1: '', wa2: '', alamat: '', peta: '' },
              pengumuman: '', perlengkapan: [], pembayaran: []
            };

            rows.forEach(row => {
              const getV = (keys: string[]) => {
                for (const k of keys) {
                  if (row[k] || row[k.toUpperCase()]) return String(row[k] || row[k.toUpperCase()]).trim();
                }
                return '';
              };
              const type = getV(['TIPE', 'KEY', 'KATEGORI', 'JENIS']).toUpperCase();
              
              if (type === 'PROFIL' && !spreadsheetData.profil) spreadsheetData.profil = getV(['ISI', 'VALUE', 'KONTEN']);
              if (type === 'SOSMED') {
                spreadsheetData.sosmed!.ig = getV(['IG', 'INSTAGRAM']) || spreadsheetData.sosmed!.ig;
                spreadsheetData.sosmed!.tiktok = getV(['TIKTOK']) || spreadsheetData.sosmed!.tiktok;
                spreadsheetData.sosmed!.yt = getV(['YT', 'YOUTUBE']) || spreadsheetData.sosmed!.yt;
              }
              // ... keep other spreadsheet mapping logic if needed but we'll apply mergeWithDefaults at the end
              if (type === 'MATERI' || type === 'DOA' || type === 'TEKS') {
                spreadsheetData.materi!.push({
                  id: 'ss-' + Math.random().toString(36).substr(2, 5),
                  judul: getV(['JUDUL', 'NAMA']),
                  tipe: type.toLowerCase() as any,
                  isi: { konten: getV(['ISI', 'KONTEN']), arab: getV(['ARAB']) }
                } as any);
              }
            });

            const final = mergeWithDefaults(spreadsheetData);
            cachedAdminContent = final;
            lastContentFetchTime = now;
            saveStorage(KEY_CONTENT, final);
            resolve(final);
          },
          error: () => resolve(mergeWithDefaults(getStorage<any>(KEY_CONTENT, null)))
        });
      });
    }

    return mergeWithDefaults(getStorage<any>(KEY_CONTENT, null));
  } catch (error) {
    console.error('getAdminContent overall failure:', error);
    return mergeWithDefaults(getStorage<any>(KEY_CONTENT, null));
  }
}

// Global state for quota tracking
let isQuotaExceeded = false;

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
  if (isQuotaExceeded) {
    console.warn("Firestore: Write skipped (Quota Exceeded)");
    saveStorage(KEY_CONTENT, content);
    return;
  }
  try {
    // 1. Ensure Auth (Throws if fails)
    await ensureAuth();
    
    // 2. Clean data for Firestore (remove undefineds)
    const sanitized = sanitizePayload(content);
    
    console.log("Firebase Save: Attempting to write to settings/admin_content (Primary Path)...");
    const targetDoc = doc(db, 'settings', 'admin_content');
    
    // 3. Perform Write
    await setDoc(targetDoc, {
      ...sanitized,
      updatedAt: serverTimestamp()
    });
    
    console.log("Firebase Save: Success. Updating local cache.");
    
    // Update path cache to the one we just saved to
    successfulContentPath = { db: db, path: ['settings', 'admin_content'], label: 'DB-Config: settings/admin_content' };
    saveStorage('successful_content_path', successfulContentPath);
    
    saveStorage(KEY_CONTENT, content);
    cachedAdminContent = content;
    lastContentFetchTime = Date.now();
  } catch (e: any) {
    console.error("Error saving admin content to Firebase:", e);
    // Persist locally as fallback
    saveStorage(KEY_CONTENT, content);
    
    if (e?.code === 'resource-exhausted') {
      isQuotaExceeded = true;
      throw new Error("Kuota harian cloud habis. Perubahan disimpan di aplikasi ini hari ini.");
    }
    
    if (e?.code === 'permission-denied') {
      throw new Error("Akses Cloud ditolak. Pastikan Firebase Security Rules sudah di-deploy.");
    }

    throw e; // Relaunch specialized error or generic
  }
}

export async function testWriteCloud() {
  try {
    await ensureAuth();
    console.log("Firebase Diagnostic: Testing simple write to 'test/write'...");
    await setDoc(doc(db, 'test', 'write'), {
      test: true,
      at: serverTimestamp()
    });
    console.log("Firebase Diagnostic: Write SUCCESS.");
    return true;
  } catch (e) {
    console.error("Firebase Diagnostic: Write FAILED:", e);
    throw e;
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
  if (isQuotaExceeded) {
    console.warn("Firestore: Write skipped (Quota Exceeded)");
    saveStorage(KEY_USERS, users);
    return;
  }
  try {
    await ensureAuth();
    await setDoc(doc(db, 'settings', 'admin_users'), {
      users,
      updatedAt: serverTimestamp()
    }).catch(e => {
      if (e?.code === 'resource-exhausted') isQuotaExceeded = true;
      handleFirestoreError(e, 'write', 'settings/admin_users');
    });
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

  console.log(`Login Debug: Attempting login for [${uName}]. Jemaah master count: ${jemaahList?.length || 0}`);

  const admin = admins.find(u => u.username === uName && (u.password === pwOrPorsi || u.porsi === pwOrPorsi));
  
  if (admin) {
    console.log("Login Debug: Logged in as Admin/Petugas.");
    return admin;
  }
  
  // LOGGING (Internal)
  if (!jemaahList || jemaahList.length === 0) {
    console.error("Login Debug: No jemaah loaded from master source.");
  }

  // Helper for flexible matching (removes non-digits)
  const toDigits = (val: string) => val ? String(val).replace(/\D/g, '') : '';
  const uDigits = toDigits(uName);
  const pDigits = toDigits(pwOrPorsi);

  const jemaah = jemaahList.find(j => {
    const dbPorsi = cleanInput(j.nomorPorsi);
    const dbPorsiDigits = toDigits(dbPorsi);
    const dbName = (j.namaLengkap || '').toLowerCase().trim();
    
    // 1. Exact Porsi match
    if (dbPorsi && (dbPorsi === pwOrPorsi || dbPorsi === uName)) return true;
    
    // 2. Digits-only match (if long enough, e.g. 10 digits porsi)
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
