'use client';

import { useEffect, useRef } from "react";
import { Globe } from "./ui/globe";
import { GitHubIcon } from "./ui/github-icon";
import { COBEOptions } from "cobe";

interface HeroSectionProps {
  onStartGame: () => void;
  isLoading: boolean;
}

export function HeroSection({ onStartGame, isLoading }: HeroSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Globe configuration with green theme
  const globeConfig: COBEOptions = {
    width: 600,
    height: 600,
    onRender: () => {},
    devicePixelRatio: 2,
    phi: 0,
    theta: 0.3,
    dark: 1, // Dark mode for our dark theme
    diffuse: 0.4,
    mapSamples: 16000,
    mapBrightness: 1.2,
    baseColor: [0.1, 0.1, 0.1], // Dark base color
    markerColor: [34 / 255, 197 / 255, 94 / 255], // Emerald green markers
    glowColor: [16 / 255, 185 / 255, 129 / 255], // Teal glow
    markers: [
      { location: [37.7749, -122.4194], size: 0.05 }, // San Francisco
      { location: [40.7128, -74.0060], size: 0.05 }, // New York
      { location: [51.5074, -0.1278], size: 0.05 }, // London
      { location: [35.6762, 139.6503], size: 0.05 }, // Tokyo
      { location: [-33.8688, 151.2093], size: 0.05 }, // Sydney
      { location: [-22.9068, -43.1729], size: 0.05 }, // Rio de Janeiro
      { location: [55.7558, 37.6176], size: 0.05 }, // Moscow
      { location: [19.4326, -99.1332], size: 0.05 }, // Mexico City
      { location: [28.6139, 77.2090], size: 0.05 }, // New Delhi
      { location: [-26.2041, 28.0473], size: 0.05 }, // Johannesburg
    ],
  };

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
    <main className="relative w-full h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-900/20 to-slate-950/40 pointer-events-none" />

      {/* GitHub Button - Top Right Corner */}
      <div className="absolute top-6 right-6 z-20">
        <a
          href="https://github.com/Sidmaz666"
          target="_blank"
          rel="noopener noreferrer"
          title="Visit Sidmaz666's GitHub profile"
          className="cursor-pointer transition-all duration-300 hover:text-emerald-500 text-white hover:text-2xl"
        >
          <GitHubIcon />
        </a>
      </div>

      {/* Globe Background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none w-full">
        <Globe 
          className="top-[95%] scale-[300%]" 
          config={globeConfig}
        />
      </div>

      <div className="relative z-10 w-full h-full flex items-center justify-center px-4">
        <div className="w-full max-w-2xl">
          <div className="backdrop-blur-md bg-slate-900/40 border border-slate-700/50 rounded-3xl p-12 md:p-16 shadow-2xl shadow-slate-950/50">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-slate-800/20 to-transparent pointer-events-none" />

            {/* Content wrapper */}
            <div className="relative z-20 text-center space-y-8">
              <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight text-balance font-mono">
                Guess the Spot
              </h1>

              <p className="text-lg md:text-xl text-slate-300 text-balance leading-relaxed">
                Look at the image and guess where in the world it was taken!
              </p>

              <div className="pt-4">
                <button
                  onClick={onStartGame}
                  disabled={isLoading}
                  title={isLoading ? "Loading game..." : "Start playing Guess the Spot"}
                  className="px-8 md:px-12 py-4 md:py-5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold rounded-xl text-lg transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/50 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none cursor-pointer"
                >
                  <span className="flex items-center justify-center gap-2">
                    {isLoading ? 'Loading...' : 'Start Game'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
          <div
            className="absolute -bottom-20 -left-20 w-40 h-40 bg-teal-500/10 rounded-full blur-3xl pointer-events-none animate-pulse"
            style={{ animationDelay: "1s" }}
          />
        </div>
      </div>
    </main>
  );
}
