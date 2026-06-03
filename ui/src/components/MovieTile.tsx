import type { Movie } from "../types/movie";
import MovieIcon from "./MovieIcon";

export default function MovieTile({ movie }: { movie: Movie }) {
  return (
    <div className="bg-stone-50 w-full md:w-4/5 lg:w-3/5 xl:w-1/2 h-50 rounded-2xl p-4 flex">
      <div className="w-1/4 h-ful flex items-center justify-center">
        <MovieIcon size="80px" />
      </div>
      <div className="flex-1 max-w-full h-full flex flex-col p-2">
        <div className="flex justify-between">
          <div>
            <h1 className="text-3xl font-bold">{movie.name}</h1>
            <span className="text-gray-500">{movie.genre}</span>
          </div>
          <div>
            {"★".repeat(movie.rating ?? 0)}
            {"☆".repeat(10 - (movie.rating ?? 0))}
          </div>
        </div>
        <div>
          <p className="line-clamp-3">
            Lorem ipsum, dolor sit amet consectetur adipisicing elit. Unde,
            cumque! Vel laudantium nemo modi? Maxime illum odit laboriosam velit
            facilis odio itaque, vitae mollitia provident incidunt delectus vel
            sunt optio minus quos qui eveniet dolores explicabo debitis
            necessitatibus ipsum nemo! Sapiente officiis officia iure saepe
            quasi in expedita aliquam. Quo.
          </p>
        </div>
      </div>
    </div>
  );
}
