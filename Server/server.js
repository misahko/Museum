import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { cors } from "@elysiajs/cors";
import bcrypt from "bcryptjs";

const users = [];

const db = {
  findByEmail: (email) => {
    return users.find(
      (user) => user.email.toLocaleLowerCase() === email.toLocaleLowerCase(),
    );
  },
  findById: (userId) => {
    return users.find((user) => user.id === userId);
  },
  addNewUser: (user) => {
    users.push(user);
  },
  rename: (userId, newName) => {
    const user = db.findById(userId);
    user.name = newName;
    return user;
  },
  changePassword: (userId, newPassword) => {
    const user = db.findById(userId);
    user.passwordHash = newPassword;
  },

  getUserMuseums: (userId) => {
    return [];
  },

  getGallery: () => {
    return [];
  },

  getMuseumById: (id) => {
    return null;
  },

  createMuseum: (userId, museum) => {},

  removeMuseum: (userId, museumId) => {},

  updateMuseum: (userId, museumId, name) => {},

  setMuseumPublished: (userId, museumId, value) => {},
};

const app = new Elysia()
  .use(cors())
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET ?? "dev-secret-change-me",
      exp: "7d",
    }))
    .get(
        "/api/museums",
        async ({ query }) => {
          const isPublished = query.published === "true";
          const allMuseums = await db.getGallery();
          if (isPublished) {
            return allMuseums.filter((m) => m.published === true);
          }
          return allMuseums;
        },
        {
          query: t.Object({ published: t.Optional(t.String) }),
        },
      )

      .get(
        "/api/museums/:id",
        async ({ params, set }) => {
          const { id } = params;

          const museum = await db.getMuseumById(id);

          if (!museum) {
            set.status = 404;
            throw new Error("Музей не знайдено");
          }

          return museum;
        },
        {
          params: t.Object({ id: t.String() }),
        },
      )
      .post(
        "/auth/login",
        async ({ body, set, jwt }) => {
          const user = db.findByEmail(body.email);

          if (!user) {
            set.status = 401;
            return { error: "Невірна почта або пароль1" };
          }

          const valid = await bcrypt.compare(body.password, user.passwordHash);

          if (!valid) {
            set.status = 401;
            return { error: "Невірна почта або пароль2" };
          }

          const token = await jwt.sign({ sub: user.id });

          return {
            token,
            user: { id: user.id, name: user.name, email: user.email },
          };
        },
        {
          body: t.Object({ email: t.String(), password: t.String() }),
        },
      )
      .post(
        "/auth/register",
        async ({ body, set, jwt }) => {
          const existing = db.findByEmail(body.email);
          if (existing) {
            set.status = 409;
            return { error: "Почта вже зайнята" };
          }

          const passwordHash = await bcrypt.hash(body.password, 10);

          const user = {
            id: crypto.randomUUID(),
            name: body.name,
            passwordHash: passwordHash,
            email: body.email,
          };

          db.addNewUser(user);

          const token = await jwt.sign({ sub: user.id });

          return {
            token,
            user: { id: user.id, name: user.name, email: user.email },
          };
        },
        {
          body: t.Object({
            name: t.String({ minLength: 3 }),
            email: t.String({ format: "email" }),
            password: t.String({ minLength: 6 }),
          }),
        },
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

            return { userId: payload.sub };
          })
          .patch(
            "/users/me",
            async ({ body, set, userId }) => {
              const user = db.findById(userId);

              if (!user) {
                set.status = 404;
                return { error: "Користувача не знайдено" };
              }

              const newUser = db.rename(userId, body.name);

              return {
                message: "Ім'я оновлено",
                user: {
                  id: newUser.id,
                  name: newUser.name,
                  email: newUser.email,
                },
              };
            },
            { body: t.Object({ name: t.String({ minLength: 2 }) }) },
          )

          .post("/users/change-password", async ({ body, set, userId }) => {
            const user = db.findById(userId);

            if (!user) {
              set.status = 404;
              return { error: "Користувача не знайдено" };
            }

            const valid = await bcrypt.compare(
              body.currentPassword,
              user.passwordHash,
            );

            if (!valid) {
              set.status = 401;
              return { error: "Неправильний пароль" };
            }

            const passwordHash = await bcrypt.hash(body.newPassword, 10);

            db.changePassword(userId, passwordHash);
            return { message: "Пароль успішно змінено" };
          },
            {
              body: t.Object({
                currentPassword: t.String(),
                newPassword: t.String({ minLength: 6 })
              })
            }
        )

      .get(
        "/api/users/:userId/museums",
        async ({ params }) => {
          const { userId } = params;
          const museums = db.getUserMuseums(userId) ?? [];
          return museums;
        },
        {
          params: t.Object({ userId: t.String() }),
        },
      )

      .post(
        "/api/users/:userId/museums",
        async ({ params, body, set }) => {
          const { userId } = params;
          
          const { name, rooms, roomCount, tags } = body;

          const newMuseum = {
            id: crypto.randomUUID(),
            name,
            rooms,
            roomCount: roomCount ?? rooms.length,
            tags: tags ?? [],
            published: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            versions: [],
          };

          db.createMuseum(userId, newMuseum);

          set.status = 201;
          
          return newMuseum;
        },
        {
          params: t.Object({ userId: t.String() }),
          body: t.Object({
            name: t.String(),
            rooms: t.Array(t.Any()),
            roomCount: t.Optional(t.Number()),
            tags: t.Optional(t.Array(t.String())),
          }),
        },
      )

      .patch(
        "/api/museums/:museumId",
        async ({ params, body, set, userId }) => { 
          const { museumId } = params;
          const { name, published } = body;

          if (name === undefined && published === undefined) {
            set.status = 400;
            throw new Error("Немає даних для оновлення");
          }

          const museum = await db.getMuseumById(museumId);

          if (!museum) {
            set.status = 404;
            throw new Error("Музей не знайдено");
          }

          if (name !== undefined) {
            await db.updateMuseum(userId, museumId, name); 
          }

          if (published !== undefined) {
            await db.setMuseumPublished(userId, museumId, published);
          }

          return await db.getMuseumById(museumId);
        },
        {
          params: t.Object({ museumId: t.String() }),
          body: t.Object({
            name: t.Optional(t.String()),
            published: t.Optional(t.Boolean()),
          }),
        },
      )

      .delete(
        "/api/museums/:museumId",
        async ({ params, set, userId }) => {
          const { museumId } = params;

          const museum = await db.getMuseumById(museumId);

          if (!museum) {
            set.status = 404;
            throw new Error("Музей не знайдено");
          }

          await db.removeMuseum(userId, museumId);
          return { message: "Музей успішно видалено" };
        },
        {
          params: t.Object({ museumId: t.String() }),
        },
      )

      .get("/secured", ({ some }) => {
        return some;
      })
  )
  .listen(3000);
console.log("Сервер на http://localhost:3000");