import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { cors } from "@elysiajs/cors";
import bcrypt from "bcryptjs";
import { eq, and, or } from "drizzle-orm";
import { dbConnection } from "./db";
import { usersTable, museumsTable } from "./schema";
import { RepeatWrapping } from "three";

const db = {
  getUserByEmail: async (email) => {
    const result = await dbConnection
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()));
    return result[0] || null;
  },
  getUserById: async (userId) => {
    const result = await dbConnection
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    return result[0] || null;
  },
  createNewUser: async (user) => {
    const result = await dbConnection
      .insert(usersTable)
      .values(user)
      .returning();
    return result[0] || null;
  },
  renameUser: async (userId, newName) => {
    const result = await dbConnection
      .update(usersTable)
      .set({ name: newName })
      .where(eq(usersTable.id, userId))
      .returning();
    return result[0] || null;
  },
  changeUserPassword: async (userId, newPassword) => {
    const result = await dbConnection
      .update(usersTable)
      .set({ passwordHash: newPassword })
      .where(eq(usersTable.id, userId))
      .returning();
    return result[0] || null;
  },

  removeUser: async (userId) => {
    const result = await dbConnection
      .delete(usersTable)
      .where(eq(usersTable.id, userId))
      .returning({ deletedId: usersTable.id });
    return result.length > 0;
  },

  getUserMuseums: async (userId) => {
    const result = await dbConnection
      .select()
      .from(museumsTable)
      .where(eq(museumsTable.userId, userId));
    return result;
  },
  getGallery: async () => {
    const result = await dbConnection
      .select()
      .from(museumsTable)
      .where(eq(museumsTable.published, true));

    return result;
  },
  getMuseumById: async (id) => {
    const result = await dbConnection
      .select()
      .from(museumsTable)
      .where(eq(museumsTable.id, id));
    return result[0] || null;
  },
  createMuseum: async (userId, museum) => {
    const result = await dbConnection
      .insert(museumsTable)
      .values(museum)
      .returning();
    return result[0] || null;
  },
  removeMuseum: async (userId, museumId) => {
    const result = await dbConnection
      .delete(museumsTable)
      .where(
        and(eq(museumsTable.userId, userId), eq(museumsTable.id, museumId)),
      )
      .returning({ deletedId: museumsTable.id });
    return result.length > 0;
  },
  updateMuseum: async (userId, museumId, name) => {
    const result = await dbConnection
      .update(museumsTable)
      .set({ name: name })
      .where(
        and(eq(museumsTable.userId, userId), eq(museumsTable.id, museumId)),
      )
      .returning();
    return result[0] || null;
  },
  setMuseumPublished: async (userId, museumId, value) => {
    const result = await dbConnection
      .update(museumsTable)
      .set({ published: value })
      .where(
        and(eq(museumsTable.userId, userId), eq(museumsTable.id, museumId)),
      )
      .returning();
    return result[0] || null;
  },
};

