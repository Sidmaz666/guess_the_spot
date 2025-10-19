// Utility functions for game calculations

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function calculateScore(distance: number): number {
  // Score from 1-10 based on distance
  // Perfect guess (0km) = 10, Very far (5000km+) = 1
  if (distance === 0) return 10;
  if (distance >= 5000) return 1;
  
  const score = Math.max(1, 10 - (distance / 5000) * 9);
  return Math.round(score * 10) / 10; // Round to 1 decimal
}

export function calculatePercentage(distance: number): number {
  // Percentage based on distance
  // Perfect guess (0km) = 100%, Very far (5000km+) = 0%
  if (distance === 0) return 100;
  if (distance >= 5000) return 0;
  
  const percentage = Math.max(0, 100 - (distance / 5000) * 100);
  return Math.round(percentage * 10) / 10; // Round to 1 decimal
}
