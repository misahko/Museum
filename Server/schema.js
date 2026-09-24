import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb, integer } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
});

export const museumsTable = pgTable("museums", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  rooms: jsonb("rooms").default([]),
  roomCount: integer("room_count").default(0),
  published: boolean("published").default(false),
  tags: jsonb("tags").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(), 
});