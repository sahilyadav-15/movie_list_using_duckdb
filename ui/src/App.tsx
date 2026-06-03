/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import MovieTile from "./components/MovieTile";
import { getMovies } from "./service";
import type { Movie } from "./types/movie";

function App() {
  const [movies, setMovies] = useState<Movie[]>([]);

  async function list() {
    const res = await getMovies();
    console.log(res);
    setMovies(res.result);
  }

  useEffect(() => {
    list();
  }, []);

  return (
    <div className="min-h-screen w-full bg-stone-200 flex flex-col items-center gap-8 p-4">
      {movies.map((movie) => (
        <MovieTile key={movie.id} movie={movie} />
      ))}
    </div>
  );
}

export default App;
