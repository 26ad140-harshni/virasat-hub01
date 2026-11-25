export type EntryCategory = 'Manuscript' | 'Inscription' | 'Monument' | 'Treatise';

export type SupportedLanguage = 'en' | 'ta' | 'hi' | 'te' | 'ml' | 'kn';

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  nativeName: string;
  speechLocale: string;
}

export interface DynastyRuler {
  name: string;
  reign: string;
  title: string;
  achievement: string;
}

export interface Dynasty {
  id: string;
  name: string;
  period: string;
  startYear: number;
  endYear: number;
  capital: string;
  region: string;
  overview: string;
  administration: string;
  civicEthics: string;
  culturalPatronage: string;
  tradeAndEconomy?: string;
  scientificLegacy?: string;
  color: string;
  polygonCoords: [number, number][];
  rulers: DynastyRuler[];
  keyMonuments: string[];
}

export interface TimelineEvent {
  id: string;
  year: number;
  displayYear: string;
  title: string;
  dynastyId: string;
  dynastyName: string;
  location: string;
  lat: number;
  lng: number;
  category: EntryCategory | 'Political' | 'Cultural';
  summary: string;
  linkedEntryId?: string;
}

export interface ArchiveEntry {
  id: string;
  accessionNo: string;
  title: string;
  subtitle: string;
  category: EntryCategory;
  dynastyId: string;
  dynastyName: string;
  year: number;
  displayDate: string;
  script: string;
  language: string;
  material: string;
  dimensions: string;
  provenance: string;
  imageUrl: string;
  summary: string;
  originalExcerpt: string;
  transliteration: string;
  englishTranslation: string;
  scholarlyAnalysis: string;
  historicalContext?: string;
  epigraphicNotes?: string;
  keyTerms: string[];
  citationAuthor: string;
  repository: string;
}

export interface HistoricalStory {
  id: string;
  title: string;
  dynastyId: string;
  dynastyName: string;
  era: string;
  readingTime: string;
  narratorNote: string;
  imageUrl: string;
  paragraphs: string[];
  linkedEntryIds: string[];
}

export interface LexiconTerm {
  id: string;
  term: string;
  scriptText: string;
  language: string;
  ipa: string;
  syllables: string[];
  meaning: string;
  etymology: string;
  exampleEntryId: string;
}

export type GraphNodeType = 'Dynasty' | 'Ruler' | 'Monument' | 'Manuscript' | 'Script' | 'Concept';

export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  era: string;
  description: string;
  linkedEntryId?: string;
  linkedDynastyId?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
}

export interface ScholarUser {
  id: string;
  name: string;
  email: string;
  affiliation: string;
  role: 'scholar' | 'curator';
}

export interface ResearchFolder {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface SavedResearchItem {
  id: string;
  folderId: string;
  entryId: string;
  note: string;
  savedAt: string;
}

export type ChatLanguagePreference = 'auto' | SupportedLanguage;

export type TTSVoiceName = 'Kore' | 'Zephyr' | 'Charon' | 'Puck' | 'Fenrir';

export interface SpeechSynthesisOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceURI?: string;
}

export interface LocaleVoiceOption {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  matchQuality: 'exact' | 'language' | 'fallback';
}

export interface ChatCitation {
  entryId: string;
  accessionNo: string;
  title: string;
  dynastyName: string;
  relevanceScore: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  spokenText?: string;
  englishTranslation?: string;
  languageCode?: string;
  languageName?: string;
  citations?: ChatCitation[];
  timestamp: string;
  error?: string;
}

export interface VirasatDataset {
  dynasties: Dynasty[];
  events: TimelineEvent[];
  entries: ArchiveEntry[];
  stories: HistoricalStory[];
  lexicon: LexiconTerm[];
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
}
