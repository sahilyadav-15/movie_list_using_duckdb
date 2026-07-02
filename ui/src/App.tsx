import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import MovieTile from "./components/MovieTile";
import { deleteMovie, getMovies, saveMovie } from "./service";
import type { Movie, MoviePayload } from "./types/movie";

type FormState = {
  id?: number;
  name: string;
  genre: string;
  description: string;
  watched: boolean;
  rating: string;
  review: string;
};

const blankForm: FormState = {
  name: "",
  genre: "",
  description: "",
  watched: false,
  rating: "",
  review: "",
};

function formFromMovie(movie: Movie): FormState {
  return {
    id: movie.id,
    name: movie.name,
    genre: movie.genre ?? "",
    description: movie.description ?? "",
    watched: Boolean(movie.watched),
    rating: movie.rating == null ? "" : String(movie.rating),
    review: movie.review ?? "",
  };
}

function App() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [form, setForm] = useState<FormState>(blankForm);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEditing = form.id != null;
  const visibleCount = useMemo(() => movies.length.toLocaleString(), [movies.length]);

  async function list(query = search) {
    setLoading(true);
    setError(null);
    try {
      const res = await getMovies(query);
      setMovies(res.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void list("");
  }, []);

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await list(search);
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const rating = form.rating === "" ? null : Number(form.rating);
    const payload: MoviePayload = {
      ...(form.id == null ? {} : { id: form.id }),
      name: form.name.trim(),
      genre: form.genre.trim() || null,
      description: form.description.trim() || null,
      watched: form.watched,
      rating,
      review: form.review.trim() || null,
    };

    try {
      await saveMovie(payload);
      setForm(blankForm);
      await list(search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save movie");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: number) {
    setDeletingId(id);
    setError(null);
    try {
      await deleteMovie(id);
      setMovies((current) => current.filter((movie) => movie.id !== id));
      if (form.id === id) setForm(blankForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete movie");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-950">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
        <section className="flex flex-col gap-4 rounded-lg border border-stone-300 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-bold">DuckDB Movie Library</h1>
              <p className="mt-1 text-sm text-stone-600">{visibleCount} movies loaded</p>
            </div>
            <form className="flex w-full gap-2 md:w-auto" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by title"
                className="min-w-0 flex-1 rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-stone-700 md:w-72"
              />
              <button
                type="submit"
                className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
              >
                Search
              </button>
            </form>
          </div>

          {error ? (
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          <form className="grid gap-3 md:grid-cols-2" onSubmit={onSave}>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Movie title"
              required
              className="rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-stone-700"
            />
            <input
              value={form.genre}
              onChange={(event) => setForm({ ...form, genre: event.target.value })}
              placeholder="Genre"
              className="rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-stone-700"
            />
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Description"
              className="min-h-24 rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-stone-700 md:col-span-2"
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={form.watched}
                  onChange={(event) => setForm({ ...form, watched: event.target.checked })}
                  className="h-4 w-4"
                />
                Watched
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={form.rating}
                onChange={(event) => setForm({ ...form, rating: event.target.value })}
                placeholder="Rating"
                className="w-28 rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-stone-700"
              />
            </div>
            <input
              value={form.review}
              onChange={(event) => setForm({ ...form, review: event.target.value })}
              placeholder="Review"
              className="rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-stone-700"
            />
            <div className="flex justify-end gap-2 md:col-span-2">
              {isEditing ? (
                <button
                  type="button"
                  onClick={() => setForm(blankForm)}
                  className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-100"
                >
                  Cancel
                </button>
              ) : null}
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                {saving ? "Saving" : isEditing ? "Update movie" : "Add movie"}
              </button>
            </div>
          </form>
        </section>

        <section className="grid gap-4">
          {loading ? <div className="rounded-lg bg-white p-6 text-stone-600">Loading movies...</div> : null}
          {!loading && movies.length === 0 ? (
            <div className="rounded-lg bg-white p-6 text-stone-600">No movies found.</div>
          ) : null}
          {movies.map((movie) => (
            <MovieTile
              key={movie.id}
              movie={movie}
              onEdit={(selected) => setForm(formFromMovie(selected))}
              onDelete={onDelete}
              busy={deletingId === movie.id}
            />
          ))}
        </section>
      </main>
    </div>
  );
}

export default App;