const app = new Elysia()
  .use(cors())
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET ?? "dev-secret-change-me",
      exp: "7d",
    }),
  )
  .onError(({ code, error, set }) => {
    if (code === "VALIDATION") {
      console.log("Помилка валідації body/params:", error.all);
    } else {
      // ДОДАЙТЕ ЦЕ, щоб бачити, чому падає сервер
      console.error(`Помилка [${code}]:`, error);
    }
  })
  .get(
    "/museums",
    async ({ query }) => {
      const isPublished = query.published === "true";

      const page = parseInt(query.page ?? "1");
      const limit = parseInt(query.limit ?? "20");

      const searchQuery = query.search?.toLowerCase() || "";

      const sort = query.sort || "newest";
      const tagsQuery = query.tags || "";

      let allMuseums = await db.getGallery();
      if (isPublished) {
        allMuseums = allMuseums.filter((m) => m.published === true);
      }

      if (searchQuery) {
        allMuseums = allMuseums.filter((m) =>
          m.name?.toLowerCase().includes(searchQuery),
        );
      }

      if (tagsQuery) {
        const selectedTags = tagsQuery.split(",");
        allMuseums = allMuseums.filter((m) =>
          selectedTags.some((tag) => (m.tags ?? []).includes(tag)),
        );
      }

      allMuseums.sort((a, b) => {
        if (sort === "oldest")
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        if (sort === "popular") return (b.visits ?? 0) - (a.visits ?? 0);
        if (sort === "az") return a.name.localeCompare(b.name);

        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });

      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;

      const paginatedMuseums = allMuseums.slice(startIndex, endIndex);

      // 4. Повертаємо порцію ТА загальну кількість (щоб фронтенд знав, скільки всього сторінок)
      return {
        total: allMuseums.length,
        totalPages: Math.ceil(allMuseums.length / limit),
        currentPage: page,
        data: paginatedMuseums, // Тут буде лише 20 музеїв
      };
    },
    {
      query: t.Object({
        published: t.Optional(t.String()),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        search: t.Optional(t.String()),
        tags: t.Optional(t.String()),
        sort: t.Optional(t.String()),
      }),
    },
  )

  .get(
    "/museums/:id",
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
      const user = await db.getUserByEmail(body.email);

      if (!user) {
        set.status = 401;
        return { error: "Невірна почта або пароль1" };
      }

      const valid = await bcrypt.compare(body.password, user.passwordHash);
      //const valid = true;
      if (!valid) {
        set.status = 401;
        return { error: "Невірна почта або пароль2" };
      }

      //console.log(user);

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
      const existing = await db.getUserByEmail(body.email);
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

      await db.createNewUser(user);

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

        const user = await db.getUserById(payload.sub);

        if (!user) {
          set.status = 401;
          throw new Error("Користувача не знайдено");
        }

        //console.log("токен пройдений");

        return { userId: payload.sub };
      })
      .patch(
        "/users/me",
        async ({ body, set, userId }) => {
          const user = await db.getUserById(userId);

          if (!user) {
            set.status = 401;
            return { error: "Користувача не знайдено" };
          }

          const newUser = await db.renameUser(userId, body.name);

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

      .delete(
        "/users/me",
        async ({ body, set, userId }) => {
          const user = await db.getUserById(userId);

          if (!user) {
            set.status = 401;
            return { error: "Користувача не знайдено" };
          }

          const valid = await bcrypt.compare(body.password, user.passwordHash);

          if (!valid) {
            set.status = 404;
            return { error: "Неправильний пароль" };
          }

          await db.removeUser(userId);

          return {
            message: "Користувача видалено",
          };
        },
        {
          body: t.Object({ password: t.String() }),
        },
      )

      .post(
        "/users/change-password",
        async ({ body, set, userId }) => {
          const user = await db.getUserById(userId);

          if (!user) {
            set.status = 401;
            return { error: "Користувача не знайдено" };
          }

          const valid = await bcrypt.compare(body.password, user.passwordHash);

          if (!valid) {
            set.status = 404;
            return { error: "Неправильний пароль" };
          }

          const passwordHash = await bcrypt.hash(body.newPassword, 10);

          await db.changeUserPassword(userId, passwordHash);
          return { message: "Пароль успішно змінено" };
        },
        {
          body: t.Object({
            password: t.String(),
            newPassword: t.String({ minLength: 6 }),
          }),
        },
      )

      .get(
        "/users/museums",
        async ({ userId, query }) => {
          const searchQuery = query.search?.toLowerCase() || "";

          let museums = (await db.getUserMuseums(userId)) ?? [];
          if (searchQuery) {
            museums = museums.filter((m) =>
              m.name?.toLowerCase().includes(searchQuery),
            );
          }
          return museums;
        },
        {
          query: t.Object({ search: t.Optional(t.String()) }),
        },
      )

      .post(
        "/users/museums",
        async ({ body, set, userId }) => {
          const { name, rooms, roomCount, tags } = body;

          const newMuseum = {
            id: crypto.randomUUID(),
            userId: userId,
            name,
            rooms,
            roomCount: roomCount ?? rooms.length,
            tags: tags ?? [],
            published: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await db.createMuseum(userId, newMuseum);

          set.status = 201;

          return newMuseum;
        },
        {
          body: t.Object({
            name: t.String(),
            rooms: t.Array(t.Any()),
            roomCount: t.Optional(t.Number()),
            tags: t.Optional(t.Array(t.String())),
          }),
        },
      )

      .patch(
        "/museums/:museumId",
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

          if (museum.userId !== userId) {
            set.status = 403;
            return { error: "У вас немає прав для видалення цього музею" };
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
        "/museums/:museumId",
        async ({ params, set, userId }) => {
          const { museumId } = params;

          const museum = await db.getMuseumById(museumId);

          if (!museum) {
            set.status = 404;
            throw new Error("Музей не знайдено");
          }

          if (museum.userId !== userId) {
            set.status = 403;
            return { error: "У вас немає прав для видалення цього музею" };
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
      }),
  )
  .listen(3000);
console.log("Сервер на http://localhost:3000");
