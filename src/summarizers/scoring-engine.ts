import type { CollectorSource } from './types.js';

const GEO_KEYWORDS = [
  'geospatial',
  'gis',
  '3d',
  'plateau',
  'visualization',
  'map',
  'unity',
  'unreal',
  'blender',
  'deckgl',
  'deck.gl',
  'mapbox',
  'webgl',
  'japan',
  'opendata',
  'citygml',
  'geojson',
  'shapefile',
  'lidar',
  'pointcloud',
  'spatial',
  'coordinate',
  'terrain',
  'mesh',
  'voxel',
];

export const POTENTIAL_BY_SOURCE: Record<CollectorSource, number> = {
  plateau: 90,
  estat: 70,
  hacker_news: 60,
  reddit: 50,
  local_file: 40,
};

const SELECTION_THRESHOLD = 60;

const RELEVANCE_FULL_MATCH_COUNT = 5;

export class ScoringEngine {
  constructor(private readonly customPotential?: Partial<Record<CollectorSource, number>>) {}

  calculateRelevance(text: string): number {
    const lower = text.toLowerCase();
    const matchCount = GEO_KEYWORDS.filter((kw) => lower.includes(kw)).length;
    return Math.min((matchCount / RELEVANCE_FULL_MATCH_COUNT) * 100, 100);
  }

  calculatePotential(source: CollectorSource): number {
    return this.customPotential?.[source] ?? POTENTIAL_BY_SOURCE[source];
  }

  // TODO: replace with (1 - max_TF-IDF_cosine_similarity(text, existingPosts)) * 100
  calculateNovelty(_existingTexts: string[] = []): number {
    return 70;
  }

  calculateTotal(relevance: number, novelty: number, potential: number): number {
    return relevance * 0.4 + novelty * 0.35 + potential * 0.25;
  }

  isSelected(totalScore: number): boolean {
    return totalScore >= SELECTION_THRESHOLD;
  }
}
