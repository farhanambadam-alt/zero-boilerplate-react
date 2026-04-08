export interface Barber {
  id: string;
  name: string;
  init: string;
  colorClass: string;
  role: string;
}

export interface Service {
  id: number;
  name: string;
  price: number;
  duration: number;
}

export interface Booking {
  id: number;
  name: string;
  barberId: string;
  type: 'online' | 'walkin';
  status: 'serving' | 'waiting' | 'completed';
  scheduledTime: string;
  queueNo: number;
  services: string[];
  duration: number;
  price: number;
}

export interface BreakDetail {
  startMins: number;
  endMins: number;
  end: string;
}

export type ViewMode = 'queue' | 'profile';

export const BARBERS: Barber[] = [
  { id: 'b1', name: 'Arjun', init: 'AS', colorClass: 'bg-primary text-primary-foreground', role: 'Senior Stylist' },
  { id: 'b2', name: 'Binod', init: 'BK', colorClass: 'bg-emerald-600 text-white', role: 'Barber' },
  { id: 'b3', name: 'Divya', init: 'DN', colorClass: 'bg-rose-600 text-white', role: 'Master Stylist' },
];

export const SERVICES: Service[] = [
  { id: 1, name: 'Haircut', price: 250, duration: 30 },
  { id: 2, name: 'Beard Trim', price: 150, duration: 20 },
  { id: 3, name: 'Facial', price: 500, duration: 45 },
  { id: 4, name: 'Hair Color', price: 800, duration: 60 },
  { id: 5, name: 'Head Massage', price: 300, duration: 30 },
];

export const OPEN_TIME = 9 * 60;
export const CLOSE_TIME = 21 * 60;
export const SLOT_INTERVAL = 30;

export const timeToMins = (timeStr: string): number => {
  if (!timeStr) return 0;
  const parts = timeStr.split(' ');
  const [h_str, m_str] = parts[0].split(':');
  let h = parseInt(h_str, 10);
  const m = parseInt(m_str || '0', 10);
  const period = parts[1]?.toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 60 + m;
};

export const minsToTime = (mins: number): string => {
  let h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  const period = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  if (h > 12) h -= 12;
  return `${h}:${m.toString().padStart(2, '0')} ${period}`;
};
