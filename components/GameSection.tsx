'use client';

import { useEffect, useRef } from "react";
import dynamic from 'next/dynamic';
import ImageDisplay from './ImageDisplay';
import GameControls from './GameControls';
import ScoreDisplay from './ScoreDisplay';
import { GameData, GuessResult } from '../types/game';

// Dynamically import GameMap to avoid SSR issues
const GameMap = dynamic(() => import('./GameMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl">
      <div className="text-center text-slate-300">
        <div className="w-16 h-16 mx-auto mb-4 relative">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-500/30"></div>
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-500 animate-spin"></div>
        </div>
        <p className="text-lg font-medium">Loading map...</p>
      </div>
    </div>
  )
});

interface GameSectionProps {
  gameData: GameData | null;
  playerGuess: [number, number] | null;
  guessResult: GuessResult | null;
  isLoading: boolean;
  onGuess: (lat: number, lon: number) => void;
  onSubmitGuess: () => void;
}

export function GameSection({
  gameData,
  playerGuess,
  guessResult,
  isLoading,
  onGuess,
  onSubmitGuess,
}: GameSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    let animationId: number;
    let time = 0;

    const gridLines = Array.from({ length: 16 }, (_, i) => ({
      id: i,
      startTime: Math.random() * 3000,
      duration: 3000 + Math.random() * 2000,
      isHorizontal: i % 2 === 0,
      position: (i / 16) * 0.8 + 0.1,
    }));

    const drawBackground = () => {
      const bgGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      bgGradient.addColorStop(0, "#0a1410");
      bgGradient.addColorStop(0.5, "#0f1a15");
      bgGradient.addColorStop(1, "#0a0f0d");
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      gridLines.forEach((line) => {
        const elapsed = (time - line.startTime) % line.duration;
        const progress = elapsed / line.duration;

        const opacity = Math.abs(Math.sin(progress * Math.PI)) * 0.6;

        if (line.isHorizontal) {
          const y = canvas.height * line.position;
          const lineGradient = ctx.createLinearGradient(0, y, canvas.width, y);
          lineGradient.addColorStop(0, `rgba(34, 197, 94, 0)`);
          lineGradient.addColorStop(0.5, `rgba(34, 197, 94, ${opacity})`);
          lineGradient.addColorStop(1, `rgba(34, 197, 94, 0)`);

          ctx.strokeStyle = lineGradient;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();

          ctx.strokeStyle = `rgba(34, 197, 94, ${opacity * 0.3})`;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        } else {
          const x = canvas.width * line.position;
          const lineGradient = ctx.createLinearGradient(x, 0, x, canvas.height);
          lineGradient.addColorStop(0, `rgba(16, 185, 129, 0)`);
          lineGradient.addColorStop(0.5, `rgba(16, 185, 129, ${opacity})`);
          lineGradient.addColorStop(1, `rgba(16, 185, 129, 0)`);

          ctx.strokeStyle = lineGradient;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();

          ctx.strokeStyle = `rgba(16, 185, 129, ${opacity * 0.3})`;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
      });

      const rayCount = 3;
      for (let i = 0; i < rayCount; i++) {
        const fromLeft = i % 2 === 0;
        const startX = fromLeft ? -canvas.width * 0.3 : canvas.width * 1.3;
        const startY = -canvas.height * 0.2;
        const endX = canvas.width / 2;
        const endY = canvas.height * 1.2;

        const rayGradient = ctx.createLinearGradient(startX, startY, endX, endY);
        rayGradient.addColorStop(0, "rgba(34, 197, 94, 0.12)");
        rayGradient.addColorStop(0.4, `rgba(34, 197, 94, ${0.08 + Math.sin(time * 0.0008 + i) * 0.02})`);
        rayGradient.addColorStop(0.8, `rgba(16, 185, 129, ${0.04 + Math.sin(time * 0.0008 + i) * 0.01})`);
        rayGradient.addColorStop(1, "rgba(16, 185, 129, 0)");

        ctx.fillStyle = rayGradient;
        ctx.fillRect(startX - 80, startY, 160, canvas.height + canvas.height * 0.4);
      }

      time += 1;
      animationId = requestAnimationFrame(drawBackground);
    };

    drawBackground();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  return (
    <div className="flex h-screen relative z-50">
      {/* Animated Background Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0" />
      
      {/* Background Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-900/20 to-slate-950/40 pointer-events-none z-10" />

      {/* Left Panel - Map */}
      <div className="flex-1 relative z-20 p-6">
        <GameMap
          gameData={gameData}
          playerGuess={playerGuess}
          guessResult={guessResult}
          onGuess={onGuess}
        />
      </div>

      {/* Right Panel - Image and Controls */}
      <div className="flex-1 flex flex-col relative z-20 items-center justify-center">
        {/* Centered Card Container */}
        <div className="flex flex-col items-center space-y-6 w-full max-w-lg">
          {/* Show Image Display only when no results */}
          {!guessResult && (
            <div className="w-full">
              <ImageDisplay gameData={gameData} isLoading={isLoading} />
            </div>
          )}
          
          {/* Results when available */}
          {guessResult && playerGuess && (
            <div className="w-full">
              <ScoreDisplay 
                result={guessResult} 
                gameData={gameData} 
                playerGuess={playerGuess} 
              />
            </div>
          )}
          
          {/* Game Controls - Grouped with the card */}
          <div className="w-full">
            <GameControls
              playerGuess={playerGuess}
              guessResult={guessResult}
              onSubmitGuess={onSubmitGuess}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
