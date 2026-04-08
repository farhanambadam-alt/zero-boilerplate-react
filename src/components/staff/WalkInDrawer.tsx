import { useState, useMemo } from 'react';
import { X, Hash, Zap, ArrowRight } from 'lucide-react';
import DurationDial from './DurationDial';
import { SERVICES, minsToTime, timeToMins, OPEN_TIME, CLOSE_TIME } from '@/types/staff';
import type { Booking, BreakDetail } from '@/types/staff';

interface WalkInDrawerProps {
  open: boolean;
  barberId: string | null;
  bookings: Booking[];
  barberOnBreak: Record<string, boolean>;
  breakDetails: Record<string, BreakDetail | null>;
  currentTime: Date;
  onClose: () => void;
  onAdd: (booking: Omit<Booking, 'id'>) => void;
  nextQueueNo: number;
}

const WalkInDrawer = ({
  open, barberId, bookings, barberOnBreak, breakDetails,
  currentTime, onClose, onAdd, nextQueueNo,
}: WalkInDrawerProps) => {
  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  const [walkInName, setWalkInName] = useState('');
  const [manualDuration, setManualDuration] = useState(30);

  const getNextAvailableSlot = (bId: string, duration: number): number | null => {
    const nowMins = currentTime.getHours() * 60 + currentTime.getMinutes();
    const barberBookings = bookings
      .filter(b => b.barberId === bId)
      .map(b => ({ start: timeToMins(b.scheduledTime), end: timeToMins(b.scheduledTime) + b.duration }))
      .sort((a, b) => a.start - b.start);
    const breakData = barberOnBreak[bId] ? breakDetails[bId] : null;
    let ptr = Math.max(nowMins, OPEN_TIME);

    while (ptr + duration <= CLOSE_TIME) {
      const conflict = barberBookings.find(b =>
        (ptr >= b.start && ptr < b.end) ||
        (ptr + duration > b.start && ptr + duration <= b.end) ||
        (ptr <= b.start && ptr + duration >= b.end)
      );
      const breakConflict = breakData && ptr < breakData.endMins && ptr + duration > breakData.startMins;
      if (conflict) {
        ptr = conflict.end;
      } else if (breakConflict && breakData) {
        ptr = breakData.endMins;
      } else {
        return ptr;
      }
    }
    return null;
  };

  const nextSlot = useMemo(() => {
    if (!open || !barberId) return null;
    return getNextAvailableSlot(barberId, manualDuration);
  }, [open, barberId, manualDuration, bookings, barberOnBreak, breakDetails]);

  const handleSubmit = () => {
    if (!barberId || nextSlot === null) return;
    const svcs = SERVICES.filter(s => selectedServices.includes(s.id));
    onAdd({
      name: walkInName || 'Walk-in Customer',
      barberId,
      type: 'walkin',
      status: 'waiting',
      scheduledTime: minsToTime(nextSlot),
      queueNo: nextQueueNo,
      services: svcs.map(s => s.name),
      duration: manualDuration,
      price: svcs.reduce((acc, c) => acc + c.price, 0),
    });
    setWalkInName('');
    setSelectedServices([]);
    setManualDuration(30);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-background rounded-t-3xl max-h-[90vh] flex flex-col animate-slide-up shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-xl font-heading font-black text-foreground">Add Walk-in</h2>
            <div className="flex items-center gap-1.5 mt-1">
              <Hash size={12} className="text-primary" />
              <span className="text-xs font-body font-bold text-primary">QUEUE POSITION #{nextQueueNo}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-muted rounded-2xl text-muted-foreground active:scale-90 transition-transform">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Estimated Start */}
          <div className="bg-primary/10 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-body text-muted-foreground uppercase tracking-widest">Estimated Start</p>
              <p className="text-2xl font-heading font-black text-foreground mt-1">
                {nextSlot !== null ? minsToTime(nextSlot) : 'No Gaps!'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Zap size={20} className="text-primary" />
            </div>
          </div>

          {/* Customer Name */}
          <div>
            <label className="text-xs font-body font-bold text-muted-foreground uppercase tracking-widest mb-2 block">
              Customer Name
            </label>
            <input
              type="text"
              value={walkInName}
              onChange={(e) => setWalkInName(e.target.value)}
              placeholder="Enter client name"
              className="w-full bg-muted border-2 border-border rounded-2xl p-4 font-heading font-bold text-lg text-foreground outline-none focus:border-primary focus:bg-background transition-all"
            />
          </div>

          {/* Duration Dial */}
          <div>
            <label className="text-xs font-body font-bold text-muted-foreground uppercase tracking-widest mb-3 block">
              Set Service Duration
            </label>
            <DurationDial value={manualDuration} onChange={setManualDuration} />
          </div>

          {/* Services */}
          <div>
            <label className="text-xs font-body font-bold text-muted-foreground uppercase tracking-widest mb-3 block">
              Select Services
            </label>
            <div className="grid grid-cols-2 gap-3">
              {SERVICES.map(s => {
                const selected = selectedServices.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedServices(p => selected ? p.filter(x => x !== s.id) : [...p, s.id])}
                    className={`p-4 rounded-2xl border-2 text-left transition-all ${
                      selected
                        ? 'border-primary bg-primary text-primary-foreground shadow-lg scale-[1.02]'
                        : 'border-border bg-card text-muted-foreground'
                    }`}
                  >
                    <p className="font-heading font-bold text-sm">{s.name}</p>
                    <p className="text-xs mt-0.5 opacity-80">₹{s.price} · {s.duration}min</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="p-5 border-t border-border">
          <button
            onClick={handleSubmit}
            disabled={nextSlot === null}
            className="w-full bg-primary text-primary-foreground py-5 rounded-2xl font-heading font-black text-lg shadow-xl active:scale-[0.97] transition-all disabled:opacity-30 flex items-center justify-center gap-3 uppercase tracking-widest"
          >
            Add to Queue <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default WalkInDrawer;
