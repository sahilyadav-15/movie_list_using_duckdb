import { table, type TableSchema } from "./query.js";

export type MovieRow = {
  id: number;
  name: string;
  genre: string | null;
  description: string | null;
};

export type UserMovieStatusRow = {
  id: number;
  watched: boolean | null;
  rating: number | null;
  review: string | null;
};

export const moviesTable: TableSchema<MovieRow> = table(
  "movies",
  {
    id: { type: "INTEGER", primary: true },
    name: { type: "VARCHAR" },
    genre: { type: "VARCHAR", nullable: true },
    description: { type: "VARCHAR", nullable: true },
  },
  { primaryKey: "id" }
);

export const userMovieStatusTable: TableSchema<UserMovieStatusRow> = table(
  "user_movie_status",
  {
    id: {
      type: "INTEGER",
      primary: true,
      references: { table: "movies", column: "id" },
    },
    watched: { type: "BOOLEAN", nullable: true },
    rating: { type: "INTEGER", nullable: true },
    review: { type: "VARCHAR", nullable: true },
  },
  { primaryKey: "id" }
);
