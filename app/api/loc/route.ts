import { NextRequest, NextResponse } from 'next/server';
import { getRandomLocation } from '../../../lib/services/get_location';
import { getNearbyPhotoWithFallback } from '../../../lib/services/get_image';
import axios from 'axios';

// Environment variables with fallbacks
const API_RATE_LIMIT = parseInt(process.env.API_RATE_LIMIT || '100'); // requests per hour
const API_TIMEOUT = parseInt(process.env.API_TIMEOUT || '30000'); // 30 seconds
const DEFAULT_RADIUS = parseInt(process.env.DEFAULT_RADIUS || '5000'); // 5km default radius

// Note: Images are included by default unless explicitly disabled with includeImage=false

// Reverse geocoding function
async function reverseGeocode(lat: number, lon: number) {
  const NOMINATIM_BASE_URL = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
  const NOMINATIM_USER_AGENT = process.env.NOMINATIM_USER_AGENT || 'GuessTheSpot (contact@example.com)';
  
  const reverseUrl = `${NOMINATIM_BASE_URL}/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1`;
  
  const response = await axios.get(reverseUrl, {
    headers: {
      'User-Agent': NOMINATIM_USER_AGENT,
      'Accept': 'application/json',
    },
    timeout: 10000,
  });
  
  if (!response.data || !response.data.address) {
    throw new Error('No address found for the coordinates');
  }
  
  const data = response.data;
  const city = data.address.city || data.address.town || data.address.village || null;
  const localName = data.address.road || data.address.house_number || data.display_name.split(',')[0].trim();
  
  return {
    lat: parseFloat(data.lat),
    lon: parseFloat(data.lon),
    country: data.address.country,
    state: data.address.state,
    city,
    localName,
    displayName: data.display_name,
    placeId: data.place_id,
    osmType: data.osm_type,
    osmId: data.osm_id,
    placeRank: data.place_rank,
    category: data.category,
    type: data.type,
    importance: data.importance,
    address: data.address,
  };
}

// Request validation interface
interface LocationRequest {
  continent?: string;
  country?: string;
  includeImage?: boolean;
  imageRadius?: number;
  maxRetries?: number;
}

// Response interface
interface LocationResponse {
  success: boolean;
  data?: {
    location: {
      lat: number;
      lon: number;
      country: string;
      state?: string;
      city?: string | null;
      localName?: string;
      displayName: string;
      placeId?: number;
      osmType?: string;
      osmId?: number;
      placeRank?: number;
      category?: string;
      type?: string;
      importance?: number;
      address?: {
        houseNumber?: string;
        road?: string;
        suburb?: string;
        city?: string;
        town?: string;
        village?: string;
        county?: string;
        state?: string;
        postcode?: string;
        country?: string;
        countryCode?: string;
        [key: string]: string | undefined;
      };
      boundingBox?: [number, number, number, number];
    };
    image?: {
      id: number;
      lat: number;
      lng: number;
      fileurl: string;
      title?: string;
      description?: string;
      author?: string;
      license?: string;
      width?: number;
      height?: number;
      size?: number;
      timestamp?: string;
      pageId?: number;
      namespace?: number;
      coordinates?: {
        lat: number;
        lon: number;
        primary?: boolean;
        globe?: string;
      };
    } | null;
  };
  error?: string;
  metadata: {
    timestamp: string;
    processingTime: number;
    version: string;
    retries?: number;
  };
}

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const userLimit = rateLimitStore.get(ip);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (userLimit.count >= API_RATE_LIMIT) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0] || realIP || 'unknown';
}

function validateRequest(params: URLSearchParams): { valid: boolean; error?: string; data?: LocationRequest } {
  const continent = params.get('continent');
  const country = params.get('country');
  const includeImage = params.get('includeImage')?.toLowerCase();
  const imageRadius = params.get('imageRadius');
  const maxRetries = params.get('maxRetries');

  // Validate continent if provided
  const validContinents = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania', 'Antarctica'];
  if (continent && !validContinents.includes(continent)) {
    return {
      valid: false,
      error: `Invalid continent. Must be one of: ${validContinents.join(', ')}`
    };
  }

  // Validate country if provided
  if (country && country.length < 2) {
    return {
      valid: false,
      error: 'Country name must be at least 2 characters long'
    };
  }

  // Validate includeImage - default to true if not specified
  const shouldIncludeImage = includeImage === undefined || includeImage === 'true' || includeImage === '1';

  // Validate imageRadius
  let radius = DEFAULT_RADIUS;
  if (imageRadius) {
    const parsedRadius = parseInt(imageRadius);
    if (isNaN(parsedRadius) || parsedRadius < 100 || parsedRadius > 50000) {
      return {
        valid: false,
        error: 'Image radius must be between 100 and 50000 meters'
      };
    }
    radius = parsedRadius;
  }

  // Validate maxRetries
  let retries = 3;
  if (maxRetries) {
    const parsedRetries = parseInt(maxRetries);
    if (isNaN(parsedRetries) || parsedRetries < 1 || parsedRetries > 10) {
      return {
        valid: false,
        error: 'Max retries must be between 1 and 10'
      };
    }
    retries = parsedRetries;
  }

  return {
    valid: true,
    data: {
      continent: continent || undefined,
      country: country || undefined,
      includeImage: shouldIncludeImage,
      imageRadius: radius,
      maxRetries: retries
    }
  };
}

