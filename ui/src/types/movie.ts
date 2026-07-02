export type Movie = {
  id: number;
  name: string;
  genre: string | null;
  description: string | null;
  watched: boolean | null;
  rating: number | null;
  review: string | null;
};

export type MoviePayload = {
  id?: number;
  name: string;
  genre: string | null;
  description: string | null;
  watched: boolean;
  rating: number | null;
  review: string | null;
};
