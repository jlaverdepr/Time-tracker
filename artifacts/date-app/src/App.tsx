import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';

const ACTIVITIES = [
  { id: 'sushi', label: 'Sushi', emoji: '🍣' },
  { id: 'cooking', label: 'Cooking Together', emoji: '👨‍🍳' },
  { id: 'cuddles', label: 'Cuddles', emoji: '🤗' },
  { id: 'movie', label: 'Movie Night', emoji: '🎬' },
  { id: 'walk', label: 'Walk', emoji: '🚶' },
  { id: 'drinks', label: 'Drinks', emoji: '🍹' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'stargazing', label: 'Stargazing', emoji: '🌙' }
];

function FloatingHearts() {
  const [hearts, setHearts] = useState<{ id: number, x: number, delay: number, duration: number, scale: number }[]>([]);

  useEffect(() => {
    setHearts(Array.from({ length: 25 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 5,
      duration: Math.random() * 5 + 8,
      scale: Math.random() * 0.5 + 0.5,
    })));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {hearts.map((h) => (
        <motion.div
          key={h.id}
          initial={{ y: "110vh", opacity: 0 }}
          animate={{ y: "-10vh", opacity: [0, 1, 0.8, 0] }}
          transition={{ duration: h.duration, repeat: Infinity, delay: h.delay, ease: "linear" }}
          className="absolute text-2xl drop-shadow-sm select-none"
          style={{ left: `${h.x}vw`, transform: `scale(${h.scale})` }}
        >
          {['💕', '💝', '💗', '💖'][h.id % 4]}
        </motion.div>
      ))}
    </div>
  );
}

function AskScreen({ onNext }: { onNext: () => void }) {
  const noRef = useRef<HTMLButtonElement>(null);
  const [isDodging, setIsDodging] = useState(false);
  const [noPos, setNoPos] = useState({ x: 0, y: 0 });
  const [noScale, setNoScale] = useState(1);

  const dodge = useCallback((e?: MouseEvent | TouchEvent) => {
    if (!noRef.current) return;
    const btn = noRef.current;
    
    if (e) {
      let clientX = 0, clientY = 0;
      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }
      
      const rect = btn.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dist = Math.hypot(clientX - centerX, clientY - centerY);
      
      // If mouse is further than 120px from center, do not dodge
      if (dist > 120) return;
    }
    
    setIsDodging(true);
    
    const width = btn.offsetWidth || 144;
    const height = btn.offsetHeight || 56;
    
    const padding = 20;
    const maxX = window.innerWidth - width - padding;
    const maxY = window.innerHeight - height - padding;
    
    const newX = Math.max(padding, Math.random() * maxX);
    const newY = Math.max(padding, Math.random() * maxY);
    
    setNoPos({ x: newX, y: newY });
    setNoScale(s => Math.max(0.5, s - 0.15));
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => dodge(e);
    const onTouch = (e: TouchEvent) => dodge(e);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchstart', onTouch, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchstart', onTouch);
    };
  }, [dodge]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 1.05 }}
      transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
      className="text-center flex flex-col items-center justify-center min-h-[50vh]"
    >
      <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold text-primary mb-12 leading-tight drop-shadow-sm px-4">
        Will you go on a date with me? <span className="inline-block animate-bounce ml-2">💕</span>
      </h1>
      
      <div className="flex items-center justify-center gap-6 h-16 w-[320px] relative">
        <div className="w-36 h-14">
          <button 
            data-testid="yes-button" 
            onClick={onNext}
            className="w-full h-full bg-primary text-primary-foreground text-xl font-bold rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all focus:outline-none focus:ring-4 focus:ring-primary/30 active:scale-95"
          >
            Yes! 🥰
          </button>
        </div>
        <div className="w-36 h-14">
          <button
            ref={noRef}
            data-testid="no-button"
            onClick={(e) => {
              e.preventDefault();
              dodge();
            }}
            className="w-36 h-14 bg-secondary text-secondary-foreground text-xl font-bold rounded-full shadow-sm hover:shadow-md transition-all ease-out focus:outline-none active:scale-95 z-50 cursor-pointer"
            style={{
              position: isDodging ? 'fixed' : 'relative',
              left: isDodging ? noPos.x : 'auto',
              top: isDodging ? noPos.y : 'auto',
              transform: `scale(${noScale})`,
              transition: isDodging ? 'left 0.2s ease-out, top 0.2s ease-out, transform 0.2s ease-out' : 'all 0.2s'
            }}
          >
            No 😢
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function DateTimeScreen({ date, setDate, time, setTime, onNext }: any) {
  const isComplete = date && time;
  const today = new Date();
  today.setHours(0,0,0,0);

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.4 }}
      className="bg-card/90 backdrop-blur-md p-6 md:p-8 rounded-3xl shadow-xl border border-border flex flex-col items-center max-w-md mx-auto relative z-10"
    >
      <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-6 text-center">
        When are you free? 📅
      </h2>
      
      <div className="mb-6 bg-background rounded-2xl p-4 shadow-sm border border-border/50">
        <DayPicker
          mode="single"
          selected={date}
          onSelect={setDate}
          disabled={{ before: today }}
          showOutsideDays
          className="font-sans"
        />
      </div>

      <div className="w-full mb-8">
        <label className="block text-sm font-bold text-muted-foreground mb-2 ml-2">What time?</label>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-full h-14 px-4 rounded-xl border-2 border-border bg-background text-lg focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all cursor-pointer font-medium text-foreground"
        />
      </div>

      <button
        data-testid="continue-button"
        onClick={onNext}
        disabled={!isComplete}
        className="w-full h-14 bg-primary text-primary-foreground text-xl font-bold rounded-full shadow-md hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-4 focus:ring-primary/30"
      >
        Continue 💌
      </button>
    </motion.div>
  );
}

