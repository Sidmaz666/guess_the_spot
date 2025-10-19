# API References for Image Services

## 1. MediaWiki API (for Wikimedia Commons / Geosearch)

**Base URL:** typically `https://commons.wikimedia.org/w/api.php` (or another wiki instance) ([MediaWiki][6])

### Key Modules & Endpoints

* `list=geosearch` — Search for pages near a geographic coordinate. ([vinyl-creep.net][7])
* `generator=geosearch` — Use geosearch as a generator to fetch full page info for results. ([MediaWiki][8])
* `prop=imageinfo`, `prop=coordinates`, `prop=pageimages`, etc. — Fetch image URL, metadata, coordinates for page/files. ([MediaWiki][8])

### Parameters for `list=geosearch`

| Parameter  | Required?                       | Description                                                                              |                                              |      |                                                                   |
| ---------- | ------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------- | ---- | ----------------------------------------------------------------- |
| `action`   | **Yes**                         | `query`                                                                                  |                                              |      |                                                                   |
| `list`     | **Yes**                         | `geosearch`                                                                              |                                              |      |                                                                   |
| `gscoord`  | **Yes**                         | Coordinates “LAT                                                                         | LON” around which to search ([MediaWiki][9]) |      |                                                                   |
| `gsradius` | **Optional**                    | Radius in metres (10–10,000) ([vinyl-creep.net][7])                                      |                                              |      |                                                                   |
| `gslimit`  | **Optional**                    | Max number of pages to return (1–500) ([MediaWiki][9])                                   |                                              |      |                                                                   |
| `gsbbox`   | **Optional**                    | Bounding box “lat1                                                                       | lon1                                         | lat2 | lon2” (top left + bottom right) for search ([vinyl-creep.net][7]) |
| `gsmaxdim` | **Optional**                    | Restrict search to objects no larger than this size (metres) ([theaquariumwiki.com][10]) |                                              |      |                                                                   |
| `format`   | **Yes**                         | e.g. `json`                                                                              |                                              |      |                                                                   |
| `origin`   | **Optional** (for browser CORS) | `*` to allow cross-origin requests ([Stack Overflow][11])                                |                                              |      |                                                                   |

### Parameters for `generator=geosearch` + `prop=imageinfo|coordinates` etc.

| Parameter                    | Required?                  | Description                                                  |                                                           |                                                            |
| ---------------------------- | -------------------------- | ------------------------------------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------- |
| `action`                     | **Yes**                    | `query`                                                      |                                                           |                                                            |
| `generator`                  | **Yes**                    | `geosearch`                                                  |                                                           |                                                            |
| `ggscoord`                   | **Yes**                    | Coordinates “LAT                                             | LON” for generator search (prefix `gg`) ([MediaWiki][12]) |                                                            |
| `ggsradius`                  | **Optional**               | As above, radius for generator search                        |                                                           |                                                            |
| `ggslimit`                   | **Optional**               | Limit results from generator                                 |                                                           |                                                            |
| `prop`                       | **Yes**                    | e.g. `coordinates                                            | imageinfo                                                 | pageimages` — whichever metadata you need ([MediaWiki][8]) |
| `iiprop`                     | **Optional**               | If using `prop=imageinfo`, you may specify extra `iiprop=url | extmetadata` to get image URL & metadata                  |                                                            |
| `iiurlwidth` / `iiurlheight` | **Optional**               | If you need a thumbnail version (width/height)               |                                                           |                                                            |
| `format`                     | **Yes**                    | e.g. `json`                                                  |                                                           |                                                            |
| `origin`                     | **Optional** (for browser) | `*`                                                          |                                                           |                                                            |

### Usage Notes

* For your game, you can do:

  1. Search for photos near random lat/lon: `action=query&list=geosearch&gscoord=LAT|LON&gsradius=R&gslimit=1&format=json&origin=*`
  2. For the page found, query `prop=imageinfo|coordinates`, get image URL + exact coordinates.
* Not all pages have images or geotagged coordinates. You may need to filter or iterate until you get one with both.
* Rate limits: MediaWiki API is free but has request limits per IP/client; spa-like bulk use should include `&continue=` or pagination.
* Important: Use `&origin=*` if using via browser to avoid CORS errors. ([Stack Overflow][11])

### Example GET URLs

1. Search for a photo near lat=51.5, lng=11.95 with radius 5000 m:

```
https://commons.wikimedia.org/w/api.php?action=query
&list=geosearch
&gscoord=51.5|11.95
&gsradius=5000
&gslimit=1
&format=json
&origin=*
```

2. Fetch metadata/image URL for page ID (e.g. 12345678):

```
https://commons.wikimedia.org/w/api.php?action=query
&pageids=12345678
&prop=imageinfo|coordinates
&iiprop=url|extmetadata
&format=json
&origin=*
```

---


---


[6]: https://www.mediawiki.org/wiki/API%3AGeosearch/Sample_code_2?utm_source=chatgpt.com "API:Geosearch/Sample code 2 - MediaWiki"
[7]: https://vinyl-creep.net/wiki/Special%3AApiHelp/query%2Bgeosearch?utm_source=chatgpt.com "MediaWiki API help - Vinyl Creep"
[8]: https://www.mediawiki.org/wiki/API%3AGeosearch/Sample_code_3?utm_source=chatgpt.com "API:Geosearch/Sample code 3 - MediaWiki"
[9]: https://www.mediawiki.org/wiki/API%3AGeosearch?utm_source=chatgpt.com "API:Geosearch - MediaWiki"
[10]: https://www.theaquariumwiki.com/wiki/Special%3AApiHelp/query%2Bgeosearch?utm_source=chatgpt.com "MediaWiki API help - The Free Freshwater and Saltwater Aquarium ..."
[11]: https://stackoverflow.com/questions/71842760/how-to-fetch-a-wikipedia-geosearch-with-a-correct-origin?utm_source=chatgpt.com "how to fetch a wikipedia geosearch with a correct origin?"
[12]: https://www.mediawiki.org/wiki/API%3AGeosearch/es?utm_source=chatgpt.com "API:Geosearch/es - MediaWiki"
