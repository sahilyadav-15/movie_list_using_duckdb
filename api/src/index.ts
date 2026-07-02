import express from "express";
import cors from "cors";
import { migrate } from "./db/migrations.js";
import { orm } from "./db/query.js";
import moviesRoutes from "./routes/movies.route.js";

const app = express();
app.use(cors());
app.use(express.json());

await migrate(orm);
console.log("Database ready");

app.get("/", (req, res) => {
  res.send("Backend running");
});

app.use("/movies", moviesRoutes);

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ message: error.message || "Unexpected server error" });
});

app.listen(8004, () => {
  console.log("Server running on port 8004...");
});
