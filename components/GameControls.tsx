'use client';

import { GuessResult } from '@/types/game';

interface GameControlsProps {
  playerGuess: [number, number] | null;
  guessResult: GuessResult | null;
  onSubmitGuess: () => void;
  isLoading: boolean;
}

export default function GameControls({ 
  playerGuess, 
  guessResult, 
  onSubmitGuess,
  isLoading 
}: GameControlsProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-6">
      {/* Guess Status */}
      {playerGuess && !guessResult && (
        <div className="text-center p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <p className="text-sm text-emerald-300">
            📍 Guess placed! Click "Check Guess" to see results.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 justify-center">
        {!guessResult ? (
          <button
            onClick={onSubmitGuess}
            disabled={!playerGuess}
            title={!playerGuess ? "Click on the map to place your guess first" : "Submit your guess to see results"}
            className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold rounded-xl text-lg transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/50 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none cursor-pointer"
          >
            <span className="flex items-center justify-center gap-2">
              {playerGuess ? '✅ Check Guess' : '📍 Make a Guess First'}
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
