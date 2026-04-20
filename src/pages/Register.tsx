import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function Register() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nomorPorsi: '',
    namaLengkap: '',
    alamat: '',
    ttl: '',
    jk: 'Laki-laki',
    statusNikah: 'Belum Nikah',
    namaIbu: '',
    usia: '',
    wa: '',
    kesehatan: {
      'Pen Tubuh': false,
      'Ring Jantung': false,
      'Kursi Roda': false,
    } as Record<string, boolean>,
    photos: {
      'KTP': '',
      'SPPH': '',
      'KK': '',
      'FOTO': ''
    } as Record<string, string>
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max dimension to stay under Firestore limits roughly
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
          
          // Quality 0.6 to keep size small
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          setFormData(prev => ({
            ...prev,
            photos: { ...prev.photos, [key]: dataUrl }
          }));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleKesehatanChange = (key: string) => {
    setFormData(prev => ({
      ...prev,
      kesehatan: { ...prev.kesehatan, [key]: !prev.kesehatan[key] }
    }));
  };

  const handleFinalize = async () => {
    if (!formData.nomorPorsi || !formData.namaLengkap || !formData.wa || !formData.usia || !formData.namaIbu) {
      setError('Mohon lengkapi data wajib (Porsi, Nama, WhatsApp, Usia, Nama Ibu)');
      setStep(1);
      return;
    }

    setLoading(true);
    setError('');
    try {
      await addDoc(collection(db, 'registrations'), {
        ...formData,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      console.error("Error saving registration:", err);
      setError('Gagal mengirim pendaftaran. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => setStep(prev => prev + 1);
  const handlePrev = () => setStep(prev => prev - 1);

  return (
    <div className="bg-white flex flex-col">
      <div className="p-4 flex items-center justify-between border-b border-neutral-100 bg-white shadow-sm">
        <button onClick={() => step === 1 ? navigate('/') : handlePrev()} className="p-2 -ml-2 text-neutral-400 hover:text-primary transition-colors flex items-center gap-1 font-bold text-sm">
          <ArrowLeft className="w-5 h-5" /> Kembali
        </button>
        <h2 className="text-[11px] font-black text-primary uppercase tracking-[0.2em]">Registrasi</h2>
        <div className="w-12"></div>
      </div>

      <div className="flex-1 px-8 py-8 pb-32">
        <div className="mb-10 flex items-center gap-3">
          {[1, 2, 3].map((s) => (
            <div key={s} className={cn(
              "h-1.5 flex-1 rounded-full transition-all",
              s <= step ? "bg-primary shadow shadow-emerald-100" : "bg-neutral-100"
            )} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-8">
            <div className="space-y-1">
              <h3 className="text-xl font-black text-primary tracking-tight">Identitas Utama</h3>
              <p className="text-[13px] text-neutral-400 font-medium">Lengkapi data sesuai KTP & Dokumen Porsi.</p>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-primary uppercase tracking-widest ml-1">Nomor Porsi *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Wajib 10 digit" 
                  value={formData.nomorPorsi}
                  onChange={(e) => setFormData({...formData, nomorPorsi: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-primary uppercase tracking-widest ml-1">Nama Lengkap *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Sesuai KTP" 
                  value={formData.namaLengkap}
                  onChange={(e) => setFormData({...formData, namaLengkap: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-primary uppercase tracking-widest ml-1">Alamat Domisili *</label>
                <textarea 
                  className="form-input min-h-[80px]" 
                  placeholder="Alamat lengkap..."
                  value={formData.alamat}
                  onChange={(e) => setFormData({...formData, alamat: e.target.value})}
                ></textarea>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-primary uppercase tracking-widest ml-1">Nama Ibu Kandung *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Nama Ibu" 
                    value={formData.namaIbu}
                    onChange={(e) => setFormData({...formData, namaIbu: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-primary uppercase tracking-widest ml-1">Usia *</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="Tahun" 
                    value={formData.usia}
                    onChange={(e) => setFormData({...formData, usia: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-primary uppercase tracking-widest ml-1">Gender</label>
                  <select 
                    className="form-input"
                    value={formData.jk}
                    onChange={(e) => setFormData({...formData, jk: e.target.value})}
                  >
                    <option>Laki-laki</option>
                    <option>Perempuan</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-primary uppercase tracking-widest ml-1">Status</label>
                  <select 
                    className="form-input"
                    value={formData.statusNikah}
                    onChange={(e) => setFormData({...formData, statusNikah: e.target.value})}
                  >
                    <option>Belum Nikah</option>
                    <option>Nikah</option>
                  </select>
                </div>
              </div>
            </div>
            <button onClick={handleNext} className="btn-primary w-full shadow-lg shadow-emerald-100 uppercase tracking-widest text-[12px]">Lanjutkan</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8">
            <div className="space-y-1">
              <h3 className="text-xl font-black text-primary tracking-tight">Kontak & Kesehatan</h3>
              <p className="text-[13px] text-neutral-400 font-medium">Informasi darurat dan kebutuhan khusus.</p>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-primary uppercase tracking-widest ml-1">Nomor WhatsApp *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="08..." 
                  value={formData.wa}
                  onChange={(e) => setFormData({...formData, wa: e.target.value})}
                />
              </div>
              
              <div className="space-y-3">
                <label className="text-[11px] font-black text-primary uppercase tracking-widest ml-1">Kondisi Khusus</label>
                {['Pen Tubuh', 'Ring Jantung', 'Kursi Roda'].map((item) => (
                  <div key={item} className="flex items-center justify-between bg-white p-4 rounded-xl border border-neutral-100 shadow-sm">
                    <span className="text-[13px] font-bold text-neutral-700">{item}</span>
                    <button 
                      onClick={() => handleKesehatanChange(item)}
                      className={cn(
                        "w-12 h-6 rounded-full relative transition-all border",
                        formData.kesehatan[item as keyof typeof formData.kesehatan] ? "bg-primary border-primary" : "bg-neutral-100 border-neutral-200"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm",
                        formData.kesehatan[item as keyof typeof formData.kesehatan] ? "right-1" : "left-1"
                      )} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={handleNext} className="btn-primary w-full shadow-lg shadow-emerald-100 uppercase tracking-widest text-[12px]">Lanjutkan</button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8">
            <div className="space-y-1">
              <h3 className="text-xl font-black text-primary tracking-tight">Dokumen Pendukung</h3>
              <p className="text-[13px] text-neutral-400 font-medium">Lampirkan scan dokumen format gambar/PDF.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {['KTP', 'SPPH', 'KK', 'FOTO'].map((doc) => (
                <div key={doc} className="relative group">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={(e) => handleFileChange(e, doc)}
                  />
                  <div className={cn(
                    "bg-card border rounded-3xl p-5 flex flex-col items-center justify-center gap-3 aspect-square transition-all shadow-sm",
                    formData.photos[doc] 
                      ? "border-primary bg-emerald-50/50" 
                      : "border-neutral-100 group-hover:border-primary active:scale-95"
                  )}>
                    {formData.photos[doc] ? (
                      <div className="bg-primary p-4 rounded-2xl text-white shadow-lg animate-in zoom-in-50">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                    ) : (
                      <div className="bg-white p-4 rounded-2xl text-primary shadow-sm border border-neutral-50 group-hover:bg-primary group-hover:text-white transition-all">
                        <Upload className="w-6 h-6" />
                      </div>
                    )}
                    <span className={cn(
                      "text-[11px] font-black uppercase tracking-tighter",
                      formData.photos[doc] ? "text-primary" : "text-neutral-600"
                    )}>
                      {doc} {formData.photos[doc] && '✔'}
                    </span>
                    {formData.photos[doc] && (
                      <p className="text-[8px] font-bold text-primary/60 uppercase">Berhasil Terunggah</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-[11px] font-bold text-center">
                {error}
              </div>
            )}
            {success ? (
              <div className="p-8 bg-emerald-50 border border-emerald-100 rounded-[32px] text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-200">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-emerald-900 leading-tight">Pendaftaran Berhasil!</h4>
                  <p className="text-[12px] text-emerald-700 font-medium">Data Anda telah dikirim dan sedang diproses oleh admin.</p>
                </div>
              </div>
            ) : (
              <button 
                onClick={handleFinalize} 
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-3 shadow-xl shadow-emerald-100 uppercase tracking-widest text-[12px] disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5 text-secondary" />}
                {loading ? 'Mengirim...' : 'Finalisasi Data'}
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        .form-input {
          width: 100%;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 14px 18px;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          outline: none;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
        }
        .form-input:focus {
          border-color: #1b5e20;
          background: white;
          box-shadow: 0 0 0 4px rgba(27, 94, 32, 0.08);
        }
        .btn-primary {
          background: #1b5e20;
          color: white;
          border-radius: 12px;
          padding: 18px;
          font-weight: 800;
          font-size: 13px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .btn-primary:hover {
          background: #2e7d32;
        }
      `}</style>
    </div>
  );
}
