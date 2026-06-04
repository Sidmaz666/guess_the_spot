import * as randomUseragent from 'random-useragent';
import axios from 'axios';

// Environment variables
const NOMINATIM_BASE_URL = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
const REST_COUNTRIES_API_URL = process.env.REST_COUNTRIES_API_URL || 'https://restcountries.com/v3.1/all';

// Comprehensive country bbox data (critical for fallback when APIs fail)
const COUNTRY_BBOX_DATA: Record<string, { bbox: [number, number, number, number]; region: string; lat: number; lon: number }> = {
  'United States': { bbox: [-125, 25, -66, 49], region: 'Americas', lat: 37.1, lon: -95.7 },
  'Canada': { bbox: [-141, 42, -52, 83], region: 'Americas', lat: 56.1, lon: -106.3 },
  'Brazil': { bbox: [-74, -34, -34, 5], region: 'Americas', lat: -14.2, lon: -51.9 },
  'Mexico': { bbox: [-118, 15, -86, 33], region: 'Americas', lat: 23.9, lon: -102.6 },
  'Argentina': { bbox: [-74, -55, -53, -22], region: 'Americas', lat: -38.4, lon: -63.6 },
  'Colombia': { bbox: [-79, 4, -67, 13], region: 'Americas', lat: 4.6, lon: -74.1 },
  'Peru': { bbox: [-81, -18, -68, 0], region: 'Americas', lat: -9.2, lon: -75.0 },
  'Chile': { bbox: [-81, -56, -66, -17], region: 'Americas', lat: -35.7, lon: -71.5 },
  'Venezuela': { bbox: [-73, 0, -60, 12], region: 'Americas', lat: 6.4, lon: -66.9 },
  'Cuba': { bbox: [-85, 19, -74, 24], region: 'Americas', lat: 21.5, lon: -79.3 },
  'Jamaica': { bbox: [-78, 17, -76, 19], region: 'Americas', lat: 18.1, lon: -77.3 },
  'Costa Rica': { bbox: [-86, 8, -82, 11], region: 'Americas', lat: 9.7, lon: -83.7 },
  'Panama': { bbox: [-83, 7, -77, 10], region: 'Americas', lat: 8.5, lon: -80.1 },
  'United Kingdom': { bbox: [-9, 49, 2, 61], region: 'Europe', lat: 54.7, lon: -3.3 },
  'France': { bbox: [-5, 42, 10, 51], region: 'Europe', lat: 46.2, lon: 2.2 },
  'Germany': { bbox: [5, 47, 15, 55], region: 'Europe', lat: 51.2, lon: 10.4 },
  'Italy': { bbox: [6, 35, 19, 47], region: 'Europe', lat: 41.9, lon: 12.6 },
  'Spain': { bbox: [-10, 36, 4, 44], region: 'Europe', lat: 40.5, lon: -3.7 },
  'Netherlands': { bbox: [3, 50, 7, 54], region: 'Europe', lat: 52.1, lon: 5.3 },
  'Belgium': { bbox: [2, 49, 6, 51], region: 'Europe', lat: 50.5, lon: 4.5 },
  'Switzerland': { bbox: [6, 45, 11, 48], region: 'Europe', lat: 46.8, lon: 8.2 },
  'Austria': { bbox: [9, 46, 17, 49], region: 'Europe', lat: 47.5, lon: 14.5 },
  'Portugal': { bbox: [-10, 36, -6, 42], region: 'Europe', lat: 39.4, lon: -8.0 },
  'Greece': { bbox: [19, 34, 29, 42], region: 'Europe', lat: 39.1, lon: 22.5 },
  'Poland': { bbox: [14, 49, 24, 55], region: 'Europe', lat: 51.9, lon: 19.1 },
  'Czech Republic': { bbox: [12, 48, 19, 51], region: 'Europe', lat: 49.8, lon: 15.5 },
  'Hungary': { bbox: [16, 45, 23, 49], region: 'Europe', lat: 47.2, lon: 19.5 },
  'Romania': { bbox: [20, 43, 30, 48], region: 'Europe', lat: 45.9, lon: 24.9 },
  'Bulgaria': { bbox: [22, 41, 29, 44], region: 'Europe', lat: 42.7, lon: 25.5 },
  'Croatia': { bbox: [13, 42, 20, 47], region: 'Europe', lat: 45.1, lon: 15.2 },
  'Serbia': { bbox: [18, 42, 23, 47], region: 'Europe', lat: 44.0, lon: 21.0 },
  'Ukraine': { bbox: [22, 44, 40, 52], region: 'Europe', lat: 48.4, lon: 31.2 },
  'Russia': { bbox: [19, 41, 170, 82], region: 'Europe', lat: 61.5, lon: 105.3 },
  'Norway': { bbox: [4, 58, 31, 71], region: 'Europe', lat: 60.5, lon: 10.7 },
  'Sweden': { bbox: [11, 55, 24, 69], region: 'Europe', lat: 62.1, lon: 17.6 },
  'Finland': { bbox: [20, 59, 32, 70], region: 'Europe', lat: 64.0, lon: 26.2 },
  'Denmark': { bbox: [8, 54, 12, 58], region: 'Europe', lat: 56.3, lon: 9.5 },
  'Ireland': { bbox: [-11, 51, -5, 56], region: 'Europe', lat: 53.1, lon: -8.2 },
  'Iceland': { bbox: [-24, 63, -13, 67], region: 'Europe', lat: 64.9, lon: -19.0 },
  'Turkey': { bbox: [25, 36, 45, 42], region: 'Asia', lat: 39.0, lon: 35.0 },
  'Japan': { bbox: [122, 24, 146, 46], region: 'Asia', lat: 36.2, lon: 138.3 },
  'China': { bbox: [73, 18, 135, 54], region: 'Asia', lat: 35.9, lon: 104.2 },
  'India': { bbox: [68, 6, 97, 36], region: 'Asia', lat: 20.6, lon: 78.9 },
  'South Korea': { bbox: [125, 33, 130, 39], region: 'Asia', lat: 35.9, lon: 127.8 },
  'North Korea': { bbox: [124, 38, 131, 43], region: 'Asia', lat: 40.3, lon: 127.5 },
  'Thailand': { bbox: [97, 5, 106, 21], region: 'Asia', lat: 15.0, lon: 101.0 },
  'Vietnam': { bbox: [102, 8, 110, 24], region: 'Asia', lat: 16.2, lon: 106.1 },
  'Philippines': { bbox: [116, 4, 127, 21], region: 'Asia', lat: 12.9, lon: 121.8 },
  'Indonesia': { bbox: [94, -11, 141, 6], region: 'Asia', lat: -2.5, lon: 118.0 },
  'Malaysia': { bbox: [99, 0, 119, 7], region: 'Asia', lat: 4.2, lon: 101.9 },
  'Singapore': { bbox: [103, 1, 104, 2], region: 'Asia', lat: 1.4, lon: 103.8 },
  'Pakistan': { bbox: [60, 23, 78, 37], region: 'Asia', lat: 30.4, lon: 69.3 },
  'Bangladesh': { bbox: [88, 20, 93, 27], region: 'Asia', lat: 23.7, lon: 90.4 },
  'Nepal': { bbox: [80, 26, 88, 30], region: 'Asia', lat: 28.4, lon: 84.1 },
  'Sri Lanka': { bbox: [79, 5, 82, 10], region: 'Asia', lat: 7.9, lon: 80.8 },
  'Myanmar': { bbox: [92, 9, 101, 28], region: 'Asia', lat: 21.9, lon: 95.9 },
  'Cambodia': { bbox: [102, 10, 107, 15], region: 'Asia', lat: 12.6, lon: 104.9 },
  'Laos': { bbox: [100, 13, 108, 23], region: 'Asia', lat: 19.9, lon: 102.5 },
  'Mongolia': { bbox: [87, 41, 120, 52], region: 'Asia', lat: 46.9, lon: 103.8 },
  'Kazakhstan': { bbox: [46, 40, 87, 55], region: 'Asia', lat: 48.0, lon: 66.9 },
  'Saudi Arabia': { bbox: [34, 16, 56, 32], region: 'Asia', lat: 24.0, lon: 45.0 },
  'United Arab Emirates': { bbox: [51, 22, 56, 27], region: 'Asia', lat: 24.0, lon: 54.7 },
  'Israel': { bbox: [34, 29, 36, 34], region: 'Asia', lat: 31.0, lon: 34.8 },
  'Egypt': { bbox: [24, 22, 37, 32], region: 'Africa', lat: 26.8, lon: 30.0 },
  'South Africa': { bbox: [16, -35, 33, -22], region: 'Africa', lat: -29.0, lon: 24.0 },
  'Nigeria': { bbox: [2, 4, 15, 14], region: 'Africa', lat: 9.1, lon: 8.7 },
  'Kenya': { bbox: [33, -5, 42, 5], region: 'Africa', lat: -0.7, lon: 37.9 },
  'Morocco': { bbox: [-13, 27, -1, 36], region: 'Africa', lat: 31.8, lon: -6.9 },
  'Ghana': { bbox: [-3, 4, 2, 11], region: 'Africa', lat: 7.9, lon: -0.5 },
  'Ethiopia': { bbox: [33, 3, 48, 15], region: 'Africa', lat: 9.1, lon: 40.5 },
  'Tanzania': { bbox: [29, -12, 41, -1], region: 'Africa', lat: -6.4, lon: 34.5 },
  'Australia': { bbox: [113, -44, 154, -10], region: 'Oceania', lat: -25.3, lon: 133.8 },
  'New Zealand': { bbox: [166, -52, 179, -34], region: 'Oceania', lat: -40.9, lon: 174.9 },
  'Fiji': { bbox: [175, -21, -177, -13], region: 'Oceania', lat: -17.7, lon: 178.1 },
  'Papua New Guinea': { bbox: [141, -10, 156, -1], region: 'Oceania', lat: -6.3, lon: 143.9 },
};

