import type { Movie, MoviePayload } from "./types/movie";

const API: string = (import.meta.env.VITE_API_URL as string | undefined) || "";

type MovieResponse = {
  result: Movie[];
  message: string;
};

export async function getMovies(search: string = ""): Promise<MovieResponse> {
  const res = await fetch(`${API}/movies/list?k=${encodeURIComponent(search)}`);

  if (!res.ok) throw new Error("Could not fetch movies");
  return await res.json();
}

export async function saveMovie(movie: MoviePayload): Promise<{ id: number; message: string }> {
  const res = await fetch(`${API}/movies/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(movie),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Could not save movie");
  return body;
}

export async function deleteMovie(id: number): Promise<void> {
  const res = await fetch(`${API}/movies/del/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.message || "Could not delete movie");
  }
}