export async function GET(request: NextRequest): Promise<NextResponse<LocationResponse>> {
  const startTime = Date.now();
  const clientIP = getClientIP(request);
  
  try {
    // Check rate limiting
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
        metadata: {
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          version: '1.0.0'
        }
      }, { status: 429 });
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    
    // Handle reverse geocoding request
    if (searchParams.has('lat') && searchParams.has('lon')) {
      const lat = parseFloat(searchParams.get('lat')!);
      const lon = parseFloat(searchParams.get('lon')!);
      
      if (isNaN(lat) || isNaN(lon)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid latitude or longitude values',
          metadata: {
            timestamp: new Date().toISOString(),
            processingTime: Date.now() - startTime,
            version: '1.0.0'
          }
        }, { status: 400 });
      }
      
      try {
        const locationData = await reverseGeocode(lat, lon);
        return NextResponse.json({
          success: true,
          data: {
            location: locationData
          },
          metadata: {
            timestamp: new Date().toISOString(),
            processingTime: Date.now() - startTime,
            version: '1.0.0'
          }
        });
      } catch (error: any) {
        return NextResponse.json({
          success: false,
          error: `Reverse geocoding failed: ${error.message}`,
          metadata: {
            timestamp: new Date().toISOString(),
            processingTime: Date.now() - startTime,
            version: '1.0.0'
          }
        }, { status: 500 });
      }
    }
    
    const validation = validateRequest(searchParams);
    
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: validation.error,
        metadata: {
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          version: '1.0.0'
        }
      }, { status: 400 });
    }

    const requestData = validation.data!;
    let retryCount = 0;
    const maxRetries = requestData.maxRetries!;

    // Main processing loop with retries
    while (retryCount < maxRetries) {
      try {
        // Get random location
        const locationOptions = {
          continent: requestData.continent,
          country: requestData.country
        };

        console.log(`API: Getting random location (attempt ${retryCount + 1}/${maxRetries})`);
        const location = await getRandomLocation(locationOptions);

        // Get image if requested
        let image = null;
        if (requestData.includeImage) {
          try {
            console.log(`API: Getting nearby image for location using infinite fallback method`);
            console.log(`API: Location data being passed:`, {
              lat: location.lat,
              lon: location.lon,
              city: location.city,
              state: location.state,
              country: location.country,
              localName: location.localName,
              displayName: location.displayName
            });
            
            image = await getNearbyPhotoWithFallback(
              location.lat,
              location.lon,
              requestData.imageRadius,
              location
            );
            
            // If no image found, log it but don't fail the request
            if (!image) {
              console.log(`API: No image found for location after infinite attempts, continuing without image`);
            } else {
              console.log(`API: Image successfully found: "${image.title}"`);
            }
          } catch (imageError) {
            console.warn('API: Failed to get image, continuing without it:', imageError);
            // Continue without image rather than failing the entire request
          }
        }

        // Success response
        return NextResponse.json({
          success: true,
          data: {
            location,
            image
          },
          metadata: {
            timestamp: new Date().toISOString(),
            processingTime: Date.now() - startTime,
            version: '1.0.0',
            retries: retryCount
          }
        });

      } catch (error) {
        retryCount++;
        console.error(`API: Attempt ${retryCount} failed:`, error);
        
        if (retryCount >= maxRetries) {
          throw error; // Re-throw to be caught by outer try-catch
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    // This should never be reached, but TypeScript requires it
    throw new Error('Unexpected error: retry loop completed without success');

  } catch (error) {
    console.error('API: Final error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      metadata: {
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        version: '1.0.0'
      }
    }, { status: 500 });
  }
}

// Handle unsupported methods
export async function POST() {
  return NextResponse.json({
    success: false,
    error: 'Method not allowed. Use GET request.',
    metadata: {
      timestamp: new Date().toISOString(),
      processingTime: 0,
      version: '1.0.0'
    }
  }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({
    success: false,
    error: 'Method not allowed. Use GET request.',
    metadata: {
      timestamp: new Date().toISOString(),
      processingTime: 0,
      version: '1.0.0'
    }
  }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({
    success: false,
    error: 'Method not allowed. Use GET request.',
    metadata: {
      timestamp: new Date().toISOString(),
      processingTime: 0,
      version: '1.0.0'
    }
  }, { status: 405 });
}
