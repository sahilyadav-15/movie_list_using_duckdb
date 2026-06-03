import { Router } from "express";
import { pickValues } from "../db/connection.js";
import { list, remove, save } from "../db/query.js";

const router = Router();

router.get("/list", async (req, res) => {
  const { k } = req.query;

  const field: string = "m.id, m.name, m.genre, s.watched, s.rating";

  const query = list("movies as m")
    .leftJoin("user_movie_status as s", "m.id", "s.id")
    .orderBy("m.id");

  if (typeof k === "string" && k.trim() !== "") {
    query.where("m.name", "LIKE", `${k}%`);
  }

  const result = await query.select(field);

  res.status(200).json({ result: result, message: "Fetched successfully" });
});

router.post("/saveMovie", async (req, res) => {
  const post = req.body || {};
  const data = pickValues(post, ["id", "name", "genre"]);

  const result = await save("movies", data);
  res.status(201).json({ message: "Movie saved", id: result });
});

router.post("/saveDetails", async (req, res) => {
  const post = req.body || {};
  const data = pickValues(post, ["id", "watched", "rating"]);

  const result = await save("user_movie_status", data);
  res.status(201).json({ message: "Movie details saved", id: result });
});

router.delete("/del/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({
      message: "Invalid id",
    });
  }
  await remove("user_movie_status", id);
  const result = await remove("movies", id);
  res.status(200).json({ result: result, message: "Deleted successfully" });
});

router.delete("/delDetails/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({
      message: "Invalid id",
    });
  }
  const result = await remove("user_movie_status", id);
  res.status(200).json({ result: result, message: "Deleted successfully" });
});

export default router;
