import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { cors } from "@elysiajs/cors";
import bcrypt from "bcryptjs";
import { use } from "react";

const db = {

  getUserMuseums: (userId) => {
    return [];
  },

  getGallery: () => {
    return [];
  },

  getMuseumById: (id) => {
    return "{}"
  },

  createMuseum: (userId,{ name, rooms, roomCount, tags }) => {

  },

  removeMuseum: (userId,museumId) => {

  },

  updateMuseum: (userId,museumId,name) => {

  },

  setMuseumPublished: (userId,museumId,value) => {

  }

};

const app = new Elysia()
  .use(cors())
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SEVRET ?? "dev-secret-change-me",
      exp: "7d",
    })
      .get("/api/museums", async ({query}) => {
        const isPublished = query.published === 'true';
        const allMuseums = await getAllMuseumsFromDb();
        if (isPublished) {
          return allMuseums.filter((m) => m.published === true);
        }
        return allMuseums;

      }, {
        query: t.Object({published: t.Optional(t.String)})
      }
  )
      .guard({}, (app) =>
        app.derive(async ({ jwt, headers, set }) => {
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
        }),
      )

      .get("/api/museums/:id", async ({ params, set }) => {
      const { id } = params;

      const museum = await getMuseumById(id);

      if (!museum) {
        set.status = 404;
        throw new Error("Музей не знайдено");
      }

      return museum;
    }, {
      params: t.Object({ id: t.String() })
    })

      .get("/api/users/:userId/museums", async ({params}) => 
      {
        const userId = params;
        const museums = getUserMuseums(userId) ?? [];
        return museums;
      },{
        params: t.Object({userId: t.String()})
      }
      )

      .post("/api/users/:userId/museums", async ({ params, body, set }) => {
      const { userId } = params;
      const newMuseum = {
        id: crypto.randomUUID(),
        name: body.name,
        rooms: body.rooms,
        roomCount: body.roomCount ?? body.rooms.length,
        tags: body.tags ?? [],
        published: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        versions: [],
      };

      createMuseum(userId, {name,rooms,roomCount,tags})

      set.status = 201;
    }, {
      params: t.Object({ userId: t.String() }),
      body: t.Object({
        name: t.String(),
        rooms: t.Array(t.Any()),
        roomCount: t.Optional(t.Number()),
        tags: t.Optional(t.Array(t.String())),
      })
    })

   .patch("/api/museums/:museumId", async ({ params, body, set, user }) => {
      const { museumId } = params;
      const { name, published } = body;
      
      const userId = user.id; 

      if (name === undefined && published === undefined) {
        set.status = 400;
        throw new Error("Немає даних для оновлення");
      }

      const museum = await getMuseumById(museumId);
      
      if (!museum) {
        set.status = 404;
        throw new Error("Музей не знайдено");
      }

      if (name !== undefined) {
        await updateMuseum(userId, museumId, name);
      }

      if (published !== undefined) {
        await setMuseumPublished(userId, museumId, published);
      }
      
    }, {
      params: t.Object({ museumId: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        published: t.Optional(t.Boolean()),
      })
    })

    .delete("/api/museums/:museumId", async ({ params, set, user }) => {
      const { museumId } = params;
      const userId = user.id;

      const museum = await getMuseumById(museumId);
      
      if (!museum) {
        set.status = 404;
        throw new Error("Музей не знайдено");
      }

      await removeMuseum(userId, museumId);

    }, {
      params: t.Object({ museumId: t.String() })
    })

      .get("/secured", ({ some }) => {
        return some;
      }),
  )
  .listen(3000);
console.log("Сервер на http://localhost:3000");