import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { cors } from "@elysiajs/cors";
import bcrypt from "bcryptjs";

const db = {};

const app = new Elysia()
  .use(cors())
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SEVRET ?? "dev-secret-change-me",
      exp: "7d",
    }),
  )
  .guard({}, (app) =>
    app
      .derive(async ({ jwt, headers, set }) => {
        const auth = headers.authorization;

        const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token) {
          set.status = 401;
          throw new Error("Немає токена");
        }

        const payload = await jwt.verify(token);
        if (!payload) {
          set.status = 401;
          throw new Error("Невірний токен");
        }

        console.log("токен пройдений");

        return { userId: payload.sub, role: payload.role };
      })

      .get("/secured", ({ some }) => {
        return some;
      }),
  )
  .listen(3000);
console.log("Сервер на http://localhost:3000");
