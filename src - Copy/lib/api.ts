import type {
  ArchiveEntry,
  ChatCitation,
  GraphEdge,
  GraphNode,
  ResearchFolder,
  SavedResearchItem,
  ScholarUser,
  SupportedLanguage,
  VirasatDataset,
} from '../types';
import {
  SEED_ARCHIVE_ENTRIES,
  SEED_DYNASTIES,
  SEED_LEXICON,
  SEED_STORIES,
  SEED_TIMELINE_EVENTS,
} from '../data/seedData';
import { SEED_GRAPH_EDGES, SEED_GRAPH_NODES } from '../data/seedGraphData';

const CACHE_KEY = 'virasat_dataset_cache_v1';
const SCHOLAR_KEY = 'virasat_scholar_user_v1';
const TRANSLATION_CACHE_KEY = 'virasat_translations_v1';

export async function fetchDataset(): Promise<VirasatDataset> {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as VirasatDataset;
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    return data;
  } catch {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as VirasatDataset;
    }
    return {
      dynasties: SEED_DYNASTIES,
      events: SEED_TIMELINE_EVENTS,
      entries: SEED_ARCHIVE_ENTRIES,
      stories: SEED_STORIES,
      lexicon: SEED_LEXICON,
      graphNodes: SEED_GRAPH_NODES,
      graphEdges: SEED_GRAPH_EDGES,
    };
  }
}

export function loadScholarSession(): ScholarUser | null {
  try {
    const raw = localStorage.getItem(SCHOLAR_KEY);
    return raw ? (JSON.parse(raw) as ScholarUser) : null;
  } catch {
    return null;
  }
}

export function saveScholarSession(user: ScholarUser | null): void {
  if (!user) {
    localStorage.removeItem(SCHOLAR_KEY);
  } else {
    localStorage.setItem(SCHOLAR_KEY, JSON.stringify(user));
  }
}

function scholarHeaders(scholar: ScholarUser | null): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-scholar-id': scholar?.id || 'guest-scholar',
  };
}

export async function fetchResearchSpace(
  scholar: ScholarUser
): Promise<{ folders: ResearchFolder[]; items: SavedResearchItem[] }> {
  const res = await fetch('/api/research-space', { headers: scholarHeaders(scholar) });
  if (!res.ok) throw new Error('Unable to load Research Space');
  return res.json();
}

export async function createFolder(
  scholar: ScholarUser,
  name: string,
  description: string
): Promise<ResearchFolder> {
  const res = await fetch('/api/research-space/folders', {
    method: 'POST',
    headers: scholarHeaders(scholar),
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) throw new Error('Unable to create folder');
  return res.json();
}

export async function deleteFolder(scholar: ScholarUser, folderId: string): Promise<void> {
  const res = await fetch(`/api/research-space/folders/${folderId}`, {
    method: 'DELETE',
    headers: scholarHeaders(scholar),
  });
  if (!res.ok) throw new Error('Unable to delete folder');
}

export async function saveItemToFolder(
  scholar: ScholarUser,
  folderId: string,
  entryId: string,
  note: string
): Promise<SavedResearchItem> {
  const res = await fetch('/api/research-space/items', {
    method: 'POST',
    headers: scholarHeaders(scholar),
    body: JSON.stringify({ folderId, entryId, note }),
  });
  if (!res.ok) throw new Error('Unable to save item');
  return res.json();
}

export async function updateSavedItemNote(
  scholar: ScholarUser,
  itemId: string,
  note: string
): Promise<SavedResearchItem> {
  const res = await fetch(`/api/research-space/items/${itemId}`, {
    method: 'PUT',
    headers: scholarHeaders(scholar),
    body: JSON.stringify({ note }),
  });
  if (!res.ok) throw new Error('Unable to update note');
  return res.json();
}

export async function removeSavedItem(scholar: ScholarUser, itemId: string): Promise<void> {
  const res = await fetch(`/api/research-space/items/${itemId}`, {
    method: 'DELETE',
    headers: scholarHeaders(scholar),
  });
  if (!res.ok) throw new Error('Unable to remove saved item');
}

export async function createArchiveEntry(entry: Partial<ArchiveEntry>): Promise<ArchiveEntry> {
  const res = await fetch('/api/entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create entry');
  }
  return res.json();
}

