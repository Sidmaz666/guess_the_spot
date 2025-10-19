import axios from 'axios';

// Environment variables with fallbacks
const WIKIMEDIA_BASE_URL = process.env.WIKIMEDIA_BASE_URL || 'https://commons.wikimedia.org/w/api.php';
const WIKIMEDIA_USER_AGENT = process.env.WIKIMEDIA_USER_AGENT || 'GuessTheSpot (contact@example.com)';
const WIKIMEDIA_REFERER = process.env.WIKIMEDIA_REFERER || 'https://guessthespot.app';
const OPENVERSE_BASE_URL = process.env.OPENVERSE_BASE_URL || 'https://api.openverse.org/v1/images';

interface Place {
  lat: number;
  lon: number;
  // Other fields like country, city, etc., can be added as needed
}



interface Photo {
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
  // Additional metadata from Wikimedia
  pageId?: number;
  namespace?: number;
  coordinates?: {
    lat: number;
    lon: number;
    primary?: boolean;
    globe?: string;
  };
}

// Openverse API interfaces
interface OpenverseImage {
  id: string;
  title: string;
  indexed_on: string;
  foreign_landing_url: string;
  url: string;
  creator: string;
  creator_url: string;
  license: string;
  license_version: string;
  license_url: string;
  provider: string;
  source: string;
  category: string | null;
  filesize: number | null;
  filetype: string | null;
  tags: Array<{
    name: string;
    accuracy: number | null;
    unstable__provider: string;
  }>;
  attribution: string;
  fields_matched: string[];
  mature: boolean;
  height: number;
  width: number;
  thumbnail: string;
  detail_url: string;
  related_url: string;
  unstable__sensitivity: any[];
}

interface OpenverseResponse {
  result_count: number;
  page_count: number;
  page_size: number;
  page: number;
  results: OpenverseImage[];
}

