import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CoffeeCupWidgetProps {
  progress: number; // 0-100
  weeklyGoal: number;
  currentPnl: number;
  consecutiveLosses?: number; // Number of consecutive losing trades
}

// Confetti Particle Component
const ConfettiParticle: React.FC<{ 
  index: number; 
  color: string;
}> = ({ index, color }) => {
  const startX = 10 + Math.random() * 80; // Random start position
  const endX = startX + (Math.random() - 0.5) * 40; // Drift left or right
  const duration = 2 + Math.random() * 1.5;
  const delay = Math.random() * 0.5;
  const size = 4 + Math.random() * 4;
  const rotation = Math.random() * 360;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: `${startX}%`,
        top: '-5%',
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
        transform: `rotate(${rotation}deg)`,
      }}
      initial={{ y: 0, x: 0, opacity: 1, scale: 1, rotate: 0 }}
      animate={{ 
        y: [0, 150, 200],
        x: [0, (Math.random() - 0.5) * 60],
        opacity: [1, 1, 0],
        scale: [1, 0.8, 0.5],
        rotate: [0, rotation + 180, rotation + 360],
      }}
      transition={{ 
        duration, 
        delay,
        ease: 'easeOut',
        repeat: Infinity,
        repeatDelay: 3,
      }}
    />
  );
};

