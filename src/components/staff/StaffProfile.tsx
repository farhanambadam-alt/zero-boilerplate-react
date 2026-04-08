import { Star, MessageSquare, Camera, Image as ImageIcon, TrendingUp, Award } from 'lucide-react';
import type { Barber } from '@/types/staff';

interface StaffProfileProps {
  barber: Barber;
}

// Mock data for profile
const MOCK_REVIEWS = [
  { id: 1, customer: 'Rahul M.', rating: 5, text: 'Amazing haircut! Best in the city.', date: '2 days ago' },
  { id: 2, customer: 'Priya K.', rating: 4, text: 'Great service, very professional.', date: '5 days ago' },
  { id: 3, customer: 'Amit S.', rating: 5, text: 'Always delivers perfect results.', date: '1 week ago' },
];

const MOCK_GALLERY = [
  { id: 1, before: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=200&h=200&fit=crop', after: 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=200&h=200&fit=crop', service: 'Haircut', date: 'Today' },
  { id: 2, before: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=200&h=200&fit=crop', after: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=200&h=200&fit=crop', service: 'Hair Color', date: 'Yesterday' },
  { id: 3, before: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=200&h=200&fit=crop', after: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=200&h=200&fit=crop', service: 'Beard Trim', date: '3 days ago' },
];

const StaffProfile = ({ barber }: StaffProfileProps) => {
  return (
    <div className="space-y-6 p-4">
      {/* Profile Header */}
      <div className="bg-card rounded-3xl p-6 border border-border text-center">
        <div className={`w-20 h-20 rounded-full ${barber.colorClass} flex items-center justify-center mx-auto text-2xl font-heading font-black`}>
          {barber.init}
        </div>
        <h2 className="font-heading font-black text-xl text-foreground mt-3">{barber.name}</h2>
        <p className="text-sm text-muted-foreground font-body">{barber.role}</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="bg-muted rounded-2xl p-3">
            <div className="flex items-center justify-center gap-1 text-amber-500">
              <Star size={14} fill="currentColor" />
              <span className="font-heading font-black text-lg">4.8</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-body mt-0.5">Rating</p>
          </div>
          <div className="bg-muted rounded-2xl p-3">
            <div className="flex items-center justify-center gap-1 text-primary">
              <TrendingUp size={14} />
              <span className="font-heading font-black text-lg">156</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-body mt-0.5">This Month</p>
          </div>
          <div className="bg-muted rounded-2xl p-3">
            <div className="flex items-center justify-center gap-1 text-emerald-500">
              <Award size={14} />
              <span className="font-heading font-black text-lg">2.1K</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-body mt-0.5">Total</p>
          </div>
        </div>
      </div>

      {/* Before / After Gallery */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Camera size={16} className="text-primary" />
          <h3 className="font-heading font-bold text-sm text-foreground uppercase tracking-widest">Before & After</h3>
        </div>
        <div className="space-y-3">
          {MOCK_GALLERY.map(item => (
            <div key={item.id} className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="grid grid-cols-2 gap-px bg-border">
                <div className="relative">
                  <img src={item.before} alt="Before" className="w-full h-32 object-cover" />
                  <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Before</span>
                </div>
                <div className="relative">
                  <img src={item.after} alt="After" className="w-full h-32 object-cover" />
                  <span className="absolute bottom-1 left-1 bg-primary/90 text-primary-foreground text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">After</span>
                </div>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-xs font-heading font-bold text-foreground">{item.service}</span>
                <span className="text-[10px] text-muted-foreground">{item.date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare size={16} className="text-primary" />
          <h3 className="font-heading font-bold text-sm text-foreground uppercase tracking-widest">Customer Reviews</h3>
        </div>
        <div className="space-y-3">
          {MOCK_REVIEWS.map(review => (
            <div key={review.id} className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-heading font-bold text-sm text-foreground">{review.customer}</span>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star key={i} size={10} className="text-amber-500" fill="currentColor" />
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground font-body leading-relaxed">{review.text}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-2">{review.date}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Stats */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ImageIcon size={16} className="text-primary" />
          <h3 className="font-heading font-bold text-sm text-foreground uppercase tracking-widest">Today's Summary</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-2xl border border-border p-4 text-center">
            <p className="text-2xl font-heading font-black text-foreground">8</p>
            <p className="text-[10px] text-muted-foreground font-body mt-1">Customers Served</p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4 text-center">
            <p className="text-2xl font-heading font-black text-foreground">₹4,250</p>
            <p className="text-[10px] text-muted-foreground font-body mt-1">Revenue Today</p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4 text-center">
            <p className="text-2xl font-heading font-black text-foreground">35 min</p>
            <p className="text-[10px] text-muted-foreground font-body mt-1">Avg. Service Time</p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4 text-center">
            <p className="text-2xl font-heading font-black text-foreground">92%</p>
            <p className="text-[10px] text-muted-foreground font-body mt-1">Satisfaction</p>
          </div>
        </div>
      </div>

      <div className="h-8" />
    </div>
  );
};

export default StaffProfile;
