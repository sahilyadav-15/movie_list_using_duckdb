import type { DuckOrm } from "./query.js";
import { moviesTable, userMovieStatusTable } from "./schema.js";

const seedMovies = [
  [1, "Inception", "Sci-Fi", "A thief enters dreams to steal secrets."],
  [2, "The Dark Knight", "Action", "Batman faces the Joker."],
  [3, "Interstellar", "Sci-Fi", "Explorers travel through a wormhole."],
  [4, "Parasite", "Thriller", "A poor family infiltrates a wealthy household."],
  [5, "The Shawshank Redemption", "Drama", "A banker survives prison life."],
  [6, "Avengers: Endgame", "Action", "Heroes battle Thanos one last time."],
  [7, "Whiplash", "Drama", "A drummer pushes himself to greatness."],
  [8, "The Matrix", "Sci-Fi", "A hacker discovers reality is a simulation."],
  [9, "Forrest Gump", "Drama", "A simple man experiences historic events."],
  [10, "The Godfather", "Crime", "The rise of a powerful mafia family."],
] as const;

const seedStatuses = [
  [1, true, 9, "Mind bending and visually stunning."],
  [2, true, 10, "One of the best superhero movies ever."],
  [3, true, 9, "Amazing science and emotional story."],
  [4, true, 8, "Great social commentary and suspense."],
  [5, true, 10, "A timeless masterpiece."],
  [6, true, 8, "Epic finale to the Infinity Saga."],
  [7, true, 9, "Intense and inspiring."],
  [8, true, 9, "Changed the sci-fi genre forever."],
  [9, false, null, null],
  [10, false, null, null],
] as const;

export async function migrate(orm: DuckOrm) {
  await orm.migrate([
    {
      name: "001_create_movie_tables",
      async up(trx) {
        await trx.createTable(moviesTable);
        await trx.createTable(userMovieStatusTable);
      },
    },
    {
      name: "001b_add_missing_movie_columns",
      async up(trx) {
        await trx.run("ALTER TABLE movies ADD COLUMN IF NOT EXISTS description VARCHAR");
        await trx.run("ALTER TABLE user_movie_status ADD COLUMN IF NOT EXISTS review VARCHAR");
      },
    },
    {
      name: "002_seed_movies",
      async up(trx) {
        const existingMovies = await trx.from(moviesTable).count();
        if (existingMovies > 0) return;

        for (const [id, name, genre, description] of seedMovies) {
          await trx.insert(moviesTable, { id, name, genre, description });
        }
        for (const [id, watched, rating, review] of seedStatuses) {
          await trx.insert(userMovieStatusTable, { id, watched, rating, review });
        }
      },
    },
    {
      name: "002b_fill_missing_seed_movies",
      async up(trx) {
        for (const [id, name, genre, description] of seedMovies) {
          const existing = await trx.from(moviesTable).where("id", "=", id).first();
          if (!existing) {
            await trx.insert(moviesTable, { id, name, genre, description });
          }
        }
        for (const [id, watched, rating, review] of seedStatuses) {
          const existing = await trx.from(userMovieStatusTable).where("id", "=", id).first();
          if (!existing) {
            await trx.insert(userMovieStatusTable, { id, watched, rating, review });
          }
        }
      },
    },
    {
      name: "003_seed_dummy_movies",
      async up(trx) {
        const existingDummy = await trx
          .from(moviesTable)
          .whereBetween("id", 1001, 2000)
          .count();
        if (existingDummy >= 1000) return;

        const genres = ["Action", "Comedy", "Drama", "Sci-Fi", "Thriller", "Documentary"];
        for (let index = 1; index <= 1000; index += 1) {
          const id = 1000 + index;
          const genre = genres[index % genres.length];
          await trx.insert(moviesTable, {
            id,
            name: `Dummy Movie ${index}`,
            genre,
            description: `Generated ${genre.toLowerCase()} movie used for testing large DuckDB result sets.`,
          });
          await trx.insert(userMovieStatusTable, {
            id,
            watched: index % 3 !== 0,
            rating: index % 3 === 0 ? null : (index % 10) + 1,
            review: index % 4 === 0 ? `Review note for dummy movie ${index}.` : null,
          });
        }
      },
    },
  ]);
}
