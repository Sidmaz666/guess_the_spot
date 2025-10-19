export interface Location {
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
}

export interface Image {
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
}

export interface GameData {
  location: Location;
  image: Image | null;
}

export interface GuessResult {
  distance: number;
  score: number;
  percentage: number;
  correctLocation: [number, number];
  playerGuess: [number, number];
}
