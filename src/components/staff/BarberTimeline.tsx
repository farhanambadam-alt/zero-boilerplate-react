import { useMemo } from 'react';
import {
  Clock, CheckCircle, Smartphone, Plus, Coffee, Play, Zap, List,
} from 'lucide-react';
import StaffProfile from './StaffProfile';
import {
  minsToTime, timeToMins, OPEN_TIME, CLOSE_TIME, SLOT_INTERVAL,
} from '@/types/staff';
import type { Barber, Booking, BreakDetail, ViewMode } from '@/types/staff';

interface BarberTimelineProps {
  barber: Barber;
  bookings: Booking[];
  currentTime: Date;
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  barberOnBreak: boolean;
  breakDetail: BreakDetail | null;
  onStartJob: (id: number) => void;
  onComplete: (id: number) => void;
  onOpenDrawer: () => void;
  onBreak: (duration: number) => void;
}

const BarberTimeline = ({
  barber, bookings, currentTime, viewMode, setViewMode,
  barberOnBreak, breakDetail, onStartJob, onComplete, onOpenDrawer, onBreak,
}: BarberTimelineProps) => {
  const bBookings = bookings.filter(b => b.barberId === barber.id);

  const timeSlots = useMemo(() => {
    const slots: number[] = [];
    for (let m = OPEN_TIME; m < CLOSE_TIME; m += SLOT_INTERVAL) slots.push(m);
    return slots;
  }, []);

  const nowMins = currentTime.getHours() * 60 + currentTime.getMinutes();

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-full ${barber.colorClass} flex items-center justify-center font-heading font-black text-sm`}>
              {barber.init}
            </div>
            <div>
              <h3 className="font-heading font-black text-foreground text-base">{barber.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${barberOnBreak ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                <span className="text-[10px] font-body font-bold text-muted-foreground uppercase tracking-widest">
                  {barberOnBreak ? `Break ends ${breakDetail?.end}` : 'Available'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock size={14} />
            <span className="text-sm font-heading font-bold">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Break button */}
        {!barberOnBreak && (
          <button
            onClick={() => onBreak(15)}
            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-xl text-xs font-body font-bold text-muted-foreground active:scale-95 transition-transform"
          >
            <Coffee size={12} /> 15 min break
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === 'queue' ? (
          <div className="p-4">
            {/* Queue header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <List size={14} className="text-primary" />
                  <span className="font-heading font-bold text-sm text-foreground">Queue</span>
                </div>
                <p className="text-[10px] text-muted-foreground font-body mt-0.5">
                  {bBookings.filter(b => b.type === 'walkin').length} walk-ins pending
                </p>
              </div>
              <button
                onClick={onOpenDrawer}
                className="bg-primary text-primary-foreground px-5 py-2.5 rounded-2xl text-xs font-heading font-black flex items-center gap-2 shadow-lg active:scale-95 transition-transform"
              >
                <Plus size={14} /> Queue Customer
              </button>
            </div>

            {/* Timeline */}
            <div className="space-y-0">
              {timeSlots.map(mins => {
                const booking = bBookings.find(b => {
                  const bStart = timeToMins(b.scheduledTime);
                  return mins >= bStart && mins < bStart + b.duration;
                });
                const isBookingStart = booking ? timeToMins(booking.scheduledTime) === mins : false;
                const isBreak = barberOnBreak && breakDetail && mins >= breakDetail.startMins && mins < breakDetail.endMins;
                const isPast = mins + SLOT_INTERVAL <= nowMins;
                const isCurrent = nowMins >= mins && nowMins < mins + SLOT_INTERVAL;

                // How many slots does this booking span?
                const bookingSlotSpan = booking ? Math.ceil(booking.duration / SLOT_INTERVAL) : 1;
                // If this slot is part of a booking but NOT the start, skip rendering the card
                if (booking && !isBookingStart) {
                  return null;
                }

                return (
                  <div key={mins} className="flex gap-3" style={{ minHeight: booking ? `${Math.max(bookingSlotSpan * 80, 140)}px` : '56px' }}>
                    {/* Time label */}
                    <div className="w-14 flex-shrink-0 flex flex-col items-end pt-1">
                      <span className={`text-xs font-heading font-bold ${isCurrent ? 'text-primary' : isPast ? 'text-muted-foreground/40' : 'text-muted-foreground'}`}>
                        {minsToTime(mins).split(' ')[0]}
                      </span>
                      <span className={`text-[9px] ${isCurrent ? 'text-primary' : 'text-muted-foreground/50'}`}>
                        {minsToTime(mins).split(' ')[1]}
                      </span>
                    </div>

                    {/* Timeline line + dot */}
                    <div className="flex flex-col items-center w-4 flex-shrink-0">
                      <div className={`w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 ${
                        isCurrent ? 'border-primary bg-primary' :
                        booking ? 'border-primary bg-primary/30' :
                        isBreak ? 'border-amber-500 bg-amber-500/30' :
                        'border-border bg-muted'
                      }`} />
                      <div className={`flex-1 w-px ${isPast ? 'bg-border/40' : 'bg-border'}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-2 min-w-0">
                      {isBookingStart && booking ? (
                        <div className={`rounded-2xl border-2 p-3.5 transition-all ${
                          booking.status === 'serving'
                            ? 'border-primary bg-primary/5 shadow-md'
                            : 'border-border bg-card'
                        }`}>
                          {/* Tags row */}
                          <div className="flex flex-wrap items-center gap-1.5 mb-2">
                            <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[9px] font-heading font-black uppercase">
                              Queue #{booking.queueNo}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-heading font-bold uppercase flex items-center gap-1 ${
                              booking.type === 'online'
                                ? 'bg-blue-500/15 text-blue-600'
                                : 'bg-amber-500/15 text-amber-600'
                            }`}>
                              {booking.type === 'online' ? <Smartphone size={8} /> : <Zap size={8} />}
                              {booking.type}
                            </span>
                            {booking.status === 'serving' && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 text-[9px] font-heading font-bold uppercase">
                                In Progress
                              </span>
                            )}
                          </div>

                          {/* Customer name */}
                          <p className="font-heading font-black text-foreground text-sm">{booking.name}</p>

                          {/* Services */}
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {booking.services.map((s, i) => (
                              <span key={i} className="text-[10px] font-body text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                {s}
                              </span>
                            ))}
                          </div>

                          {/* Duration + time */}
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground font-body">
                            <span className="flex items-center gap-1"><Clock size={10} />{booking.duration} min</span>
                            <span>Start: {booking.scheduledTime}</span>
                            <span>₹{booking.price}</span>
                          </div>

                          {/* Action */}
                          <div className="mt-3">
                            {booking.status === 'serving' ? (
                              <button
                                onClick={() => onComplete(booking.id)}
                                className="w-full bg-emerald-600 text-white py-3 rounded-xl font-heading font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-transform"
                              >
                                <CheckCircle size={14} /> Complete
                              </button>
                            ) : (
                              <button
                                onClick={() => onStartJob(booking.id)}
                                className="w-full bg-foreground text-background py-3 rounded-xl font-heading font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-transform"
                              >
                                <Play size={14} /> Start Job
                              </button>
                            )}
                          </div>
                        </div>
                      ) : isBreak ? (
                        <div className="rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 p-3 flex items-center gap-3">
                          <Coffee size={16} className="text-amber-500 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-heading font-bold text-foreground">Break</p>
                            <p className="text-[10px] text-muted-foreground">Reserved time</p>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={onOpenDrawer}
                          className="w-full rounded-xl border border-dashed border-border/60 bg-muted/30 p-2.5 flex items-center gap-2 text-muted-foreground/50 hover:border-primary/30 hover:text-primary/50 transition-colors"
                        >
                          <Plus size={12} />
                          <span className="text-[10px] font-body">Available</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <StaffProfile barber={barber} />
        )}
      </div>

      {/* Bottom Tabs */}
      <div className="border-t border-border p-2 bg-card">
        <div className="flex bg-muted rounded-2xl p-1">
          <button
            onClick={() => setViewMode('queue')}
            className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-heading font-bold transition-all ${
              viewMode === 'queue' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <List size={14} /> Queue
          </button>
          <button
            onClick={() => setViewMode('profile')}
            className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-heading font-bold transition-all ${
              viewMode === 'profile' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <Zap size={14} /> Profile
          </button>
        </div>
      </div>
    </div>
  );
};

export default BarberTimeline;
