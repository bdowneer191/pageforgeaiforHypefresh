

export interface Session {
  id?: string;
  url: string;
  startTime: string;
  endTime: string;
  duration: number;
  beforeScores: { mobile: number, desktop: number };
  afterScores: { mobile: number, desktop: number };
  userId?: string;
  userEmail?: string;
}

export interface CleaningOptions {
  stripComments: boolean;
  collapseWhitespace: boolean;
  minifyInlineCSSJS: boolean;
  removeEmptyAttributes: boolean;
  preserveIframes: boolean;
  preserveLinks: boolean;
  preserveShortcodes: boolean;
  semanticRewrite: boolean;
  lazyLoadEmbeds: boolean;
  lazyLoadImages: boolean;
  optimizeCssLoading: boolean;
  optimizeFontLoading: boolean;
  addPrefetchHints: boolean;
  deferScripts: boolean;
}

export interface ImpactSummary {
  originalBytes: number;
  cleanedBytes: number;
  bytesSaved: number;
  nodesRemoved: number;
  estimatedSpeedGain: string;
}

export interface Recommendation {
  title: string;
  description: string;
  priority?: 'High' | 'Medium' | 'Low';
}