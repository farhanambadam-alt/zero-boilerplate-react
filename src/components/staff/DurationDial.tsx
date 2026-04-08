import { useRef, useState, useCallback } from 'react';
import { Clock, Plus, Minus } from 'lucide-react';

interface DurationDialProps {
  value: number;
  onChange: (mins: number) => void;
}

const MIN_DURATION = 15;
const MAX_DURATION = 180;
const STEP = 5;

const DurationDial = ({ value, onChange }: DurationDialProps) => {
  const dialRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const clamp = (v: number) => Math.max(MIN_DURATION, Math.min(MAX_DURATION, v));

  const handlePointer = useCallback((clientX: number, clientY: number) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // Angle from 12-o'clock position, clockwise
    let angle = Math.atan2(clientX - cx, -(clientY - cy)) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    // Map 0–360° to MIN_DURATION–MAX_DURATION
    const mins = clamp(Math.round((angle / 360) * MAX_DURATION / STEP) * STEP);
    onChange(mins);
  }, [onChange]);

  const hours = Math.floor(value / 60);
  const mins = value % 60;
  const rotation = (value / MAX_DURATION) * 360;
  const circumference = 2 * Math.PI * 42;
  const dashLen = (rotation / 360) * circumference;

  // Needle endpoint
  const needleAngle = ((rotation - 90) * Math.PI) / 180;
  const needleR = 34;

  // Tick marks
  const ticks = Array.from({ length: 36 }, (_, i) => {
    const a = (i / 36) * 360 - 90;
    const rad = (a * Math.PI) / 180;
    const isMajor = i % 6 === 0; // every 30°
    const outerR = 47;
    const innerR = isMajor ? 41 : 44;
    return { x1: 50 + innerR * Math.cos(rad), y1: 50 + innerR * Math.sin(rad), x2: 50 + outerR * Math.cos(rad), y2: 50 + outerR * Math.sin(rad), isMajor };
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={dialRef}
        className="relative w-48 h-48 cursor-pointer select-none touch-none"
        onMouseMove={(e) => isDragging && handlePointer(e.clientX, e.clientY)}
        onMouseDown={(e) => { setIsDragging(true); handlePointer(e.clientX, e.clientY); }}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onTouchMove={(e) => { e.preventDefault(); handlePointer(e.touches[0].clientX, e.touches[0].clientY); }}
        onTouchStart={(e) => { setIsDragging(true); handlePointer(e.touches[0].clientX, e.touches[0].clientY); }}
        onTouchEnd={() => setIsDragging(false)}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Background ring */}
          <circle cx="50" cy="50" r="48" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="0.8" />

          {/* Track */}
          <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />

          {/* Progress arc */}
          <circle
            cx="50" cy="50" r="42"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${dashLen} ${circumference}`}
            transform="rotate(-90 50 50)"
            className="transition-[stroke-dasharray] duration-100"
          />

          {/* Ticks */}
          {ticks.map((t, i) => (
            <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={t.isMajor ? 'hsl(var(--foreground) / 0.35)' : 'hsl(var(--foreground) / 0.1)'}
              strokeWidth={t.isMajor ? 1.2 : 0.6}
            />
          ))}

          {/* Needle */}
          <line
            x1="50" y1="50"
            x2={50 + needleR * Math.cos(needleAngle)}
            y2={50 + needleR * Math.sin(needleAngle)}
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeLinecap="round"
            className="transition-all duration-100"
          />
          {/* Knob at needle tip */}
          <circle
            cx={50 + needleR * Math.cos(needleAngle)}
            cy={50 + needleR * Math.sin(needleAngle)}
            r="3.5"
            fill="hsl(var(--primary))"
            stroke="hsl(var(--card))"
            strokeWidth="1.5"
            className="transition-all duration-100"
          />
          {/* Center dot */}
          <circle cx="50" cy="50" r="2.5" fill="hsl(var(--primary))" />
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-heading font-black text-foreground leading-none">
            {hours > 0 ? `${hours}h ${mins > 0 ? `${mins}m` : ''}` : `${mins}m`}
          </span>
          <span className="text-[9px] font-body font-bold text-muted-foreground uppercase tracking-[0.15em] mt-1">
            Duration
          </span>
        </div>
      </div>

      {/* Hour increment buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(clamp(value - 60))}
          disabled={value <= MIN_DURATION}
          className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-foreground active:scale-90 transition-transform disabled:opacity-30"
          aria-label="Subtract 1 hour"
        >
          <Minus size={16} />
        </button>
        <span className="text-xs font-body font-bold text-muted-foreground min-w-[40px] text-center">± 1 hr</span>
        <button
          onClick={() => onChange(clamp(value + 60))}
          disabled={value >= MAX_DURATION}
          className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-foreground active:scale-90 transition-transform disabled:opacity-30"
          aria-label="Add 1 hour"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Fine-tune row */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(clamp(value - STEP))}
          disabled={value <= MIN_DURATION}
          className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground active:scale-90 transition-transform disabled:opacity-30"
          aria-label="Subtract 5 minutes"
        >
          <Minus size={13} />
        </button>
        <span className="text-[10px] font-body text-muted-foreground min-w-[40px] text-center">± 5 min</span>
        <button
          onClick={() => onChange(clamp(value + STEP))}
          disabled={value >= MAX_DURATION}
          className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground active:scale-90 transition-transform disabled:opacity-30"
          aria-label="Add 5 minutes"
        >
          <Plus size={13} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
        <Clock size={10} />
        <span>Drag dial or use buttons</span>
      </div>
    </div>
  );
};

export default DurationDial;
