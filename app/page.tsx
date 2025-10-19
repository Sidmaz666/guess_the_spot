'use client';

import { useState, useCallback } from 'react';
import { HeroSection } from '../components/HeroSection';
import { GameSection } from '../components/GameSection';
import ActionButtons from '../components/ActionButtons';
import { GameData, GuessResult } from '../types/game';
import { calculateDistance, calculateScore, calculatePercentage } from '../lib/gameUtils';

export default function Home() {
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [playerGuess, setPlayerGuess] = useState<[number, number] | null>(null);
  const [guessResult, setGuessResult] = useState<GuessResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const startNewGame = async () => {
    setIsLoading(true);
    setGameStarted(true); // Show map immediately
    setPlayerGuess(null);
    setGuessResult(null);
    
    try {
      const response = await fetch('/api/loc');
      const data = await response.json();
      
      if (data.success) {
        setGameData(data.data);
      } else {
        console.error('Failed to fetch game data:', data.error);
        alert('Failed to start new game. Please try again.');
        setGameStarted(false); // Reset game started if API fails
      }
    } catch (error) {
      console.error('Error fetching game data:', error);
      alert('An unexpected error occurred. Please try again.');
      setGameStarted(false); // Reset game started if API fails
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuess = useCallback((lat: number, lon: number) => {
    // Allow guessing even before game data loads
    setPlayerGuess([lat, lon]);
    setGuessResult(null);
  }, []);

  const handleExit = () => {
    // Reset all game state
    setGameData(null);
    setPlayerGuess(null);
    setGuessResult(null);
    setGameStarted(false);
    setIsLoading(false);
  };

  const submitGuess = () => {
    if (!playerGuess || !gameData) return;

    const distance = calculateDistance(
      gameData.location.lat,
      gameData.location.lon,
      playerGuess[0],
      playerGuess[1]
    );

    const score = calculateScore(distance);
    const percentage = calculatePercentage(distance);

    setGuessResult({
      distance,
      score,
      percentage,
      correctLocation: [gameData.location.lat, gameData.location.lon],
      playerGuess: [...playerGuess]
    });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Action Buttons - Always visible when game is started */}
      {gameStarted && (
        <ActionButtons
          guessResult={guessResult}
          playerGuess={playerGuess}
          onNewGame={startNewGame}
          onExit={handleExit}
          isLoading={isLoading}
        />
      )}
      
      {!gameStarted ? (
        <HeroSection onStartGame={startNewGame} isLoading={isLoading} />
      ) : (
        <GameSection
          gameData={gameData}
          playerGuess={playerGuess}
          guessResult={guessResult}
          isLoading={isLoading}
          onGuess={handleGuess}
          onSubmitGuess={submitGuess}
        />
      )}
    </div>
  );
}
