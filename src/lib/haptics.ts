/**
 * Centralized haptic feedback utility for mobile interactions
 * Uses the Vibration API when available
 */
export const haptics = {
  /** Light tap - for navigation, minor selections (10ms) */
  light: () => navigator.vibrate?.(10),
  
  /** Medium tap - for button presses, confirmations (20ms) */
  medium: () => navigator.vibrate?.(20),
  
  /** Heavy tap - for important actions like add/delete (40ms) */
  heavy: () => navigator.vibrate?.(40),
  
  /** Success pattern - for completed actions ([10, 50, 20]ms) */
  success: () => navigator.vibrate?.([10, 50, 20]),
  
  /** Error pattern - for failures, warnings ([50, 30, 50]ms) */
  error: () => navigator.vibrate?.([50, 30, 50]),
  
  /** Threshold reached - for pull-to-refresh threshold (15ms) */
  threshold: () => navigator.vibrate?.(15),
};
