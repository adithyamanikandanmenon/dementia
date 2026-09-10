// ============================================================
// MemoryCare — Voice Service
// Thin wrapper over the Web Speech API (speechSynthesis).
// Never throws if unsupported; callers can check isSupported().
// ============================================================

import type { LanguageCode } from '@/types';

const BCP47: Record<LanguageCode, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  as: 'as-IN',
  bn: 'bn-IN',
};

export function isVoiceSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined'
  );
}

let currentLang: LanguageCode = 'en';
let enabled = true;
let voices: SpeechSynthesisVoice[] = [];
let listeningForVoices = false;

function refreshVoices(): void {
  if (!isVoiceSupported()) return;
  try { voices = window.speechSynthesis.getVoices(); } catch { voices = []; }
}

const onVoicesChanged = () => refreshVoices();

/** Starts voice discovery once the browser is ready; safe to call repeatedly. */
export function initializeVoiceService(): void {
  if (!isVoiceSupported()) return;
  refreshVoices();
  if (!listeningForVoices) {
    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
    listeningForVoices = true;
  }
}

/** Removes the module listener when the app provider unmounts. */
export function disposeVoiceService(): void {
  if (isVoiceSupported() && listeningForVoices) {
    window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
  }
  listeningForVoices = false;
}

export function configureVoice(lang: LanguageCode, isEnabled: boolean): void {
  currentLang = lang;
  enabled = isEnabled;
  initializeVoiceService();
}

function pickVoice(langTag: string): SpeechSynthesisVoice | undefined {
  refreshVoices();
  if (!voices.length) return undefined;
  // Prefer exact locale, then base language, then any.
  const base = langTag.split('-')[0].toLowerCase();
  return (
    voices.find((v) => v.lang.toLowerCase() === langTag.toLowerCase()) ||
    voices.find((v) => v.lang.toLowerCase() === base || v.lang.toLowerCase().startsWith(`${base}-`)) ||
    voices.find((v) => v.lang.toLowerCase() === 'en' || v.lang.toLowerCase().startsWith('en-'))
  );
}

/** Speak text. No-op (returns false) when disabled or unsupported. */
export function speak(text: string, langOverride?: LanguageCode, onError?: (message: string) => void): boolean {
  if (!enabled || !isVoiceSupported() || !text.trim()) return false;
  try {
    initializeVoiceService();
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const tag = BCP47[langOverride ?? currentLang] ?? 'en-IN';
    utter.lang = tag;
    utter.rate = 0.92; // gentle, unhurried pace for older listeners
    utter.pitch = 1;
    utter.volume = 1;
    const v = pickVoice(tag);
    if (v) utter.voice = v;
    utter.onerror = (event) => {
      // Cancelling a previous sentence to start a new one is intentional.
      if (event.error !== 'interrupted' && event.error !== 'canceled') onError?.('Voice reading could not start. Please try again.');
    };
    window.speechSynthesis.speak(utter);
    // Safari may leave a queued utterance paused after an interruption.
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    return true;
  } catch {
    onError?.('Voice reading could not start. Please try again.');
    return false;
  }
}

export function stopSpeaking(): void {
  if (isVoiceSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}
