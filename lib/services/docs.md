# Image Service Pipeline Documentation

## Overview

The image fetching system uses a multi-stage fallback pipeline to ensure reliable image retrieval for any location. Each stage is tried in order with a timeout, and the pipeline stops at the first successful result.

## Pipeline Stages (in order)

### Stage 1: Wikimedia Commons Geosearch
- **API**: Wikimedia Commons MediaWiki API
- **Auth**: None required
- **Method**: `generator=geosearch` with coordinates
- **Max Radius**: 10,000 meters (API limit)
- **Timeout**: 18 seconds
- **Best For**: Locations with geotagged images on Wikimedia Commons

**API Reference**:
```
https://commons.wikimedia.org/w/api.php?action=query&generator=geosearch&ggscoord=LAT|LON&ggsradius=RADIUS&ggsnamespace=6&prop=imageinfo|coordinates&iiprop=url|extmetadata|size&format=json&origin=*
```

### Stage 2: Wikipedia Article Images
- **API**: Wikipedia MediaWiki API
- **Auth**: None required
- **Method**: Search articles by location name, extract lead images
- **Timeout**: 8 seconds
- **Best For**: Populated places with Wikipedia articles

**API Reference**:
```
https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=LOCATION&gsrlimit=3&prop=pageimages|coordinates&format=json&origin=*
```

### Stage 3: Wikimedia Commons Name Search
- **API**: Wikimedia Commons MediaWiki API
- **Auth**: None required
- **Method**: Search File namespace by location name (not geosearch)
- **Timeout**: 8 seconds
- **Best For**: Locations without geotagged images but with Commons files

**API Reference**:
```
https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=LOCATION&srnamespace=6&format=json&origin=*
```

### Stage 4: DuckDuckGo Image Search (VQD API)
- **API**: DuckDuckGo VQD-based image search
- **Auth**: None required
- **Method**: Get VQD token, then fetch JSON image results
- **Timeout**: 8 seconds
- **Best For**: General web images, wide coverage

**How it works**:
1. Request `https://duckduckgo.com/?q=LOCATION&iax=images&ia=images`
2. Extract VQD token from HTML response
3. Request `https://duckduckgo.com/i.js?q=LOCATION&o=json&vqd=VQD`
4. Parse JSON results for image URLs

### Stage 5: Openverse
- **API**: Openverse API (formerly CC Search)
- **Auth**: None required
- **Method**: Multi-strategy search with exact match and stemmed queries
- **Timeout**: 10 seconds
- **Best For**: Creative Commons licensed images

**API Reference**:
```
https://api.openverse.org/v1/images/?q=QUERY&page_size=20&license=cc0,by,by-sa,by-nc,by-nc-sa,by-nd,by-nc-nd&source=flickr,wikimedia
```

### Stage 6: Country-Level Wikimedia Fallback
- **API**: Wikimedia Commons MediaWiki API
- **Auth**: None required
- **Method**: Search by country name when specific location fails
- **Timeout**: 10 seconds
- **Best For**: Remote locations, fallback to country-level images

### Stage 7: Google Custom Search API (Optional)
- **API**: Google Custom Search JSON API
- **Auth**: Required (API key + Custom Search Engine ID)
- **Environment Variables**: `GOOGLE_API_KEY`, `GOOGLE_CX`
- **Timeout**: 8 seconds
- **Free Tier**: 100 queries/day
- **Best For**: High-quality, curated results

**Setup**:
1. Create API key at https://console.cloud.google.com/apis/credentials
2. Create Custom Search Engine at https://cse.google.com/cse/
3. Set `GOOGLE_API_KEY` and `GOOGLE_CX` in environment

### Stage 8: Microsoft Bing Image Search API (Optional)
- **API**: Bing Image Search API
- **Auth**: Required (Azure API key)
- **Environment Variables**: `BING_API_KEY`
- **Timeout**: 8 seconds
- **Free Tier**: 1,000 queries/month
- **Best For**: High-quality commercial images

**Setup**:
1. Create Bing Search resource at https://portal.azure.com/
2. Get API key from Azure portal
3. Set `BING_API_KEY` in environment

### Stage 9: Pexels API (Optional)
- **API**: Pexels Photos API
- **Auth**: Required (API key)
- **Environment Variables**: `PEXELS_API_KEY`
- **Timeout**: 8 seconds
- **Free Tier**: 200 requests/hour
- **Best For**: Professional stock photography

**Setup**:
1. Get API key at https://www.pexels.com/api/
2. Set `PEXELS_API_KEY` in environment

### Stage 10: Pixabay API (Optional)
- **API**: Pixabay API
- **Auth**: Required (API key)
- **Environment Variables**: `PIXABAY_API_KEY`
- **Timeout**: 8 seconds
- **Free Tier**: 5,000 requests/hour
- **Best For**: Free stock photos and illustrations

