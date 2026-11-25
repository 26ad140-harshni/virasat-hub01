import { transcribeVoiceAudio } from './api';
import type { ArchiveEntry } from '../types';

export function formatCitationAPA(entry: ArchiveEntry): string {
  return `${entry.citationAuthor}. (${entry.displayDate}). ${entry.title}: ${entry.subtitle} [${entry.category}; ${entry.material}]. ${entry.repository}. Accession ${entry.accessionNo}.`;
}

export function formatCitationChicago(entry: ArchiveEntry): string {
  return `${entry.citationAuthor}. "${entry.title}." ${entry.displayDate}. ${entry.material}, ${entry.dimensions}. ${entry.provenance}. ${entry.repository} (${entry.accessionNo}).`;
}

/**
 * Normalizes written archival text into cleaner spoken phrasing so both
 * neural TTS and browser SpeechSynthesis pronounce citations and punctuation naturally.
 */
export function formatTextForSpeech(text: string, locale = 'en-IN'): string {
  let cleaned = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`#>]/g, '')
    .replace(/\[([^\]]+)\]/g, '$1');

  if (locale.toLowerCase().startsWith('en')) {
    cleaned = cleaned
      .replace(/\bVH-(\d+)\b/g, 'V H $1')
      .replace(/\bBCE\b/g, 'B C E')
      .replace(/\bCE\b/g, 'C E');
  }

  return cleaned
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s*;\s*/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export interface LocaleVoiceGroups {
  exactMatches: SpeechSynthesisVoice[];
  languageMatches: SpeechSynthesisVoice[];
  fallbackVoices: SpeechSynthesisVoice[];
  recommendedVoice?: SpeechSynthesisVoice;
}

function scoreBrowserVoice(voice: SpeechSynthesisVoice, locale: string): number {
  const normalized = locale.toLowerCase();
  const langPrefix = normalized.split('-')[0];
  const vLang = voice.lang.toLowerCase();

  let score = 0;
  if (vLang === normalized) score += 120;
  else if (vLang.startsWith(`${langPrefix}-`) || vLang === langPrefix) score += 70;
  else return -1;

  const nameLower = voice.name.toLowerCase();
  if (nameLower.includes('natural') || nameLower.includes('neural') || nameLower.includes('online')) score += 30;
  if (nameLower.includes('google')) score += 22;
  if (nameLower.includes('microsoft')) score += 18;
  if (nameLower.includes('apple') || nameLower.includes('siri') || nameLower.includes('lekha') || nameLower.includes('vani')) score += 16;
  if (voice.localService) score += 4;
  return score;
}

export function getVoicesForLocale(locale = 'en-IN'): LocaleVoiceGroups {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return { exactMatches: [], languageMatches: [], fallbackVoices: [] };
  }

  const rawVoices = window.speechSynthesis.getVoices();
  const seen = new Set<string>();
  const uniqueVoices: SpeechSynthesisVoice[] = [];
  for (const voice of rawVoices) {
    if (!seen.has(voice.voiceURI)) {
      seen.add(voice.voiceURI);
      uniqueVoices.push(voice);
    }
  }

  const normalized = locale.toLowerCase();
  const langPrefix = normalized.split('-')[0];

  const exactMatches: SpeechSynthesisVoice[] = [];
  const languageMatches: SpeechSynthesisVoice[] = [];
  const fallbackVoices: SpeechSynthesisVoice[] = [];

  for (const voice of uniqueVoices) {
    const vLang = voice.lang.toLowerCase();
    if (vLang === normalized) {
      exactMatches.push(voice);
    } else if (vLang.startsWith(`${langPrefix}-`) || vLang === langPrefix) {
      languageMatches.push(voice);
    } else {
      fallbackVoices.push(voice);
    }
  }

  const sortByQuality = (a: SpeechSynthesisVoice, b: SpeechSynthesisVoice) =>
    scoreBrowserVoice(b, locale) - scoreBrowserVoice(a, locale) || a.name.localeCompare(b.name);

  exactMatches.sort(sortByQuality);
  languageMatches.sort(sortByQuality);
  fallbackVoices.sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));

  const recommendedVoice = exactMatches[0] || languageMatches[0];
  return { exactMatches, languageMatches, fallbackVoices, recommendedVoice };
}

let activeAudioElement: HTMLAudioElement | null = null;
let activeAudioUrl: string | null = null;
let activeAudioContext: AudioContext | null = null;
let activeGainNode: GainNode | null = null;
let activeMediaSource: MediaElementAudioSourceNode | null = null;

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function releaseActiveAudio(): void {
  if (activeAudioElement) {
    activeAudioElement.pause();
    activeAudioElement.onended = null;
    activeAudioElement.onerror = null;
    activeAudioElement.src = '';
    activeAudioElement = null;
  }
  if (activeMediaSource) {
    try {
      activeMediaSource.disconnect();
    } catch {
      // Ignore disconnect errors during cleanup
    }
    activeMediaSource = null;
  }
  if (activeGainNode) {
    try {
      activeGainNode.disconnect();
    } catch {
      // Ignore disconnect errors during cleanup
    }
    activeGainNode = null;
  }
  if (activeAudioContext) {
    const ctx = activeAudioContext;
    activeAudioContext = null;
    if (ctx.state !== 'closed') {
      void ctx.close().catch(() => undefined);
    }
  }
  if (activeAudioUrl) {
    URL.revokeObjectURL(activeAudioUrl);
    activeAudioUrl = null;
  }
}

export function updateActiveAudioRate(rate: number): void {
  if (activeAudioElement) {
    activeAudioElement.playbackRate = clamp(rate, 0.5, 1.5);
    activeAudioElement.preservesPitch = true;
  }
}

export function updateActiveAudioVolume(volume: number): void {
  const clampedVol = clamp(volume, 0, 1);
  if (activeGainNode && activeAudioContext) {
    activeGainNode.gain.setTargetAtTime(clampedVol, activeAudioContext.currentTime, 0.02);
  } else if (activeAudioElement) {
    activeAudioElement.volume = clampedVol;
  }
}

export interface AudioPlaybackOptions {
  rate?: number;
  volume?: number;
}

export function playBase64WavAudio(
  base64Audio: string,
  rateOrOptions: number | AudioPlaybackOptions = 0.9,
  onEnd?: () => void,
  onError?: () => void
): boolean {
  if (typeof window === 'undefined' || !base64Audio) {
    return false;
  }
  stopSpeaking();

  const opts: AudioPlaybackOptions =
    typeof rateOrOptions === 'number' ? { rate: rateOrOptions } : rateOrOptions;
  const targetRate = clamp(opts.rate ?? 0.9, 0.5, 1.5);
  const targetVolume = clamp(opts.volume ?? 0.95, 0, 1);

  try {
    const binary = window.atob(base64Audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.playbackRate = targetRate;
    audio.preservesPitch = true;
    activeAudioElement = audio;
    activeAudioUrl = url;

    // Route WAV audio through a hi-fi vocal clarity Web Audio chain (de-mud high-pass,
    // 2.8kHz articulation presence boost, dynamics leveling, and smooth GainNode volume).
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    let connectedHiFiGraph = false;
    if (AudioCtx) {
      try {
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          void ctx.resume().catch(() => undefined);
        }
        const source = ctx.createMediaElementSource(audio);

        const highPass = ctx.createBiquadFilter();
        highPass.type = 'highpass';
        highPass.frequency.value = 80;
        highPass.Q.value = 0.7;

        const presence = ctx.createBiquadFilter();
        presence.type = 'peaking';
        presence.frequency.value = 2800;
        presence.Q.value = 1.0;
        presence.gain.value = 2.4;

        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.knee.value = 12;
        compressor.ratio.value = 3;
        compressor.attack.value = 0.005;
        compressor.release.value = 0.15;

        const gainNode = ctx.createGain();
        gainNode.gain.value = targetVolume;

        source.connect(highPass);
        highPass.connect(presence);
        presence.connect(compressor);
        compressor.connect(gainNode);
        gainNode.connect(ctx.destination);

        audio.volume = 1.0;
        activeAudioContext = ctx;
        activeMediaSource = source;
        activeGainNode = gainNode;
        connectedHiFiGraph = true;
      } catch {
        connectedHiFiGraph = false;
      }
    }

    if (!connectedHiFiGraph) {
      audio.volume = targetVolume;
    }

    audio.onended = () => {
      releaseActiveAudio();
      onEnd?.();
    };
    audio.onerror = () => {
      releaseActiveAudio();
      onError?.();
    };

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        releaseActiveAudio();
        onError?.();
      });
    }
    return true;
  } catch {
    releaseActiveAudio();
    return false;
  }
}

function selectBestVoiceForLocale(
  voices: SpeechSynthesisVoice[],
  locale: string,
  preferredVoiceURI?: string
): SpeechSynthesisVoice | undefined {
  if (!voices.length) return undefined;
  if (preferredVoiceURI) {
    const explicit = voices.find((v) => v.voiceURI === preferredVoiceURI);
    if (explicit) return explicit;
  }

  let best: SpeechSynthesisVoice | undefined;
  let bestScore = -1;
  for (const voice of voices) {
    const s = scoreBrowserVoice(voice, locale);
    if (s > bestScore) {
      bestScore = s;
      best = voice;
    }
  }
  return best;
}

export interface SpeakTextOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceURI?: string;
}

export function speakText(
  text: string,
  locale = 'en-IN',
  rateOrOptions: number | SpeakTextOptions = 0.92,
  onEnd?: () => void,
  extraOptions?: Omit<SpeakTextOptions, 'rate'>
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }
  releaseActiveAudio();
  window.speechSynthesis.cancel();

  const cleaned = formatTextForSpeech(text, locale);
  if (!cleaned) return false;

  const opts: SpeakTextOptions =
    typeof rateOrOptions === 'number'
      ? { rate: rateOrOptions, ...extraOptions }
      : { ...rateOrOptions, ...extraOptions };

  const utterance = new SpeechSynthesisUtterance(cleaned);
  utterance.lang = locale;
  utterance.rate = clamp(opts.rate ?? 0.92, 0.5, 1.5);
  utterance.pitch = clamp(opts.pitch ?? 1.0, 0.5, 1.5);
  utterance.volume = clamp(opts.volume ?? 0.95, 0, 1);

  const voices = window.speechSynthesis.getVoices();
  const matchedVoice = selectBestVoiceForLocale(voices, locale, opts.voiceURI);
  if (matchedVoice) {
    utterance.voice = matchedVoice;
    utterance.lang = matchedVoice.lang || locale;
  }

  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  releaseActiveAudio();
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export interface VoiceCaptureHandle {
  stop: () => void;
}

export interface VoiceCaptureOptions {
  languageCode?: string;
  languageName?: string;
  onStart?: () => void;
  onTranscribing?: () => void;
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read recorded audio.'));
    reader.readAsDataURL(blob);
  });
}

function startBrowserSpeechFallback(options: VoiceCaptureOptions): VoiceCaptureHandle | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const RecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
  if (!RecognitionCtor) return null;

  try {
    const recognition = new RecognitionCtor();
    recognition.lang = options.languageCode && options.languageCode !== 'auto' ? options.languageCode : 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    let settled = false;

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() || '';
      if (transcript) {
        settled = true;
        options.onTranscript(transcript);
      }
    };
    recognition.onerror = (event) => {
      if (!settled) {
        options.onError?.(
          event?.error === 'not-allowed'
            ? 'Microphone permission denied. Please allow microphone access in browser settings.'
            : 'Could not capture voice cleanly. Please try again or type your query.'
        );
      }
      options.onEnd?.();
    };
    recognition.onend = () => {
      options.onEnd?.();
    };

    options.onStart?.();
    recognition.start();
    return {
      stop: () => {
        try {
          recognition.stop();
        } catch {
          // ignore
        }
      },
    };
  } catch {
    return null;
  }
}

/**
 * Starts a reliable multilingual voice search/input session.
 * Uses MediaRecorder + Gemini 3.5 Transcribe so Tamil, Hindi, Telugu, Malayalam, Kannada,
 * and world languages transcribe accurately even when browser SpeechRecognition is unavailable,
 * with Web Speech API fallback if MediaRecorder is unsupported.
 */
export function startVoiceCaptureSession(options: VoiceCaptureOptions): VoiceCaptureHandle {
  let stopped = false;
  let mediaRecorder: MediaRecorder | null = null;
  let mediaStream: MediaStream | null = null;
  let silenceTimer: number | null = null;
  let maxTimer: number | null = null;
  let monitorCtx: AudioContext | null = null;
  let fallbackHandle: VoiceCaptureHandle | null = null;

  const cleanupMedia = () => {
    if (silenceTimer !== null) {
      window.clearInterval(silenceTimer);
      silenceTimer = null;
    }
    if (maxTimer !== null) {
      window.clearTimeout(maxTimer);
      maxTimer = null;
    }
    if (monitorCtx) {
      const ctx = monitorCtx;
      monitorCtx = null;
      if (ctx.state !== 'closed') {
        void ctx.close().catch(() => undefined);
      }
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }
  };

  const stopAll = () => {
    if (stopped) return;
    stopped = true;
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      try {
        mediaRecorder.stop();
      } catch {
        cleanupMedia();
        options.onEnd?.();
      }
    } else if (fallbackHandle) {
      fallbackHandle.stop();
    } else {
      cleanupMedia();
      options.onEnd?.();
    }
  };

  const canRecordMedia =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined';

  if (!canRecordMedia) {
    fallbackHandle = startBrowserSpeechFallback(options);
    if (!fallbackHandle) {
      options.onError?.('Voice input is not supported in this browser. Please type your query.');
      options.onEnd?.();
    }
    return { stop: stopAll };
  }

  void (async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      mediaStream = stream;

      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      const chosenMime = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type)) || '';
      const recorder = chosenMime
        ? new MediaRecorder(stream, { mimeType: chosenMime })
        : new MediaRecorder(stream);
      mediaRecorder = recorder;

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        cleanupMedia();
        if (chunks.length === 0) {
          options.onEnd?.();
          return;
        }

        const mimeType = recorder.mimeType || chosenMime || 'audio/webm';
        const blob = new Blob(chunks, { type: mimeType });
        if (blob.size < 400) {
          options.onError?.('No speech was detected. Please speak closer to the microphone.');
          options.onEnd?.();
          return;
        }

        options.onTranscribing?.();
        try {
          const audioBase64 = await blobToBase64(blob);
          const { transcript } = await transcribeVoiceAudio({
            audioBase64,
            mimeType,
            languageCode: options.languageCode,
            languageName: options.languageName,
          });
          if (transcript.trim()) {
            options.onTranscript(transcript.trim());
          } else {
            options.onError?.('Could not recognize words clearly. Please try speaking again.');
          }
        } catch (err) {
          options.onError?.(err instanceof Error ? err.message : 'Voice transcription failed.');
        } finally {
          options.onEnd?.();
        }
      };

      // Automatic hands-free silence detection so voice search finishes naturally after speaking
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          monitorCtx = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          source.connect(analyser);
          const data = new Uint8Array(analyser.fftSize);
          let heardSpeech = false;
          let silentTicks = 0;

          silenceTimer = window.setInterval(() => {
            if (recorder.state !== 'recording') return;
            analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
              const v = (data[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / data.length);
            if (rms > 0.018) {
              heardSpeech = true;
              silentTicks = 0;
            } else if (heardSpeech) {
              silentTicks += 1;
              if (silentTicks >= 12) {
                stopAll();
              }
            }
          }, 130);
        }
      } catch {
        // Ignore silence monitor errors; manual click or max timer still stops recording
      }

      maxTimer = window.setTimeout(() => {
        stopAll();
      }, 11000);

      options.onStart?.();
      recorder.start(250);
    } catch {
      cleanupMedia();
      fallbackHandle = startBrowserSpeechFallback(options);
      if (!fallbackHandle) {
        options.onError?.('Microphone permission denied or unavailable. Please allow microphone access.');
        options.onEnd?.();
      }
    }
  })();

  return { stop: stopAll };
}

export function playSoftArchivalChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(528, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(396, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.23);
  } catch {
    // Ignore if audio context is blocked by autoplay policy
  }
}
