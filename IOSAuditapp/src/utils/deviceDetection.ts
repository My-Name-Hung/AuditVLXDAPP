/**
 * Device detection utility for iOS-only web app
 */

export const isIOSDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform.toLowerCase();
  
  // Check for iOS devices
  const isIOS = /iphone|ipad|ipod/.test(userAgent) || 
                (platform === 'macintel' && navigator.maxTouchPoints > 1); // iPad on iOS 13+
  
  return isIOS;
};

export const getDeviceInfo = () => {
  if (typeof window === 'undefined') return { isIOS: false, isMobile: false, isTablet: false };
  
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIOS = isIOSDevice();
  const isMobile = /mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  const isTablet = /ipad|android(?!.*mobile)|tablet/i.test(userAgent);
  
  return { isIOS, isMobile, isTablet };
};

