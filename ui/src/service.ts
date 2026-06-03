import type { Movie } from "./types/movie";

const API: string = "http://localhost:8004";

type MovieResponse = {
  result: Movie[];
  message: string;
};

export async function getMovies(search: string = ""): Promise<MovieResponse> {
  const res = await fetch(`${API}/movies/list?k=${encodeURIComponent(search)}`);

  return await res.json();
}
