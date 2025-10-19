import * as randomUseragent from 'random-useragent';
import axios from 'axios';

// Environment variables with fallbacks
const NOMINATIM_USER_AGENT = process.env.NOMINATIM_USER_AGENT || 'GuessTheSpot (contact@example.com)';
const NOMINATIM_REFERER = process.env.NOMINATIM_REFERER || 'https://guessthespot.app';
const NOMINATIM_CONTACT_EMAIL = process.env.NOMINATIM_CONTACT_EMAIL || 'contact@example.com';
const REST_COUNTRIES_API_URL = process.env.REST_COUNTRIES_API_URL || 'https://restcountries.com/v3.1/all';
const NOMINATIM_BASE_URL = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';

interface Country {
  name: {
    common: string;
    official: string;
  };
  region: string;
  subregion?: string;
  latlng: [number, number];
  cca2: string;
}

interface NominatimSearchResult {
  boundingbox: [string, string, string, string]; // [south, north, west, east]
  display_name: string;
  address?: {
    country?: string;
    state?: string;
    city?: string;
    town?: string;
    village?: string;
    road?: string;
    // Add more as needed
  };
}

interface NominatimReverseResult {
  lat: string;
  lon: string;
  display_name: string;
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  place_rank?: number;
  category?: string;
  type?: string;
  importance?: number;
  boundingbox?: [string, string, string, string]; // [minLat, maxLat, minLon, maxLon]
  address: {
    country: string;
    state?: string;
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    county?: string;
    road?: string;
    house_number?: string;
    postcode?: string;
    country_code: string;
    // Add more as needed
  };
}

interface Location {
  lat: number;
  lon: number;
  country: string;
  state?: string;
  city?: string | null;
  localName?: string;
  displayName: string;
  // Enhanced details from Nominatim API
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
  boundingBox?: [number, number, number, number]; // [minLat, maxLat, minLon, maxLon]
}

interface Options {
  continent?: string;
  country?: string;
}

async function fetchWithUA(url: string, retries: number = 3): Promise<any> {
  // Check if this is a Nominatim API call
  const isNominatim = url.includes('nominatim.openstreetmap.org');
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      let headers: any = {
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      };
      
      if (isNominatim) {
        // Nominatim requires a specific User-Agent format: AppName (email@example.com)
        headers['User-Agent'] = NOMINATIM_USER_AGENT;
        headers['Referer'] = NOMINATIM_REFERER; // Required for web apps
      } else {
        // For other APIs, use random user agents
        const userAgents = [
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        ];
        headers['User-Agent'] = attempt === 1 ? randomUseragent.getRandom() : userAgents[attempt % userAgents.length];
      }
      
      const response = await axios.get(url, {
        headers,
        timeout: 10000, // 10 second timeout
        validateStatus: function (status) {
          return status >= 200 && status < 300; // Only resolve for 2xx status codes
        }
      });
      
      return response.data;
    } catch (error: any) {
      console.warn(`Axios attempt ${attempt} failed for ${url}:`, error.message);
      
      if (attempt === retries) {
        throw new Error(`Failed to fetch data after ${retries} attempts: ${error.message}`);
      }
      
      // Add exponential backoff delay, longer for Nominatim
      const delay = isNominatim ? 2000 * attempt : 1000 * attempt;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function getAllCountries(): Promise<Country[]> {
  const data = await fetchWithUA(`${REST_COUNTRIES_API_URL}?fields=name,region,subregion,latlng,cca2`);
  return data as Country[];
}

function getCountriesInRegion(countries: Country[], region: string): Country[] {
  return countries.filter(c => c.region.toLowerCase() === region.toLowerCase());
}

function pickRandom<T>(array: T[]): T {
  if (array.length === 0) {
    throw new Error('No countries available');
  }
  const index = Math.floor(Math.random() * array.length);
  return array[index];
}

async function getCountryBbox(countryName: string): Promise<[number, number, number, number]> {
  const searchUrl = `${NOMINATIM_BASE_URL}/search?q=${encodeURIComponent(countryName)}&format=jsonv2&limit=1&addressdetails=1`;
  const data = await fetchWithUA(searchUrl);
  
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`No search results found for country: ${countryName}`);
  }
  
  const result = data[0] as NominatimSearchResult;
  if (!result || !result.boundingbox) {
    throw new Error(`Could not find bounding box for country: ${countryName}`);
  }
  
  const [south, north, west, east] = result.boundingbox.map(parseFloat);
  return [west, south, east, north]; // [minLon, minLat, maxLon, maxLat]
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