interface CountryData {
  name: string;
  bbox: [number, number, number, number];
  region: string;
  lat: number;
  lon: number;
}

interface Location {
  lat: number;
  lon: number;
  country: string;
  state?: string;
  city?: string | null;
  localName?: string;
  displayName: string;
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
  };
  boundingBox?: [number, number, number, number];
}

interface Options {
  continent?: string;
  country?: string;
}

// Browser-like headers for maximum compatibility
const BROWSER_HEADERS = [
  {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0',
  },
  {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
  },
  {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
  },
];

// Global rate limiter for Nominatim (max 1 request per 2 seconds)
let lastNominatimRequest = 0;
async function rateLimitNominatim(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastNominatimRequest;
  if (elapsed < 2000) {
    await new Promise(resolve => setTimeout(resolve, 2000 - elapsed));
  }
  lastNominatimRequest = Date.now();
}

async function fetchWithHeaders(
  url: string,
  retries: number = 3,
  isNominatim: boolean = false
): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const headers: any = { ...BROWSER_HEADERS[(attempt - 1) % BROWSER_HEADERS.length] };
      
      if (isNominatim) {
        headers['User-Agent'] = 'GuessTheSpot/1.0 (https://github.com/Sidmaz666/guessthespot)';
        headers['From'] = 'contact@example.com';
      }

      const response = await axios.get(url, {
        headers,
        timeout: 15000,
        validateStatus: (status) => status >= 200 && status < 300,
        maxRedirects: 5,
      });

      return response.data;
    } catch (error: any) {
      console.warn(`Attempt ${attempt} failed for ${url}:`, error.message);
      
      if (attempt === retries) {
        throw new Error(`Failed after ${retries} attempts: ${error.message}`);
      }
      
      const delay = isNominatim ? 2500 * attempt : 1500 * attempt;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Get all country data from cache or API
async function getCountryData(): Promise<CountryData[]> {
  const countries: CountryData[] = Object.entries(COUNTRY_BBOX_DATA).map(([name, data]) => ({
    name,
    bbox: data.bbox,
    region: data.region,
    lat: data.lat,
    lon: data.lon,
  }));

  // Try to fetch additional countries from REST Countries API
  try {
    const apiCountries = await fetchWithHeaders(
      `${REST_COUNTRIES_API_URL}?fields=name,region,latlng,borders,cca2`,
      2,
      false
    );

    for (const c of apiCountries) {
      if (!countries.find(cx => cx.name === c.name.common)) {
        const bbox = COUNTRY_BBOX_DATA[c.name.common]?.bbox || 
                     (c.latlng ? [c.latlng[1] - 5, c.latlng[0] - 5, c.latlng[1] + 5, c.latlng[0] + 5] : null) ||
                     [-180, -90, 180, 90];
        
        countries.push({
          name: c.name.common,
          bbox: bbox as [number, number, number, number],
          region: c.region || 'Americas',
          lat: c.latlng?.[0] || 0,
          lon: c.latlng?.[1] || 0,
        });
      }
    }
  } catch (error) {
    console.warn('REST Countries API failed, using hardcoded data only');
  }

  return countries;
}

function getCountriesInRegion(countries: CountryData[], region: string): CountryData[] {
  return countries.filter(c => c.region.toLowerCase() === region.toLowerCase());
}

function pickRandom<T>(array: T[]): T {
  if (array.length === 0) throw new Error('No items available');
  return array[Math.floor(Math.random() * array.length)];
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Reverse geocode with multiple fallbacks
async function reverseGeocode(lat: number, lon: number): Promise<any> {
  // Try Nominatim first
  try {
    await rateLimitNominatim();
    const url = `${NOMINATIM_BASE_URL}/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1`;
    const data = await fetchWithHeaders(url, 3, true);
    
    if (data?.address) {
      return data;
    }
  } catch (error) {
    console.warn('Nominatim reverse geocode failed:', error);
  }

  // Fallback using cached country bbox data
  const fallback = await reverseGeocodeFallback(lat, lon);
  return fallback;
}

async function reverseGeocodeFallback(lat: number, lon: number): Promise<any> {
  const countries = await getCountryData();
  for (const country of countries) {
    const [minLon, minLat, maxLon, maxLat] = country.bbox;
    if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) {
      return {
        lat: lat.toString(),
        lon: lon.toString(),
        display_name: `${country.name}`,
        address: {
          country: country.name,
          country_code: '',
        },
      };
    }
  }
  return {
    lat: lat.toString(),
    lon: lon.toString(),
    display_name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    address: { country: 'Unknown' },
  };
}

export async function getRandomLocation(options?: Options): Promise<Location> {
  const countryData = await getCountryData();
  let selectedCountry: CountryData;

  if (options?.country) {
    const found = countryData.find(c =>
      c.name.toLowerCase().includes(options.country!.toLowerCase())
    );
    if (!found) {
      console.warn(`Country "${options.country}" not found, using random`);
      selectedCountry = pickRandom(countryData);
    } else {
      selectedCountry = found;
    }
  } else if (options?.continent) {
    const regionCountries = getCountriesInRegion(countryData, options.continent);
    if (regionCountries.length === 0) {
      console.warn(`No countries in "${options.continent}", using random`);
      selectedCountry = pickRandom(countryData);
    } else {
      selectedCountry = pickRandom(regionCountries);
    }
  } else {
    selectedCountry = pickRandom(countryData);
  }

  const [minLon, minLat, maxLon, maxLat] = selectedCountry.bbox;

  let lat: number;
  let lon: number;
  let address: any = null;
  let attempts = 0;
  const maxAttempts = 3;

  do {
    lat = randomBetween(minLat, maxLat);
    lon = randomBetween(minLon, maxLon);

    try {
      address = await reverseGeocode(lat, lon);
      attempts++;

      if (address?.address) {
        break;
      }
      address = null;
    } catch (error) {
      console.warn(`Geocode attempt ${attempts + 1} failed`);
      attempts++;
      address = null;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  } while (attempts < maxAttempts);

  if (!address?.address) {
    // Final fallback: use country center
    console.warn(`Using country center fallback for ${selectedCountry.name}`);
    lat = selectedCountry.lat;
    lon = selectedCountry.lon;
    address = {
      lat: lat.toString(),
      lon: lon.toString(),
      display_name: selectedCountry.name,
      address: {
        country: selectedCountry.name,
        country_code: 'XX',
      },
    };
  }

  const city = address.address.city || address.address.town || address.address.village || null;
  const localName = address.address.road || address.address.house_number || selectedCountry.name;

  return {
    lat: parseFloat(address.lat),
    lon: parseFloat(address.lon),
    country: address.address.country || selectedCountry.name,
    state: address.address.state,
    city,
    localName,
    displayName: address.display_name || selectedCountry.name,
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
      parseFloat(address.boundingbox[0]),
      parseFloat(address.boundingbox[1]),
      parseFloat(address.boundingbox[2]),
      parseFloat(address.boundingbox[3]),
    ] : undefined,
  };
}