export interface MaterialType {
  id: string;
  name: string;
}

export interface RugConfig {
  prompt: string;
  colors: string[];
  materialTypes: string[];
  preset: string;
  width: number;
  length: number;
  construction: string;
  pileType: string;
  pileHeight: string;
  surfaceFinishes: string[];
  seed: number;
  midjourneyMode: boolean;
}

export type AppView = 'config' | 'results';

export interface SavedDesign {
  id: string;
  name: string;
  imageUrl: string;
  config: RugConfig;
  folderId: string;
  createdAt: number;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export interface Preset {
  id: string;
  name: string;
  colors: string[];
}
// ... rest of the types

export interface ConstructionType {
  id: string;
  name: string;
  multiplier: number;
}

export interface PileType {
  id: string;
  name: string;
}

export interface PileHeight {
  id: string;
  name: string;
}

export interface SurfaceFinish {
  id: string;
  name: string;
  pricePerSqFt: number;
}