async function reverseGeocode(lat: number, lon: number): Promise<NominatimReverseResult> {
  const reverseUrl = `${NOMINATIM_BASE_URL}/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1`;
  const data = await fetchWithUA(reverseUrl);
  
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid response from reverse geocoding API');
  }
  
  if (!data.address) {
    throw new Error('No address found for the coordinates');
  }
  
  return data as NominatimReverseResult;
}

export async function getRandomLocation(options?: Options): Promise<Location> {
  let countries: Country[];
  let selectedCountry: Country;

  countries = await getAllCountries();

  if (options?.country) {
    // Find the country by name
    const foundCountry = countries.find(c => c.name.common.toLowerCase() === options.country!.toLowerCase());
    if (!foundCountry) {
      throw new Error(`Country not found: ${options.country}`);
    }
    selectedCountry = foundCountry;
  } else if (options?.continent) {
    const regionCountries = getCountriesInRegion(countries, options.continent);
    if (regionCountries.length === 0) {
      throw new Error(`No countries found in continent: ${options.continent}`);
    }
    selectedCountry = pickRandom(regionCountries);
  } else {
    // Global random: pick any country
    selectedCountry = pickRandom(countries);
  }

  const bbox = await getCountryBbox(selectedCountry.name.common);
  const [minLon, minLat, maxLon, maxLat] = bbox;
  
  // Add a delay to respect Nominatim rate limits (1 request per second)
  await new Promise(resolve => setTimeout(resolve, 1500));

  let lat: number;
  let lon: number;
  let address: NominatimReverseResult | null = null;
  let attempts = 0;
  const maxAttempts = 5; // Retry if no valid address (e.g., ocean)

  do {
    lat = randomBetween(minLat, maxLat);
    lon = randomBetween(minLon, maxLon);
    try {
      address = await reverseGeocode(lat, lon);
      attempts++;
      
      // Enhanced validation: ensure we have a reasonable location
      const hasValidLocation = address && address.address && (
        address.address.city || 
        address.address.town || 
        address.address.village ||
        address.address.suburb ||
        address.address.road ||
        address.address.country
      );
      
      if (hasValidLocation) {
        break; // Found a valid location, exit the loop
      } else {
        console.warn(`Attempt ${attempts}: Found location but insufficient details, retrying...`);
        address = null;
      }
    } catch (error) {
      console.warn(`Attempt ${attempts + 1} failed for ${selectedCountry.name.common}, retrying...`);
      attempts++;
      address = null; // Reset address on error
      // Add a delay before retry to respect Nominatim rate limits
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay for Nominatim
      }
    }
  } while (attempts < maxAttempts);

  if (!address || attempts >= maxAttempts) {
    throw new Error('Could not find a valid populated location after retries');
  }

  const city = address.address.city || address.address.town || address.address.village || null;
  const localName = address.address.road || address.address.house_number || address.display_name.split(',')[0].trim();

  // Enhanced location object with detailed information
  const location: Location = {
    lat: parseFloat(address.lat),
    lon: parseFloat(address.lon),
    country: address.address.country,
    state: address.address.state,
    city,
    localName,
    displayName: address.display_name,
    // Enhanced details from Nominatim API
    placeId: address.place_id,
    osmType: address.osm_type,
    osmId: address.osm_id,
    placeRank: address.place_rank,
    category: address.category,
    type: address.type,
    importance: address.importance,
    address: {
      houseNumber: address.address.house_number,
      road: address.address.road,
      suburb: address.address.suburb,
      city: address.address.city,
      town: address.address.town,
      village: address.address.village,
      county: address.address.county,
      state: address.address.state,
      postcode: address.address.postcode,
      country: address.address.country,
      countryCode: address.address.country_code,
    },
    boundingBox: address.boundingbox ? [
      parseFloat(address.boundingbox[0]), // minLat
      parseFloat(address.boundingbox[1]), // maxLat
      parseFloat(address.boundingbox[2]), // minLon
      parseFloat(address.boundingbox[3])  // maxLon
    ] : undefined,
  };

  return location;
}

// Example usage:
// getRandomLocation().then(loc => console.log(loc));
// getRandomLocation({ country: 'Germany' }).then(loc => console.log(loc));
// getRandomLocation({ continent: 'Europe' }).then(loc => console.log(loc));