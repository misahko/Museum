import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { cors } from "@elysiajs/cors";
import bcrypt from "bcryptjs";

const db = {
  findByLogin: (login) => users.find((u) => u.login === login),
  findBiId: (userId) => users.find((u) => u.id === userId),
  add: (user) => {
    users.push(user);
    console.log(`created ${user}`);
  },
  getPersonalTests: (userId) => {
    return personalTests;
  },
  getLibraryTests: () => {
    return tests;
  },
  getStudents: (userId) => {
    return [];
  },
};

const app = new Elysia().use(cors()).use(
  jwt({
    name: "jwt",
    secret: process.env.JWT_SEVRET ?? "dev-secret-change-me",
    exp: "7d",
  }).post(),
);
