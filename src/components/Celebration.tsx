import React, { useEffect, useState } from 'react';
import { PartyPopper, Trophy, CheckCircle2 } from 'lucide-react';

interface CelebrationOverlayProps {
  show: boolean;
  onClose: () => void;
  message?: string;
  type?: 'success' | 'milestone' | 'achievement';
}

export const CelebrationOverlay: React.FC<CelebrationOverlayProps> = ({
  show,
  onClose,
  message = 'Selamat!',
  type = 'success',
}) => {
  const [particles, setParticles] = useState<Array<{ id: number; left: number; delay: number; color: string }>>([]);

  useEffect(() => {
    if (show) {
      // Generate particles
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 2,
        color: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][Math.floor(Math.random() * 5)],
      }));
      setParticles(newParticles);

      // Auto close after 5 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 5000);

      return () => clearTimeout(timer);
    } else {
      setParticles([]);
    }
  }, [show, onClose]);

  if (!show) return null;

  const icons = {
    success: <CheckCircle2 size={48} className="text-emerald-600" />,
    milestone: <Trophy size={48} className="text-amber-500" />,
    achievement: <PartyPopper size={48} className="text-blue-500" />,
  };

  const bgColors = {
    success: 'bg-emerald-100 border-emerald-200',
    milestone: 'bg-amber-100 border-amber-200',
    achievement: 'bg-blue-100 border-blue-200',
  };

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center overflow-hidden pointer-events-none">
      {/* Particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute w-2 h-2 rounded-sm"
          style={{
            backgroundColor: p.color,
            left: `${p.left}%`,
            top: '-20px',
            animation: `fall ${2 + Math.random() * 3}s linear forwards`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

      {/* Celebration Card */}
      <div
        className={`${bgColors[type]} border-4 rounded-3xl p-12 shadow-2xl text-center animate-in zoom-in-50 duration-300 pointer-events-auto`}
      >
        <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center mx-auto mb-6 animate-bounce shadow-xl">
          {icons[type]}
        </div>
        <h2 className="text-4xl font-black text-slate-800 mb-3">{message}</h2>
        <p className="text-slate-600 font-bold text-lg mb-4">Pencapaian luar biasa!</p>
        <div className="flex justify-center gap-2 mt-6">
          <Trophy size={20} className="text-amber-500" />
          <span className="text-xs text-amber-600 font-black uppercase tracking-wider">Kerja Bagus</span>
        </div>
      </div>

      <style>{`
        @keyframes fall {
          to {
            transform: translateY(105vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

