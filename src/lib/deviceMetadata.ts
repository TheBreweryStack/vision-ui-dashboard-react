/**
 * Device metadata utilities for capturing browser, OS, and device information
 * Used by push notification subscriptions to enrich device identification
 */

export interface DeviceMetadata {
  os: string;
  osVersion: string;
  browser: string;
  browserVersion: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  timezone: string;
  language: string;
  screenWidth: number;
  screenHeight: number;
}

/**
 * Detect the operating system from user agent
 */
function detectOS(ua: string): string {
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  if (/CrOS/.test(ua)) return 'Chrome OS';
  return 'Unknown';
}

/**
 * Detect OS version from user agent
 */
function detectOSVersion(ua: string): string {
  // iOS version
  const iosMatch = ua.match(/OS (\d+[._]\d+([._]\d+)?)/);
  if (iosMatch) return iosMatch[1].replace(/_/g, '.');

  // Android version
  const androidMatch = ua.match(/Android (\d+(\.\d+)?)/);
  if (androidMatch) return androidMatch[1];

  // macOS version
  const macMatch = ua.match(/Mac OS X (\d+[._]\d+([._]\d+)?)/);
  if (macMatch) return macMatch[1].replace(/_/g, '.');

  // Windows version
  const winMatch = ua.match(/Windows NT (\d+\.\d+)/);
  if (winMatch) {
    const version = winMatch[1];
    // Map NT versions to marketing versions
    const winVersions: Record<string, string> = {
      '10.0': '10/11',
      '6.3': '8.1',
      '6.2': '8',
      '6.1': '7',
    };
    return winVersions[version] || version;
  }

  return '';
}

/**
 * Detect browser from user agent
 */
function detectBrowser(ua: string): string {
  // Order matters - check more specific browsers first
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
  if (/Chrome\//.test(ua)) return 'Chrome';
  return 'Unknown';
}

/**
 * Detect browser version from user agent
 */
function detectBrowserVersion(ua: string): string {
  // Edge
  const edgeMatch = ua.match(/Edg\/(\d+(\.\d+)?)/);
  if (edgeMatch) return edgeMatch[1];

  // Firefox
  const firefoxMatch = ua.match(/Firefox\/(\d+(\.\d+)?)/);
  if (firefoxMatch) return firefoxMatch[1];

  // Safari - get the Safari version, not WebKit
  const safariMatch = ua.match(/Version\/(\d+(\.\d+)?)/);
  if (safariMatch && /Safari\//.test(ua)) return safariMatch[1];

  // Chrome
  const chromeMatch = ua.match(/Chrome\/(\d+(\.\d+)?)/);
  if (chromeMatch) return chromeMatch[1];

  // Opera
  const operaMatch = ua.match(/OPR\/(\d+(\.\d+)?)/);
  if (operaMatch) return operaMatch[1];

  return '';
}

/**
 * Detect device type based on screen size and user agent
 */
function detectDeviceType(ua: string): 'mobile' | 'tablet' | 'desktop' {
  // Check for mobile indicators in UA
  const isMobileUA = /iPhone|iPod|Android.*Mobile|webOS|BlackBerry|Opera Mini|IEMobile/.test(ua);
  const isTabletUA = /iPad|Android(?!.*Mobile)|Tablet/.test(ua);

  if (isMobileUA) return 'mobile';
  if (isTabletUA) return 'tablet';

  // Fallback to screen size
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  const minDimension = Math.min(screenWidth, screenHeight);

  if (minDimension < 600) return 'mobile';
  if (minDimension < 1024) return 'tablet';
  return 'desktop';
}

/**
 * Capture all device metadata for the current browser/device
 */
export function captureDeviceMetadata(): DeviceMetadata {
  const ua = navigator.userAgent;

  return {
    os: detectOS(ua),
    osVersion: detectOSVersion(ua),
    browser: detectBrowser(ua),
    browserVersion: detectBrowserVersion(ua),
    deviceType: detectDeviceType(ua),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
  };
}

/**
 * Generate a human-readable device label from metadata
 * e.g., "Safari on iOS 17.3" or "Chrome on Windows 11"
 */
export function generateDeviceLabel(metadata: DeviceMetadata): string {
  const browserPart = metadata.browserVersion 
    ? `${metadata.browser} ${metadata.browserVersion.split('.')[0]}` 
    : metadata.browser;
  
  const osPart = metadata.osVersion 
    ? `${metadata.os} ${metadata.osVersion.split('.')[0]}` 
    : metadata.os;

  return `${browserPart} on ${osPart}`;
}

/**
 * Get an emoji icon for the device/browser
 */
export function getDeviceIcon(metadata: DeviceMetadata): string {
  // OS-based icons
  if (metadata.os === 'iOS' || metadata.os === 'macOS') return '🍎';
  if (metadata.os === 'Android') return '🤖';
  if (metadata.os === 'Windows') return '🪟';
  if (metadata.os === 'Linux') return '🐧';

  // Fallback to device type
  if (metadata.deviceType === 'mobile') return '📱';
  if (metadata.deviceType === 'tablet') return '📱';
  return '💻';
}

/**
 * Get device type label
 */
export function getDeviceTypeLabel(deviceType: 'mobile' | 'tablet' | 'desktop'): string {
  switch (deviceType) {
    case 'mobile': return 'Mobile';
    case 'tablet': return 'Tablet';
    case 'desktop': return 'Desktop';
    default: return 'Unknown';
  }
}
