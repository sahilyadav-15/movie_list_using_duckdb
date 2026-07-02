import type { Movie } from "../types/movie";
import MovieIcon from "./MovieIcon";

type MovieTileProps = {
  movie: Movie;
  onEdit: (movie: Movie) => void;
  onDelete: (id: number) => void;
  busy: boolean;
};

export default function MovieTile({ movie, onEdit, onDelete, busy }: MovieTileProps) {
  const rating = movie.rating ?? 0;

  return (
    <article className="bg-white w-full rounded-lg border border-stone-300 p-4 shadow-sm">
      <div className="flex gap-4">
        <div className="hidden h-24 w-20 shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-700 sm:flex">
          <MovieIcon size="52px" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="break-words text-xl font-bold text-stone-950">{movie.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone-600">
                <span>{movie.genre || "Uncategorized"}</span>
                <span className={movie.watched ? "text-emerald-700" : "text-stone-500"}>
                  {movie.watched ? "Watched" : "Not watched"}
                </span>
              </div>
            </div>
            <div className="shrink-0 text-sm text-amber-600" aria-label={`${rating} out of 10`}>
              {"★".repeat(rating)}
              {"☆".repeat(10 - rating)}
            </div>
          </div>

          <p className="mt-3 line-clamp-3 text-sm leading-6 text-stone-700">
            {movie.description || "No description yet."}
          </p>

          {movie.review ? (
            <p className="mt-2 line-clamp-2 border-l-2 border-stone-300 pl-3 text-sm italic text-stone-600">
              {movie.review}
            </p>
          ) : null}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onEdit(movie)}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-100"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(movie.id)}
              disabled={busy}
              className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-red-300"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
