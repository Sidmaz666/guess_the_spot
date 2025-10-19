'use client';

import { GuessResult } from '@/types/game';
import { Trophy, Target, MapPin, BarChart3, Navigation, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import { useState, useEffect } from 'react';

interface ScoreDisplayProps {
  result: GuessResult;
  gameData: any;
  playerGuess: [number, number];
}

export default function ScoreDisplay({ result, gameData, playerGuess }: ScoreDisplayProps) {
  const [playerGuessDetails, setPlayerGuessDetails] = useState<string>('');

  useEffect(() => {
    // Fetch location details for player's guess
    const fetchPlayerGuessDetails = async () => {
      try {
        const response = await fetch(`/api/loc?lat=${playerGuess[0]}&lon=${playerGuess[1]}`);
        const data = await response.json();
        if (data.success && data.data) {
          const details = [];
          if (data.data.location.city) details.push(data.data.location.city);
          else if (data.data.location.localName) details.push(data.data.location.localName);
          if (data.data.location.state) details.push(data.data.location.state);
          if (data.data.location.country) details.push(data.data.location.country);
          setPlayerGuessDetails(details.length > 0 ? details.join(', ') : data.data.location.displayName);
        }
      } catch (error) {
        console.error('Failed to fetch player guess details:', error);
      }
    };

    fetchPlayerGuessDetails();
  }, [playerGuess]);

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-emerald-400';
    if (score >= 6) return 'text-yellow-400';
    if (score >= 4) return 'text-orange-400';
    return 'text-red-400';
  };

  const getLocationDetails = (location: any) => {
    const details = [];
    if (location.city) details.push(location.city);
    else if (location.localName) details.push(location.localName);
    if (location.state) details.push(location.state);
    if (location.country) details.push(location.country);
    return details.length > 0 ? details.join(', ') : location.displayName;
  };

  const handleImageClick = () => {
    if (gameData?.image?.fileurl) {
      window.open(gameData.image.fileurl, '_blank');
    }
  };

  return (
    <div className="w-full max-w-lg">
      {/* Results Card */}
      <div className="p-6 bg-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-4 text-center flex items-center justify-center gap-2">
          <Trophy className="w-5 h-5 text-emerald-400" />
          Your Results
        </h3>
        
        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Score */}
          <div className="text-center p-3 bg-slate-800/50 border border-slate-600/30 rounded-xl">
            <div className={`text-xl font-bold ${getScoreColor(result.score)}`}>
              {result.score}/10
            </div>
            <div className="text-xs text-slate-400 mt-1">Score</div>
          </div>

          {/* Accuracy */}
          <div className="text-center p-3 bg-slate-800/50 border border-slate-600/30 rounded-xl">
            <div className={`text-xl font-bold ${getScoreColor(result.percentage)}`}>
              {result.percentage}%
            </div>
            <div className="text-xs text-slate-400 mt-1">Accuracy</div>
          </div>
        </div>

        {/* Distance */}
        <div className="text-center p-3 bg-slate-800/50 border border-slate-600/30 rounded-xl mb-4">
          <div className="flex justify-center mb-1">
            <Navigation className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-sm font-semibold text-slate-200">
            {result.distance < 1 
              ? `${(result.distance * 1000).toFixed(0)} meters`
              : `${result.distance.toFixed(2)} km`
            }
          </div>
          <div className="text-xs text-slate-400 mt-1">Distance</div>
        </div>

        {/* Location Badges */}
        <div className="space-y-2">
          {/* Your Guess Badge */}
          <div className="flex items-center gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <MapPin className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-blue-300 font-medium">Your Guess</div>
              <div className="text-xs text-slate-200 truncate">
                {playerGuessDetails || 'Loading...'}
              </div>
            </div>
            <div className="flex gap-1">
              <span className="px-2 py-1 bg-slate-700/50 text-xs text-slate-300 rounded">
                {playerGuess[0].toFixed(4)}
              </span>
              <span className="px-2 py-1 bg-slate-700/50 text-xs text-slate-300 rounded">
                {playerGuess[1].toFixed(4)}
              </span>
            </div>
          </div>

          {/* Correct Location Badge */}
          <div className="flex items-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <Target className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-emerald-300 font-medium">Correct Location</div>
              <div className="text-xs text-slate-200 truncate">
                {getLocationDetails(gameData.location)}
              </div>
            </div>
            <div className="flex gap-1">
              <span className="px-2 py-1 bg-slate-700/50 text-xs text-slate-300 rounded">
                {gameData.location.lat.toFixed(4)}
              </span>
              <span className="px-2 py-1 bg-slate-700/50 text-xs text-slate-300 rounded">
                {gameData.location.lon.toFixed(4)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Image Thumbnail Badge */}
      {gameData?.image?.fileurl && (
        <div className="absolute bottom-0 right-0 m-2 flex justify-center">
          <button
            onClick={handleImageClick}
            title="Click to view full image in new tab"
            className="group relative overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-sm hover:bg-slate-800/60 transition-all duration-300 hover:scale-105 cursor-pointer"
          >
            <div className="relative flex space-x-2 w-full h-16">
              <Image
                src={gameData.image.fileurl}
                alt={gameData.image.title || 'Mystery location'}
                fill
                className="object-cover"
                sizes="96px"
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <ExternalLink className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="px-3 py-2 text-xs text-slate-300 group-hover:text-white transition-colors duration-300">
              View Full Image
            </div>
          </button>
        </div>
      )}
    </div>
  );
}