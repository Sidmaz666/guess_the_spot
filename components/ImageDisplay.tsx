'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { GameData } from '@/types/game';

interface ImageDisplayProps {
  gameData: GameData | null;
  isLoading: boolean;
}

const loadingMessages = [
  "We are searching the most mysterious places for you...",
  "Exploring hidden corners of our beautiful world...",
  "Discovering breathtaking locations just for you...",
  "Finding the perfect spot to challenge your geography skills...",
  "Scouring the globe for an amazing destination...",
  "Uncovering secret places that will amaze you...",
  "Searching through the world's most stunning locations...",
  "Finding a place that will test your knowledge...",
  "Discovering hidden gems from around the world...",
  "Exploring the most fascinating places on Earth..."
];

export default function ImageDisplay({ gameData, isLoading }: ImageDisplayProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setCurrentMessageIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="h-80 w-full flex items-center justify-center bg-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl">
        <div className="text-center text-slate-300 max-w-md">
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto mb-4 relative">
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500/30"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-500 animate-spin"></div>
            </div>
          </div>
          <p className="text-lg font-medium text-slate-200 transition-all duration-500">
            {loadingMessages[currentMessageIndex]}
          </p>
          <div className="mt-4 flex justify-center space-x-1">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  i === (currentMessageIndex % 3) ? 'bg-emerald-500' : 'bg-emerald-500/30'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!gameData || !gameData.image) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-slate-400">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
            <span className="text-2xl">🖼️</span>
          </div>
          <p className="text-lg">No image available</p>
        </div>
      </div>
    );
  }

  const { image } = gameData;

  return (
    <div className="h-full">
      <div className="h-80 w-full relative bg-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
        <Image
          src={image.fileurl}
          alt={image.title || 'Mystery location'}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-900/20 pointer-events-none" />
      </div>
    </div>
  );
}
