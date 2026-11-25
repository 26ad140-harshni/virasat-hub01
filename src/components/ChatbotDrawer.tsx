import { useState, useRef, useEffect, useMemo } from 'react';
import {
  ArrowUpRight,
  BookMarked,
  Globe,
  Languages,
  Loader2,
  Mic,
  MicOff,
  Palette,
  Play,
  RotateCcw,
  Send,
  Sliders,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../data/seedData';
import { askResearchAssistant, synthesizeSpeech, translatePassage } from '../lib/api';
import {
  getVoicesForLocale,
  playBase64WavAudio,
  speakText,
  startVoiceCaptureSession,
  stopSpeaking,
  updateActiveAudioRate,
  updateActiveAudioVolume,
  type VoiceCaptureHandle,
} from '../lib/scholarUtils';
import type { ChatLanguagePreference, ChatMessage, SupportedLanguage, TTSVoiceName } from '../types';

interface ChatbotDrawerProps {
  open: boolean;
  colorMode?: 'light' | 'dark';
  onClose: () => void;
  onOpenEntry: (entryId: string) => void;
}

type RoyalTheme = 'oxblood' | 'peacock' | 'navy' | 'forest';
type VoiceEngine = 'neural' | 'device';

const ROYAL_THEME_CLASS: Record<RoyalTheme, string> = {
  oxblood: 'royal-theme-oxblood',
  peacock: 'royal-theme-peacock',
  navy: 'royal-theme-navy',
  forest: 'royal-theme-forest',
};

const ROYAL_THEMES: Array<{ id: RoyalTheme; label: string; swatch: string }> = [
  { id: 'oxblood', label: 'Ivory', swatch: '#F4EDE1' },
  { id: 'forest', label: 'Champagne', swatch: '#DCC8AD' },
  { id: 'peacock', label: 'French Blue', swatch: '#7993AC' },
  { id: 'navy', label: 'Navy', swatch: '#22324B' },
];

const VOICE_PERSONAS: Array<{ id: TTSVoiceName; label: string; recommendedFor: string[] }> = [
  { id: 'Kore', label: 'Kore · Clear Studio', recommendedFor: ['en-IN', 'ta-IN', 'ml-IN'] },
  { id: 'Zephyr', label: 'Zephyr · Warm Lyrical', recommendedFor: ['hi-IN', 'te-IN'] },
  { id: 'Charon', label: 'Charon · Deep Scholarly', recommendedFor: ['kn-IN', 'en-IN'] },
  { id: 'Puck', label: 'Puck · Crisp Articulate', recommendedFor: ['ta-IN', 'hi-IN'] },
  { id: 'Fenrir', label: 'Fenrir · Resonant Bass', recommendedFor: ['kn-IN', 'te-IN'] },
];

const DEFAULT_NEURAL_VOICE_BY_LOCALE: Record<string, TTSVoiceName> = {
  'en-IN': 'Kore',
  'ta-IN': 'Kore',
  'hi-IN': 'Zephyr',
  'te-IN': 'Zephyr',
  'ml-IN': 'Kore',
  'kn-IN': 'Charon',
};

const STARTER_PROMPTS = [
  'How did the Uttaramerur Kudavolai ballot prevent electoral corruption?',
  'உத்திரமேரூர் குடவோலை தேர்தல் முறை எவ்வாறு செயல்பட்டது?',
  'अशोक के गिरनार शिलालेख XII में धम्म और सहिष्णुता का क्या संदेश है?',
  'Compare Krishnadevaraya’s Amuktamalyada port policies with Gupta civic guilds.',
];

const LOCALE_PREVIEW_SAMPLES: Record<string, string> = {
  'en-IN': 'Vanakkam and welcome to the Virasat Heritage Archive.',
  'ta-IN': 'வணக்கம், விராசத் வரலாற்று ஆவணக் காப்பகத்திற்கு உங்களை அன்புடன் வரவேற்கிறோம்.',
  'hi-IN': 'नमस्ते, विरासत ऐतिहासिक अभिलेखागार में आपका हार्दिक स्वागत है।',
  'te-IN': 'నమస్కారం, విరాసత్ చారిత్రక పురావస్తు సంగ్రహాలయానికి స్వాగతం.',
  'ml-IN': 'നമസ്കാരം, വിരാസത് ചരിത്ര ശേഖരത്തിലേക്ക് സ്വാഗതം.',
  'kn-IN': 'ನಮಸ್ಕಾರ, ವಿರಾಸತ್ ಐತಿಹಾಸಿಕ ಪತ್ರಾಗಾರಕ್ಕೆ ಸುಸ್ವಾಗತ.',
};

const SPEED_PRESETS = [
  { label: '0.75x', value: 0.75 },
  { label: '0.90x', value: 0.9 },
  { label: '1.00x', value: 1.0 },
  { label: '1.20x', value: 1.2 },
];

export function ChatbotDrawer({ open, colorMode = 'light', onClose, onOpenEntry }: ChatbotDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      text: 'Welcome to the Virasat Research Assistant. Ask in English, Tamil, Hindi, Telugu, Malayalam, Kannada, or another language. Enable HD Neural Voice for exact native pronunciation, or translate any reply below.',
      spokenText:
        'Welcome to the Virasat Research Assistant. You can ask questions in English, Tamil, Hindi, Telugu, Malayalam, Kannada, or other languages.',
      languageCode: 'en-IN',
      languageName: 'English',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [languagePref, setLanguagePref] = useState<ChatLanguagePreference>('auto');
  const [voiceEngine, setVoiceEngine] = useState<VoiceEngine>('neural');
  const [neuralVoiceByLocale, setNeuralVoiceByLocale] = useState<Record<string, TTSVoiceName>>(
    DEFAULT_NEURAL_VOICE_BY_LOCALE
  );
  const [deviceVoiceByLocale, setDeviceVoiceByLocale] = useState<Record<string, string>>({});
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [speechPitch, setSpeechPitch] = useState<number>(1.0);
  const [speechVolume, setSpeechVolume] = useState<number>(0.95);
  const [voicesVersion, setVoicesVersion] = useState<number>(0);
  const [autoSpeak, setAutoSpeak] = useState<boolean>(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [synthesizingMsgId, setSynthesizingMsgId] = useState<string | null>(null);
  const [ttsNotice, setTtsNotice] = useState<string | null>(null);
  const [isListeningMic, setIsListeningMic] = useState<boolean>(false);
  const [isTranscribingMic, setIsTranscribingMic] = useState<boolean>(false);
  const [messageTranslations, setMessageTranslations] = useState<
    Record<string, { langLabel: string; langCode: SupportedLanguage; speechLocale: string; text: string }>
  >({});
  const [translationErrors, setTranslationErrors] = useState<
    Record<string, { langCode: SupportedLanguage; message: string }>
  >({});
  const [translatingMsgId, setTranslatingMsgId] = useState<string | null>(null);
  const [royalTheme, setRoyalTheme] = useState<RoyalTheme>(colorMode === 'dark' ? 'navy' : 'oxblood');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const voiceCaptureRef = useRef<VoiceCaptureHandle | null>(null);
  const activeVoiceTypeRef = useRef<VoiceEngine>('neural');

  useEffect(() => {
    setRoyalTheme(colorMode === 'dark' ? 'navy' : 'oxblood');
  }, [colorMode]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const handleVoicesChanged = () => setVoicesVersion((v) => v + 1);
    handleVoicesChanged();
    window.speechSynthesis.addEventListener?.('voiceschanged', handleVoicesChanged);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', handleVoicesChanged);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      stopSpeaking();
      voiceCaptureRef.current?.stop();
      setIsListeningMic(false);
      setIsTranscribingMic(false);
      setSpeakingMsgId(null);
      setSynthesizingMsgId(null);
    }
  }, [messages, open]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      voiceCaptureRef.current?.stop();
    };
  }, []);

  const activeLocaleInfo = useMemo(() => {
    if (languagePref !== 'auto') {
      const selected = SUPPORTED_LANGUAGES.find((l) => l.code === languagePref);
      if (selected) {
        return { locale: selected.speechLocale, name: selected.label };
      }
    }
    const latestAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && m.languageCode);
    if (latestAssistant?.languageCode) {
      return {
        locale: latestAssistant.languageCode,
        name: latestAssistant.languageName || latestAssistant.languageCode,
      };
    }
    return { locale: 'en-IN', name: 'English' };
  }, [languagePref, messages]);

  const localeVoiceGroups = useMemo(() => {
    void voicesVersion;
    return getVoicesForLocale(activeLocaleInfo.locale);
  }, [activeLocaleInfo.locale, voicesVersion]);

  const activeNeuralVoice: TTSVoiceName =
    neuralVoiceByLocale[activeLocaleInfo.locale] ||
    DEFAULT_NEURAL_VOICE_BY_LOCALE[activeLocaleInfo.locale] ||
    'Kore';

  const activeDeviceVoiceURI = deviceVoiceByLocale[activeLocaleInfo.locale] || '';

  if (!open) return null;

  const resolveLocaleForMessage = (msg?: ChatMessage): { locale: string; name: string } => {
    if (languagePref !== 'auto') {
      const selected = SUPPORTED_LANGUAGES.find((l) => l.code === languagePref);
      if (selected) {
        return { locale: selected.speechLocale, name: selected.label };
      }
    }
    if (msg?.languageCode) {
      return {
        locale: msg.languageCode,
        name: msg.languageName || msg.languageCode,
      };
    }
    return { locale: 'en-IN', name: 'English' };
  };

  const speakWithDeviceVoice = (
    msg: ChatMessage,
    overrides?: { rate?: number; pitch?: number; volume?: number; voiceURI?: string }
  ) => {
    const { locale } = resolveLocaleForMessage(msg);
    const spokenPayload = msg.spokenText || msg.text;
    const rate = overrides?.rate ?? speechRate;
    const pitch = overrides?.pitch ?? speechPitch;
    const volume = overrides?.volume ?? speechVolume;
    const voiceURI = overrides?.voiceURI ?? (deviceVoiceByLocale[locale] || '');

    activeVoiceTypeRef.current = 'device';
    setSpeakingMsgId(msg.id);
    const started = speakText(
      spokenPayload,
      locale,
      { rate, pitch, volume, voiceURI: voiceURI || undefined },
      () => {
        setSpeakingMsgId((prev) => (prev === msg.id ? null : prev));
      }
    );
    if (!started) {
      setSpeakingMsgId(null);
      setTtsNotice('Browser SpeechSynthesis is unavailable in this browser.');
    }
  };

  const speakMessage = async (
    msg: ChatMessage,
    rateOverride?: number,
    engineOverride?: VoiceEngine
  ) => {
    const rawSpoken = (msg.spokenText || msg.text || '').trim();
    if (!rawSpoken) return;

    if (speakingMsgId === msg.id && rateOverride === undefined && engineOverride === undefined) {
      stopSpeaking();
      setSpeakingMsgId(null);
      return;
    }

    stopSpeaking();
    setTtsNotice(null);

    const activeRate = rateOverride ?? speechRate;
    const activeEngine = engineOverride ?? voiceEngine;
    const { locale, name } = resolveLocaleForMessage(msg);

    if (activeEngine === 'device') {
      speakWithDeviceVoice(msg, { rate: activeRate });
      return;
    }

    const chosenNeuralVoice =
      neuralVoiceByLocale[locale] || DEFAULT_NEURAL_VOICE_BY_LOCALE[locale] || activeNeuralVoice;

    setSynthesizingMsgId(msg.id);
    try {
      const result = await synthesizeSpeech({
        text: rawSpoken,
        languageCode: locale,
        languageName: name,
        voiceName: chosenNeuralVoice,
        pitch: speechPitch,
      });
      setSynthesizingMsgId((prev) => (prev === msg.id ? null : prev));
      activeVoiceTypeRef.current = 'neural';
      setSpeakingMsgId(msg.id);
      const started = playBase64WavAudio(
        result.audioBase64,
        { rate: activeRate, volume: speechVolume },
        () => {
          setSpeakingMsgId((prev) => (prev === msg.id ? null : prev));
        },
        () => {
          setSpeakingMsgId((prev) => (prev === msg.id ? null : prev));
          setTtsNotice('Audio playback was blocked or interrupted. Click Listen or try Device Voice.');
        }
      );
      if (!started) {
        setSpeakingMsgId(null);
      }
    } catch (error) {
      setSynthesizingMsgId((prev) => (prev === msg.id ? null : prev));
      setSpeakingMsgId(null);
      setTtsNotice(
        error instanceof Error
          ? error.message
          : 'HD Neural Voice could not be generated. You can switch to Device Voice.'
      );
    }
  };

  const handleSpeedChange = (newRate: number) => {
    const clamped = Math.min(1.5, Math.max(0.5, Number(newRate.toFixed(2))));
    setSpeechRate(clamped);
    if (speakingMsgId) {
      if (activeVoiceTypeRef.current === 'neural') {
        updateActiveAudioRate(clamped);
      } else {
        const currentMsg = messages.find((m) => m.id === speakingMsgId);
        if (currentMsg) {
          speakWithDeviceVoice(currentMsg, { rate: clamped });
        }
      }
    }
  };

  const handlePitchChange = (newPitch: number) => {
    const clamped = Math.min(1.3, Math.max(0.7, Number(newPitch.toFixed(2))));
    setSpeechPitch(clamped);
    if (speakingMsgId && activeVoiceTypeRef.current === 'device') {
      const currentMsg = messages.find((m) => m.id === speakingMsgId);
      if (currentMsg) {
        speakWithDeviceVoice(currentMsg, { pitch: clamped });
      }
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    const clamped = Math.min(1, Math.max(0, Number(newVolume.toFixed(2))));
    setSpeechVolume(clamped);
    if (speakingMsgId) {
      if (activeVoiceTypeRef.current === 'neural') {
        updateActiveAudioVolume(clamped);
      } else {
        const currentMsg = messages.find((m) => m.id === speakingMsgId);
        if (currentMsg) {
          speakWithDeviceVoice(currentMsg, { volume: clamped });
        }
      }
    }
  };

  const handleResetAcoustics = () => {
    handleSpeedChange(1.0);
    handlePitchChange(1.0);
    handleVolumeChange(0.95);
  };

  const handleTestVoice = async () => {
    const sampleText =
      LOCALE_PREVIEW_SAMPLES[activeLocaleInfo.locale] ||
      `Welcome to Virasat Hub in ${activeLocaleInfo.name}.`;
    await speakMessage({
      id: 'preview-voice',
      role: 'assistant',
      text: sampleText,
      spokenText: sampleText,
      languageCode: activeLocaleInfo.locale,
      languageName: activeLocaleInfo.name,
      timestamp: new Date().toISOString(),
    });
  };

  const handleTranslateMessage = async (msg: ChatMessage, targetLang: SupportedLanguage) => {
    const langMeta = SUPPORTED_LANGUAGES.find((l) => l.code === targetLang);
    if (!langMeta) return;
    setTranslatingMsgId(msg.id);
    setTranslationErrors((prev) => {
      const next = { ...prev };
      delete next[msg.id];
      return next;
    });
    try {
      const res = await translatePassage(`chat-${msg.id}`, msg.text, targetLang);
      setMessageTranslations((prev) => ({
        ...prev,
        [msg.id]: {
          langLabel: `${langMeta.label} · ${langMeta.nativeName}`,
          langCode: targetLang,
          speechLocale: langMeta.speechLocale,
          text: res.translatedText,
        },
      }));
    } catch (error) {
      setTranslationErrors((prev) => ({
        ...prev,
        [msg.id]: {
          langCode: targetLang,
          message: error instanceof Error ? error.message : 'Unable to translate message right now.',
        },
      }));
    } finally {
      setTranslatingMsgId((prev) => (prev === msg.id ? null : prev));
    }
  };

  const toggleMicInput = () => {
    if (isListeningMic) {
      voiceCaptureRef.current?.stop();
      setIsListeningMic(false);
      return;
    }

    setTtsNotice(null);
    const selectedLang = SUPPORTED_LANGUAGES.find((l) => l.code === languagePref);

    voiceCaptureRef.current = startVoiceCaptureSession({
      languageCode: selectedLang?.speechLocale || 'auto',
      languageName: selectedLang?.label,
      onStart: () => {
        setIsListeningMic(true);
        setIsTranscribingMic(false);
      },
      onTranscribing: () => {
        setIsListeningMic(false);
        setIsTranscribingMic(true);
      },
      onTranscript: (transcript) => {
        setInput((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
      },
      onError: (msg) => {
        setTtsNotice(msg);
      },
      onEnd: () => {
        setIsListeningMic(false);
        setIsTranscribingMic(false);
      },
    });
  };

  const sendQuestion = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);
    setTtsNotice(null);

    try {
      const historyPayload = nextHistory
        .filter((m) => !m.error)
        .map((m) => ({ role: m.role, text: m.text }));
      const res = await askResearchAssistant(trimmed, historyPayload, languagePref);
      const replyId = `a-${Date.now()}`;
      const replyMsg: ChatMessage = {
        id: replyId,
        role: 'assistant',
        text: res.answer,
        spokenText: res.spokenText,
        englishTranslation: res.englishTranslation,
        languageCode: res.detectedLanguageCode,
        languageName: res.detectedLanguageName,
        citations: res.citations,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, replyMsg]);
      if (autoSpeak && (res.spokenText || res.answer)) {
        void speakMessage(replyMsg, speechRate);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          text: '',
          error: error instanceof Error ? error.message : 'Unable to reach Research Assistant.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#22324B]/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Archival Research Assistant"
    >
      <div
        className={`w-full max-w-lg bg-[var(--royal-canvas)] border-l border-[var(--royal-border)] h-full flex flex-col shadow-2xl ${ROYAL_THEME_CLASS[royalTheme]}`}
      >
        <div className="royal-spectrum-bar" />

        {/* Variable-themed Imperial Header */}
        <div className="royal-workspace-header px-5 py-3.5 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold tracking-wide text-[var(--royal-header-text)]">
              Archival Research Assistant
            </h2>
            <p className="text-xs text-[var(--royal-header-subtext)] mt-0.5">
              Multilingual RAG citations &amp; crystal-clear HD voice narration
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              voiceCaptureRef.current?.stop();
              onClose();
            }}
            className="w-10 h-10 inline-flex items-center justify-center rounded border border-white/25 bg-white/10 text-[var(--royal-header-text)] hover:bg-white/20 cursor-pointer"
            aria-label="Close Research Assistant"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Royal Palette + Multilingual Voice Controls */}
        <div className="royal-workspace-alt px-5 py-3 border-b space-y-2.5">
          {/* Theme Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--royal-border)]">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium royal-text-primary">
              <Palette className="w-3.5 h-3.5" />
              <span>Royal Palette:</span>
            </span>
            <div className="flex items-center gap-1.5" role="group" aria-label="Select chatbot royal theme">
              {ROYAL_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setRoyalTheme(t.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded border transition-colors cursor-pointer ${
                    royalTheme === t.id
                      ? 'royal-btn-primary border-transparent'
                      : 'bg-[var(--royal-surface)] text-[var(--royal-text)] border-[var(--royal-border)] hover:opacity-90'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-[#534D41]/55"
                    style={{ backgroundColor: royalTheme === t.id ? '#B58A45' : t.swatch }}
                    aria-hidden="true"
                  />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Bot Language + Voice Clarity Engine */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-2 border-b border-[var(--royal-border)]">
            <label className="flex flex-col gap-1 text-[11px] font-medium text-[var(--royal-text)]">
              <span className="inline-flex items-center gap-1 royal-text-primary">
                <Globe className="w-3.5 h-3.5" />
                <span>Bot &amp; Voice Language</span>
              </span>
              <select
                value={languagePref}
                onChange={(e) => setLanguagePref(e.target.value as ChatLanguagePreference)}
                aria-label="Select chatbot response and voice language"
                className="bg-[var(--royal-surface)] border border-[var(--royal-border)] rounded px-2.5 py-1.5 text-xs text-[var(--royal-text)] focus:outline-none focus:border-[var(--royal-primary)] cursor-pointer"
              >
                <option value="auto">Auto (Match My Language)</option>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label} · {lang.nativeName}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-1 text-[11px] font-medium text-[var(--royal-text)]">
              <span className="inline-flex items-center gap-1 royal-text-primary">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Voice Clarity Engine</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setVoiceEngine('neural')}
                  className={`flex-1 px-2 py-1.5 text-[11px] font-medium rounded border transition-colors cursor-pointer ${
                    voiceEngine === 'neural'
                      ? 'royal-btn-primary border-transparent'
                      : 'bg-[var(--royal-surface)] text-[var(--royal-text-muted)] border-[var(--royal-border)]'
                  }`}
                >
                  HD Neural
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceEngine('device')}
                  className={`flex-1 px-2 py-1.5 text-[11px] font-medium rounded border transition-colors cursor-pointer ${
                    voiceEngine === 'device'
                      ? 'royal-btn-primary border-transparent'
                      : 'bg-[var(--royal-surface)] text-[var(--royal-text-muted)] border-[var(--royal-border)]'
                  }`}
                >
                  Device Voice
                </button>
              </div>
            </div>
          </div>

          {/* Locale-Specific Voice Selector + Auto-Speak */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end pb-2 border-b border-[var(--royal-border)]">
            <label className="flex flex-col gap-1 text-[11px] font-medium text-[var(--royal-text)]">
              <span className="inline-flex items-center justify-between gap-2 royal-text-primary">
                <span className="inline-flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>
                    {voiceEngine === 'neural' ? 'Neural Voice' : 'Device Locale Voice'} ({activeLocaleInfo.locale})
                  </span>
                </span>
                {voiceEngine === 'device' && (
                  <span className="text-[10px] text-[var(--royal-text-muted)]">
                    {localeVoiceGroups.exactMatches.length + localeVoiceGroups.languageMatches.length} matched
                  </span>
                )}
              </span>

              {voiceEngine === 'neural' ? (
                <select
                  value={activeNeuralVoice}
                  onChange={(e) =>
                    setNeuralVoiceByLocale((prev) => ({
                      ...prev,
                      [activeLocaleInfo.locale]: e.target.value as TTSVoiceName,
                    }))
                  }
                  aria-label={`Select neural voice for ${activeLocaleInfo.locale}`}
                  className="bg-[var(--royal-surface)] border border-[var(--royal-border)] rounded px-2.5 py-1.5 text-xs text-[var(--royal-text)] focus:outline-none focus:border-[var(--royal-primary)] cursor-pointer"
                >
                  {VOICE_PERSONAS.map((v) => {
                    const isRecommended = v.recommendedFor.includes(activeLocaleInfo.locale);
                    return (
                      <option key={v.id} value={v.id}>
                        {v.label}
                        {isRecommended ? ` · Recommended (${activeLocaleInfo.locale})` : ''}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <select
                  value={activeDeviceVoiceURI}
                  onChange={(e) => {
                    const nextURI = e.target.value;
                    setDeviceVoiceByLocale((prev) => ({
                      ...prev,
                      [activeLocaleInfo.locale]: nextURI,
                    }));
                    if (speakingMsgId && activeVoiceTypeRef.current === 'device') {
                      const currentMsg = messages.find((m) => m.id === speakingMsgId);
                      if (currentMsg) {
                        speakWithDeviceVoice(currentMsg, { voiceURI: nextURI });
                      }
                    }
                  }}
                  aria-label={`Select device voice for ${activeLocaleInfo.locale}`}
                  className="bg-[var(--royal-surface)] border border-[var(--royal-border)] rounded px-2.5 py-1.5 text-xs text-[var(--royal-text)] focus:outline-none focus:border-[var(--royal-primary)] cursor-pointer"
                >
                  <option value="">
                    Auto Best Match ({localeVoiceGroups.recommendedVoice?.name || activeLocaleInfo.locale})
                  </option>
                  {localeVoiceGroups.exactMatches.length > 0 && (
                    <optgroup label={`Exact ${activeLocaleInfo.locale} Voices`}>
                      {localeVoiceGroups.exactMatches.map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {localeVoiceGroups.languageMatches.length > 0 && (
                    <optgroup label={`Related ${activeLocaleInfo.locale.split('-')[0]} Voices`}>
                      {localeVoiceGroups.languageMatches.map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {localeVoiceGroups.fallbackVoices.length > 0 && (
                    <optgroup label="Other Installed Voices">
                      {localeVoiceGroups.fallbackVoices.map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              )}
            </label>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void handleTestVoice()}
                disabled={synthesizingMsgId === 'preview-voice'}
                title={`Preview ${activeLocaleInfo.locale} pronunciation`}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded border bg-[var(--royal-surface)] border-[var(--royal-border)] royal-text-primary hover:opacity-90 cursor-pointer disabled:opacity-60"
              >
                {synthesizingMsgId === 'preview-voice' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Play className="w-3 h-3" />
                )}
                <span>Test</span>
              </button>

              <button
                type="button"
                onClick={() => setAutoSpeak((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded border transition-colors cursor-pointer ${
                  autoSpeak
                    ? 'royal-btn-primary border-transparent'
                    : 'bg-[var(--royal-surface)] text-[var(--royal-text-muted)] border-[var(--royal-border)] hover:text-[var(--royal-text)]'
                }`}
              >
                {autoSpeak ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                <span>{autoSpeak ? 'Auto On' : 'Auto Off'}</span>
              </button>

              {speakingMsgId && (
                <button
                  type="button"
                  onClick={() => {
                    stopSpeaking();
                    setSpeakingMsgId(null);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded royal-btn-secondary cursor-pointer"
                >
                  <Square className="w-3 h-3" />
                  <span>Stop</span>
                </button>
              )}
            </div>
          </div>

          {voiceEngine === 'device' &&
            localeVoiceGroups.exactMatches.length + localeVoiceGroups.languageMatches.length === 0 && (
              <div className="px-2.5 py-1.5 rounded border border-[#B58A45]/60 bg-[var(--royal-surface)] text-[11px] text-[var(--royal-text-muted)] flex flex-wrap items-center justify-between gap-2">
                <span>
                  No {activeLocaleInfo.locale} voice is installed on this browser. Use HD Neural for exact native pronunciation.
                </span>
                <button
                  type="button"
                  onClick={() => setVoiceEngine('neural')}
                  className="font-semibold underline text-[var(--royal-accent)] cursor-pointer"
                >
                  Switch to HD Neural
                </button>
              </div>
            )}

          {/* Acoustic Tuning: Speed, Pitch & Volume */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium royal-text-primary">
                <Sliders className="w-3.5 h-3.5" />
                <span>Vocal Clarity Tuning</span>
              </span>

              <div className="flex items-center gap-1">
                {SPEED_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handleSpeedChange(preset.value)}
                    className={`px-1.5 py-0.5 text-[10px] font-mono rounded border transition-colors cursor-pointer ${
                      Math.abs(speechRate - preset.value) < 0.03
                        ? 'royal-btn-primary border-transparent'
                        : 'bg-[var(--royal-surface)] text-[var(--royal-text-muted)] border-[var(--royal-border)] hover:text-[var(--royal-text)]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleResetAcoustics}
                  title="Reset speed, pitch, and volume"
                  aria-label="Reset vocal speed, pitch, and volume to defaults"
                  className="inline-flex items-center justify-center p-1 rounded border bg-[var(--royal-surface)] border-[var(--royal-border)] text-[var(--royal-text-muted)] hover:text-[var(--royal-text)] cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <label className="flex flex-col gap-1 text-[11px] text-[var(--royal-text)]">
                <span className="flex items-center justify-between">
                  <span className="font-medium">Speed</span>
                  <span className="font-mono royal-text-secondary tabular-nums">{speechRate.toFixed(2)}x</span>
                </span>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={speechRate}
                  onChange={(e) => handleSpeedChange(Number(e.target.value))}
                  aria-label="Chatbot speaking speed slider"
                  style={{ accentColor: 'var(--royal-primary)' }}
                  className="w-full cursor-pointer"
                />
              </label>

              <label className="flex flex-col gap-1 text-[11px] text-[var(--royal-text)]">
                <span className="flex items-center justify-between">
                  <span className="font-medium">Pitch</span>
                  <span className="font-mono royal-text-secondary tabular-nums">
                    {speechPitch.toFixed(2)} {speechPitch <= 0.88 ? 'Deep' : speechPitch >= 1.12 ? 'Bright' : 'Natural'}
                  </span>
                </span>
                <input
                  type="range"
                  min="0.7"
                  max="1.3"
                  step="0.05"
                  value={speechPitch}
                  onChange={(e) => handlePitchChange(Number(e.target.value))}
                  aria-label="Chatbot vocal pitch slider"
                  style={{ accentColor: 'var(--royal-primary)' }}
                  className="w-full cursor-pointer"
                />
              </label>

              <label className="flex flex-col gap-1 text-[11px] text-[var(--royal-text)]">
                <span className="flex items-center justify-between">
                  <span className="font-medium">Volume</span>
                  <span className="font-mono royal-text-secondary tabular-nums">{Math.round(speechVolume * 100)}%</span>
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={speechVolume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  aria-label="Chatbot voice volume slider"
                  style={{ accentColor: 'var(--royal-primary)' }}
                  className="w-full cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Messages Thread */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {ttsNotice && (
            <div
              role="status"
              className="px-3.5 py-2.5 rounded border border-[#B58A45] bg-[var(--royal-surface-alt)] text-xs text-[var(--royal-text)] flex flex-wrap items-center justify-between gap-2"
            >
              <span>{ttsNotice}</span>
              {voiceEngine === 'neural' && (
                <button
                  type="button"
                  onClick={() => {
                    setVoiceEngine('device');
                    setTtsNotice(null);
                  }}
                  className="underline font-semibold text-[var(--royal-accent)] cursor-pointer"
                >
                  Use Device Voice
                </button>
              )}
            </div>
          )}

          {messages.length === 1 && (
            <div className="space-y-2 pb-2">
              <p className="text-xs font-medium royal-text-primary">
                Suggested multilingual inquiries
              </p>
              <div className="space-y-2">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendQuestion(prompt)}
                    className="w-full text-left px-3.5 py-2.5 text-xs royal-workspace-alt border rounded text-[var(--royal-text)] hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => {
            const isSpeakingThis = speakingMsgId === msg.id;
            const isSynthesizingThis = synthesizingMsgId === msg.id;
            return (
              <div
                key={msg.id}
                className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  style={
                    msg.role === 'user'
                      ? {
                          backgroundColor: 'var(--royal-user-bubble)',
                          color: 'var(--royal-user-bubble-text)',
                        }
                      : undefined
                  }
                  className={`max-w-[92%] rounded px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user' ? '' : 'royal-workspace-surface border'
                  }`}
                >
                  {msg.error ? (
                    <p className="text-xs text-[var(--royal-accent)] font-medium">
                      Service Notice: {msg.error}
                    </p>
                  ) : (
                    <div className="whitespace-pre-line">{msg.text}</div>
                  )}

                  {/* Visible English or On-Demand Translation Block */}
                  {msg.role === 'assistant' && !msg.error && (messageTranslations[msg.id] || msg.englishTranslation) && (
                    <div className="mt-3 p-3 rounded border border-[var(--royal-border)] bg-[var(--royal-surface-alt)] space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold royal-text-accent">
                        <span className="inline-flex items-center gap-1">
                          <Languages className="w-3.5 h-3.5" />
                          <span>
                            Translation ·{' '}
                            {messageTranslations[msg.id]?.langLabel || 'English'}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const trans = messageTranslations[msg.id];
                            void speakMessage({
                              ...msg,
                              id: `${msg.id}-trans`,
                              text: trans ? trans.text : msg.englishTranslation || '',
                              spokenText: trans ? trans.text : msg.englishTranslation || '',
                              languageCode: trans ? trans.speechLocale : 'en-IN',
                              languageName: trans ? trans.langLabel : 'English',
                            });
                          }}
                          className="inline-flex items-center gap-1 underline font-medium royal-text-primary cursor-pointer"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>Speak Translation</span>
                        </button>
                      </div>
                      <p className="text-xs leading-relaxed text-[var(--royal-text)] whitespace-pre-line">
                        {messageTranslations[msg.id]?.text || msg.englishTranslation}
                      </p>
                    </div>
                  )}

                  {msg.role === 'assistant' && !msg.error && translationErrors[msg.id] && (
                    <div className="mt-2.5 p-2.5 rounded border border-[#B58A45] bg-[var(--royal-surface-alt)] text-[11px] text-[var(--royal-text)] flex flex-wrap items-center justify-between gap-2">
                      <span>{translationErrors[msg.id].message}</span>
                      <button
                        type="button"
                        onClick={() => void handleTranslateMessage(msg, translationErrors[msg.id].langCode)}
                        className="underline font-semibold text-[var(--royal-accent)] cursor-pointer"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {msg.role === 'assistant' && !msg.error && msg.text && (
                    <div className="mt-2.5 pt-2 border-t border-[var(--royal-border)] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isSynthesizingThis}
                          onClick={() => void speakMessage(msg)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded border transition-colors cursor-pointer disabled:opacity-60 ${
                            isSpeakingThis
                              ? 'royal-btn-secondary border-transparent'
                              : 'royal-workspace-alt royal-text-primary hover:opacity-90'
                          }`}
                        >
                          {isSynthesizingThis ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Preparing Clear Voice...</span>
                            </>
                          ) : isSpeakingThis ? (
                            <>
                              <Square className="w-3 h-3" />
                              <span>Stop Voice</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3" />
                              <span>
                                Listen ({speechRate.toFixed(2)}x · {voiceEngine === 'neural' ? 'HD' : 'Device'})
                              </span>
                            </>
                          )}
                        </button>

                        <div className="inline-flex items-center gap-1">
                          <Languages className="w-3 h-3 royal-text-secondary" />
                          <select
                            aria-label="Translate this response"
                            value={messageTranslations[msg.id]?.langCode || ''}
                            disabled={translatingMsgId === msg.id}
                            onChange={(e) => {
                              const code = e.target.value as SupportedLanguage;
                              if (code) void handleTranslateMessage(msg, code);
                            }}
                            className="bg-[var(--royal-surface-alt)] border border-[var(--royal-border)] rounded px-1.5 py-1 text-[11px] text-[var(--royal-text)] cursor-pointer"
                          >
                            <option value="">
                              {translatingMsgId === msg.id ? 'Translating...' : 'Translate...'}
                            </option>
                            {SUPPORTED_LANGUAGES.map((lang) => (
                              <option key={lang.code} value={lang.code}>
                                {lang.label} ({lang.nativeName})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <span className="text-[11px] text-[var(--royal-text-muted)]">
                        {msg.languageName || 'English'}
                        {msg.languageCode ? ` · ${msg.languageCode}` : ''}
                      </span>
                    </div>
                  )}

                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[var(--royal-border)] space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium royal-text-accent">
                        <BookMarked className="w-3.5 h-3.5" />
                        <span>Cited Archive Monographs</span>
                      </div>
                      <div className="space-y-1">
                        {msg.citations.map((cit) => (
                          <button
                            key={cit.entryId}
                            type="button"
                            onClick={() => {
                              onOpenEntry(cit.entryId);
                              onClose();
                            }}
                            className="w-full flex items-center justify-between gap-2 text-left px-2.5 py-1.5 rounded royal-workspace-alt border text-xs text-[var(--royal-text)] hover:opacity-90 transition-opacity cursor-pointer"
                          >
                            <span className="truncate">
                              <span className="font-mono royal-text-secondary mr-1.5">
                                {cit.accessionNo}
                              </span>
                              {cit.title}
                            </span>
                            <ArrowUpRight className="w-3.5 h-3.5 shrink-0 royal-text-primary" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-2 text-xs royal-text-primary">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Retrieving archival citations and preparing multilingual narration...</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Form + Multilingual Voice Microphone */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendQuestion(input);
          }}
          className="royal-workspace-alt p-4 border-t flex items-center gap-2"
        >
          <button
            type="button"
            onClick={toggleMicInput}
            disabled={isTranscribingMic}
            aria-label={isListeningMic ? 'Stop voice input' : 'Speak question with microphone'}
            title={
              isTranscribingMic
                ? 'Transcribing speech...'
                : isListeningMic
                ? 'Listening — click to stop'
                : 'Speak question in Tamil, Hindi, English, or any language'
            }
            className={`inline-flex items-center justify-center px-3 py-2.5 rounded border transition-colors cursor-pointer min-h-[42px] disabled:opacity-60 ${
              isListeningMic
                ? 'royal-btn-secondary border-transparent animate-pulse'
                : 'bg-[var(--royal-surface)] border-[var(--royal-border)] royal-text-primary hover:opacity-85'
            }`}
          >
            {isTranscribingMic ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isListeningMic ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isTranscribingMic
                ? 'Transcribing your voice...'
                : isListeningMic
                ? 'Listening — speak now...'
                : 'Ask in English, Tamil, Hindi, Telugu, Malayalam, Kannada...'
            }
            className="flex-1 bg-[var(--royal-surface)] border border-[var(--royal-border)] rounded px-3.5 py-2.5 text-sm text-[var(--royal-text)] placeholder:text-[var(--royal-text-muted)]/70 focus:outline-none focus:border-[var(--royal-primary)]"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="royal-btn-primary inline-flex items-center justify-center px-4 py-2.5 text-xs font-medium rounded disabled:opacity-45 transition-colors cursor-pointer min-h-[42px]"
            aria-label="Send inquiry"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
