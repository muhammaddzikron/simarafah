import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, RefreshCw, AlertCircle, QrCode } from 'lucide-react';

export default function QrScanner({ onScan, onClose }: { onScan: (data: string) => void, onClose: () => void }) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qrRef = useRef<Html5Qrcode | null>(null);
  const scannerId = "qr-reader-container";

  useEffect(() => {
    const startScanner = async () => {
      try {
        qrRef.current = new Html5Qrcode(scannerId);
        
        // Prefer back camera on mobile (facingMode: environment)
        await qrRef.current.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const minDim = Math.min(viewfinderWidth, viewfinderHeight);
              const qrboxSize = Math.floor(minDim * 0.7);
              return { width: qrboxSize, height: qrboxSize };
            }
          },
          (decodedText) => {
            onScan(decodedText);
          },
          () => {
            // Unused failure callback
          }
        );
        setIsReady(true);
      } catch (err: any) {
        console.error("Camera access error:", err);
        setError("Gagal mengakses kamera. Mohon izinkan akses kamera di pengaturan browser Anda.");
      }
    };

    startScanner();

    return () => {
      if (qrRef.current) {
        qrRef.current.stop().catch(e => console.error("Error stopping scanner:", e));
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-neutral-900/95 z-[100] flex flex-col items-center justify-center p-6 backdrop-blur-md">
      <div className="absolute top-0 left-0 right-0 p-8 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/20 text-primary rounded-xl flex items-center justify-center backdrop-blur-xl border border-white/10">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-white text-sm font-black uppercase tracking-widest leading-none">Scan QR Porsi</h2>
            <p className="text-neutral-400 text-[9px] font-bold uppercase mt-1">Arahkan kamera ke Kode QR</p>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="p-3 bg-white/10 text-white rounded-2xl hover:bg-white/20 transition-all active:scale-90 backdrop-blur-xl"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="relative w-full max-w-sm aspect-square">
        {/* Scanner Container */}
        <div 
          id={scannerId} 
          className="w-full h-full bg-black rounded-[40px] overflow-hidden border-2 border-white/20 shadow-2xl relative"
        >
          {!isReady && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-4 bg-neutral-900">
              <RefreshCw className="w-10 h-10 text-primary animate-spin" />
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Memuat Kamera...</p>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-neutral-900">
              <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
              <p className="text-white text-sm font-bold mb-6">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-primary text-white rounded-xl text-[11px] font-black uppercase tracking-widest"
              >
                Muat Ulang
              </button>
            </div>
          )}
        </div>

        {/* Framing Corners (Visual Overlay) */}
        {isReady && (
          <>
            <div className="absolute top-12 left-12 w-10 h-10 border-t-4 border-l-4 border-primary rounded-tl-2xl z-20" />
            <div className="absolute top-12 right-12 w-10 h-10 border-t-4 border-r-4 border-primary rounded-tr-2xl z-20" />
            <div className="absolute bottom-12 left-12 w-10 h-10 border-b-4 border-l-4 border-primary rounded-bl-2xl z-20" />
            <div className="absolute bottom-12 right-12 w-10 h-10 border-b-4 border-r-4 border-primary rounded-br-2xl z-20" />
            
            {/* Animated Scan Line */}
            <div className="absolute top-12 left-12 right-12 h-0.5 bg-primary/50 shadow-[0_0_15px_rgba(27,94,32,0.8)] z-20 animate-scan" />
          </>
        )}
      </div>

      <div className="mt-12 text-center max-w-[240px]">
        <div className="flex items-center justify-center gap-2 text-neutral-400 mb-2">
          <Camera className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] italic">Auto-Focus Aktif</span>
        </div>
        <p className="text-[11px] text-neutral-500 font-medium leading-relaxed">
          Posisikan kode QR di tengah kotak untuk proses pemindaian otomatis
        </p>
      </div>

      <style>{`
        #${scannerId} video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
        @keyframes scan {
          0% { top: 10%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
        .animate-scan {
          animation: scan 2s linear infinite;
          position: absolute;
          width: calc(100% - 96px);
        }
      `}</style>
    </div>
  );
}