export async function updateArchiveEntry(id: string, entry: Partial<ArchiveEntry>): Promise<ArchiveEntry> {
  const res = await fetch(`/api/entries/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error('Failed to update entry');
  return res.json();
}

export async function deleteArchiveEntry(id: string): Promise<void> {
  const res = await fetch(`/api/entries/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete entry');
}

export async function createGraphNode(node: Omit<GraphNode, 'id'>): Promise<GraphNode> {
  const res = await fetch('/api/graph/nodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(node),
  });
  if (!res.ok) throw new Error('Failed to create node');
  return res.json();
}

export async function deleteGraphNode(id: string): Promise<void> {
  const res = await fetch(`/api/graph/nodes/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete node');
}

export async function createGraphEdge(edge: Omit<GraphEdge, 'id'>): Promise<GraphEdge> {
  const res = await fetch('/api/graph/edges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(edge),
  });
  if (!res.ok) throw new Error('Failed to create edge');
  return res.json();
}

export async function deleteGraphEdge(id: string): Promise<void> {
  const res = await fetch(`/api/graph/edges/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete edge');
}

export async function translatePassage(
  entryId: string,
  text: string,
  targetLang: SupportedLanguage
): Promise<{ translatedText: string; culturalNote: string; cached: boolean }> {
  const cleanSource = text.trim();
  const cacheKey = `${entryId}:${targetLang}:${cleanSource.length}:${cleanSource.slice(0, 40)}`;
  try {
    const localMap = JSON.parse(localStorage.getItem(TRANSLATION_CACHE_KEY) || '{}') as Record<
      string,
      { translatedText: string; culturalNote: string }
    >;
    const hit = localMap[cacheKey];
    if (
      hit &&
      hit.translatedText?.trim() &&
      (targetLang === 'en' || hit.translatedText.trim() !== cleanSource)
    ) {
      return { ...hit, cached: true };
    }
  } catch {
    // ignore storage errors
  }

  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entryId, text: cleanSource, targetLang }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Translation request failed');
  }
  if (!data.translatedText || !String(data.translatedText).trim()) {
    throw new Error('Translation service returned an empty translation.');
  }

  try {
    const localMap = JSON.parse(localStorage.getItem(TRANSLATION_CACHE_KEY) || '{}') as Record<
      string,
      { translatedText: string; culturalNote: string }
    >;
    localMap[cacheKey] = {
      translatedText: data.translatedText,
      culturalNote: data.culturalNote || '',
    };
    localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(localMap));
  } catch {
    // ignore storage errors
  }

  return data;
}

export async function askResearchAssistant(
  question: string,
  history: Array<{ role: 'user' | 'assistant'; text: string }>,
  language: string = 'auto'
): Promise<{
  answer: string;
  spokenText: string;
  englishTranslation?: string;
  detectedLanguageCode: string;
  detectedLanguageName: string;
  citations: ChatCitation[];
}> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, history, language }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Research Assistant request failed');
  }
  return data;
}

export async function transcribeVoiceAudio(params: {
  audioBase64: string;
  mimeType: string;
  languageCode?: string;
  languageName?: string;
}): Promise<{ transcript: string }> {
  const res = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Voice transcription failed');
  }
  return data;
}

const CLIENT_TTS_CACHE = new Map<string, string>();

export async function synthesizeSpeech(params: {
  text: string;
  languageName?: string;
  languageCode?: string;
  voiceName?: string;
  pitch?: number;
}): Promise<{ audioBase64: string; mimeType: string; voiceName: string }> {
  const voice = params.voiceName || 'Kore';
  const lang = params.languageName || params.languageCode || 'English';
  const pitchBucket = Math.round((params.pitch ?? 1.0) * 20) / 20;
  const cacheKey = `${voice}:${lang}:${pitchBucket.toFixed(2)}:${params.text.slice(0, 120)}:${params.text.length}`;
  const cached = CLIENT_TTS_CACHE.get(cacheKey);
  if (cached) {
    return { audioBase64: cached, mimeType: 'audio/wav', voiceName: voice };
  }

  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, pitch: pitchBucket }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Speech synthesis request failed');
  }
  if (data.audioBase64) {
    if (CLIENT_TTS_CACHE.size >= 25) {
      const oldest = CLIENT_TTS_CACHE.keys().next().value;
      if (oldest) CLIENT_TTS_CACHE.delete(oldest);
    }
    CLIENT_TTS_CACHE.set(cacheKey, data.audioBase64);
  }
  return data;
}

export async function testSemanticEmbeddings(query: string): Promise<{
  model: string;
  dimensions: number;
  previewVector: number[];
  matches: Array<{ entryId: string; accessionNo: string; title: string; dynastyName: string; score: number }>;
}> {
  const res = await fetch('/api/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Embedding test failed');
  }
  return data;
}
