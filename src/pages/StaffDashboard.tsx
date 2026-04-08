import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BarberTimeline from '@/components/staff/BarberTimeline';
import WalkInDrawer from '@/components/staff/WalkInDrawer';
import { BARBERS, minsToTime } from '@/types/staff';
import type { Booking, BreakDetail, ViewMode } from '@/types/staff';

const StaffDashboard = () => {
  const navigate = useNavigate();
  const [activeBarberTab, setActiveBarberTab] = useState('b1');
  const [viewMode, setViewMode] = useState<ViewMode>('queue');
  const [currentTime, setCurrentTime] = useState(new Date());

  const [barberOnBreak, setBarberOnBreak] = useState<Record<string, boolean>>({
    b1: false, b2: false, b3: false,
  });
  const [breakDetails, setBreakDetails] = useState<Record<string, BreakDetail | null>>({
    b1: null, b2: null, b3: null,
  });

  const [bookings, setBookings] = useState<Booking[]>([
    { id: 1, name: 'Rahul M.', barberId: 'b1', type: 'online', status: 'serving', scheduledTime: '10:00 AM', queueNo: 1, services: ['Skin Fade', 'Beard Trim'], duration: 45, price: 400 },
    { id: 2, name: 'Amit Singh', barberId: 'b1', type: 'online', status: 'waiting', scheduledTime: '11:00 AM', queueNo: 2, services: ['Haircut'], duration: 30, price: 250 },
  ]);

  const [wiDrawer, setWiDrawer] = useState<{ open: boolean; barberId: string | null }>({ open: false, barberId: null });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const completeService = useCallback((id: number) => {
    setBookings(prev => prev.filter(b => b.id !== id));
  }, []);

  const startJob = useCallback((id: number) => {
    setBookings(prev => {
      const target = prev.find(b => b.id === id);
      if (!target) return prev;
      return prev.map(b => {
        if (b.barberId === target.barberId && b.status === 'serving') return { ...b, status: 'waiting' as const };
        if (b.id === id) return { ...b, status: 'serving' as const };
        return b;
      });
    });
  }, []);

  const handleBreak = useCallback((barberId: string, duration: number) => {
    const nowMins = currentTime.getHours() * 60 + currentTime.getMinutes();
    setBarberOnBreak(prev => ({ ...prev, [barberId]: true }));
    setBreakDetails(prev => ({
      ...prev,
      [barberId]: { startMins: nowMins, endMins: nowMins + duration, end: minsToTime(nowMins + duration) },
    }));
    // Auto-end break
    setTimeout(() => {
      setBarberOnBreak(prev => ({ ...prev, [barberId]: false }));
      setBreakDetails(prev => ({ ...prev, [barberId]: null }));
    }, duration * 60 * 1000);
  }, [currentTime]);

  const addWalkIn = useCallback((booking: Omit<Booking, 'id'>) => {
    setBookings(prev => [...prev, { ...booking, id: Date.now() }]);
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card"
        style={{ paddingTop: 'calc(var(--inset-top, 0px) + 12px)' }}
      >
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-muted active:scale-90 transition-transform">
          <ChevronLeft size={20} className="text-foreground" />
        </button>
        <h1 className="font-heading font-black text-foreground text-lg flex-1">Staff Dashboard</h1>
      </div>

      {/* Barber tabs */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar border-b border-border bg-card">
        {BARBERS.map(b => (
          <button
            key={b.id}
            onClick={() => setActiveBarberTab(b.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 transition-all flex-shrink-0 ${
              activeBarberTab === b.id
                ? 'border-primary bg-primary text-primary-foreground shadow-lg scale-[1.02]'
                : 'border-border bg-card text-muted-foreground'
            }`}
          >
            <span className="text-xs font-heading font-black">{b.init}</span>
            <span className="text-xs font-heading font-bold">{b.name}</span>
          </button>
        ))}
      </div>

      {/* Active barber timeline */}
      <div className="flex-1 overflow-hidden">
        {BARBERS.map(b => (
          <div key={b.id} className={`h-full ${activeBarberTab === b.id ? 'block' : 'hidden'}`}>
            <BarberTimeline
              barber={b}
              bookings={bookings}
              currentTime={currentTime}
              viewMode={viewMode}
              setViewMode={setViewMode}
              barberOnBreak={barberOnBreak[b.id]}
              breakDetail={breakDetails[b.id]}
              onStartJob={startJob}
              onComplete={completeService}
              onOpenDrawer={() => setWiDrawer({ open: true, barberId: b.id })}
              onBreak={(dur) => handleBreak(b.id, dur)}
            />
          </div>
        ))}
      </div>

      {/* Walk-in Drawer */}
      <WalkInDrawer
        open={wiDrawer.open}
        barberId={wiDrawer.barberId}
        bookings={bookings}
        barberOnBreak={barberOnBreak}
        breakDetails={breakDetails}
        currentTime={currentTime}
        onClose={() => setWiDrawer({ open: false, barberId: null })}
        onAdd={addWalkIn}
        nextQueueNo={bookings.length + 1}
      />
    </div>
  );
};

export default StaffDashboard;
