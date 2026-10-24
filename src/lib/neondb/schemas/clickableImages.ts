
import { pgTable, uuid, text, jsonb, integer } from "drizzle-orm/pg-core";

export const clickableImages = pgTable("board_images", {
  id: uuid("id").primaryKey().defaultRandom(),

  title: text("title").notNull().unique(),

  coverImage: text("cover_image").notNull(),
  publicId: text("public_id").notNull().unique(),

  width: integer("width").notNull().default(320),

  position: jsonb("position")
    .$type<{ x: number; y: number }>()
    .notNull(),

  keywords: text("keywords").array().notNull().default([]),

  link: text("link"),
});

export type ClickableImage = typeof clickableImages.$inferSelect;
export type NewClickableImage = typeof clickableImages.$inferInsert;
