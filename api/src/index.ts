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
    name VARCHAR NOT NULL,
    genre VARCHAR,
    description VARCHAR
  );

  CREATE TABLE IF NOT EXISTS user_movie_status (
    id INT PRIMARY KEY,
    watched BOOLEAN,
    rating INT,
    review VARCHAR,
    FOREIGN KEY (id) REFERENCES movies(id)
  );
`);

async function seedMovies() {
  await conn.run(`
    INSERT INTO movies VALUES
      (1, 'Inception', 'Sci-Fi', 'A thief enters dreams to steal secrets.'),
      (2, 'The Dark Knight', 'Action', 'Batman faces the Joker.'),
      (3, 'Interstellar', 'Sci-Fi', 'Explorers travel through a wormhole.'),
      (4, 'Parasite', 'Thriller', 'A poor family infiltrates a wealthy household.'),
      (5, 'The Shawshank Redemption', 'Drama', 'A banker survives prison life.'),
      (6, 'Avengers: Endgame', 'Action', 'Heroes battle Thanos one last time.'),
      (7, 'Whiplash', 'Drama', 'A drummer pushes himself to greatness.'),
      (8, 'The Matrix', 'Sci-Fi', 'A hacker discovers reality is a simulation.'),
      (9, 'Forrest Gump', 'Drama', 'A simple man experiences historic events.'),
      (10, 'The Godfather', 'Crime', 'The rise of a powerful mafia family.');

    INSERT INTO user_movie_status VALUES
      (1, TRUE, 9, 'Mind bending and visually stunning.'),
      (2, TRUE, 10, 'One of the best superhero movies ever.'),
      (3, TRUE, 9, 'Amazing science and emotional story.'),
      (4, TRUE, 8, 'Great social commentary and suspense.'),
      (5, TRUE, 10, 'A timeless masterpiece.'),
      (6, TRUE, 8, 'Epic finale to the Infinity Saga.'),
      (7, TRUE, 9, 'Intense and inspiring.'),
      (8, TRUE, 9, 'Changed the sci-fi genre forever.'),
      (9, FALSE, NULL, NULL),
      (10, FALSE, NULL, NULL);
  `);
}

console.log("Table ready");

app.get("/", (req, res) => {
  res.send("Backend running");
});

app.use("/movies", moviesRoutes);

app.listen(8004, () => {
  console.log("Server running on port 8004...");
});
