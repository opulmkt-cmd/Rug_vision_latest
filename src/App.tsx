import React, { useState, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  ArrowRight, 
  Plus, 
  Minus, 
  Loader2, 
  Save,
  Download,
  Maximize2,
  RefreshCw,
  ChevronLeft,
  Check,
  Ruler,
  Layers,
  Move,
  Maximize,
  Sparkles,
  Palette,
  Info,
  Folder as FolderIcon,
  FolderPlus,
  Trash2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { HexColorPicker } from 'react-colorful';
import { 
  PRESETS, 
  CONSTRUCTIONS, 
  PILE_TYPES, 
  PILE_HEIGHTS, 
  SURFACE_FINISHES,
  MATERIAL_TYPES,
  PRICING_MATRIX
} from './constants';
import { RugConfig, AppView, SavedDesign, Folder } from './types';

const BASE_PRICE_PER_SQFT = 45;

const SIZE_PRESETS = [
  { id: '5x8', name: '5\' x 8\'', w: 5, l: 8 },
  { id: '8x10', name: '8\' x 10\'', w: 8, l: 10 },
  { id: '9x12', name: '9\' x 12\'', w: 9, l: 12 },
  { id: '10x14', name: '10\' x 14\'', w: 10, l: 14 },
];

const calculateEstimate = (config: RugConfig) => {
  const area = config.width * config.length;
  
  // Get the matrix for the selected construction
  const constructionMatrix = PRICING_MATRIX[config.construction] || PRICING_MATRIX['tufted'];
  
  // Calculate average material price from the matrix based on selected materials
  const materialCost = config.materialTypes.reduce((acc, materialName) => {
    const price = constructionMatrix[materialName] || 0;
    return acc + price;
  }, 0) / 5;

  const finishCost = config.surfaceFinishes.reduce((acc, id) => {
    const finish = SURFACE_FINISHES.find(f => f.id === id);
    return acc + (finish?.pricePerSqFt || 0);
  }, 0);
  
  const perSqFt = Math.round(materialCost + finishCost);
  return {
    perSqFt,
    area,
    total: perSqFt * area
  };
};

export default function App() {
  const [view, setView] = useState<AppView>('config');
  const [config, setConfig] = useState<RugConfig>({
    prompt: '',
    colors: ['#EFBB76', '#1A1A1A', '#E0E0E0', '#4A4A4A', '#8B4513'],
    materialTypes: ['NZ Wool', 'NZ Wool', 'NZ Wool', 'NZ Wool', 'NZ Wool'],
    preset: 'custom',
    width: 8,
    length: 10,
    construction: 'knotted-40',
    pileType: 'cut',
    pileHeight: 'standard',
    surfaceFinishes: ['tip-shear', 'sculpted'],
    seed: Math.floor(Math.random() * 1000000),
    midjourneyMode: false,
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [fullScreenIdx, setFullScreenIdx] = useState<number | null>(null);
  const [estimate, setEstimate] = useState(() => calculateEstimate(config));

  // Saved Designs State
  const [savedDesigns, setSavedDesigns] = useState<SavedDesign[]>(() => {
    const saved = localStorage.getItem('rug_saved_designs');
    return saved ? JSON.parse(saved) : [];
  });
  const [folders, setFolders] = useState<Folder[]>(() => {
    const saved = localStorage.getItem('rug_folders');
    return saved ? JSON.parse(saved) : [{ id: 'default', name: 'My Designs', createdAt: Date.now() }];
  });
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [designName, setDesignName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState('default');
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [selectedSavedDesign, setSelectedSavedDesign] = useState<SavedDesign | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  React.useEffect(() => {
    localStorage.setItem('rug_saved_designs', JSON.stringify(savedDesigns));
  }, [savedDesigns]);

  React.useEffect(() => {
    localStorage.setItem('rug_folders', JSON.stringify(folders));
  }, [folders]);

  React.useEffect(() => {
    setEstimate(calculateEstimate(config));
  }, [config]);

  const createFolder = () => {
    if (!newFolderName.trim()) return;
    const newFolder: Folder = {
      id: Math.random().toString(36).substr(2, 9),
      name: newFolderName.trim(),
      createdAt: Date.now()
    };
    setFolders(prev => [...prev, newFolder]);
    setSelectedFolderId(newFolder.id);
    setNewFolderName('');
    setIsCreatingFolder(false);
  };

  const saveDesign = () => {
    if (imageUrls.length === 0) return;
    const url = selectedVariation !== null ? imageUrls[selectedVariation] : imageUrls[0];
    
    const newDesign: SavedDesign = {
      id: Math.random().toString(36).substr(2, 9),
      name: designName.trim() || `Rug Design ${savedDesigns.length + 1}`,
      imageUrl: url,
      config: { ...config },
      folderId: selectedFolderId,
      createdAt: Date.now()
    };

    setSavedDesigns(prev => [newDesign, ...prev]);
    setIsSaveModalOpen(false);
    setDesignName('');
  };

  const deleteDesign = (id: string) => {
    setSavedDesigns(prev => prev.filter(d => d.id !== id));
  };

  const deleteFolder = (id: string) => {
    if (id === 'default') return;
    setFolders(prev => prev.filter(f => f.id !== id));
    setSavedDesigns(prev => prev.filter(d => d.folderId !== id));
    if (selectedFolderId === id) setSelectedFolderId('default');
  };

  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }), []);

  const generateImage = async () => {
    if (!config.prompt) {
      setError("Please enter a prompt first.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSelectedVariation(null);
    setImageUrls([]);
    setView('results');
    
    const estimate = calculateEstimate(config);
    
    try {
      const construction = CONSTRUCTIONS.find(c => c.id === config.construction)?.name;
      const pileType = PILE_TYPES.find(p => p.id === config.pileType)?.name;
      const pileHeight = PILE_HEIGHTS.find(p => p.id === config.pileHeight)?.name;
      const finishes = config.surfaceFinishes.map(id => SURFACE_FINISHES.find(f => f.id === id)?.name).join(', ');

      const fullPrompt = `A high-quality, professional top-down studio photograph of a single custom designer rug. 
      The rug dimensions are ${config.width}ft x ${config.length}ft. 
      Design concept: ${config.prompt}. 
      Color Palette: ${config.colors.join(', ')}. 
      Construction: ${construction}. 
      Texture: ${pileType} with ${pileHeight} height. 
      Finishing details: ${finishes}. 
      The rug should be perfectly centered on a PURE WHITE background. No shadows, no floor texture, just the rug on white. Highly detailed textile texture, realistic fibers, luxury aesthetic.`;

      // Calculate best aspect ratio based on rug dimensions
      const ratio = config.width / config.length;
      let aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "1:1";
      if (ratio > 1.15) aspectRatio = "4:3";
      if (ratio > 1.4) aspectRatio = "16:9";
      if (ratio < 0.85) aspectRatio = "3:4";
      if (ratio < 0.65) aspectRatio = "9:16";

      // Generate 4 separate variations in parallel
      const generationPromises = [1, 2, 3, 4].map(async (i) => {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [{ text: fullPrompt + ` Variation ${i}` }],
          },
          config: {
            imageConfig: {
              aspectRatio: aspectRatio
            },
            seed: config.seed + i,
          }
        });

        const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        return part?.inlineData ? `data:image/png;base64,${part.inlineData.data}` : null;
      });

      const results = await Promise.all(generationPromises);
      const validImages = results.filter((img): img is string => img !== null);
      
      if (validImages.length > 0) {
        setImageUrls(validImages);
      } else {
        throw new Error("Failed to generate rug visualizations. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleFinish = (id: string) => {
    setConfig(prev => ({
      ...prev,
      surfaceFinishes: prev.surfaceFinishes.includes(id)
        ? prev.surfaceFinishes.filter(f => f !== id)
        : [...prev.surfaceFinishes, id]
    }));
  };

  const updateColor = (index: number, color: string) => {
    const newColors = [...config.colors];
    newColors[index] = color;
    setConfig({ ...config, colors: newColors, preset: 'custom' });
  };

  const updateMaterialType = (index: number, material: string) => {
    const newMaterials = [...config.materialTypes];
    newMaterials[index] = material;
    setConfig({ ...config, materialTypes: newMaterials });
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-[#EFBB76] selection:text-black overflow-x-hidden pt-20">
      {/* Sidebar Drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-80 bg-white border-r border-black/10 z-[70] flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-black/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderIcon className="w-5 h-5 text-[#EFBB76]" />
                  <h2 className="text-sm font-bold tracking-widest uppercase">My Collections</h2>
                </div>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 hover:bg-black/5 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar">
                {folders.map(folder => (
                  <div key={folder.id} className="space-y-4">
                    <div className="flex items-center justify-between group">
                      <h3 className="text-[10px] font-bold text-black/40 uppercase tracking-widest">
                        {folder.name}
                      </h3>
                      {folder.id !== 'default' && (
                        <button 
                          onClick={() => setFolders(prev => prev.filter(f => f.id !== folder.id))}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {savedDesigns.filter(d => d.folderId === folder.id).map(design => (
                        <div 
                          key={design.id} 
                          className="group relative aspect-square bg-black/5 rounded-xl overflow-hidden cursor-pointer border border-transparent hover:border-[#EFBB76] transition-all"
                          onClick={() => {
                            setSelectedSavedDesign(design);
                            setIsSidebarOpen(false);
                          }}
                        >
                          <img 
                            src={design.imageUrl} 
                            alt={design.name} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center">
                            <span className="text-[8px] text-white font-bold uppercase tracking-tighter leading-tight mb-2">
                              {design.name}
                            </span>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSavedDesigns(prev => prev.filter(d => d.id !== design.id));
                              }}
                              className="p-1.5 bg-red-500/20 hover:bg-red-500 text-white rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {savedDesigns.filter(d => d.folderId === folder.id).length === 0 && (
                        <div className="col-span-2 py-8 border border-dashed border-black/10 rounded-xl flex flex-col items-center justify-center gap-2">
                          <Plus className="w-4 h-4 text-black/20" />
                          <span className="text-[8px] text-black/30 uppercase font-bold tracking-widest">Empty</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-black/5 bg-black/5">
                {isCreatingFolder ? (
                  <div className="space-y-3">
                    <input 
                      type="text" 
                      autoFocus
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Folder Name..."
                      className="w-full bg-white border border-black/10 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-[#EFBB76]/50"
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={createFolder}
                        className="flex-1 py-2 bg-[#EFBB76] text-black rounded-lg font-bold text-[10px] uppercase"
                      >
                        Create
                      </button>
                      <button 
                        onClick={() => setIsCreatingFolder(false)}
                        className="flex-1 py-2 bg-black/10 text-black rounded-lg font-bold text-[10px] uppercase"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsCreatingFolder(true)}
                    className="w-full py-3 bg-white border border-black/10 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:border-[#EFBB76] transition-all"
                  >
                    <FolderPlus className="w-4 h-4" /> New Collection
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav className="fixed top-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-md border-b border-black/5 z-40 px-6 sm:px-12 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-[#EFBB76]" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tighter leading-none">RUGVISION</h1>
              <span className="text-[10px] font-bold text-[#EFBB76] tracking-[0.2em] uppercase">AI Studio</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1 bg-black/5 p-1 rounded-xl">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-black/40 hover:text-black transition-colors flex items-center gap-2"
            >
              <FolderIcon className="w-3 h-3" /> Collections
            </button>
            <div className="w-px h-4 bg-black/10 mx-1" />
            <button 
              onClick={() => setView('config')}
              className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded-lg ${view === 'config' ? 'bg-white text-black shadow-sm' : 'text-black/40 hover:text-black'}`}
            >
              Design
            </button>
            <button 
              onClick={() => setView('results')}
              disabled={imageUrls.length === 0}
              className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded-lg disabled:opacity-30 ${view === 'results' ? 'bg-white text-black shadow-sm' : 'text-black/40 hover:text-black'}`}
            >
              Visualize
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3 bg-black/5 px-4 py-2 rounded-xl border border-black/10">
              <div className="w-8 h-8 bg-[#EFBB76] rounded-lg flex items-center justify-center text-black font-black text-xs">
                {user.email[0].toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="text-[10px] font-bold text-black leading-none">{user.email.split('@')[0]}</p>
                <button onClick={() => setUser(null)} className="text-[8px] font-bold text-black/30 hover:text-red-500 uppercase tracking-widest mt-1">Sign Out</button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setIsAuthModalOpen(true)}
              className="px-6 py-3 bg-[#EFBB76] text-black rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[#DBA762] transition-all shadow-lg"
            >
              Sign In
            </button>
          )}
        </div>
      </nav>

      <AnimatePresence mode="wait">
        {view === 'config' ? (
          <motion.div 
            key="config"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-4xl mx-auto px-6 py-12"
          >
            <header className="mb-12 text-center relative">
              <h1 className="text-5xl font-serif font-bold text-[#EFBB76] mb-4 tracking-tight">Design Your Masterpiece</h1>
              <p className="text-black/40 text-lg max-w-xl mx-auto">Configure your bespoke rug with AI-powered visualization. Every detail crafted to your vision.</p>
            </header>

            <div className="space-y-12">
              {/* Prompt Section */}
              <section className="bg-black/5 p-8 rounded-3xl border border-black/10 shadow-sm">
                <label className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#EFBB76] mb-4">
                  <Sparkles className="w-4 h-4" /> 1. Describe Your Vision
                </label>
                <textarea
                  value={config.prompt}
                  onChange={(e) => setConfig({ ...config, prompt: e.target.value })}
                  placeholder="e.g., A modern abstract design inspired by desert sunsets with flowing organic shapes..."
                  className="w-full bg-white border border-black/10 rounded-2xl px-6 py-4 min-h-[120px] focus:outline-none focus:border-[#EFBB76]/50 transition-all text-lg resize-none text-black"
                />
              </section>

              {/* Color Selection */}
              <section className="bg-black/5 p-8 rounded-3xl border border-black/10 shadow-sm">
                <label className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#EFBB76] mb-8">
                  <Palette className="w-4 h-4" /> 2. Select Color Palette (5 Colors)
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                  {config.colors.map((color, index) => (
                    <div key={index} className="flex flex-col items-center gap-4">
                      <div className="w-full aspect-square max-w-[150px] bg-white p-3 rounded-2xl border border-black/10">
                        <HexColorPicker 
                          color={color} 
                          onChange={(newColor) => updateColor(index, newColor)} 
                          className="!w-full !h-full"
                        />
                      </div>
                      <div className="w-full space-y-3">
                        <div className="flex items-center justify-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full border border-black/20" 
                            style={{ backgroundColor: color }} 
                          />
                          <span className="text-[10px] font-mono text-black/40 uppercase tracking-tighter">
                            {color}
                          </span>
                        </div>
                        <select
                          value={config.materialTypes[index]}
                          onChange={(e) => updateMaterialType(index, e.target.value)}
                          className="w-full bg-white border border-black/10 rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider focus:outline-none focus:border-[#EFBB76]/50 transition-all text-black"
                        >
                          {MATERIAL_TYPES.map(m => (
                            <option key={m.id} value={m.name}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Size Selection */}
              <section className="bg-black/5 p-8 rounded-3xl border border-black/10 shadow-sm">
                <label className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#EFBB76] mb-6">
                  <Ruler className="w-4 h-4" /> 3. Dimensions (FT)
                </label>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="grid grid-cols-2 gap-3">
                    {SIZE_PRESETS.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setConfig({ ...config, width: s.w, length: s.l })}
                        className={`p-4 rounded-xl border text-center transition-all ${
                          config.width === s.w && config.length === s.l
                          ? 'bg-[#EFBB76]/10 border-[#EFBB76] text-[#EFBB76]' 
                          : 'bg-white border-black/5 hover:border-black/20'
                        }`}
                      >
                        <span className="text-sm font-bold">{s.name}</span>
                      </button>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-black/20 uppercase">W</span>
                      <input
                        type="number"
                        value={config.width}
                        onChange={(e) => setConfig({ ...config, width: parseInt(e.target.value) || 0 })}
                        className="w-full bg-white border border-black/10 rounded-xl pl-10 pr-4 py-4 focus:outline-none focus:border-[#EFBB76]/50 transition-all font-bold text-black"
                      />
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-black/20 uppercase">L</span>
                      <input
                        type="number"
                        value={config.length}
                        onChange={(e) => setConfig({ ...config, length: parseInt(e.target.value) || 0 })}
                        className="w-full bg-white border border-black/10 rounded-xl pl-10 pr-4 py-4 focus:outline-none focus:border-[#EFBB76]/50 transition-all font-bold text-black"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Technical Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Construction */}
                <section className="bg-black/5 p-8 rounded-3xl border border-black/10 shadow-sm">
                  <label className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#EFBB76] mb-6">
                    <Layers className="w-4 h-4" /> 4. Construction
                  </label>
                  <div className="space-y-2">
                    {CONSTRUCTIONS.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setConfig({ ...config, construction: c.id })}
                        className={`w-full px-4 py-3 text-sm rounded-xl border flex justify-between items-center transition-all ${
                          config.construction === c.id 
                          ? 'bg-[#EFBB76]/10 border-[#EFBB76] text-[#EFBB76]' 
                          : 'bg-white border-black/5 hover:border-black/20'
                        }`}
                      >
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{c.name}</span>
                        </div>
                        <Check className={`w-4 h-4 ${config.construction === c.id ? 'opacity-100' : 'opacity-0'}`} />
                      </button>
                    ))}
                  </div>
                </section>

                {/* Pile & Finish */}
                <section className="bg-black/5 p-8 rounded-3xl border border-black/10 shadow-sm">
                  <label className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#EFBB76] mb-6">
                    <Move className="w-4 h-4" /> 5. Texture & Finish
                  </label>
                  
                  <div className="space-y-6">
                    <div>
                      <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest block mb-3">Pile Type</span>
                      <div className="flex gap-2">
                        {PILE_TYPES.map(p => (
                          <button
                            key={p.id}
                            onClick={() => setConfig({ ...config, pileType: p.id })}
                            className={`flex-1 py-2 text-xs rounded-lg border transition-all ${
                              config.pileType === p.id 
                              ? 'bg-[#EFBB76]/10 border-[#EFBB76] text-[#EFBB76]' 
                              : 'bg-white border-black/5 hover:border-black/20'
                            }`}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest block mb-3">Pile Height</span>
                      <div className="grid grid-cols-2 gap-2">
                        {PILE_HEIGHTS.map(p => (
                          <button
                            key={p.id}
                            onClick={() => setConfig({ ...config, pileHeight: p.id })}
                            className={`py-2 text-xs rounded-lg border transition-all ${
                              config.pileHeight === p.id 
                              ? 'bg-[#EFBB76]/10 border-[#EFBB76] text-[#EFBB76]' 
                              : 'bg-white border-black/5 hover:border-black/20'
                            }`}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest block mb-3">Surface Finish</span>
                      <div className="grid grid-cols-2 gap-2">
                        {SURFACE_FINISHES.map(f => (
                          <button
                            key={f.id}
                            onClick={() => toggleFinish(f.id)}
                            className={`py-2 text-xs rounded-lg border transition-all ${
                              config.surfaceFinishes.includes(f.id)
                              ? 'bg-[#EFBB76]/10 border-[#EFBB76] text-[#EFBB76]' 
                              : 'bg-white border-black/5 hover:border-black/20'
                            }`}
                          >
                            {f.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* Action Button */}
              <div className="pt-8 flex flex-col items-center">
                <button
                  onClick={generateImage}
                  disabled={!config.prompt || isGenerating}
                  className="group relative px-12 py-5 bg-[#EFBB76] text-black font-black text-xl rounded-full hover:bg-[#DBA762] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(239,187,118,0.3)] hover:shadow-[0_0_50px_rgba(239,187,118,0.5)] flex items-center gap-3"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" /> Generating...
                    </>
                  ) : (
                    <>
                      Visualize 4 Variations <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                    </>
                  )}
                </button>
                {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-screen flex flex-col bg-white"
          >
            {/* Main Preview Area */}
            <div className="relative flex-1 overflow-hidden">
              <button 
                onClick={() => setView('config')}
                className="absolute top-8 left-8 flex items-center gap-2 text-black/40 hover:text-[#EFBB76] transition-colors group z-50"
              >
                <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> Back to Edit
              </button>

              <div className="absolute top-8 right-8 flex items-center gap-4 bg-white/60 backdrop-blur-xl px-6 py-3 rounded-full border border-black/10 z-50 shadow-2xl">
                <div className="flex items-center gap-3 pr-4 border-r border-black/10">
                  <button 
                    onClick={() => setZoom(z => Math.max(50, z - 25))} 
                    className="text-black/60 hover:text-[#EFBB76] transition-colors"
                    title="Zoom Out"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <input 
                    type="range" 
                    min="50" 
                    max="300" 
                    value={zoom} 
                    onChange={(e) => setZoom(parseInt(e.target.value))}
                    className="w-24 accent-[#EFBB76] cursor-pointer"
                  />
                  <button 
                    onClick={() => setZoom(z => Math.min(300, z + 25))} 
                    className="text-black/60 hover:text-[#EFBB76] transition-colors"
                    title="Zoom In"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-mono font-bold text-[#EFBB76] w-12 text-center">{zoom}%</span>
                  <button 
                    onClick={() => setZoom(100)} 
                    className="text-[10px] font-black uppercase tracking-widest text-black/40 hover:text-black transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="w-full h-full overflow-auto p-8 lg:p-16 pt-32 lg:pt-40 scrollbar-hide custom-scrollbar">
                <div 
                  className="relative transition-all duration-300 mx-auto"
                  style={{ 
                    width: `${zoom}%`,
                    maxWidth: zoom <= 100 ? '1200px' : 'none',
                  }}
                >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <AnimatePresence mode="popLayout">
                    {isGenerating ? (
                      [0, 1, 2, 3].map((i) => (
                        <motion.div 
                          key={`loader-${i}`}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="aspect-[4/5] bg-black/5 rounded-3xl border border-black/10 flex flex-col items-center justify-center gap-4 overflow-hidden relative"
                        >
                          <div className="absolute inset-0 bg-gradient-to-t from-white/40 to-transparent z-10" />
                          <Loader2 className="w-8 h-8 animate-spin text-[#EFBB76] relative z-20" />
                          <span className="text-[10px] font-bold tracking-widest uppercase text-black/40 relative z-20">Generating Variation {i + 1}...</span>
                          <motion.div 
                            className="absolute bottom-0 left-0 h-1 bg-[#EFBB76]"
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 5, repeat: Infinity }}
                          />
                        </motion.div>
                      ))
                    ) : imageUrls.length > 0 ? (
                      imageUrls.map((url, i) => (
                        <motion.div
                          key={`rug-${i}`}
                          layoutId={`rug-${i}`}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`relative group cursor-pointer rounded-3xl overflow-hidden border transition-all duration-500 ${
                            selectedVariation === i 
                            ? 'ring-4 ring-[#EFBB76] border-transparent scale-[1.02] z-10 shadow-[0_0_50px_rgba(239,187,118,0.3)]' 
                            : 'border-black/10 hover:border-black/30'
                          }`}
                          onClick={() => setSelectedVariation(i === selectedVariation ? null : i)}
                        >
                          <img 
                            src={url} 
                            alt={`Variation ${i + 1}`} 
                            className="w-full h-auto object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-300 ${selectedVariation === i ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
                            <div className="flex flex-col gap-3 items-center p-4 text-center">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedVariation(i);
                                }}
                                className="bg-[#EFBB76] text-black px-6 py-3 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-transform shadow-xl"
                              >
                                Select Variation {i + 1} <Sparkles className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFullScreenIdx(i);
                                }}
                                className="bg-white/10 backdrop-blur-md text-white px-6 py-3 rounded-full font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-white/20 transition-colors border border-white/10"
                              >
                                View Full Screen <Maximize2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="absolute top-4 left-4 bg-white/60 backdrop-blur-md px-3 py-1 rounded-full border border-black/10">
                            <span className="text-[10px] font-bold text-black/60 uppercase tracking-widest">V{i + 1}</span>
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="col-span-4 aspect-video bg-black/5 rounded-3xl border border-black/10 flex items-center justify-center text-black/10">
                        <RefreshCw className="w-16 h-16 animate-pulse" />
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

              <div className="absolute bottom-8 flex gap-4 left-1/2 -translate-x-1/2">
                <button 
                  onClick={() => {
                    setConfig(prev => ({ ...prev, seed: Math.floor(Math.random() * 1000000) }));
                    generateImage();
                  }}
                  className="px-6 py-3 bg-white/80 backdrop-blur-md rounded-full border border-black/10 hover:bg-white transition-all flex items-center gap-2 group shadow-lg"
                >
                  <RefreshCw className={`w-5 h-5 ${isGenerating ? 'animate-spin text-[#EFBB76]' : 'group-hover:text-[#EFBB76]'}`} />
                  <span className="text-sm font-medium">Regenerate Grid</span>
                </button>
                <button 
                  onClick={() => {
                    if (!user) {
                      setIsAuthModalOpen(true);
                      return;
                    }
                    setIsSaveModalOpen(true);
                  }}
                  className="p-3 bg-white/80 backdrop-blur-md rounded-full border border-black/10 hover:bg-white transition-colors shadow-lg"
                  title="Save Design"
                >
                  <Save className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Horizontal Estimate Bar */}
            <div className="bg-white border-t border-black/5 p-6 lg:px-12">
              <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row items-center justify-between gap-8">
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-8 w-full">
                  {/* Material & Fiber */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      <span className="text-[10px] font-bold tracking-widest uppercase text-green-500">Material & Fiber</span>
                    </div>
                    <div className="space-y-1">
                      {Object.entries(config.materialTypes.reduce((acc, m) => {
                        acc[m] = (acc[m] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)).map(([material, count]) => (
                        <div key={material} className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-black/20">{count}x</span>
                          <span className="text-xs font-bold text-black/80">{material}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pile Height */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      <span className="text-[10px] font-bold tracking-widest uppercase text-red-500">Pile Height</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-black/20">1x</span>
                      <span className="text-xs font-bold text-black/80">
                        {PILE_TYPES.find(p => p.id === config.pileType)?.name} ({PILE_HEIGHTS.find(p => p.id === config.pileHeight)?.name})
                      </span>
                    </div>
                  </div>

                  {/* Construction & Rate */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                      <span className="text-[10px] font-bold tracking-widest uppercase text-yellow-500">Construction</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-black/80">{CONSTRUCTIONS.find(c => c.id === config.construction)?.name}</div>
                    </div>
                  </div>

                  {/* Production & Origin */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                      <span className="text-[10px] font-bold tracking-widest uppercase text-orange-500">Production & Origin</span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="text-[8px] font-bold text-black/30 uppercase tracking-widest">Production Time</div>
                        <div className="text-xs font-bold text-black/80">6-8 weeks</div>
                      </div>
                      <div>
                        <div className="text-[8px] font-bold text-black/30 uppercase tracking-widest">Craft Origin</div>
                        <div className="text-[10px] font-bold text-black/60 leading-tight">Ethically artisan-made in Nepal / India</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8 pl-8 border-l border-black/5">
                  <div className="text-right">
                    <div className="text-[10px] font-bold tracking-widest uppercase text-black/30">Status</div>
                    <div className="text-4xl font-black tracking-tighter">Ready</div>
                    <div className="text-[8px] font-bold text-green-500 uppercase tracking-tighter mt-1">Design finalized and ready for quote</div>
                  </div>
                  <button 
                    disabled={selectedVariation === null}
                    className="px-8 py-4 bg-[#EFBB76] text-black font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-[#DBA762] transition-all disabled:opacity-30 shadow-xl"
                  >
                    {selectedVariation !== null ? 'Request Quote' : 'Select Design'}
                  </button>
                </div>
              </div>
            </div>

            {/* Full Screen Modal */}
            <AnimatePresence>
              {fullScreenIdx !== null && (
                <FullScreenModal 
                  url={imageUrls[fullScreenIdx]} 
                  index={fullScreenIdx} 
                  onClose={() => setFullScreenIdx(null)}
                  onSelect={(idx) => {
                    setSelectedVariation(idx);
                    setFullScreenIdx(null);
                  }}
                  setIsSaveModalOpen={setIsSaveModalOpen}
                  user={user}
                  setIsAuthModalOpen={setIsAuthModalOpen}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(user) => setUser(user)}
      />

      <SaveModal 
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={saveDesign}
        designName={designName}
        setDesignName={setDesignName}
        folders={folders}
        selectedFolderId={selectedFolderId}
        setSelectedFolderId={setSelectedFolderId}
        isCreatingFolder={isCreatingFolder}
        setIsCreatingFolder={setIsCreatingFolder}
        newFolderName={newFolderName}
        setNewFolderName={setNewFolderName}
        onCreateFolder={createFolder}
      />

      <AnimatePresence>
        {selectedSavedDesign && (
          <SavedDesignDetail 
            design={selectedSavedDesign} 
            onClose={() => setSelectedSavedDesign(null)} 
          />
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(239, 187, 118, 0.2);
        }
      `}</style>
    </div>
  );
}

function AuthModal({ isOpen, onClose, onAuthSuccess }: { isOpen: boolean, onClose: () => void, onAuthSuccess: (user: any) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Mock auth for now - will be replaced with real Firebase Auth once terms are accepted
      setTimeout(() => {
        onAuthSuccess({ email, uid: 'mock-uid' });
        setLoading(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white border border-black/10 rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="p-8 border-b border-black/5 flex items-center justify-between">
          <h3 className="text-xl font-serif font-bold text-black">{isLogin ? 'Sign In' : 'Create Account'}</h3>
          <button onClick={onClose} className="text-black/40 hover:text-black transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-500 text-xs rounded-xl border border-red-100">{error}</div>}
          <div>
            <label className="text-[10px] font-bold text-black/30 uppercase tracking-widest block mb-2">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#EFBB76]/50 transition-all text-black"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-black/30 uppercase tracking-widest block mb-2">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#EFBB76]/50 transition-all text-black"
            />
          </div>
          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#EFBB76] text-black font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-[#DBA762] transition-all shadow-xl disabled:opacity-50"
          >
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
          <div className="text-center">
            <button 
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-xs text-black/40 hover:text-[#EFBB76] transition-colors"
            >
              {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function SaveModal({ 
  isOpen, 
  onClose, 
  onSave, 
  designName, 
  setDesignName, 
  folders, 
  selectedFolderId, 
  setSelectedFolderId,
  isCreatingFolder,
  setIsCreatingFolder,
  newFolderName,
  setNewFolderName,
  onCreateFolder
}: any) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white border border-black/10 rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="p-8 border-b border-black/5 flex items-center justify-between">
          <h3 className="text-xl font-serif font-bold text-black">Save to Collection</h3>
          <button onClick={onClose} className="text-black/40 hover:text-black transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div>
            <label className="text-[10px] font-bold text-black/30 uppercase tracking-widest block mb-2">Design Name</label>
            <input 
              type="text" 
              value={designName}
              onChange={(e) => setDesignName(e.target.value)}
              placeholder="Enter a name for your design..."
              className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#EFBB76]/50 transition-all text-black"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-black/30 uppercase tracking-widest block">Select Folder</label>
              <button 
                onClick={() => setIsCreatingFolder(true)}
                className="text-[10px] text-[#EFBB76] hover:underline flex items-center gap-1"
              >
                <FolderPlus className="w-3 h-3" /> New Folder
              </button>
            </div>
            
            {isCreatingFolder ? (
              <div className="flex gap-2">
                <input 
                  type="text" 
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name..."
                  className="flex-1 bg-black/5 border border-black/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#EFBB76]/50 transition-all text-black"
                />
                <button 
                  onClick={onCreateFolder}
                  className="bg-[#EFBB76] text-black px-4 py-2 rounded-xl font-bold text-xs"
                >
                  Create
                </button>
                <button 
                  onClick={() => setIsCreatingFolder(false)}
                  className="bg-black/5 text-black px-4 py-2 rounded-xl font-bold text-xs"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                {folders.map((folder: Folder) => (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                      selectedFolderId === folder.id 
                      ? 'bg-[#EFBB76]/10 border-[#EFBB76] text-[#EFBB76]' 
                      : 'bg-black/5 border-black/5 hover:border-black/20 text-black/60'
                    }`}
                  >
                    <FolderIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">{folder.name}</span>
                    {selectedFolderId === folder.id && <Check className="w-4 h-4 ml-auto" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-8 bg-black/5 border-t border-black/5">
          <button 
            onClick={onSave}
            className="w-full py-4 bg-[#EFBB76] text-black font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-[#DBA762] transition-all shadow-xl"
          >
            Confirm & Save
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function SavedDesignDetail({ design, onClose }: { design: SavedDesign, onClose: () => void }) {
  const estimate = calculateEstimate(design.config);
  
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white border border-black/10 rounded-[32px] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col md:flex-row"
      >
        <div className="flex-1 bg-black/5 flex items-center justify-center p-8 overflow-hidden">
          <img 
            src={design.imageUrl} 
            alt={design.name} 
            className="max-w-full max-h-full object-contain rounded-xl shadow-lg"
            referrerPolicy="no-referrer"
          />
        </div>
        
        <div className="w-full md:w-[400px] p-8 overflow-y-auto custom-scrollbar flex flex-col bg-white">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-2xl font-serif font-bold text-black">{design.name}</h3>
              <p className="text-[10px] text-black/30 uppercase tracking-[0.2em] mt-1">Saved on {new Date(design.createdAt).toLocaleDateString()}</p>
            </div>
            <button onClick={onClose} className="text-black/40 hover:text-black transition-colors p-2 bg-black/5 rounded-full">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6 flex-1">
            <div className="p-4 bg-black/5 rounded-2xl border border-black/5">
              <span className="text-[10px] font-bold text-[#EFBB76] uppercase tracking-widest block mb-2">Prompt</span>
              <p className="text-sm italic text-black/60 leading-relaxed">"{design.config.prompt}"</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-black/5 rounded-2xl border border-black/5">
                <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest block mb-2">Dimensions</span>
                <div className="flex items-center gap-2">
                  <Maximize className="w-4 h-4 text-[#EFBB76]" />
                  <span className="text-lg font-bold">{design.config.width}' x {design.config.length}'</span>
                </div>
              </div>
              <div className="p-4 bg-black/5 rounded-2xl border border-black/5">
                <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest block mb-2">Construction</span>
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#EFBB76]" />
                  <span className="text-sm font-bold">{CONSTRUCTIONS.find(c => c.id === design.config.construction)?.name}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-black/5 rounded-2xl border border-black/5">
              <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest block mb-3">Color Palette & Materials</span>
              <div className="grid grid-cols-5 gap-2">
                {design.config.colors.map((c, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className="w-full aspect-square rounded shadow-inner border border-black/10" style={{ backgroundColor: c }} />
                    <span className="text-[8px] text-black/40 font-bold uppercase truncate w-full text-center">
                      {design.config.materialTypes[i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-black/5 rounded-2xl border border-black/5">
                <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest block mb-1">Pile</span>
                <p className="text-sm font-medium">{PILE_TYPES.find(p => p.id === design.config.pileType)?.name}</p>
                <p className="text-[10px] text-black/40">{PILE_HEIGHTS.find(p => p.id === design.config.pileHeight)?.name}</p>
              </div>
              <div className="p-4 bg-black/5 rounded-2xl border border-black/5">
                <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest block mb-1">Finishes</span>
                <div className="flex flex-wrap gap-1">
                  {design.config.surfaceFinishes.map(id => (
                    <span key={id} className="text-[10px] bg-[#EFBB76]/10 text-[#EFBB76] px-2 py-0.5 rounded-full border border-[#EFBB76]/20">
                      {SURFACE_FINISHES.find(f => f.id === id)?.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-black/5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold tracking-widest uppercase opacity-30">Status</span>
              <span className="text-2xl font-serif font-bold">Ready</span>
            </div>
            <button className="w-full py-4 bg-[#EFBB76] text-black font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-[#DBA762] transition-all shadow-xl">
              Request Official Quote
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function FullScreenModal({ 
  url, 
  index, 
  onClose, 
  onSelect, 
  setIsSaveModalOpen, 
  user, 
  setIsAuthModalOpen 
}: { 
  url: string, 
  index: number, 
  onClose: () => void, 
  onSelect: (idx: number) => void, 
  setIsSaveModalOpen: (open: boolean) => void,
  user: any,
  setIsAuthModalOpen: (open: boolean) => void
}) {
  const [modalZoom, setModalZoom] = useState(100);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-2xl flex flex-col"
    >
      {/* Modal Header */}
      <div className="flex items-center justify-between p-6 border-b border-black/5 bg-white/40 backdrop-blur-md z-50">
        <div className="flex items-center gap-6">
          <button 
            onClick={onClose}
            className="text-black/40 hover:text-black transition-colors p-2 bg-black/5 rounded-full"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h3 className="text-black font-serif text-xl font-bold leading-none">Variation {index + 1}</h3>
            <p className="text-black/30 text-[10px] uppercase tracking-[0.2em] mt-1">High-Resolution Inspection</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 bg-black/5 px-4 py-2 rounded-full border border-black/10">
            <button onClick={() => setModalZoom(z => Math.max(50, z - 25))} className="text-black/40 hover:text-[#EFBB76]"><Minus className="w-4 h-4" /></button>
            <span className="text-xs font-mono font-bold w-12 text-center text-black">{modalZoom}%</span>
            <button onClick={() => setModalZoom(z => Math.min(400, z + 25))} className="text-black/40 hover:text-[#EFBB76]"><Plus className="w-4 h-4" /></button>
          </div>
          <button 
            onClick={() => onSelect(index)}
            className="bg-[#EFBB76] text-black px-6 py-3 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-[#DBA762] transition-colors shadow-lg"
          >
            Select Design <Check className="w-4 h-4" />
          </button>
          <button 
            onClick={() => {
              if (!user) {
                setIsAuthModalOpen(true);
                return;
              }
              setIsSaveModalOpen(true);
            }}
            className="bg-black/5 text-black p-3 rounded-full hover:bg-black/10 transition-colors border border-black/10"
            title="Save Design"
          >
            <Save className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Modal Content */}
      <div className="flex-1 overflow-auto p-8 lg:p-12 flex items-start justify-center scrollbar-hide custom-scrollbar">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative origin-top transition-all duration-300"
          style={{ width: `${modalZoom}%`, maxWidth: modalZoom <= 100 ? '1000px' : 'none' }}
        >
          <img 
            src={url} 
            alt={`Variation ${index + 1}`} 
            className="w-full h-auto rounded-xl shadow-2xl border border-black/10"
            referrerPolicy="no-referrer"
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
