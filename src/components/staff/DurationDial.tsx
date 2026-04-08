import { useRef, useState } from 'react';
import { Clock } from 'lucide-react';

interface DurationDialProps {
  value: number;
  onChange: (mins: number) => void;
}

const DurationDial = ({ value, onChange }: DurationDialProps) => {
  const dialRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleUpdate = (clientX: number, clientY: number) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI) + 90;
    const normalizedAngle = angle < 0 ? angle + 360 : angle;
    const mins = Math.max(15, Math.min(120, Math.round((normalizedAngle / 360) * 120 / 5) * 5));
    onChange(mins);
  };

  const rotation = (value / 120) * 360;

  // Generate tick marks
  const ticks = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * 360 - 90;
    const rad = (angle * Math.PI) / 180;
    const isMajor = i % 4 === 0;
    const outerR = 46;
    const innerR = isMajor ? 38 : 41;
    return {
      x1: 50 + innerR * Math.cos(rad),
      y1: 50 + innerR * Math.sin(rad),
      x2: 50 + outerR * Math.cos(rad),
      y2: 50 + outerR * Math.sin(rad),
      isMajor,
    };
  });

  // Needle endpoint
  const needleAngle = (rotation - 90) * (Math.PI / 180);
  const needleR = 32;

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={dialRef}
        className="relative w-44 h-44 cursor-pointer select-none"
        onMouseMove={(e) => isDragging && handleUpdate(e.clientX, e.clientY)}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onTouchMove={(e) => isDragging && handleUpdate(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchStart={() => setIsDragging(true)}
        onTouchEnd={() => setIsDragging(false)}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Outer ring */}
          <circle cx="50" cy="50" r="47" fill="none" stroke="hsl(var(--border))" strokeWidth="1" />
          <circle cx="50" cy="50" r="47" fill="hsl(var(--card))" />

          {/* Progress arc */}
          <circle
            cx="50" cy="50" r="40"
            fill="none"
            stroke="hsl(var(--primary) / 0.15)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <circle
            cx="50" cy="50" r="40"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${(rotation / 360) * 251.3} 251.3`}
            transform="rotate(-90 50 50)"
            className="transition-all duration-150"
          />

          {/* Tick marks */}
          {ticks.map((t, i) => (
            <line
              key={i}
              x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={t.isMajor ? 'hsl(var(--foreground) / 0.4)' : 'hsl(var(--foreground) / 0.15)'}
              strokeWidth={t.isMajor ? 1.5 : 0.8}
            />
          ))}

          {/* Needle */}
          <line
            x1="50" y1="50"
            x2={50 + needleR * Math.cos(needleAngle)}
            y2={50 + needleR * Math.sin(needleAngle)}
            stroke="hsl(var(--primary))"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="transition-all duration-150"
          />
          <circle cx="50" cy="50" r="3" fill="hsl(var(--primary))" />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-heading font-black text-foreground leading-none">{value}</span>
          <span className="text-[10px] font-body font-bold text-muted-foreground uppercase tracking-widest">MINS</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock size={12} />
        <span>Drag to adjust duration</span>
      </div>
    </div>
  );
};

export default DurationDial;