async function fetchWithUA(url: string, retries: number = 3): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': WIKIMEDIA_USER_AGENT,
          'Referer': WIKIMEDIA_REFERER,
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 10000, // 10 second timeout
        validateStatus: function (status) {
          return status >= 200 && status < 300; // Only resolve for 2xx status codes
        }
      });
      
      return response.data;
    } catch (error: any) {
      console.warn(`Wikimedia API attempt ${attempt} failed for ${url}:`, error.message);
      
      if (attempt === retries) {
        throw new Error(`Failed to fetch data after ${retries} attempts: ${error.message}`);
      }
      
      // Add exponential backoff delay
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

async function getNearbyPhotoWikimedia(place: Place, location?: any): Promise<Photo | null> {
  const { lat, lon } = place;
  const radii = [500, 1000, 2000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000]; // Much larger radii up to 1000km
  
  for (const radius of radii) {
    // First try Wiki at this radius
    const params = new URLSearchParams({
      action: 'query',
      generator: 'geosearch',
      ggscoord: `${lat}|${lon}`,
      ggsradius: radius.toString(),
      ggsnamespace: '6', // File namespace to search for images directly
      ggslimit: '5', // Get more results to filter through
      prop: 'imageinfo|coordinates',
      iiprop: 'url|extmetadata|size|timestamp', // Get comprehensive image info
      format: 'json',
      origin: '*' // For CORS if used in browser
    });
    const url = `${WIKIMEDIA_BASE_URL}?${params.toString()}`;
    
    try {
      console.log(`Wikimedia: Searching with ${radius}m radius`);
      const data = await fetchWithUA(url);
      
      // Check for warnings or errors
      if (data.warnings) {
        console.warn('Wikimedia warnings:', data.warnings);
      }
      
      const pages = data.query?.pages;
      if (pages && Object.keys(pages).length > 0) {
        // Handle the -1 index case (sometimes used for first result)
        const pageKeys = Object.keys(pages).filter(key => key !== '-1');
        if (pageKeys.length === 0 && pages['-1']) {
          pageKeys.push('-1');
        }
        
        // Try to find the best photo - prioritize with coordinates, but accept any image
        for (const pageId of pageKeys) {
          const page = pages[pageId];
          const coords = page.coordinates?.[0];
          const imageInfo = page.imageinfo?.[0];
          
          // First priority: photos with coordinates and image info
          if (coords && imageInfo && imageInfo.url) {
            console.log(`Wikimedia: Found photo with coordinates at ${radius}m radius. Title: ${page.title}`);
            return createPhotoObject(pageId, page, coords, imageInfo);
          }
          
          // Second priority: photos with image info but no coordinates (still from the area)
          if (imageInfo && imageInfo.url) {
            console.log(`Wikimedia: Found photo without coordinates at ${radius}m radius. Title: ${page.title}`);
            // Create coordinates from the search center for display purposes
            const fallbackCoords = { lat: lat.toString(), lon: lon.toString(), primary: false, globe: 'earth' };
            return createPhotoObject(pageId, page, fallbackCoords, imageInfo);
          }
        }
      }
      
      console.log(`Wikimedia: No suitable photo found at ${radius}m. Trying Openverse before expanding radius...`);
      
      // Try Openverse before expanding radius
      const openversePhoto = await getNearbyPhotoOpenverse(lat, lon, radius, location);
      if (openversePhoto) {
        console.log(`✅ Openverse SUCCESS at ${radius}m radius!`);
        console.log(`📸 Image found: "${openversePhoto.title}"`);
        console.log(`🎯 Image URL: ${openversePhoto.fileurl}`);
        console.log(`👤 Author: ${openversePhoto.author || 'Unknown'}`);
        console.log(`📄 License: ${openversePhoto.license || 'Unknown'}`);
        return openversePhoto;
      }
      
      console.log(`Openverse: No suitable photo found at ${radius}m. Trying larger radius...`);
    } catch (error) {
      console.error(`Wikimedia error at ${radius}m:`, error);
      
      // Try Openverse even if Wiki had an error
      console.log(`Trying Openverse after Wiki error at ${radius}m...`);
      const openversePhoto = await getNearbyPhotoOpenverse(lat, lon, radius, location);
      if (openversePhoto) {
        console.log(`✅ Openverse SUCCESS at ${radius}m radius (after Wiki error)!`);
        console.log(`📸 Image found: "${openversePhoto.title}"`);
        console.log(`🎯 Image URL: ${openversePhoto.fileurl}`);
        console.log(`👤 Author: ${openversePhoto.author || 'Unknown'}`);
        console.log(`📄 License: ${openversePhoto.license || 'Unknown'}`);
        return openversePhoto;
      }
    }
    
    // Add a small delay between radius attempts to respect rate limits
    if (radius !== radii[radii.length - 1]) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('Wikimedia: No photos found within maximum search radius. Trying fallback strategies...');
  
  // Fallback 1: Search for photos in nearby cities/landmarks
  const fallbackPhoto = await searchNearbyCities(lat, lon);
  if (fallbackPhoto) {
    console.log('Wikimedia: Found fallback photo from nearby city/landmark');
    return fallbackPhoto;
  }
  
  // Fallback 2: Search for country-level photos
  const countryPhoto = await searchCountryPhotos(lat, lon);
  if (countryPhoto) {
    console.log('Wikimedia: Found fallback photo from country level');
    return countryPhoto;
  }
  
  // Fallback 3: Global search as last resort
  const globalPhoto = await searchGlobalPhotos(lat, lon);
  if (globalPhoto) {
    console.log('Wikimedia: Found fallback photo from global search');
    return globalPhoto;
  }
  
  console.log('Wikimedia: No photos found with any strategy.');
  return null;
}

// Fallback function to search for photos in nearby cities/landmarks
async function searchNearbyCities(lat: number, lon: number): Promise<Photo | null> {
  try {
    // Search for photos in a much larger radius focusing on cities and landmarks
    const params = new URLSearchParams({
      action: 'query',
      generator: 'geosearch',
      ggscoord: `${lat}|${lon}`,
      ggsradius: '500000', // 500km radius for cities/landmarks
      ggsnamespace: '6',
      ggslimit: '50', // Get more results
      prop: 'imageinfo|coordinates',
      iiprop: 'url|extmetadata|size|timestamp',
      format: 'json',
      origin: '*'
    });
    
    const url = `${WIKIMEDIA_BASE_URL}?${params.toString()}`;
    console.log('Wikimedia: Searching nearby cities/landmarks');
    
    const data = await fetchWithUA(url);
    const pages = data.query?.pages;
    
    if (pages && Object.keys(pages).length > 0) {
      // Look for photos with higher importance (cities, landmarks)
      const pageKeys = Object.keys(pages).filter(key => key !== '-1');
      
      for (const pageId of pageKeys) {
        const page = pages[pageId];
        const coords = page.coordinates?.[0];
        const imageInfo = page.imageinfo?.[0];
        
        // Accept any image with coordinates first
        if (coords && imageInfo && imageInfo.url) {
          console.log(`Wikimedia: Found city/landmark photo with coordinates: ${page.title}`);
          return createPhotoObject(pageId, page, coords, imageInfo);
        }
        
        // Accept any image without coordinates too
        if (imageInfo && imageInfo.url) {
          console.log(`Wikimedia: Found city/landmark photo without coordinates: ${page.title}`);
          const fallbackCoords = { lat: lat.toString(), lon: lon.toString(), primary: false, globe: 'earth' };
          return createPhotoObject(pageId, page, fallbackCoords, imageInfo);
        }
      }
    }
  } catch (error) {
    console.warn('Wikimedia: Error in nearby cities search:', error);
  }
  
  return null;
}

// Fallback function to search for country-level photos
async function searchCountryPhotos(lat: number, lon: number): Promise<Photo | null> {
  try {
    // Search for photos with country-level importance - much larger radius
    const params = new URLSearchParams({
      action: 'query',
      generator: 'geosearch',
      ggscoord: `${lat}|${lon}`,
      ggsradius: '2000000', // 2000km radius for country-level
      ggsnamespace: '6',
      ggslimit: '30', // Get many more results
      prop: 'imageinfo|coordinates',
      iiprop: 'url|extmetadata|size|timestamp',
      format: 'json',
      origin: '*'
    });
    
    const url = `${WIKIMEDIA_BASE_URL}?${params.toString()}`;
    console.log('Wikimedia: Searching country-level photos');
    
    const data = await fetchWithUA(url);
    const pages = data.query?.pages;
    
    if (pages && Object.keys(pages).length > 0) {
      const pageKeys = Object.keys(pages).filter(key => key !== '-1');
      
      for (const pageId of pageKeys) {
        const page = pages[pageId];
        const coords = page.coordinates?.[0];
        const imageInfo = page.imageinfo?.[0];
        
        // Accept any image with coordinates first
        if (coords && imageInfo && imageInfo.url) {
          console.log(`Wikimedia: Found country-level photo with coordinates: ${page.title}`);
          return createPhotoObject(pageId, page, coords, imageInfo);
        }
        
        // Accept any image without coordinates too - we need something from the region
        if (imageInfo && imageInfo.url) {
          console.log(`Wikimedia: Found country-level photo without coordinates: ${page.title}`);
          const fallbackCoords = { lat: lat.toString(), lon: lon.toString(), primary: false, globe: 'earth' };
          return createPhotoObject(pageId, page, fallbackCoords, imageInfo);
        }
      }
    }
  } catch (error) {
    console.warn('Wikimedia: Error in country photos search:', error);
  }
  
  return null;
}

// Fallback function for global search as last resort
async function searchGlobalPhotos(lat: number, lon: number): Promise<Photo | null> {
  try {
    // Search globally with maximum radius
    const params = new URLSearchParams({
      action: 'query',
      generator: 'geosearch',
      ggscoord: `${lat}|${lon}`,
      ggsradius: '10000000', // 10,000km radius - essentially global
      ggsnamespace: '6',
      ggslimit: '50', // Get many results
      prop: 'imageinfo|coordinates',
      iiprop: 'url|extmetadata|size|timestamp',
      format: 'json',
      origin: '*'
    });
    
    const url = `${WIKIMEDIA_BASE_URL}?${params.toString()}`;
    console.log('Wikimedia: Searching global photos as last resort');
    
    const data = await fetchWithUA(url);
    const pages = data.query?.pages;
    
    if (pages && Object.keys(pages).length > 0) {
      const pageKeys = Object.keys(pages).filter(key => key !== '-1');
      
      for (const pageId of pageKeys) {
        const page = pages[pageId];
        const coords = page.coordinates?.[0];
        const imageInfo = page.imageinfo?.[0];
        
        // Accept any image - we're desperate at this point
        if (imageInfo && imageInfo.url) {
          console.log(`Wikimedia: Found global photo: ${page.title}`);
          const fallbackCoords = coords || { lat: lat.toString(), lon: lon.toString(), primary: false, globe: 'earth' };
          return createPhotoObject(pageId, page, fallbackCoords, imageInfo);
        }
      }
    }
  } catch (error) {
    console.warn('Wikimedia: Error in global photos search:', error);
  }
  
  return null;
}

// Helper function to create photo object
function createPhotoObject(pageId: string | number, page: any, coords: any, imageInfo: any): Photo {
  const extmetadata = imageInfo.extmetadata || {};
  
  return {
    id: typeof pageId === 'string' ? parseInt(pageId) : pageId,
    lat: parseFloat(coords.lat),
    lng: parseFloat(coords.lon),
    fileurl: imageInfo.url,
    title: page.title,
    description: extmetadata.ImageDescription?.value || extmetadata.ObjectName?.value,
    author: extmetadata.Artist?.value || extmetadata.Credit?.value,
    license: extmetadata.LicenseShortName?.value || extmetadata.License?.value,
    width: imageInfo.width,
    height: imageInfo.height,
    size: imageInfo.size,
    timestamp: imageInfo.timestamp,
    pageId: typeof pageId === 'string' ? parseInt(pageId) : pageId,
    namespace: page.ns,
    coordinates: {
      lat: parseFloat(coords.lat),
      lon: parseFloat(coords.lon),
      primary: coords.primary,
      globe: coords.globe
    }
  };
}

// Export the main function for use in other modules
// Helper function to create multiple search strategies for Openverse following best practices
function createSearchStrategies(location: any): Array<{query: string, useExactMatch: boolean}> {
  const strategies: Array<{query: string, useExactMatch: boolean}> = [];
  
  console.log(`🔧 Creating search strategies for location:`, location);
  
  // Strategy 1: Full display name (exact match for specific locations)
  if (location.displayName && location.displayName.length < 100) { // Avoid overly long queries
    strategies.push({query: location.displayName, useExactMatch: true});
    console.log(`📝 Strategy 1: Full display name (exact) - "${location.displayName}"`);
  }
  
  // Strategy 2: City + Country (exact match for specific combinations)
  if (location.city && location.country) {
    const cityCountry = `${location.city} ${location.country}`;
    strategies.push({query: cityCountry, useExactMatch: true});
    console.log(`🏙️ Strategy 2: City + Country (exact) - "${cityCountry}"`);
  }
  
  // Strategy 3: State + Country (exact match)
  if (location.state && location.country) {
    const stateCountry = `${location.state} ${location.country}`;
    strategies.push({query: stateCountry, useExactMatch: true});
    console.log(`🗺️ Strategy 3: State + Country (exact) - "${stateCountry}"`);
  }
  
  // Strategy 4: Local Name + Country (exact match)
  if (location.localName && location.country) {
    const localCountry = `${location.localName} ${location.country}`;
    strategies.push({query: localCountry, useExactMatch: true});
    console.log(`📍 Strategy 4: Local Name + Country (exact) - "${localCountry}"`);
  }
  
  // Strategy 5: Just Country + landscape (stemmed search for broader results)
  if (location.country) {
    strategies.push({query: `${location.country} landscape`, useExactMatch: false});
    console.log(`🌍 Strategy 5: Country + landscape (stemmed) - "${location.country} landscape"`);
  }
  
  // Strategy 6: Country + city (stemmed search)
  if (location.country && location.city) {
    strategies.push({query: `${location.country} ${location.city}`, useExactMatch: false});
    console.log(`🏙️ Strategy 6: Country + City (stemmed) - "${location.country} ${location.city}"`);
  }
  
  // Strategy 7: Country + architecture (stemmed search)
  if (location.country) {
    strategies.push({query: `${location.country} architecture`, useExactMatch: false});
    console.log(`🏛️ Strategy 7: Country + architecture (stemmed) - "${location.country} architecture"`);
  }
  
  // Strategy 8: Country + nature (stemmed search)
  if (location.country) {
    strategies.push({query: `${location.country} nature`, useExactMatch: false});
    console.log(`🌿 Strategy 8: Country + nature (stemmed) - "${location.country} nature"`);
  }
  
  // Strategy 9: Country + travel (stemmed search)
  if (location.country) {
    strategies.push({query: `${location.country} travel`, useExactMatch: false});
    console.log(`✈️ Strategy 9: Country + travel (stemmed) - "${location.country} travel"`);
  }
  
  // Strategy 10: Country + tourism (stemmed search)
  if (location.country) {
    strategies.push({query: `${location.country} tourism`, useExactMatch: false});
    console.log(`🎯 Strategy 10: Country + tourism (stemmed) - "${location.country} tourism"`);
  }
  
  // Strategy 11: Regional terms based on country (stemmed search)
  if (location.country) {
    const countryLower = location.country.toLowerCase();
    
    if (countryLower.includes('europe') || countryLower.includes('france') || countryLower.includes('germany') || countryLower.includes('italy') || countryLower.includes('spain')) {
      strategies.push({query: 'european architecture', useExactMatch: false});
      strategies.push({query: 'european landscape', useExactMatch: false});
      console.log(`🏰 Added European strategies (stemmed)`);
    }
    
    if (countryLower.includes('asia') || countryLower.includes('china') || countryLower.includes('japan') || countryLower.includes('india') || countryLower.includes('thailand')) {
      strategies.push({query: 'asian architecture', useExactMatch: false});
      strategies.push({query: 'asian landscape', useExactMatch: false});
      console.log(`🏮 Added Asian strategies (stemmed)`);
    }
    
    if (countryLower.includes('america') || countryLower.includes('usa') || countryLower.includes('canada') || countryLower.includes('mexico')) {
      strategies.push({query: 'american landscape', useExactMatch: false});
      strategies.push({query: 'north american', useExactMatch: false});
      console.log(`🗽 Added American strategies (stemmed)`);
    }
    
    if (countryLower.includes('africa') || countryLower.includes('south africa') || countryLower.includes('egypt') || countryLower.includes('kenya')) {
      strategies.push({query: 'african landscape', useExactMatch: false});
      strategies.push({query: 'african wildlife', useExactMatch: false});
      console.log(`🦁 Added African strategies (stemmed)`);
    }
    
    if (countryLower.includes('australia') || countryLower.includes('new zealand')) {
      strategies.push({query: 'australian landscape', useExactMatch: false});
      strategies.push({query: 'oceania', useExactMatch: false});
      console.log(`🦘 Added Australian strategies (stemmed)`);
    }
  }
  
  // Strategy 12: Generic landscape terms (stemmed search for broad results)
  strategies.push({query: 'landscape photography', useExactMatch: false});
  strategies.push({query: 'nature photography', useExactMatch: false});
  strategies.push({query: 'travel photography', useExactMatch: false});
  console.log(`📸 Added generic photography strategies (stemmed)`);
  
  console.log(`📋 Total strategies created: ${strategies.length}`);
  return strategies;
}

// Helper function to try a single search strategy following Openverse best practices
async function trySearchStrategy(searchQuery: string, lat: number, lon: number, useExactMatch: boolean = false): Promise<Photo | null> {
  try {
    // Format query according to Openverse guidelines
    const formattedQuery = useExactMatch ? `"${searchQuery}"` : searchQuery;
    console.log(`🔍 Openverse: Trying search strategy - "${formattedQuery}" (${useExactMatch ? 'exact match' : 'stemmed search'})`);
    
    // Build search URL following Openverse documentation guidelines
    const params = new URLSearchParams({
      q: formattedQuery,
      page_size: '20', // Get more results for better selection
      page: '1',
      license: 'cc0,by,by-sa,by-nc,by-nc-sa,by-nd,by-nc-nd', // Include all common licenses
      source: 'flickr,wikimedia', // Focus on reliable sources
      mature: 'false' // Exclude mature content
    });
    
    const searchUrl = `${OPENVERSE_BASE_URL}/?${params.toString()}`;
    console.log(`🌐 Openverse URL: ${searchUrl}`);
    
    const response = await fetchWithUA(searchUrl);
    
    if (!response || !response.results || response.results.length === 0) {
      console.log(`❌ Openverse: No results for "${formattedQuery}"`);
      return null;
    }
    
    console.log(`📊 Openverse: Found ${response.results.length} results for "${formattedQuery}"`);
    
    // Filter out mature content and prioritize high-quality images
    const validImages = response.results
      .filter((img: OpenverseImage) => !img.mature && img.width && img.height) // Ensure we have dimensions
      .filter((img: OpenverseImage) => img.width >= 400 && img.height >= 300) // Minimum quality threshold
      .slice(0, 15); // Take top 15 for better selection
    
    console.log(`✅ Openverse: ${validImages.length} suitable images after filtering`);
    
    if (validImages.length === 0) {
      console.log(`❌ Openverse: No suitable images found (all filtered out)`);
      return null;
    }
    
    // Prioritize images with better titles (title matches get higher weight per docs)
    const sortedImages = validImages.sort((a: OpenverseImage, b: OpenverseImage) => {
      const aTitleMatch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) ? 1 : 0;
      const bTitleMatch = b.title.toLowerCase().includes(searchQuery.toLowerCase()) ? 1 : 0;
      return bTitleMatch - aTitleMatch; // Higher title match first
    });
    
    // Randomly select from top 5 results for variety
    const topResults = sortedImages.slice(0, 5);
    const randomIndex = Math.floor(Math.random() * topResults.length);
    const selectedImage = topResults[randomIndex];
    
    console.log(`🎲 Openverse: Selected from top ${topResults.length} results (index ${randomIndex + 1})`);
    console.log(`📸 Openverse: Selected image: "${selectedImage.title}"`);
    console.log(`🎯 Openverse: Image URL: ${selectedImage.url}`);
    console.log(`👤 Openverse: Creator: ${selectedImage.creator}`);
    console.log(`📄 Openverse: License: ${selectedImage.license}`);
    console.log(`📏 Openverse: Dimensions: ${selectedImage.width}x${selectedImage.height}`);
    console.log(`🏷️ Openverse: Tags: [${selectedImage.tags.map((tag: any) => tag.name).slice(0, 5).join(', ')}]`);
    
    // Convert Openverse image to Photo format
    const photo: Photo = {
      id: parseInt(selectedImage.id.replace(/-/g, '').substring(0, 8), 16), // Convert UUID to number
      lat: lat, // Use the target coordinates for display purposes
      lng: lon, // Use the target coordinates for display purposes
      fileurl: selectedImage.url,
      title: selectedImage.title,
      description: selectedImage.tags.map((tag: any) => tag.name).join(', '),
      author: selectedImage.creator,
      license: selectedImage.license.toUpperCase(),
      width: selectedImage.width,
      height: selectedImage.height,
      size: selectedImage.filesize,
      timestamp: selectedImage.indexed_on,
      pageId: parseInt(selectedImage.id.replace(/-/g, '').substring(0, 8), 16),
      namespace: 0,
      coordinates: {
        lat: lat, // Use target coordinates since Openverse doesn't provide geolocation
        lon: lon, // Use target coordinates since Openverse doesn't provide geolocation
        primary: true,
        globe: 'earth'
      }
    };
    
    console.log(`✅ Openverse: Successfully converted to Photo object`);
    return photo;
    
  } catch (error) {
    console.error(`💥 Openverse: Error with strategy "${searchQuery}":`, error);
    return null;
  }
}

// Openverse API function - multi-strategy search with intelligent fallbacks following best practices
async function getNearbyPhotoOpenverse(lat: number, lon: number, radius: number = 5000, location?: any): Promise<Photo | null> {
  try {
    console.log(`🔍 Openverse: Starting multi-strategy search for coordinates ${lat}, ${lon}`);
    
    // Create multiple search strategies with exact match preferences
    const strategies = location ? createSearchStrategies(location) : [
      {query: 'landscape photography', useExactMatch: false},
      {query: 'nature photography', useExactMatch: false},
      {query: 'travel photography', useExactMatch: false}
    ];
    
    console.log(`📋 Openverse: Will try ${strategies.length} different search strategies`);
    
    // Try each strategy until one succeeds
    for (let i = 0; i < strategies.length; i++) {
      const strategy = strategies[i];
      console.log(`🎯 Openverse: Strategy ${i + 1}/${strategies.length}: "${strategy.query}" (${strategy.useExactMatch ? 'exact match' : 'stemmed search'})`);
      
      const photo = await trySearchStrategy(strategy.query, lat, lon, strategy.useExactMatch);
      if (photo) {
        console.log(`✅ Openverse: SUCCESS with strategy ${i + 1}: "${strategy.query}"`);
        console.log(`📸 Image found: "${photo.title}"`);
        console.log(`🎯 Image URL: ${photo.fileurl}`);
        console.log(`👤 Author: ${photo.author || 'Unknown'}`);
        console.log(`📄 License: ${photo.license || 'Unknown'}`);
        return photo;
      }
      
      console.log(`❌ Openverse: Strategy ${i + 1} failed: "${strategy.query}"`);
      
      // Add a small delay between strategies to be respectful to the API
      if (i < strategies.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`❌ Openverse: All ${strategies.length} strategies failed`);
    return null;
    
  } catch (error) {
    console.error(`💥 Openverse: Error in multi-strategy search:`, error);
    return null;
  }
}

// Main function with infinite fallback logic: Wiki -> Openverse -> Wiki -> Openverse (until success)
async function getNearbyPhotoWithFallback(lat: number, lon: number, radius: number = 5000, location?: any): Promise<Photo | null> {
  let attempt = 0;
  let consecutiveFailures = 0;
  const maxConsecutiveFailures = 50; // Safety valve to prevent infinite loops in extreme cases
  
  console.log(`🔄 Starting infinite fallback search for images near ${lat}, ${lon}`);
  if (location) {
    console.log(`📍 Location details: ${location.city || 'Unknown City'}, ${location.state || 'Unknown State'}, ${location.country || 'Unknown Country'}`);
  }
  console.log(`🎯 Fallback Strategy: Wiki (with Openverse at each radius) → Openverse → Wiki (with Openverse at each radius) → Openverse → ... (until success)`);
  
  while (consecutiveFailures < maxConsecutiveFailures) {
    try {
      let photo: Photo | null = null;
      
      if (attempt % 2 === 0) {
        // Even attempts: Try Wikimedia first
        console.log(`🔄 Attempt ${attempt + 1}: Trying Wikimedia Commons...`);
        console.log(`📊 Current attempt pattern: Wiki (attempt ${attempt + 1})`);
        photo = await getNearbyPhotoWikimedia({ lat, lon }, location);
        
        if (photo) {
          console.log(`✅ Wikimedia SUCCESS on attempt ${attempt + 1}!`);
          console.log(`📸 Image found: "${photo.title}"`);
          console.log(`🎯 Image URL: ${photo.fileurl}`);
          console.log(`👤 Author: ${photo.author || 'Unknown'}`);
          console.log(`📄 License: ${photo.license || 'Unknown'}`);
          console.log(`🏁 Fallback completed successfully with Wikimedia!`);
          return photo;
        }
        
        console.log(`❌ Wikimedia failed on attempt ${attempt + 1} - will try Openverse next`);
      } else {
        // Odd attempts: Try Openverse
        console.log(`🔄 Attempt ${attempt + 1}: Trying Openverse API...`);
        console.log(`📊 Current attempt pattern: Openverse (attempt ${attempt + 1})`);
        photo = await getNearbyPhotoOpenverse(lat, lon, radius, location);
        
        if (photo) {
          console.log(`✅ Openverse SUCCESS on attempt ${attempt + 1}!`);
          console.log(`📸 Image found: "${photo.title}"`);
          console.log(`🎯 Image URL: ${photo.fileurl}`);
          console.log(`👤 Author: ${photo.author || 'Unknown'}`);
          console.log(`📄 License: ${photo.license || 'Unknown'}`);
          console.log(`🏁 Fallback completed successfully with Openverse!`);
          return photo;
        }
        
        console.log(`❌ Openverse failed on attempt ${attempt + 1} - will try Wikimedia next`);
      }
      
      attempt++;
      consecutiveFailures++;
      
      // Progressive delay to respect rate limits - increases with each failure
      const baseDelay = 2000; // 2 seconds base delay
      const progressiveDelay = Math.min(consecutiveFailures * 1000, 10000); // Max 10 seconds
      const totalDelay = baseDelay + progressiveDelay;
      
      console.log(`⏳ Waiting ${totalDelay}ms before next attempt... (consecutive failures: ${consecutiveFailures})`);
      await new Promise(resolve => setTimeout(resolve, totalDelay));
      
    } catch (error) {
      console.error(`💥 Attempt ${attempt + 1} failed with error:`, error);
      attempt++;
      consecutiveFailures++;
      
      // Longer delay on errors to be extra respectful to APIs
      const errorDelay = 5000 + (consecutiveFailures * 2000);
      console.log(`⏳ Error occurred, waiting ${errorDelay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, errorDelay));
    }
  }
  
  console.log(`❌ Stopped after ${maxConsecutiveFailures} consecutive failures - this location may not have any images available`);
  console.log(`📊 Final Summary: ${attempt} total attempts made (${Math.ceil(attempt/2)} Wiki attempts, ${Math.floor(attempt/2)} Openverse attempts)`);
  return null;
}

export { getNearbyPhotoWikimedia, getNearbyPhotoOpenverse, getNearbyPhotoWithFallback };

// Example usage with provided location data
async function main() {
  const examplePlace: Place = {
    lat: 33.54634,
    lon: 133.6710487
    // Other fields omitted for brevity
  };

  const photo = await getNearbyPhotoWikimedia(examplePlace);
  if (photo) {
    console.log('Found nearby photo from Wikimedia Commons:');
    console.log(`ID: ${photo.id}`);
    console.log(`Title: ${photo.title}`);
    console.log(`Location: ${photo.lat.toFixed(6)}, ${photo.lng.toFixed(6)}`);
    console.log(`Image URL: ${photo.fileurl}`);
    console.log(`Author: ${photo.author || 'Unknown'}`);
    console.log(`License: ${photo.license || 'Unknown'}`);
    console.log(`Size: ${photo.width}x${photo.height} (${photo.size} bytes)`);
    // Optionally, open or download the image
  } else {
    console.log('No photo found from Wikimedia Commons.');
  }
}

// Only run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}