const CoffeeCupWidget: React.FC<CoffeeCupWidgetProps> = ({ 
  progress, 
  weeklyGoal, 
  currentPnl,
  consecutiveLosses = 0 
}) => {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const isGoalMet = progress >= 100;
  const isAlmostThere = clampedProgress >= 90 && clampedProgress < 100;
  const isNegative = currentPnl < 0;
  const lossPercentage = weeklyGoal > 0 ? Math.abs(currentPnl) / weeklyGoal * 100 : 0;
  const [showConfetti, setShowConfetti] = useState(false);

  // Trigger confetti when goal is met
  useEffect(() => {
    if (isGoalMet) {
      setShowConfetti(true);
    }
  }, [isGoalMet]);

  const getMessage = () => {
    if (isGoalMet) {
      const messages = [
        "Goal hit! Don't give back gains! 🎉",
        "Take the money and run! 💰",
        "Weekly goal smashed! 🏆",
      ];
      return messages[Math.floor(Math.random() * messages.length)];
    }
    
    // Handle negative P&L with tiered messaging
    if (isNegative) {
      // 3+ consecutive losses - show warning
      if (consecutiveLosses >= 3) {
        return "Take a break, review & refocus";
      }
      // Large loss (>50% of weekly goal) - encourage but cautious
      if (lossPercentage > 50) {
        return "Tough day. Review your setups 📝";
      }
      // Medium loss (25-50% of weekly goal) - supportive
      if (lossPercentage > 25) {
        return "Part of the game. Stay disciplined!";
      }
      // Small loss (<25% of weekly goal) - encouraging
      return "Small setback, you've got this! 💪";
    }
    
    if (clampedProgress >= 75) return "Almost there!";
    if (clampedProgress >= 50) return "Halfway! Keep brewing ☕";
    if (clampedProgress >= 25) return "Making progress!";
    return "Fresh week, let's go!";
  };
  
  // Determine if we should show the loss styling (only for significant losses or streaks)
  const showLossStyling = isNegative && (consecutiveLosses >= 3 || lossPercentage > 50);

  // Coffee colors - always brown, never green
  const coffeeColorLight = showLossStyling ? "hsl(var(--destructive))" : "hsl(25 60% 35%)";
  const coffeeColorMid = showLossStyling ? "hsl(var(--destructive))" : "hsl(25 55% 40%)";
  const coffeeColorDark = showLossStyling ? "hsl(var(--destructive))" : "hsl(25 50% 30%)";

  // Confetti colors
  const confettiColors = [
    'hsl(35 80% 55%)', // Gold
    'hsl(25 70% 45%)', // Coffee brown
    'hsl(45 90% 60%)', // Yellow
    'hsl(15 80% 50%)', // Orange
    'hsl(var(--primary))', // Theme primary
  ];

  return (
    <div className="stat-card relative overflow-hidden h-full">
      {/* Confetti overlay when goal is met */}
      <AnimatePresence>
        {showConfetti && isGoalMet && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
            {Array.from({ length: 20 }).map((_, i) => (
              <ConfettiParticle 
                key={i} 
                index={i} 
                color={confettiColors[i % confettiColors.length]} 
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-2 md:mb-3">
        <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">Weekly Goal</span>
        {isGoalMet && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-lg"
          >
            🎉
          </motion.span>
        )}
      </div>
      
      <div className="flex items-center gap-2 md:gap-4">
        {/* Coffee Cup - responsive sizing */}
        <div className="relative w-12 h-16 md:w-20 md:h-24 shrink-0">
          <svg viewBox="0 0 80 100" className="w-full h-full">
            <defs>
              {/* Coffee gradient - always brown (or red for loss) */}
              <linearGradient id="coffeeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={coffeeColorLight} stopOpacity="1" />
                <stop offset="50%" stopColor={coffeeColorMid} stopOpacity="0.85" />
                <stop offset="100%" stopColor={coffeeColorDark} stopOpacity="0.7" />
              </linearGradient>
              
              {/* Crema/foam gradient */}
              <linearGradient id="cremaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(35 70% 65%)" stopOpacity="0.95" />
                <stop offset="50%" stopColor="hsl(30 60% 55%)" stopOpacity="0.9" />
                <stop offset="100%" stopColor="hsl(25 55% 45%)" stopOpacity="0.85" />
              </linearGradient>

              {/* Bubble pattern */}
              <pattern id="bubbles" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <motion.circle
                  cx="5"
                  cy="15"
                  r="2"
                  fill="hsl(var(--background))"
                  fillOpacity="0.3"
                  animate={{ cy: [15, 5, 15], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.circle
                  cx="15"
                  cy="10"
                  r="1.5"
                  fill="hsl(var(--background))"
                  fillOpacity="0.2"
                  animate={{ cy: [10, 2, 10], opacity: [0.2, 0.5, 0.2] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                />
              </pattern>
              
              {/* Cup clip path */}
              <clipPath id="cupClip">
                <path d="M12 22 L12 78 Q12 88 22 88 L48 88 Q58 88 58 78 L58 22 Z" />
              </clipPath>
            </defs>
            
            {/* Cup body */}
            <path
              d="M10 20 L10 80 Q10 90 20 90 L50 90 Q60 90 60 80 L60 20 Z"
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth="3"
            />
            
            {/* Cup handle */}
            <path
              d="M60 30 Q75 30 75 50 Q75 70 60 70"
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth="3"
            />
            
            {/* Coffee fill with wave animation */}
            <g clipPath="url(#cupClip)">
              {/* Base coffee layer */}
              <motion.rect
                x="12"
                y="88"
                width="46"
                height="66"
                fill="url(#coffeeGradient)"
                initial={{ y: 88 }}
                animate={{ y: 88 - (clampedProgress / 100) * 66 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
              
              {/* Animated sloshing layer - creates light/dark movement */}
              {clampedProgress > 5 && !showLossStyling && (
                <motion.rect
                  x="12"
                  y="88"
                  width="46"
                  height="66"
                  fill="hsl(25 65% 40%)"
                  opacity="0.3"
                  initial={{ y: 88 }}
                  animate={{ 
                    y: 88 - (clampedProgress / 100) * 66,
                    x: [12, 14, 10, 14, 12]
                  }}
                  transition={{ 
                    y: { duration: 1.2, ease: "easeOut" },
                    x: { duration: 3, repeat: Infinity, ease: "easeInOut" }
                  }}
                />
              )}
              
              {/* Second sloshing layer - opposite phase */}
              {clampedProgress > 10 && !showLossStyling && (
                <motion.rect
                  x="12"
                  y="88"
                  width="46"
                  height="66"
                  fill="hsl(25 50% 28%)"
                  opacity="0.25"
                  initial={{ y: 88 }}
                  animate={{ 
                    y: 88 - (clampedProgress / 100) * 66,
                    x: [12, 10, 14, 10, 12]
                  }}
                  transition={{ 
                    y: { duration: 1.2, ease: "easeOut" },
                    x: { duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }
                  }}
                />
              )}
              
              {/* Animated wave on top of coffee */}
              {clampedProgress > 0 && (
                <motion.path
                  d={`M12 ${88 - (clampedProgress / 100) * 66} Q23 ${86 - (clampedProgress / 100) * 66} 35 ${88 - (clampedProgress / 100) * 66} Q47 ${90 - (clampedProgress / 100) * 66} 58 ${88 - (clampedProgress / 100) * 66} L58 90 L12 90 Z`}
                  fill="url(#coffeeGradient)"
                  animate={{
                    d: [
                      `M12 ${88 - (clampedProgress / 100) * 66} Q23 ${86 - (clampedProgress / 100) * 66} 35 ${88 - (clampedProgress / 100) * 66} Q47 ${90 - (clampedProgress / 100) * 66} 58 ${88 - (clampedProgress / 100) * 66} L58 90 L12 90 Z`,
                      `M12 ${88 - (clampedProgress / 100) * 66} Q23 ${90 - (clampedProgress / 100) * 66} 35 ${88 - (clampedProgress / 100) * 66} Q47 ${86 - (clampedProgress / 100) * 66} 58 ${88 - (clampedProgress / 100) * 66} L58 90 L12 90 Z`,
                      `M12 ${88 - (clampedProgress / 100) * 66} Q23 ${86 - (clampedProgress / 100) * 66} 35 ${88 - (clampedProgress / 100) * 66} Q47 ${90 - (clampedProgress / 100) * 66} 58 ${88 - (clampedProgress / 100) * 66} L58 90 L12 90 Z`,
                    ]
                  }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              
              {/* Crema/foam layer on top of coffee */}
              {clampedProgress > 5 && !showLossStyling && (
                <motion.ellipse
                  cx="35"
                  rx="22"
                  ry="3"
                  fill="url(#cremaGradient)"
                  initial={{ cy: 88, opacity: 0 }}
                  animate={{ 
                    cy: 88 - (clampedProgress / 100) * 66 - 1,
                    opacity: 1 
                  }}
                  transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
                />
              )}
              
              {/* White foam layer when goal is met - latte art style */}
              {isGoalMet && !showLossStyling && (
                <motion.g>
                  {/* Main white foam ellipse */}
                  <motion.ellipse
                    cx="35"
                    cy={88 - 66 - 2}
                    rx="20"
                    ry="4"
                    fill="white"
                    fillOpacity="0.95"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 0.95, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                  />
                  {/* Secondary foam layer for depth */}
                  <motion.ellipse
                    cx="35"
                    cy={88 - 66 - 1}
                    rx="18"
                    ry="3"
                    fill="white"
                    fillOpacity="0.8"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 0.8, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.4 }}
                  />
                  {/* Small foam bubbles for texture */}
                  <motion.circle 
                    cx="25" 
                    cy={88 - 66 + 1} 
                    r="2.5" 
                    fill="white" 
                    fillOpacity="0.85"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.85 }}
                    transition={{ delay: 0.5 }}
                  />
                  <motion.circle 
                    cx="35" 
                    cy={88 - 66} 
                    r="2" 
                    fill="white" 
                    fillOpacity="0.9"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.9 }}
                    transition={{ delay: 0.55 }}
                  />
                  <motion.circle 
                    cx="45" 
                    cy={88 - 66 + 1} 
                    r="2.2" 
                    fill="white" 
                    fillOpacity="0.8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.8 }}
                    transition={{ delay: 0.6 }}
                  />
                  <motion.circle 
                    cx="30" 
                    cy={88 - 66 - 1} 
                    r="1.5" 
                    fill="white" 
                    fillOpacity="0.75"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.75 }}
                    transition={{ delay: 0.65 }}
                  />
                  <motion.circle 
                    cx="40" 
                    cy={88 - 66 - 1} 
                    r="1.8" 
                    fill="white" 
                    fillOpacity="0.7"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.7 }}
                    transition={{ delay: 0.7 }}
                  />
                </motion.g>
              )}
              
              {/* Rising bubbles inside coffee */}
              {clampedProgress > 10 && (
                <>
                  <motion.circle
                    cx="25"
                    r="2.5"
                    fill="hsl(var(--background))"
                    fillOpacity="0.25"
                    initial={{ cy: 85, opacity: 0 }}
                    animate={{ 
                      cy: [85, 88 - (clampedProgress / 100) * 66 + 5], 
                      opacity: [0, 0.4, 0] 
                    }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
                  />
                  <motion.circle
                    cx="40"
                    r="2"
                    fill="hsl(var(--background))"
                    fillOpacity="0.2"
                    initial={{ cy: 85, opacity: 0 }}
                    animate={{ 
                      cy: [85, 88 - (clampedProgress / 100) * 66 + 8], 
                      opacity: [0, 0.35, 0] 
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.7 }}
                  />
                  <motion.circle
                    cx="32"
                    r="1.5"
                    fill="hsl(var(--background))"
                    fillOpacity="0.2"
                    initial={{ cy: 85, opacity: 0 }}
                    animate={{ 
                      cy: [85, 88 - (clampedProgress / 100) * 66 + 10], 
                      opacity: [0, 0.3, 0] 
                    }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 1.2 }}
                  />
                </>
              )}
            </g>
            
            {/* Light steam - show when progress 25-50% */}
            {clampedProgress > 25 && clampedProgress <= 50 && (
              <>
                <motion.path
                  d="M24 14 Q28 8 24 2"
                  fill="none"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth="2"
                  strokeLinecap="round"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ 
                    opacity: [0, 0.4, 0], 
                    y: [4, -4, -12] 
                  }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                />
                <motion.path
                  d="M35 12 Q39 6 35 0"
                  fill="none"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth="2"
                  strokeLinecap="round"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ 
                    opacity: [0, 0.4, 0], 
                    y: [4, -4, -12] 
                  }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut", delay: 0.6 }}
                />
                <motion.path
                  d="M46 14 Q50 8 46 2"
                  fill="none"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth="2"
                  strokeLinecap="round"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ 
                    opacity: [0, 0.4, 0], 
                    y: [4, -4, -12] 
                  }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 1.1 }}
                />
              </>
            )}
            
            {/* Wispy steam - show when progress > 50% (hot coffee) */}
            {clampedProgress > 50 && (
              <>
                {/* Left wisp - organic S-curve */}
                <motion.path
                  d="M22 16 Q18 10 22 4 Q20 -2 24 -8"
                  fill="none"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  initial={{ opacity: 0, y: 6, scale: 0.8 }}
                  animate={{ 
                    opacity: [0, isGoalMet ? 0.6 : 0.45, isGoalMet ? 0.4 : 0.25, 0], 
                    y: [6, 0, -8, -16],
                    scale: [0.8, 1, 1.1, 1.15]
                  }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeOut" }}
                />
                
                {/* Left-center wisp */}
                <motion.path
                  d="M28 14 Q32 8 28 2 Q30 -4 26 -10"
                  fill="none"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  initial={{ opacity: 0, y: 5, x: 0 }}
                  animate={{ 
                    opacity: [0, isGoalMet ? 0.55 : 0.4, isGoalMet ? 0.35 : 0.2, 0], 
                    y: [5, -2, -10, -18],
                    x: [0, 1, -1, 0]
                  }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
                />
                
                {/* Center wisp - main steam */}
                <motion.path
                  d="M35 12 Q38 6 34 0 Q37 -6 33 -12"
                  fill="none"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth="2"
                  strokeLinecap="round"
                  initial={{ opacity: 0, y: 4, scale: 0.85 }}
                  animate={{ 
                    opacity: [0, isGoalMet ? 0.7 : 0.5, isGoalMet ? 0.45 : 0.3, 0], 
                    y: [4, -4, -12, -20],
                    scale: [0.85, 1, 1.1, 1.2]
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeOut", delay: 0.2 }}
                />
                
                {/* Right-center wisp */}
                <motion.path
                  d="M42 14 Q38 8 42 2 Q40 -4 44 -10"
                  fill="none"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  initial={{ opacity: 0, y: 5, x: 0 }}
                  animate={{ 
                    opacity: [0, isGoalMet ? 0.55 : 0.4, isGoalMet ? 0.35 : 0.2, 0], 
                    y: [5, -2, -10, -18],
                    x: [0, -1, 1, 0]
                  }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut", delay: 0.7 }}
                />
                
                {/* Right wisp - organic S-curve */}
                <motion.path
                  d="M48 16 Q52 10 48 4 Q50 -2 46 -8"
                  fill="none"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  initial={{ opacity: 0, y: 6, scale: 0.8 }}
                  animate={{ 
                    opacity: [0, isGoalMet ? 0.6 : 0.45, isGoalMet ? 0.4 : 0.25, 0], 
                    y: [6, 0, -8, -16],
                    scale: [0.8, 1, 1.1, 1.15]
                  }}
                  transition={{ duration: 2.7, repeat: Infinity, ease: "easeOut", delay: 0.9 }}
                />
                
                {/* Extra wisp for goal met - more intense steam */}
                {isGoalMet && (
                  <motion.path
                    d="M35 10 Q40 4 35 -2 Q38 -8 34 -14 Q36 -18 32 -22"
                    fill="none"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ 
                      opacity: [0, 0.5, 0.3, 0], 
                      y: [4, -6, -14, -22]
                    }}
                    transition={{ duration: 3.2, repeat: Infinity, ease: "easeOut", delay: 1.2 }}
                  />
                )}
              </>
            )}
          </svg>
        </div>
        
        {/* Stats on the right */}
        <div className="flex-1 min-w-0">
          {/* Progress percentage */}
          <p className={cn(
            "text-xl md:text-2xl font-bold tracking-tight",
            isGoalMet ? "text-profit" : showLossStyling ? "text-loss" : "text-foreground"
          )}>
            {Math.round(clampedProgress)}%
          </p>
          
          {/* P&L amount */}
          <div className="flex items-baseline gap-1 md:gap-2 mt-0.5 md:mt-1 flex-wrap">
            <span className={cn(
              "text-[11px] md:text-sm font-semibold truncate",
              currentPnl >= 0 ? "text-profit" : "text-loss"
            )}>
              {currentPnl >= 0 ? '+' : ''}${Math.abs(currentPnl).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
            <span className="text-[9px] md:text-xs text-muted-foreground whitespace-nowrap">/ ${weeklyGoal}</span>
          </div>

          {/* Progress bar */}
          <div className="mt-2 md:mt-3 h-1 md:h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div 
              className={cn(
                "h-full rounded-full",
                isGoalMet 
                  ? "bg-gradient-to-r from-profit to-profit/70" 
                  : showLossStyling 
                    ? "bg-gradient-to-r from-loss to-loss/70"
                    : "bg-gradient-to-r from-amber-700 to-amber-600"
              )}
              initial={{ width: 0 }}
              animate={{ width: `${clampedProgress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>

          {/* Message - show for goal met, losses, or good progress */}
          {(isGoalMet || isNegative || clampedProgress >= 50) && (
            <motion.p 
              className={cn(
                "text-xs mt-2 font-medium",
                isGoalMet ? "text-profit" : showLossStyling ? "text-loss" : "text-muted-foreground"
              )}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {getMessage()}
            </motion.p>
          )}
        </div>
      </div>

      {/* Anticipation glow when almost at goal (90-99%) */}
      {isAlmostThere && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-xl"
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: [0, 0.12, 0.08, 0.15, 0],
            scale: [1, 1.01, 1, 1.01, 1]
          }}
          transition={{ 
            duration: 2.5, 
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{
            background: 'radial-gradient(circle at center, hsl(35 70% 50% / 0.25) 0%, hsl(25 60% 40% / 0.1) 40%, transparent 70%)',
          }}
        />
      )}

      {/* Subtle glow when goal is met - golden instead of primary */}
      {isGoalMet && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.2, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            background: 'radial-gradient(circle at top right, hsl(45 90% 50% / 0.25) 0%, transparent 60%)',
          }}
        />
      )}
    </div>
  );
};

export default CoffeeCupWidget;
