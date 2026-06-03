import express from "express";
import cors from "cors";
import db from "./db/connection.js";
import moviesRoutes from "./routes/movies.route.js";

const app = express();
app.use(cors());
app.use(express.json());

const conn = await db.connect();

await conn.run(`
  CREATE TABLE IF NOT EXISTS movies (
    id INT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    genre VARCHAR(100)
  );

  CREATE TABLE IF NOT EXISTS  user_movie_status (
    id INT PRIMARY KEY,
    watched BOOLEAN,
    rating INT,

    FOREIGN KEY (id)
      REFERENCES movies(id)
  );
`);

console.log("Table ready");

app.get("/", (req, res) => {
  res.send("Backend running");
});

app.use("/movies", moviesRoutes);

app.listen(8004, () => {
  console.log("Server running on port 8004...");
});
