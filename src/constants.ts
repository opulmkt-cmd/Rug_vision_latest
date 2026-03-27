import { Preset, ConstructionType, PileType, PileHeight, SurfaceFinish, MaterialType } from './types';

export const MATERIAL_TYPES: MaterialType[] = [
  { id: 'nz-wool', name: 'NZ Wool' },
  { id: 'viscose', name: 'Viscose' },
  { id: 'bamboo-silk', name: 'Bamboo Silk' },
  { id: 'merino-wool', name: 'Merino Wool' },
  { id: 'alpaca-wool', name: 'Alpaca Wool' },
  { id: 'lincoln-wool', name: 'Lincoln Wool' },
  { id: 'mohair-wool', name: 'Mohair Wool' },
];

export const PRESETS: Preset[] = [
  { id: 'earth', name: 'Earth', colors: ['#4A3728', '#8B5A2B', '#C19A6B', '#E3D5B8', '#F5F5DC'] },
  { id: 'nordic', name: 'Nordic', colors: ['#FFFFFF', '#D8D8D8', '#A0A0A0', '#404040', '#FF4B2B'] },
  { id: 'jewel', name: 'Jewel', colors: ['#4B0082', '#000080', '#006400', '#8B0000', '#FFD700'] },
  { id: 'pastel', name: 'Pastel', colors: ['#FFB7B2', '#FFDAC1', '#E2F0CB', '#B5EAD7', '#C7CEEA'] },
  { id: 'desert', name: 'Desert', colors: ['#EDC9AF', '#C2B280', '#E2725B', '#B87333', '#FF8C00'] },
  { id: 'ocean', name: 'Ocean', colors: ['#0077BE', '#00A86B', '#5F9EA0', '#E0FFFF', '#000080'] },
];

export const CONSTRUCTIONS: ConstructionType[] = [
  { id: 'tufted', name: 'Hand Tufted', multiplier: 1.0 },
  { id: 'knotted-40', name: '40 Knot', multiplier: 1.6 },
  { id: 'knotted-80', name: '80 Knot', multiplier: 2.1 },
  { id: 'knotted-100', name: '100 Knot', multiplier: 2.5 },
  { id: 'knotted-120', name: '120 Knot', multiplier: 3.4 },
];

export const PRICING_MATRIX: Record<string, Record<string, number>> = {
  'tufted': { 
    'NZ Wool': 36.20, 
    'Viscose': 36.20, 
    'Bamboo Silk': 36.20, 
    'Merino Wool': 336.00, 
    'Alpaca Wool': 560.00, 
    'Lincoln Wool': 236.00, 
    'Mohair Wool': 568.00 
  },
  'knotted-40': { 
    'NZ Wool': 89.31, 
    'Viscose': 89.31, 
    'Bamboo Silk': 89.31, 
    'Merino Wool': 161.78, 
    'Alpaca Wool': 325.09, 
    'Lincoln Wool': 156.20, 
    'Mohair Wool': 335.98 
  },
  'knotted-80': { 
    'NZ Wool': 106.42, 
    'Viscose': 106.42, 
    'Bamboo Silk': 106.42, 
    'Merino Wool': 186.42, 
    'Alpaca Wool': 346.42, 
    'Lincoln Wool': 184.20, 
    'Mohair Wool': 390.87 
  },
  'knotted-100': { 
    'NZ Wool': 138.53, 
    'Viscose': 148.93, 
    'Bamboo Silk': 148.93, 
    'Merino Wool': 460.93, 
    'Alpaca Wool': 367.33, 
    'Lincoln Wool': 138.53, 
    'Mohair Wool': 575.33 
  },
  'knotted-120': { 
    'NZ Wool': 169.73, 
    'Viscose': 180.13, 
    'Bamboo Silk': 180.13, 
    'Merino Wool': 502.53, 
    'Alpaca Wool': 419.33, 
    'Lincoln Wool': 169.73, 
    'Mohair Wool': 606.53 
  }
};

export const PILE_TYPES: PileType[] = [
  { id: 'cut', name: 'Cut Pile' },
  { id: 'loop', name: 'Loop Pile' },
  { id: 'cut-loop', name: 'Cut & Loop' },
];

export const PILE_HEIGHTS: PileHeight[] = [
  { id: 'low', name: 'Low 2mm' },
  { id: 'standard', name: 'Standard 4mm' },
  { id: 'high', name: 'High 7mm' },
  { id: 'shag', name: 'Shag 12mm' },
];

export const SURFACE_FINISHES: SurfaceFinish[] = [
  { id: 'tip-shear', name: 'Tip Shear', pricePerSqFt: 5 },
  { id: 'sculpted', name: 'Sculpted Carving', pricePerSqFt: 8 },
];