function ActivitiesScreen({ activities, setActivities, onNext }: any) {
  const toggleActivity = (id: string) => {
    setActivities((prev: string[]) => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.4 }}
      className="bg-card/90 backdrop-blur-md p-6 md:p-8 rounded-3xl shadow-xl border border-border flex flex-col items-center mx-auto max-w-2xl relative z-10"
    >
      <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-8 text-center">
        What are you down for? 🌹
      </h2>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-10 w-full">
        {ACTIVITIES.map((activity) => {
          const isSelected = activities.includes(activity.id);
          return (
            <button
              key={activity.id}
              data-testid={`activity-card-${activity.id}`}
              onClick={() => toggleActivity(activity.id)}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-300 ease-out focus:outline-none ${
                isSelected 
                  ? 'border-primary bg-primary/10 scale-105 shadow-md ring-2 ring-primary/20 ring-offset-2 ring-offset-background' 
                  : 'border-border bg-background hover:border-primary/40 hover:bg-secondary/30 active:scale-95'
              }`}
            >
              <span className="text-4xl mb-3 filter drop-shadow-sm">{activity.emoji}</span>
              <span className={`text-sm md:text-base ${isSelected ? 'text-primary font-bold' : 'text-foreground font-medium'}`}>
                {activity.label}
              </span>
            </button>
          );
        })}
      </div>

      <button
        data-testid="finalize-button"
        onClick={onNext}
        disabled={activities.length === 0}
        className="w-full md:w-3/4 h-14 bg-primary text-primary-foreground text-xl font-bold rounded-full shadow-md hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-4 focus:ring-primary/30"
      >
        Let's make it official! 💕
      </button>
    </motion.div>
  );
}

function ConfirmationScreen({ date, time, activities, formatActivities, formatTime, onReset }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, type: "spring", bounce: 0.5 }}
      className="bg-card/90 backdrop-blur-lg p-8 md:p-12 rounded-3xl shadow-2xl border border-primary/20 flex flex-col items-center text-center max-w-lg mx-auto relative overflow-hidden z-10"
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200%] h-32 bg-primary/20 blur-[60px] rounded-full pointer-events-none" />

      <h2 className="font-serif text-5xl font-bold text-primary mb-6 drop-shadow-sm">
        See you then! 💕
      </h2>
      
      <p className="text-xl md:text-2xl font-medium text-foreground leading-relaxed mb-10 z-10">
        I'll be counting down the days until <strong className="text-primary">{format(date!, "EEEE, MMMM do")}</strong> at <strong className="text-primary">{formatTime(time)}</strong>, when we can enjoy <strong className="text-primary">{formatActivities(activities)}</strong>! 🥰
      </p>

      <button
        data-testid="reset-button"
        onClick={onReset}
        className="text-muted-foreground hover:text-primary font-bold underline underline-offset-4 transition-colors z-10 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-lg px-4 py-2"
      >
        Make another date? 💝
      </button>
    </motion.div>
  );
}

export default function App() {
  const [step, setStep] = useState(1);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("");
  const [activities, setActivities] = useState<string[]>([]);

  const formatActivities = (ids: string[]) => {
    const labels = ids.map(id => ACTIVITIES.find(a => a.id === id)?.label.toLowerCase() || '');
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
    return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
  };

  const formatTimeStr = (timeStr: string) => {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(':');
    const hours = parseInt(h, 10);
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    return `${h12}:${m} ${suffix}`;
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center relative bg-background overflow-hidden selection:bg-primary/20 selection:text-primary font-sans">
      <FloatingHearts />
      <div className="z-10 w-full max-w-4xl px-4 py-8 relative flex items-center justify-center min-h-screen">
        <AnimatePresence mode="wait">
          {step === 1 && <AskScreen key="step1" onNext={() => setStep(2)} />}
          {step === 2 && <DateTimeScreen key="step2" date={date} setDate={setDate} time={time} setTime={setTime} onNext={() => setStep(3)} />}
          {step === 3 && <ActivitiesScreen key="step3" activities={activities} setActivities={setActivities} onNext={() => setStep(4)} />}
          {step === 4 && <ConfirmationScreen key="step4" date={date} time={time} activities={activities} formatActivities={formatActivities} formatTime={formatTimeStr} onReset={() => { setStep(1); setDate(undefined); setTime(""); setActivities([]); }} />}
        </AnimatePresence>
      </div>
    </div>
  );
}
