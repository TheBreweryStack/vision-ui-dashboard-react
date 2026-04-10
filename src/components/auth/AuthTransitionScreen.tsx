import React from 'react';
import { motion } from 'framer-motion';
import appIcon from '@/assets/app-icon.png';

interface AuthTransitionScreenProps {
  type: 'signin' | 'signout';
  displayName?: string | null;
}

const getFarewellMessage = (displayName?: string | null): { title: string; subtitle: string } => {
  const name = displayName || 'Trader';
  return { 
    title: `Goodbye, ${name}! 👋`, 
    subtitle: "See you soon ☕" 
  };
};

const getTimeBasedWelcome = (displayName?: string | null): { title: string; subtitle: string } => {
  const hour = new Date().getHours();
  const name = displayName || 'Trader';
  
  if (hour >= 5 && hour < 12) {
    return { title: `Good morning, ${name}! ☕`, subtitle: "Brewing your session..." };
  } else if (hour >= 12 && hour < 17) {
    return { title: `Good afternoon, ${name}! ☕`, subtitle: "Brewing your session..." };
  } else if (hour >= 17 && hour < 21) {
    return { title: `Good evening, ${name}! ☕`, subtitle: "Brewing your session..." };
  } else {
    return { title: `Welcome back, ${name}! ☕`, subtitle: "Brewing your session..." };
  }
};

// Coffee wave SVG component
const CoffeeWave: React.FC<{ delay?: number; opacity?: number; yOffset?: number }> = ({ 
  delay = 0, 
  opacity = 0.3,
  yOffset = 0 
}) => (
  <motion.svg
    className="absolute bottom-0 left-0 w-full"
    style={{ height: '200px', transform: `translateY(${yOffset}px)` }}
    viewBox="0 0 1440 200"
    preserveAspectRatio="none"
    initial={{ x: 0 }}
    animate={{ x: [0, -100, 0] }}
    transition={{
      duration: 8,
      repeat: Infinity,
      ease: "easeInOut",
      delay,
    }}
  >
    <motion.path
      fill={`hsla(var(--primary), ${opacity})`}
      d="M0,100 C320,180 420,20 640,100 C880,180 960,20 1200,100 C1320,140 1380,80 1440,100 L1440,200 L0,200 Z"
      initial={{ d: "M0,100 C320,180 420,20 640,100 C880,180 960,20 1200,100 C1320,140 1380,80 1440,100 L1440,200 L0,200 Z" }}
      animate={{
        d: [
          "M0,100 C320,180 420,20 640,100 C880,180 960,20 1200,100 C1320,140 1380,80 1440,100 L1440,200 L0,200 Z",
          "M0,120 C320,40 420,180 640,120 C880,40 960,180 1200,120 C1320,80 1380,140 1440,120 L1440,200 L0,200 Z",
          "M0,100 C320,180 420,20 640,100 C880,180 960,20 1200,100 C1320,140 1380,80 1440,100 L1440,200 L0,200 Z",
        ],
      }}
      transition={{
        duration: 6,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
    />
  </motion.svg>
);

// Steam particle component
const SteamParticle: React.FC<{ delay: number; x: number }> = ({ delay, x }) => (
  <motion.div
    className="absolute w-3 h-3 rounded-full bg-primary/20"
    style={{ left: `${x}%` }}
    initial={{ y: 0, opacity: 0, scale: 0.5 }}
    animate={{
      y: [-20, -80],
      opacity: [0, 0.6, 0],
      scale: [0.5, 1.2, 0.8],
      x: [0, Math.random() * 20 - 10],
    }}
    transition={{
      duration: 2,
      repeat: Infinity,
      delay,
      ease: "easeOut",
    }}
  />
);

// Coffee cup filling animation component
const CoffeeCupFilling: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.5, duration: 0.4 }}
    className="relative mt-14 pt-6 overflow-hidden"
  >
    {/* Steam above cup (clipped so it never overlaps subtitle) */}
    <div className="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 w-12 z-0">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-primary/30"
          style={{ left: `${25 + i * 25}%` }}
          animate={{
            y: [0, -10, -18],
            opacity: [0, 0.8, 0],
            scale: [0.5, 1, 0.5],
            x: [0, (i - 1) * 5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: i * 0.3,
            ease: "easeOut",
          }}
        />
      ))}
    </div>

    {/* Cup SVG */}
    <svg width="64" height="56" viewBox="0 0 64 56" className="relative z-10 overflow-visible">
      {/* Cup body */}
      <motion.path
        d="M8 12 L8 44 Q8 52 16 52 L40 52 Q48 52 48 44 L48 12 Z"
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Cup handle */}
      <motion.path
        d="M48 20 Q60 20 60 32 Q60 44 48 44"
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="3"
        strokeLinecap="round"
      />
      
      {/* Coffee liquid filling up */}
      <defs>
        <clipPath id="cupClip">
          <path d="M10 14 L10 43 Q10 50 17 50 L39 50 Q46 50 46 43 L46 14 Z" />
        </clipPath>
      </defs>
      
      {/* Animated coffee fill */}
      <motion.rect
        x="10"
        y="14"
        width="36"
        height="36"
        fill="hsl(var(--primary))"
        clipPath="url(#cupClip)"
        initial={{ y: 50 }}
        animate={{ y: 14 }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{ opacity: 0.6 }}
      />
      
      {/* Coffee surface wave */}
      <motion.ellipse
        cx="28"
        cy="20"
        rx="16"
        ry="3"
        fill="hsl(var(--primary))"
        style={{ opacity: 0.8 }}
        initial={{ cy: 50 }}
        animate={{ cy: [50, 20, 20, 50] }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: "easeInOut",
          times: [0, 0.4, 0.9, 1],
        }}
      />
      
      {/* Bubbles */}
      {[0, 1, 2].map((i) => (
        <motion.circle
          key={i}
          cx={20 + i * 8}
          r="2"
          fill="hsl(var(--primary-foreground))"
          style={{ opacity: 0.4 }}
          initial={{ cy: 45, opacity: 0 }}
          animate={{
            cy: [45, 25, 20],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: 0.8 + i * 0.2,
            ease: "easeOut",
          }}
        />
      ))}
    </svg>
    
    {/* Filling text */}
    <motion.p
      className="text-xs text-muted-foreground mt-3 text-center"
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      Brewing...
    </motion.p>
  </motion.div>
);

