'use client';

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from 'react-leaflet';
import { Icon } from 'leaflet';
import { GameData, GuessResult } from '@/types/game';
import { useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';

interface GameMapProps {
  gameData: GameData | null;
  playerGuess: [number, number] | null;
  guessResult: GuessResult | null;
  onGuess: (lat: number, lon: number) => void;
}

// Component to handle map clicks
function MapClickHandler({ onGuess, guessResult }: { onGuess: (lat: number, lon: number) => void; guessResult: GuessResult | null }) {
  useMapEvents({
    click: (e) => {
      // Only allow clicking if no result has been shown yet
      if (!guessResult) {
        onGuess(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// Component to auto-open popups
function AutoOpenPopup({ markerRef, isOpen }: { markerRef: any; isOpen: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (markerRef.current && isOpen) {
      markerRef.current.openPopup();
    }
  }, [markerRef, isOpen, map]);

  return null;
}

// Component to fetch location details
function LocationDetails({ lat, lon, onDetailsReady }: { lat: number; lon: number; onDetailsReady: (details: string) => void }) {
  useEffect(() => {
    const fetchLocationDetails = async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1&extratags=1&namedetails=1`,
          {
            headers: {
              'User-Agent': 'GuessTheSpot/1.0'
            }
          }
        );
        const data = await response.json();
        
        if (data && data.address) {
          const address = data.address;
          const details = [];
          
          // Priority order: landmark, city, town, village, suburb, county, state, country
          if (address.tourism || address.historic || address.amenity) {
            details.push(address.tourism || address.historic || address.amenity);
          }
          if (address.city) details.push(address.city);
          else if (address.town) details.push(address.town);
          else if (address.village) details.push(address.village);
          else if (address.suburb) details.push(address.suburb);
          
          if (address.county) details.push(address.county);
          if (address.state) details.push(address.state);
          if (address.country) details.push(address.country);
          
          // If we have meaningful details, use them
          if (details.length > 0) {
            onDetailsReady(details.join(', '));
            return;
          }
          
          // Fallback to display_name if address parsing didn't work well
          if (data.display_name) {
            const parts = data.display_name.split(',');
            onDetailsReady(parts.slice(0, 3).map((part: string) => part.trim()).join(', '));
            return;
          }
        }
        
        // Final fallback to coordinates
        onDetailsReady(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
      } catch (error) {
        console.warn('Reverse geocoding failed:', error);
        onDetailsReady(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
      }
    };

    fetchLocationDetails();
  }, [lat, lon, onDetailsReady]);

  return null;
}

export default function GameMap({ gameData, playerGuess, guessResult, onGuess }: GameMapProps) {
  const [playerGuessDetails, setPlayerGuessDetails] = useState<string>('');
  const [correctLocationDetails, setCorrectLocationDetails] = useState<string>('');
  
  // Fix for default markers in Next.js - only run on client side
  if (typeof window !== 'undefined') {
    delete (Icon.Default.prototype as any)._getIconUrl;
    Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  }
  
  // Determine map center and zoom
  const mapCenter: [number, number] = gameData 
    ? [gameData.location.lat, gameData.location.lon]
    : [20, 0];
  const mapZoom = gameData ? 4 : 2;

  // Create custom icons using divIcon instead of SVG with emojis
  const correctIcon = new Icon({
    iconUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
      <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="8" fill="#EF4444" stroke="white" stroke-width="2"/>
        <circle cx="10" cy="10" r="3" fill="white"/>
        <circle cx="10" cy="10" r="1" fill="#EF4444"/>
      </svg>
    `),
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

  const guessIcon = new Icon({
    iconUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
      <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="8" fill="#3B82F6" stroke="white" stroke-width="2"/>
        <path d="M10 4 L10 16 M4 10 L16 10" stroke="white" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `),
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

  // Get location details for popup
  const getLocationDetails = (location: any) => {
    const details = [];
    
    if (location.city) details.push(location.city);
    else if (location.localName) details.push(location.localName);
    
    if (location.state) details.push(location.state);
    if (location.country) details.push(location.country);
    
    return details.length > 0 ? details.join(', ') : location.displayName;
  };

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        className="h-full w-full rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50"
        style={{ 
          height: 'calc(100vh - 3rem)',
          zIndex: 1
        }}
        zoomControl={true}
        scrollWheelZoom={true}
        doubleClickZoom={false}
        boxZoom={true}
        keyboard={true}
        dragging={true}
        touchZoom={true}
        zoomAnimation={false}
        fadeAnimation={false}
        markerZoomAnimation={false}
        zoomSnap={0}
        zoomDelta={0}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© OpenStreetMap contributors'
          maxZoom={18}
          minZoom={1}
        />
        
        <MapClickHandler onGuess={onGuess} guessResult={guessResult} />
        
        {/* Correct location marker - only show if guess has been made */}
        {gameData && guessResult && (
          <Marker 
            position={[gameData.location.lat, gameData.location.lon]} 
            icon={correctIcon}
            eventHandlers={{
              add: (e) => {
                // Auto-open popup when marker is added
                setTimeout(() => {
                  e.target.openPopup();
                }, 100);
              }
            }}
          >
            <Popup autoClose={false} closeOnClick={false}>
              <div className="text-center">
                <strong>🎯 Correct Location!</strong><br />
                {correctLocationDetails || getLocationDetails(gameData.location)}
              </div>
            </Popup>
            <LocationDetails 
              lat={gameData.location.lat} 
              lon={gameData.location.lon} 
              onDetailsReady={setCorrectLocationDetails}
            />
          </Marker>
        )}
        
        {/* Player guess marker */}
        {playerGuess && (
          <Marker 
            position={playerGuess} 
            icon={guessIcon}
            eventHandlers={{
              add: (e) => {
                // Auto-open popup when marker is added
                setTimeout(() => {
                  e.target.openPopup();
                }, 100);
              }
            }}
          >
            <Popup autoClose={false} closeOnClick={false}>
              <div className="text-center">
                <strong>📍 Your Guess</strong><br />
                {playerGuessDetails || `${playerGuess[0].toFixed(4)}, ${playerGuess[1].toFixed(4)}`}
              </div>
            </Popup>
            <LocationDetails 
              lat={playerGuess[0]} 
              lon={playerGuess[1]} 
              onDetailsReady={setPlayerGuessDetails}
            />
          </Marker>
        )}
        
        {/* Line between guess and correct location */}
        {playerGuess && guessResult && gameData && (
          <Polyline
            positions={[playerGuess, guessResult.correctLocation]}
            color="red"
            weight={2}
            dashArray="5, 5"
          />
        )}
      </MapContainer>
    </div>
  );
}