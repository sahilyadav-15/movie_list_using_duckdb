import { Router } from "express";
import { pickValues } from "../db/connection.js";
import { list, orm, remove, save, table } from "../db/query.js";
import { moviesTable, userMovieStatusTable, type MovieRow, type UserMovieStatusRow } from "../db/schema.js";

const router = Router();

type MovieListRow = MovieRow &
  Pick<UserMovieStatusRow, "watched" | "rating" | "review">;

function parseId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function badRequest(res: Parameters<Parameters<typeof router.get>[1]>[1], message: string) {
  return res.status(400).json({ message });
}

function moviePayload(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) throw new Error("Movie name is required");

  const id = body.id == null || body.id === "" ? undefined : parseId(body.id);
  if (body.id != null && body.id !== "" && id == null) throw new Error("Invalid movie id");

  return {
    ...(id == null ? {} : { id }),
    name,
    genre: typeof body.genre === "string" && body.genre.trim() ? body.genre.trim() : null,
    description:
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null,
  };
}

function detailsPayload(body: Record<string, unknown>, fallbackId?: number) {
  const id = body.id == null || body.id === "" ? fallbackId : parseId(body.id);
  if (id == null) throw new Error("Valid movie id is required for details");

  const rating =
    body.rating == null || body.rating === ""
      ? null
      : Number.isInteger(Number(body.rating)) && Number(body.rating) >= 0 && Number(body.rating) <= 10
        ? Number(body.rating)
        : undefined;
  if (rating === undefined) throw new Error("Rating must be between 0 and 10");

  return {
    id,
    watched: typeof body.watched === "boolean" ? body.watched : null,
    rating,
    review: typeof body.review === "string" && body.review.trim() ? body.review.trim() : null,
  };
}

router.get("/list", async (req, res) => {
  const { k } = req.query;

  const movies = table<MovieRow>("movies", undefined, { alias: "m" });
  const query = orm
    .from(movies)
    .leftJoin("user_movie_status", "m.id", "s.id", "s")
    .select(
      "m.id",
      "m.name",
      "m.genre",
      "m.description",
      "s.watched",
      "s.rating",
      "s.review"
    )
    .orderBy("m.id");

  if (typeof k === "string" && k.trim() !== "") {
    query.where("m.name", "ILIKE", `%${k.trim()}%`);
  }

  const result = await query.execute<MovieListRow>();

  res.status(200).json({ result: result, message: "Fetched successfully" });
});

router.post("/save", async (req, res) => {
  try {
    const post = req.body || {};
    const result = await orm.transaction(async (trx) => {
      const movie = moviePayload(post);
      const id = Number(await trx.upsertById(moviesTable, movie));
      const details = detailsPayload(post, id);
      await trx.upsertById(userMovieStatusTable, details);
      return id;
    });
    res.status(201).json({ message: "Movie saved", id: result });
  } catch (error) {
    return badRequest(res, error instanceof Error ? error.message : "Invalid payload");
  }
});

router.post("/saveMovie", async (req, res) => {
  try {
    const post = req.body || {};
    const data = moviePayload(pickValues(post, ["id", "name", "genre", "description"]));

    const result = await save("movies", data);
    res.status(201).json({ message: "Movie saved", id: result });
  } catch (error) {
    return badRequest(res, error instanceof Error ? error.message : "Invalid payload");
  }
});

router.post("/saveDetails", async (req, res) => {
  try {
    const post = req.body || {};
    const data = detailsPayload(pickValues(post, ["id", "watched", "rating", "review"]));

    const result = await save("user_movie_status", data);
    res.status(201).json({ message: "Movie details saved", id: result });
  } catch (error) {
    return badRequest(res, error instanceof Error ? error.message : "Invalid payload");
  }
});

router.delete("/del/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id == null) {
    return res.status(400).json({
      message: "Invalid id",
    });
  }
  const result = await orm.transaction(async (trx) => {
    await trx.delete(userMovieStatusTable, { id });
    await trx.delete(moviesTable, { id });
    return id;
  });
  res.status(200).json({ result: result, message: "Deleted successfully" });
});

router.delete("/delDetails/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id == null) {
    return res.status(400).json({
      message: "Invalid id",
    });
  }
  const result = await remove("user_movie_status", id);
  res.status(200).json({ result: result, message: "Deleted successfully" });
});

export default router;
