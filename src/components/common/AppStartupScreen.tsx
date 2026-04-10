import React from 'react';
import { motion } from 'framer-motion';
import appIcon from '@/assets/app-icon.png';

interface AppStartupScreenProps {
  isUpdating?: boolean;
}

// Coffee cup filling animation component (simplified version)
const CoffeeCupFilling: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.3, duration: 0.4 }}
    className="relative mt-8 pt-4 overflow-hidden"
  >
    {/* Steam above cup */}
    <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-12 z-0">
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
    <svg width="48" height="42" viewBox="0 0 64 56" className="relative z-10 overflow-visible">
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
        <clipPath id="startupCupClip">
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
        clipPath="url(#startupCupClip)"
        initial={{ y: 50 }}
        animate={{ y: 14 }}
        transition={{
          duration: 2,
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
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
          times: [0, 0.4, 0.9, 1],
        }}
      />
    </svg>
  </motion.div>
);

const AppStartupScreen: React.FC<AppStartupScreenProps> = ({ isUpdating = false }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center overflow-hidden"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.3, ease: "easeOut" }}
        className="flex flex-col items-center z-10"
      >
        {/* Logo with pulse animation */}
        <motion.div
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="relative mb-4"
        >
          <img 
            src={appIcon} 
            alt="TraderCafé" 
            className="w-20 h-20 rounded-2xl shadow-xl"
          />
          {/* Glow effect */}
          <motion.div
            animate={{ 
              opacity: [0.2, 0.4, 0.2],
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl -z-10"
          />
        </motion.div>

        {/* Status text */}
        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="text-sm text-muted-foreground text-center"
        >
          {isUpdating ? 'Updating...' : 'Checking for updates...'}
        </motion.p>

        {/* Coffee cup animation */}
        <CoffeeCupFilling />
      </motion.div>
    </motion.div>
  );
};

export default AppStartupScreen;
