'use client';

import { GuessResult } from '@/types/game';
import { RotateCcw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { GitHubIcon } from './ui/github-icon';

interface ActionButtonsProps {
  guessResult: GuessResult | null;
  playerGuess: [number, number] | null;
  onNewGame: () => void;
  onExit: () => void;
  isLoading: boolean;
}

export default function ActionButtons({ 
  guessResult, 
  playerGuess,
  onNewGame, 
  onExit,
  isLoading 
}: ActionButtonsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const actionButtons = (
    <div className="fixed top-6 right-6 flex gap-2 z-[9999]">
      <a
        href="https://github.com/Sidmaz666"
        target="_blank"
        rel="noopener noreferrer"
        title="Visit Sidmaz666's GitHub profile"
        className="p-3 bg-slate-900/60 backdrop-blur-sm border border-slate-700/70 text-slate-200 rounded-xl transition-all duration-300 hover:bg-slate-800/80 hover:text-white hover:border-slate-600/90 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900/40 shadow-lg cursor-pointer"
      >
        <GitHubIcon size={20} />
      </a>
      
      <button
        onClick={onNewGame}
        disabled={isLoading}
        title={isLoading ? "Loading new game..." : "Start a new game"}
        className="p-3 bg-slate-900/60 backdrop-blur-sm border border-slate-700/70 text-slate-200 rounded-xl transition-all duration-300 hover:bg-slate-800/80 hover:text-white hover:border-slate-600/90 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-slate-900/60 shadow-lg cursor-pointer"
      >
        <RotateCcw className="w-5 h-5" />
      </button>
      
      <button
        onClick={onExit}
        title="Exit to main menu"
        className="p-3 bg-slate-900/60 backdrop-blur-sm border border-slate-700/70 text-slate-200 rounded-xl transition-all duration-300 hover:bg-slate-800/80 hover:text-white hover:border-600/90 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900/40 shadow-lg cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );

  return createPortal(actionButtons, document.body);
}