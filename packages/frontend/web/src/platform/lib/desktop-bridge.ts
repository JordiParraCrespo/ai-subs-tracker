import type { DesktopBridge } from '@flama/shared/desktop';

declare global {
  interface Window {
    /** Exposed by the Subtrack desktop app's preload script; absent in a browser. */
    subtrack?: DesktopBridge;
  }
}

/**
 * The desktop shell, when these screens run inside it. One build serves both:
 * in a browser this is undefined and every local feature (reading logins on
 * this machine, switching the terminal's account) is simply not offered.
 */
export const desktopBridge: DesktopBridge | undefined =
  typeof window === 'undefined' ? undefined : window.subtrack;
