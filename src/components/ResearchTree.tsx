/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useGame } from '../store/GameContext';
import { TECH_TREE, ITEMS } from '../data';
import { Technology, Item } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FlaskConical, CheckCircle2, Lock, ArrowRight, Shield, Crosshair, 
  Syringe, Package, Flame, Clock, Sparkles, Zap, AlertCircle, X, 
  Layers, Scale, Gauge, Info, ChevronRight, Play, StopCircle
} from 'lucide-react';

// Helper to get category icon
export const getCategoryIcon = (category?: string, size = 14) => {
  switch (category) {
    case 'WEAPONS':
      return <Crosshair size={size} className="text-cyan-400" />;
    case 'ARMOR':
      return <Shield size={size} className="text-emerald-400" />;
    case 'MEDICAL':
      return <Syringe size={size} className="text-rose-400" />;
    case 'TACTICAL':
      return <Package size={size} className="text-amber-400" />;
    case 'EXPLOSIVE':
      return <Flame size={size} className="text-orange-400" />;
    default:
      return <FlaskConical size={size} className="text-blue-400" />;
  }
};

// Format estimated completion time (minutes to HH:MM format)
export const formatEstimatedTime = (minutes: number): string => {
  if (minutes <= 0) return 'Immediate';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h 00m`;
  return `${mins}m`;
};

interface ResearchTreeProps {
  onSelectTechForInspection?: (techId: string) => void;
  selectedTechId?: string | null;
}

export const ResearchTree: React.FC<ResearchTreeProps> = ({
  onSelectTechForInspection,
  selectedTechId: externalSelectedTechId
}) => {
  const { state, startResearch, cancelResearch } = useGame();
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [inspectTechId, setInspectTechId] = useState<string | null>(externalSelectedTechId || null);

  // Pan and Zoom interactive view state
  const [viewMode, setViewMode] = useState<'CANVAS' | 'GRID'>('CANVAS');
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (externalSelectedTechId) {
      setInspectTechId(externalSelectedTechId);
    }
  }, [externalSelectedTechId]);

  // Calculate Lab research capacity
  const countLabs = state.baseSectors?.filter(s => s.type === 'LAB').length ?? 1;
  const researchRatePerMinute = 0.1 * countLabs; // 6 RP / hour per lab
  const researchRatePerHour = Math.round(researchRatePerMinute * 60);

  // Group technologies by Tier (1 to 4)
  const allTechs = Object.values(TECH_TREE);
  const tiers = [1, 2, 3, 4];

  // Helper to check if tech meets all prerequisites
  const canResearchTech = (tech: Technology) => {
    if (state.unlockedTech.includes(tech.id)) return false;
    return tech.requirements.every(reqId => state.unlockedTech.includes(reqId));
  };

  // Currently inspecting tech details
  const inspectTech = inspectTechId ? TECH_TREE[inspectTechId] : null;

  // Active Research Map
  const activeResearchesMap = state.activeResearches || (state.currentResearch ? { [state.currentResearch]: state.researchProgress } : {});
  const activeTechIds = Object.keys(activeResearchesMap);
  const maxResearchSlots = Math.max(1, countLabs);

  const canvasContentRef = useRef<HTMLDivElement>(null);
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number; w: number; h: number }>>({});

  const updateNodePositions = useCallback(() => {
    if (!canvasContentRef.current) return;
    const parentRect = canvasContentRef.current.getBoundingClientRect();
    if (!parentRect.width) return;

    const newPositions: Record<string, { x: number; y: number; w: number; h: number }> = {};
    const elements = canvasContentRef.current.querySelectorAll('[data-tech-id]');
    elements.forEach((el) => {
      const techId = el.getAttribute('data-tech-id');
      if (!techId) return;
      const rect = el.getBoundingClientRect();
      const x = (rect.left - parentRect.left) / zoom;
      const y = (rect.top - parentRect.top) / zoom;
      const w = rect.width / zoom;
      const h = rect.height / zoom;
      newPositions[techId] = { x, y, w, h };
    });
    setNodePositions(newPositions);
  }, [zoom]);

  useEffect(() => {
    updateNodePositions();
    const handleResize = () => updateNodePositions();
    window.addEventListener('resize', handleResize);
    const timer = setTimeout(updateNodePositions, 80);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [updateNodePositions, activeCategory, state.unlockedTech, viewMode]);

  const renderConnectionLines = () => {
    const lines: React.ReactNode[] = [];

    allTechs.forEach(tech => {
      if (activeCategory !== 'ALL' && tech.category !== activeCategory) return;

      const toPos = nodePositions[tech.id];
      if (!toPos) return;

      const isTechUnlocked = state.unlockedTech.includes(tech.id);
      const isTechCurrent = activeTechIds.includes(tech.id);
      const isTechReady = canResearchTech(tech);

      tech.requirements.forEach(reqId => {
        const fromPos = nodePositions[reqId];
        if (!fromPos) return;

        const isReqUnlocked = state.unlockedTech.includes(reqId);

        const startX = fromPos.x + fromPos.w;
        const startY = fromPos.y + fromPos.h / 2;
        const endX = toPos.x;
        const endY = toPos.y + toPos.h / 2;

        const dx = Math.max(30, (endX - startX) * 0.45);
        const pathD = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;

        let strokeColor = "#334155";
        let strokeWidth = 1.5;
        let strokeDash = "4 4";
        let marker = "url(#arrow-locked)";
        let glowClass = "";
        let opacity = 0.4;

        if (isReqUnlocked) {
          opacity = 0.95;
          if (isTechUnlocked) {
            strokeColor = "#10b981";
            strokeWidth = 2.5;
            strokeDash = "none";
            marker = "url(#arrow-emerald)";
            glowClass = "drop-shadow-[0_0_6px_rgba(16,185,129,0.7)]";
          } else if (isTechCurrent) {
            strokeColor = "#f59e0b";
            strokeWidth = 2.5;
            strokeDash = "6 4";
            marker = "url(#arrow-amber)";
            glowClass = "drop-shadow-[0_0_8px_rgba(251,191,36,0.9)] animate-pulse";
          } else if (isTechReady) {
            strokeColor = "#06b6d4";
            strokeWidth = 2.5;
            strokeDash = "none";
            marker = "url(#arrow-cyan)";
            glowClass = "drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]";
          } else {
            strokeColor = "#38bdf8";
            strokeWidth = 2;
            strokeDash = "4 4";
            marker = "url(#arrow-cyan)";
          }
        }

        lines.push(
          <g key={`${reqId}->${tech.id}`}>
            <path
              d={pathD}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDash}
              markerEnd={marker}
              opacity={opacity}
              className={`transition-all duration-300 ${glowClass}`}
            />
          </g>
        );
      });
    });

    return lines;
  };

  const handleStartResearchProject = (techId: string) => {
    if (activeTechIds.length >= maxResearchSlots) {
      alert(`All ${maxResearchSlots} Lab research slots are currently occupied! Build another Tech Laboratory in HQ or a conquered building to conduct more concurrent research.`);
      return;
    }
    startResearch(techId as any);
  };

  // Drag & touch to pan handlers
  const lastTouchDistRef = useRef<number | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
    setIsDragging(true);
    setHasDragged(false);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  // Clamp Pan dynamically to keep content visible without losing top/bottom edges
  const clampPan = useCallback((newX: number, newY: number, customZoom?: number) => {
    const currentZoom = customZoom ?? zoom;
    let containerWidth = 800;
    let containerHeight = 600;
    let contentWidth = 1000;
    let contentHeight = 800;

    if (containerRef.current) {
      containerWidth = containerRef.current.clientWidth || 800;
      containerHeight = containerRef.current.clientHeight || 600;
    }
    if (canvasContentRef.current) {
      contentWidth = canvasContentRef.current.scrollWidth || canvasContentRef.current.offsetWidth || 1000;
      contentHeight = canvasContentRef.current.scrollHeight || canvasContentRef.current.offsetHeight || 800;
    }

    const scaledWidth = contentWidth * currentZoom;
    const scaledHeight = contentHeight * currentZoom;

    // Max X (dragging right): top-left edge stays near left container boundary (max 50px offset)
    const maxX = 50;
    // Min X (dragging left): rightmost content reaches inside container with padding
    const minX = Math.min(-50, containerWidth - scaledWidth - 100);

    // Max Y (dragging down): top edge stays near top container boundary (max 20px offset)
    // PREVENTS the user from moving canvas down so far that nothing is on screen!
    const maxY = 20;
    // Min Y (dragging up): allows dragging up as much as needed so bottom items are visible in full!
    const minY = Math.min(-20, containerHeight - scaledHeight - 120);

    return {
      x: Math.min(maxX, Math.max(minX, newX)),
      y: Math.min(maxY, Math.max(minY, newY))
    };
  }, [zoom]);

  // Keep pan clamped when zoom or category changes
  useEffect(() => {
    setPan(p => clampPan(p.x, p.y));
  }, [zoom, activeCategory, clampPan]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const rawX = e.clientX - dragStart.x;
    const rawY = e.clientY - dragStart.y;
    if (Math.abs(rawX - pan.x) > 4 || Math.abs(rawY - pan.y) > 4) {
      setHasDragged(true);
    }
    setPan(clampPan(rawX, rawY));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for phones/tablets
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
    
    if (e.touches.length === 1) {
      setIsDragging(true);
      setHasDragged(false);
      setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastTouchDistRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1 && isDragging) {
      const rawX = e.touches[0].clientX - dragStart.x;
      const rawY = e.touches[0].clientY - dragStart.y;
      if (Math.abs(rawX - pan.x) > 4 || Math.abs(rawY - pan.y) > 4) {
        setHasDragged(true);
      }
      setPan(clampPan(rawX, rawY));
    } else if (e.touches.length === 2 && lastTouchDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = dist - lastTouchDistRef.current;
      if (Math.abs(delta) > 8) {
        if (delta > 0) handleZoomIn();
        else handleZoomOut();
        lastTouchDistRef.current = dist;
      }
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    lastTouchDistRef.current = null;
  };

  // Zoom controls
  const handleZoomIn = () => setZoom(z => Math.min(1.8, +(z + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoom(z => Math.max(0.55, +(z - 0.15).toFixed(2)));

  // Wheel zoom / trackpad panning
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.deltaY < 0) {
        handleZoomIn();
      } else {
        handleZoomOut();
      }
    } else {
      setPan(p => clampPan(p.x - e.deltaX, p.y - e.deltaY));
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 bg-slate-950 border border-slate-800 rounded-sm overflow-hidden text-slate-100 select-none relative">
      
      {/* Concise Header Bar */}
      <div className="bg-slate-900/90 border-b border-slate-800 p-2.5 px-3 flex flex-wrap justify-between items-center gap-2 shrink-0 z-10">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="p-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded text-cyan-400">
            <FlaskConical size={16} />
          </div>
          <span className="font-black text-[12px] md:text-[13px] uppercase tracking-wider text-white">
            R&D MATRIX
          </span>

          <div className="flex items-center gap-2 text-[9px] font-mono font-bold uppercase text-slate-300 bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
            <span className="flex items-center gap-1 text-amber-300">
              <Zap size={10} className="text-amber-400" /> {researchRatePerHour} RP/HR
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400">
              UNLOCKED: {state.unlockedTech.length}/{allTechs.length} ({Math.round((state.unlockedTech.length / allTechs.length) * 100)}%)
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-cyan-300">
              SLOTS: {activeTechIds.length}/{maxResearchSlots}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-950 p-0.5 border border-slate-800 rounded">
            <button
              onClick={() => setViewMode('CANVAS')}
              className={`px-2 py-0.5 text-[9px] font-mono font-black uppercase rounded ${
                viewMode === 'CANVAS' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Canvas
            </button>
            <button
              onClick={() => setViewMode('GRID')}
              className={`px-2 py-0.5 text-[9px] font-mono font-black uppercase rounded ${
                viewMode === 'GRID' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Grid
            </button>
          </div>

          {/* Category Filters */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            {['ALL', 'WEAPONS', 'ARMOR', 'MEDICAL', 'TACTICAL', 'EXPLOSIVE'].map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2 py-0.5 rounded text-[9px] font-mono font-black uppercase transition-all border whitespace-nowrap ${
                  activeCategory === cat 
                    ? 'bg-cyan-500 text-slate-950 border-cyan-300' 
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Viewport Content: Canvas or Grid */}
      {viewMode === 'GRID' ? (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 md:p-6 bg-slate-950">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {tiers.map(tierNum => {
              const tierTechs = allTechs.filter(t => (t.tier || 1) === tierNum && (activeCategory === 'ALL' || t.category === activeCategory));
              return (
                <div key={tierNum} className="flex flex-col gap-3 bg-slate-900/40 p-3 rounded border border-slate-800">
                  <div className="bg-slate-900 border border-slate-700 p-2 rounded text-[10px] font-mono font-black uppercase flex justify-between items-center text-slate-300">
                    <span className="flex items-center gap-1.5 text-cyan-400">
                      <Sparkles size={12} /> TIER 0{tierNum}
                    </span>
                    <span className="text-[8px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-bold">
                      {tierTechs.length} NODES
                    </span>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {tierTechs.map(tech => {
                      const isUnlocked = state.unlockedTech.includes(tech.id);
                      const isCurrent = activeTechIds.includes(tech.id);
                      const nodeProgress = activeResearchesMap[tech.id] || 0;
                      const nodeProgressPercent = Math.min(100, Math.round((nodeProgress / tech.cost) * 100));
                      const isAvailable = canResearchTech(tech);
                      const isLocked = !isUnlocked && !isCurrent && !isAvailable;
                      return (
                        <div
                          key={tech.id}
                          onClick={() => setInspectTechId(tech.id)}
                          className={`p-3 rounded border cursor-pointer transition-all ${
                            isUnlocked 
                              ? 'bg-emerald-950/30 border-emerald-500/50 hover:border-emerald-400' 
                              : isCurrent 
                                ? 'bg-amber-950/40 border-amber-500/80 hover:border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.25)]' 
                                : isAvailable 
                                  ? 'bg-slate-900/90 border-cyan-500/60 hover:border-cyan-300' 
                                  : 'bg-slate-950/80 border-slate-800/80 opacity-60'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <span className="text-white font-black text-xs uppercase">{tech.name}</span>
                            {isUnlocked ? (
                              <CheckCircle2 size={14} className="text-emerald-400" />
                            ) : isCurrent ? (
                              <FlaskConical size={14} className="text-amber-400 animate-pulse" />
                            ) : isLocked ? (
                              <Lock size={14} className="text-slate-600" />
                            ) : (
                              <FlaskConical size={14} className="text-cyan-400" />
                            )}
                          </div>
                          <p className="text-[9px] text-slate-400 mt-1 line-clamp-2">{tech.description}</p>
                          
                          {/* Pulsing Progress Bar for Active Research */}
                          {isCurrent && (
                            <div className="mt-2 pt-1.5 border-t border-amber-500/40">
                              <div className="flex justify-between text-[8.5px] font-mono font-black uppercase text-amber-300 mb-1">
                                <span className="flex items-center gap-1">
                                  <FlaskConical size={10} className="animate-spin text-amber-400" /> RESEARCHING
                                </span>
                                <span>{nodeProgressPercent}%</span>
                              </div>
                              <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-amber-500/50 shadow-[0_0_6px_rgba(251,191,36,0.4)]">
                                <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]" style={{ width: `${nodeProgressPercent}%` }} />
                              </div>
                            </div>
                          )}

                          <div className="mt-2 text-[9px] font-mono text-cyan-300 font-bold flex justify-between">
                            <span>Cost: {tech.cost} RP</span>
                            <span className="text-amber-400">View Details &rarr;</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Pannable & Zoomable Canvas Viewport */
        <div 
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onWheel={handleWheel}
          className={`flex-1 min-h-0 relative overflow-hidden bg-slate-950/90 touch-none ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          {/* Transformed Inner Tech Tree Content */}
          <div 
            ref={canvasContentRef}
            className="p-6 md:p-8 min-w-[1000px] min-h-[650px] relative transition-transform duration-75 origin-top-left"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}
          >
            {/* SVG Connector Lines Layer */}
            <svg className="absolute inset-0 pointer-events-none w-full h-full z-0 overflow-visible">
              <defs>
                <marker id="arrow-emerald" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#10b981" />
                </marker>
                <marker id="arrow-cyan" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#06b6d4" />
                </marker>
                <marker id="arrow-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#f59e0b" />
                </marker>
                <marker id="arrow-locked" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#475569" />
                </marker>
              </defs>
              {renderConnectionLines()}
            </svg>

            <div className="grid grid-cols-4 gap-8 md:gap-12 relative z-10">
              
              {tiers.map(tierNum => {
                const tierTechs = allTechs.filter(t => (t.tier || 1) === tierNum && (activeCategory === 'ALL' || t.category === activeCategory));

                return (
                  <div key={tierNum} className="flex flex-col gap-3 relative">
                    {/* Tier Column Header */}
                    <div className="bg-slate-900/90 border border-slate-800 p-2 px-3 rounded text-[10px] font-mono font-black uppercase flex justify-between items-center text-slate-300 shadow-md">
                      <span className="flex items-center gap-1.5 text-cyan-400">
                        <Sparkles size={12} /> TIER 0{tierNum}
                      </span>
                      <span className="text-[8px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-bold">
                        {tierTechs.length} PROJECT{tierTechs.length !== 1 ? 'S' : ''}
                      </span>
                    </div>

                    {/* Tech Cards List */}
                    <div className="flex flex-col gap-3">
                      {tierTechs.length === 0 ? (
                        <div className="p-4 bg-slate-900/30 border border-slate-900 rounded text-center text-[10px] font-mono text-slate-600 uppercase">
                          No Projects in this Tier
                        </div>
                      ) : (
                        tierTechs.map(tech => {
                          const isUnlocked = state.unlockedTech.includes(tech.id);
                          const isCurrent = activeTechIds.includes(tech.id);
                          const nodeProgress = activeResearchesMap[tech.id] || 0;
                          const nodeProgressPercent = Math.min(100, Math.round((nodeProgress / tech.cost) * 100));
                          const isAvailable = canResearchTech(tech);
                          const isLocked = !isUnlocked && !isCurrent && !isAvailable;

                          // Calculate estimated duration from scratch
                          const estMinutes = researchRatePerMinute > 0 ? tech.cost / researchRatePerMinute : 0;

                          return (
                            <div
                              key={tech.id}
                              data-tech-id={tech.id}
                              onClick={() => {
                                if (!hasDragged) {
                                  setInspectTechId(tech.id);
                                }
                              }}
                              className={`group relative p-3 border-2 rounded transition-all cursor-pointer shadow-md ${
                                isUnlocked 
                                  ? 'border-emerald-500/60 bg-emerald-950/25 hover:border-emerald-400 hover:bg-emerald-950/40 shadow-[0_0_12px_rgba(16,185,129,0.15)]' 
                                  : isCurrent 
                                    ? 'border-amber-400 bg-amber-950/45 text-glow-orange shadow-[0_0_20px_rgba(251,191,36,0.35)] ring-1 ring-amber-400/50'
                                    : isAvailable 
                                      ? 'border-cyan-400 bg-cyan-950/30 hover:border-cyan-300 hover:bg-cyan-950/50 shadow-[0_0_18px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400/40'
                                      : 'border-slate-800 bg-slate-950/80 hover:border-slate-700 opacity-60 hover:opacity-90'
                              }`}
                            >
                              {/* Node Header */}
                              <div className="flex justify-between items-start mb-1.5 gap-2">
                                <div className="flex items-center gap-1.5">
                                  {getCategoryIcon(tech.category, 13)}
                                  <span className="text-[9px] font-mono font-bold uppercase text-slate-400">
                                    {tech.category || 'GENERAL'}
                                  </span>
                                </div>

                                {/* Status Badge */}
                                {isUnlocked && (
                                  <span className="text-[8px] font-mono font-black uppercase text-emerald-400 bg-emerald-950 border border-emerald-500/50 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                                    <CheckCircle2 size={10} /> DONE
                                  </span>
                                )}
                                {isCurrent && (
                                  <span className="text-[8px] font-mono font-black uppercase text-amber-300 bg-amber-950 border border-amber-500/60 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.4)]">
                                    <FlaskConical size={10} /> BUSY
                                  </span>
                                )}
                                {isAvailable && (
                                  <span className="text-[8px] font-mono font-black uppercase text-cyan-300 bg-cyan-950 border border-cyan-400/60 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-[0_0_10px_rgba(6,182,212,0.4)]">
                                    <Sparkles size={10} className="text-cyan-400" /> READY
                                  </span>
                                )}
                                {isLocked && (
                                  <span className="text-[8px] font-mono font-bold uppercase text-slate-500 bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <Lock size={10} /> LOCKED
                                  </span>
                                )}
                              </div>

                              {/* Tech Name */}
                              <h4 className={`font-black text-[11px] md:text-[12px] uppercase tracking-tight leading-snug ${
                                isCurrent ? 'text-amber-200' : isUnlocked ? 'text-emerald-200' : isAvailable ? 'text-white' : 'text-slate-300'
                              }`}>
                                {tech.name}
                              </h4>

                              {/* Description snippet */}
                              <p className="text-[9.5px] text-slate-400 line-clamp-2 mt-1 leading-snug">
                                {tech.description}
                              </p>

                              {/* Live Pulsing Progress Bar for active tech */}
                              {isCurrent && (
                                <div className="mt-2.5 pt-2 border-t border-amber-500/40">
                                  <div className="flex justify-between items-center text-[8.5px] font-mono font-black uppercase text-amber-300 mb-1">
                                    <span className="flex items-center gap-1">
                                      <FlaskConical size={10} className="animate-spin text-amber-400" />
                                      RESEARCHING
                                    </span>
                                    <span>{nodeProgressPercent}%</span>
                                  </div>
                                  <div className="h-2 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-amber-500/50 shadow-[0_0_8px_rgba(251,191,36,0.3)]">
                                    <div 
                                      className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-300 animate-pulse shadow-[0_0_10px_rgba(251,191,36,0.8)]" 
                                      style={{ width: `${nodeProgressPercent}%` }} 
                                    />
                                  </div>
                                  <div className="text-[8px] font-mono text-amber-400/90 mt-1 text-right font-bold">
                                    EST: {formatEstimatedTime(Math.max(0, (tech.cost - nodeProgress) / (0.1 * countLabs)))}
                                  </div>
                                </div>
                              )}

                              {/* Availability / Requirements Indicator */}
                              {isAvailable && (
                                <div className="mt-2 text-[8px] font-mono text-cyan-300 bg-cyan-950/60 p-1 px-1.5 rounded border border-cyan-500/40 font-bold flex items-center gap-1 uppercase">
                                  <Zap size={10} className="text-cyan-400" /> Ready to Authorize
                                </div>
                              )}

                              {isLocked && tech.requirements.length > 0 && (
                                <div className="mt-2 text-[8px] font-mono bg-red-950/30 p-1.5 rounded border border-red-900/40 space-y-0.5">
                                  <div className="text-red-400 font-bold flex items-center gap-1 uppercase">
                                    <Lock size={9} /> Missing Req:
                                  </div>
                                  <div className="text-slate-300 flex flex-wrap gap-1">
                                    {tech.requirements.map(rId => {
                                      const isReqMet = state.unlockedTech.includes(rId);
                                      return (
                                        <span key={rId} className={`px-1 py-0.2 rounded border ${isReqMet ? 'text-emerald-400 border-emerald-900 bg-emerald-950/40' : 'text-red-300 border-red-900/50 bg-red-950/50 font-bold'}`}>
                                          {TECH_TREE[rId]?.name || rId} {isReqMet ? '✓' : '✗'}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Cost & Unlock Previews */}
                              <div className="mt-3 pt-2 border-t border-slate-800/80 flex flex-wrap justify-between items-center text-[9px] font-mono">
                                <span className="text-slate-400 flex items-center gap-1 font-bold">
                                  <Zap size={10} className="text-amber-400" /> {tech.cost} RP
                                </span>
                                <span className="text-slate-400 flex items-center gap-1 font-bold">
                                  <Clock size={10} className="text-cyan-400" /> ~{formatEstimatedTime(estMinutes)}
                                </span>
                              </div>

                              {/* Unlocked Items Pills */}
                              {tech.unlocksItems.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {tech.unlocksItems.map(itemId => {
                                    const item = ITEMS[itemId];
                                    if (!item) return null;
                                    return (
                                      <span key={itemId} className="text-[8px] font-mono font-bold bg-slate-900 border border-slate-800 text-cyan-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                                        <Package size={9} /> {item.name}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}

            </div>
          </div>
        </div>
      )}

      {/* Tech Details Modal / Drawer */}
      <AnimatePresence>
        {inspectTech && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 md:p-6"
            onClick={() => setInspectTechId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-slate-950 border-2 border-slate-700 w-full max-w-xl rounded-sm shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-slate-900 p-3 md:p-4 border-b border-slate-800 flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-950 border border-slate-700 rounded text-cyan-400 shadow-inner">
                    {getCategoryIcon(inspectTech.category, 20)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-[9px] font-mono font-bold uppercase text-slate-400">
                      <span>TIER 0{inspectTech.tier || 1}</span>
                      <span>•</span>
                      <span className="text-cyan-400">{inspectTech.category || 'GENERAL'}</span>
                    </div>
                    <h3 className="text-base md:text-lg font-black text-white uppercase tracking-tight">
                      {inspectTech.name}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setInspectTechId(null)}
                  className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Content Scroll */}
              <div className="p-4 md:p-5 overflow-y-auto space-y-4 custom-scrollbar">
                {/* Tech Overview */}
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                  <h4 className="text-[10px] font-mono font-black uppercase text-slate-400 mb-1 flex items-center gap-1.5">
                    <Info size={12} className="text-cyan-400" /> Project Briefing
                  </h4>
                  <p className="text-xs text-slate-200 leading-relaxed font-medium">
                    {inspectTech.description}
                  </p>
                </div>

                {/* Requirements & Feasibility Checklist */}
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                  <h4 className="text-[10px] font-mono font-black uppercase text-slate-400 mb-2 flex items-center gap-1.5">
                    <Lock size={12} className="text-amber-400" /> Prerequisite Technical Data
                  </h4>

                  {inspectTech.requirements.length === 0 ? (
                    <div className="text-[11px] font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                      <CheckCircle2 size={13} /> No prior technology required. Ready for immediate study.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {inspectTech.requirements.map(reqId => {
                        const reqTech = TECH_TREE[reqId];
                        const isReqUnlocked = state.unlockedTech.includes(reqId);

                        return (
                          <div 
                            key={reqId} 
                            className={`p-2 rounded border text-[11px] font-mono font-bold flex justify-between items-center ${
                              isReqUnlocked 
                                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                                : 'bg-red-950/40 border-red-500/40 text-red-300'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {isReqUnlocked ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                              {reqTech?.name || reqId}
                            </span>
                            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-black/40">
                              {isReqUnlocked ? 'ACQUIRED' : 'MISSING'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Estimated Completion Time Matrix */}
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                  <h4 className="text-[10px] font-mono font-black uppercase text-slate-400 mb-2 flex items-center gap-1.5">
                    <Clock size={12} className="text-cyan-400" /> Lab Study Specs & Estimates
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-center font-mono">
                    <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                      <div className="text-[8px] text-slate-500 uppercase font-bold">Research Cost</div>
                      <div className="text-xs font-black text-amber-300 mt-0.5">{inspectTech.cost} RP</div>
                    </div>
                    <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                      <div className="text-[8px] text-slate-500 uppercase font-bold">Current Speed ({countLabs} Lab)</div>
                      <div className="text-xs font-black text-cyan-300 mt-0.5">
                        {formatEstimatedTime(inspectTech.cost / (0.1 * countLabs))}
                      </div>
                    </div>
                    <div className="p-2 bg-slate-950 border border-slate-800 rounded col-span-2 md:col-span-1">
                      <div className="text-[8px] text-slate-500 uppercase font-bold">2-Lab Estimate</div>
                      <div className="text-xs font-black text-emerald-300 mt-0.5">
                        {formatEstimatedTime(inspectTech.cost / (0.1 * 2))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Unlocked Equipment Preview Cards */}
                <div>
                  <h4 className="text-[10px] font-mono font-black uppercase text-slate-400 mb-2 flex items-center gap-1.5">
                    <Package size={12} className="text-amber-400" /> Unlocks Market Schematics
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {inspectTech.unlocksItems.map(itemId => {
                      const item = ITEMS[itemId];
                      if (!item) return null;

                      return (
                        <div key={itemId} className="p-3 bg-slate-900 border border-slate-800 rounded flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-black text-xs text-white uppercase">{item.name}</span>
                              <span className="text-[9px] font-mono text-emerald-400 font-bold bg-emerald-950 border border-emerald-800 px-1.5 py-0.5 rounded">
                                ₮{item.cost}
                              </span>
                            </div>
                            <div className="text-[9px] font-mono text-slate-400 uppercase flex flex-wrap gap-2 mt-1">
                              <span>TYPE: {item.type}</span>
                              <span>WT: {item.weight || 1}KG</span>
                              {item.damage && <span className="text-rose-400 font-bold">DMG: {item.damage}</span>}
                              {item.range && <span className="text-cyan-400 font-bold">RNG: {item.range}</span>}
                              {item.accuracyMod && <span className="text-amber-300 font-bold">ACC: +{Math.round(item.accuracyMod * 100)}%</span>}
                              {item.slotsGranted && <span className="text-emerald-400 font-bold">+{item.slotsGranted} SLOTS</span>}
                              {item.hpBonus && <span className="text-emerald-400 font-bold">+{item.hpBonus} HP</span>}
                              {item.wearResistance && <span className="text-cyan-300 font-bold">+{item.wearResistance}% WEAR RESIST</span>}
                              {item.weightReduction && <span className="text-purple-300 font-bold">-{item.weightReduction}% WT REDUCTION</span>}
                            </div>
                            {item.description && (
                              <p className="text-[9.5px] font-sans text-slate-300 mt-1.5 italic border-t border-slate-800/80 pt-1">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Action Footer */}
              <div className="p-3 md:p-4 bg-slate-900 border-t border-slate-800 flex justify-end gap-2">
                <button
                  onClick={() => setInspectTechId(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-black uppercase border border-slate-700 rounded transition-all"
                >
                  Close
                </button>

                {state.unlockedTech.includes(inspectTech.id) ? (
                  <div className="px-4 py-2 bg-emerald-950 border border-emerald-500/50 text-emerald-300 text-xs font-mono font-black uppercase rounded flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> Technology Acquired
                  </div>
                ) : activeTechIds.includes(inspectTech.id) ? (
                  <button
                    onClick={() => {
                      cancelResearch(inspectTech.id as any);
                      setInspectTechId(null);
                    }}
                    className="px-4 py-2 bg-red-950 hover:bg-red-900 border border-red-600 text-red-200 text-xs font-mono font-black uppercase rounded flex items-center gap-1.5 transition-all"
                  >
                    <StopCircle size={14} /> Abort Research
                  </button>
                ) : canResearchTech(inspectTech) ? (
                  <button
                    onClick={() => {
                      handleStartResearchProject(inspectTech.id);
                      setInspectTechId(null);
                    }}
                    className="px-5 py-2 bg-high-primary hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider border border-cyan-300 rounded shadow-[0_0_12px_rgba(6,182,212,0.4)] transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <Play size={14} /> Authorize Project ({activeTechIds.length}/{maxResearchSlots} Labs)
                  </button>
                ) : (
                  <button
                    disabled
                    className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-600 text-xs font-mono font-black uppercase rounded flex items-center gap-1.5 opacity-60 cursor-not-allowed"
                  >
                    <Lock size={14} /> Missing Prerequisites
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