const AuthTransitionScreen: React.FC<AuthTransitionScreenProps> = ({ type, displayName }) => {
  const messages = type === 'signin' ? getTimeBasedWelcome(displayName) : getFarewellMessage(displayName);
  const { title, subtitle } = messages;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Coffee Wave Effect and Steam particles for Sign Out only */}
      {type === 'signout' && (
        <>
          <CoffeeWave delay={0} opacity={0.15} yOffset={40} />
          <CoffeeWave delay={1} opacity={0.25} yOffset={20} />
          <CoffeeWave delay={2} opacity={0.35} yOffset={0} />
          
          {/* Steam particles */}
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 w-32">
            {[...Array(8)].map((_, i) => (
              <SteamParticle key={i} delay={i * 0.3} x={20 + i * 8} />
            ))}
          </div>
        </>
      )}

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
        className="flex flex-col items-center z-10"
      >
        {/* Logo with pulse animation */}
        <motion.div
          animate={{ 
            scale: [1, 1.05, 1],
            rotate: type === 'signout' ? [0, -5, 5, 0] : 0,
          }}
          transition={{ 
            duration: type === 'signout' ? 1.5 : 2, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
          className="relative mb-6"
        >
          <img 
            src={appIcon} 
            alt="TraderCafé" 
            className="w-24 h-24 rounded-2xl shadow-2xl"
          />
          {/* Glow effect */}
          <motion.div
            animate={{ 
              opacity: [0.3, 0.6, 0.3],
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl -z-10"
          />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="text-2xl font-bold text-foreground mb-2 text-center px-4"
        >
          {title}
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className={`relative z-20 text-muted-foreground text-center px-4 ${type === 'signin' ? 'mb-10' : ''}`}
        >
          {subtitle}
        </motion.p>

        {/* Coffee cup filling animation for signin */}
        {type === 'signin' && <CoffeeCupFilling />}

        {/* Waving hand animation for signout */}
        {type === 'signout' && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
            className="mt-6"
          >
            <motion.span
              className="text-4xl inline-block"
              animate={{ rotate: [0, 20, -10, 20, 0] }}
              transition={{
                duration: 1,
                repeat: Infinity,
                repeatDelay: 0.5,
                ease: "easeInOut",
              }}
            >
              ☕
            </motion.span>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default AuthTransitionScreen;
