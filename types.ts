

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
  optimizeImages: boolean; // Main switch for WebP/AVIF
  convertToAvif: boolean; // Upgrade to AVIF
  addResponsiveSrcset: boolean; // Generate srcset/sizes
  optimizeSvgs: boolean; // Minify inline SVGs
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
  actionLog: string[]; // Detailed log of actions taken
}

export interface Recommendation {
  title: string;
  description: string;
  priority?: 'High' | 'Medium' | 'Low';
}
