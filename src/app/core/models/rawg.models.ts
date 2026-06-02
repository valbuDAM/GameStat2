export interface RawgEntity {
  id: number;
  name: string;
  slug: string;
}

export interface RawgPlatform {
  platform: RawgEntity;
}

export interface RawgGame {
  id: number;
  slug: string;
  name: string;
  released: string | null;
  background_image: string | null;
  rating: number;
  ratings_count: number;
  metacritic: number | null;
  genres: RawgEntity[];
  platforms: RawgPlatform[];
}

export interface RawgGameDetails extends RawgGame {
  description: string;
  description_raw: string;
  website: string;
  reddit_url: string;
  achievements_count: number;
  playtime: number;
  developers: RawgEntity[];
  publishers: RawgEntity[];
}

export interface RawgPaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface RawgGamesPage {
  items: RawgGame[];
  count: number;
  page: number;
  pageSize: number;
  next: string | null;
  previous: string | null;
  hasNextPage: boolean;
}

export interface FavoriteGameRow {
  user_id: string;
  rawg_id: number;
  name: string;
  background_image: string | null;
  rating: number;
  released: string | null;
}