**Setup**:
1. Get API key at https://pixabay.com/api/docs/
2. Set `PIXABAY_API_KEY` in environment

### Stage 11: Playwright Browser Search (Heavy Fallback)
- **API**: Web scraping via headless browser
- **Auth**: None required
- **Method**: Launch Chromium, navigate to DuckDuckGo images, scrape results
- **Timeout**: 20 seconds
- **Dependencies**: `playwright-core`, `@sparticuz/chromium-min`
- **Warning**: Large binary size (~50-80MB), requires Vercel Pro or similar
- **Best For**: Last resort when all APIs fail

**Vercel Deployment Notes**:
- Function size limit: 50MB (hobby) / 250MB (pro)
- Chromium binary alone is ~50-80MB
- Consider using Vercel Pro plan or external service for this stage

## Environment Variables

### Required (none - all have fallbacks)

### Optional - For Enhanced Coverage

| Variable | Description | Example |
|----------|-------------|---------|
| `WIKIMEDIA_BASE_URL` | Wikimedia Commons API endpoint | `https://commons.wikimedia.org/w/api.php` |
| `WIKIPEDIA_BASE_URL` | Wikipedia API endpoint | `https://en.wikipedia.org/w/api.php` |
| `OPENVERSE_BASE_URL` | Openverse API endpoint | `https://api.openverse.org/v1/images` |
| `GOOGLE_API_KEY` | Google Custom Search API key | `AIzaSy...` |
| `GOOGLE_CX` | Google Custom Search Engine ID | `0123456789:abcdefg` |
| `BING_API_KEY` | Bing Search API key | `abc123...` |
| `PEXELS_API_KEY` | Pexels API key | `abc123...` |
| `PIXABAY_API_KEY` | Pixabay API key | `abc123...` |

## Error Handling

Each stage has:
- Individual timeout (configurable per stage)
- Retry logic (3 attempts with exponential backoff)
- Graceful degradation (returns `null` on failure, pipeline continues)

Image loading errors in the UI:
- `ImageDisplay.tsx`: Shows fallback message with map icon
- `ScoreDisplay.tsx`: Hides broken image thumbnail, game continues

## Performance

### Typical Latencies
- Wikimedia Geosearch: 1-3 seconds
- Wikipedia Article: 1-2 seconds
- DuckDuckGo: 2-4 seconds
- API-key services: 1-2 seconds
- Playwright: 5-15 seconds

### Timeout Strategy
- Total pipeline timeout: ~100 seconds (sum of all stages)
- Early exit: Returns immediately on first success
- Skip stages: Optional stages skipped if API keys not configured

## Rate Limiting

| Service | Limit | Notes |
|---------|-------|-------|
| Wikimedia Commons | 60 req/min | Respectful client behavior |
| Wikipedia | 60 req/min | Same as above |
| DuckDuckGo | ~10 req/min | Unofficial, use cautiously |
| Openverse | 300 req/hour | Official limit |
| Google Custom Search | 100/day (free) | Paid tiers available |
| Bing Search | 1000/month (free) | Paid tiers available |
| Pexels | 200/hour | Free tier |
| Pixabay | 5000/hour | Free tier |

## Dependencies

```json
{
  "dependencies": {
    "@sparticuz/chromium-min": "^131.0.0",
    "playwright-core": "^1.50.1",
    "axios": "^1.12.2"
  }
}
```

## Usage

```typescript
import { getNearbyPhotoWithFallback } from '@/lib/services/get_image';

const photo = await getNearbyPhotoWithFallback(
  lat,
  lon,
  radius,  // optional, default 5000
  location // optional, includes city/country for better search
);

if (photo) {
  console.log('Image found:', photo.fileurl);
} else {
  console.log('No image available for this location');
}
```

## Troubleshooting

### No images found
1. Check if location is valid and has nearby images
2. Verify API keys are set correctly (if using optional services)
3. Check console logs for stage-specific errors
4. Try with a more populated location to test pipeline

### Slow performance
1. Optional API-key services add latency if configured but keys are invalid
2. Playwright stage is very slow - consider disabling if not needed
3. Increase timeout values if network is slow

### Image loading errors
1. Check if image URL is accessible directly
2. Verify CORS settings for external images
3. Next.js Image component may fail on some external domains

## API Reference

### Main Function

```typescript
export async function getNearbyPhotoWithFallback(
  lat: number,
  lon: number,
  radius: number = 5000,
  location?: {
    lat: number;
    lon: number;
    country: string;
    city?: string;
    state?: string;
    localName?: string;
    displayName: string;
  }
): Promise<Photo | null>
```

Returns a `Photo` object or `null` if no image found.

### Photo Interface

```typescript
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
  coordinates?: {
    lat: number;
    lon: number;
    primary?: boolean;
    globe?: string;
  };
}
```