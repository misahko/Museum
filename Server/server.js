import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { cors } from "@elysiajs/cors";
import bcrypt from "bcryptjs";

const users = [];
const museums = Array.from({ length: 1000 }).map((_, index) => {
  const isPublished = index % 5 !== 0; // 80% будуть опубліковані, 20% - ні
  const themes = [
    "AI",
    "Biology",
    "Physics",
    "History",
    "Art",
    "Computer Science",
    "Mathematics",
    "Chemistry",
    "Other",
  ];

  return {
    id: crypto.randomUUID(),
    userId: "seed-user-id", // Прив'язуємо до фейкового юзера, щоб ніхто випадково не видалив
    name: `Музей ${themes[index % themes.length]} №${index + 1}`,
    rooms: [{}, {}, {}], // 3 порожні кімнати для заглушки
    roomCount: 3,
    tags: ["тест", "автогенерація", themes[index % themes.length]],
    published: isPublished,
    createdAt: new Date(Date.now() - Math.random() * 10000000000).toISOString(), // Випадкова дата в минулому
    updatedAt: new Date().toISOString(),
    versions: [],
  };
});

const db = {
  getUserByEmail: (email) => {
    return users.find(
      (user) => user.email.toLocaleLowerCase() === email.toLocaleLowerCase(),
    );
  },
  getUserById: (userId) => {
    return users.find((user) => user.id === userId);
  },
  createNewUser: (user) => {
    users.push(user);
  },
  renameUser: (userId, newName) => {
    const user = db.getUserById(userId);
    user.name = newName;
    return user;
  },
  changeUserPassword: (userId, newPassword) => {
    const user = db.getUserById(userId);
    user.passwordHash = newPassword;
  },

  removeUser: (userId) => {
    const index = users.findIndex((u) => u.id === userId);
    if (index !== -1) {
      users.splice(index, 1); // Видаляємо користувача з масиву
      return true;
    }
    return false;
  },

  getUserMuseums: (userId) => {
    return museums.filter((m) => m.userId === userId);
  },
  getGallery: () => {
    return museums;
  },
  getMuseumById: (id) => {
    return museums.find((m) => m.id === id) ?? null;
  },
  createMuseum: (userId, museum) => {
    const museumWithOwner = { ...museum, userId };
    museums.push(museumWithOwner);
    return museumWithOwner;
  },
  removeMuseum: (userId, museumId) => {
    const index = museums.findIndex(
      (m) => m.id === museumId && m.userId === userId,
    );
    if (index !== -1) {
      museums.splice(index, 1);
      return true;
    }
    return false;
  },
  updateMuseum: (userId, museumId, name) => {
    const museum = museums.find(
      (m) => m.id === museumId && m.userId === userId,
    );
    if (museum) {
      museum.name = name;
      museum.updatedAt = new Date().toISOString();
    }
    return museum;
  },
  setMuseumPublished: (userId, museumId, value) => {
    const museum = museums.find(
      (m) => m.id === museumId && m.userId === userId,
    );
    if (museum) {
      museum.published = value;
      museum.updatedAt = new Date().toISOString();
    }
    return museum;
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

      let allMuseums = db.getGallery();
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
      const user = db.getUserByEmail(body.email);

      if (!user) {
        set.status = 401;
        return { error: "Невірна почта або пароль1" };
      }

      const valid = await bcrypt.compare(body.password, user.passwordHash);

      if (!valid) {
        set.status = 401;
        return { error: "Невірна почта або пароль2" };
      }

      console.log(user);

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
      const existing = db.getUserByEmail(body.email);
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

      db.createNewUser(user);

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

        const user = db.getUserById(payload.sub);

        if (!user) {
          set.status = 401;
          throw new Error("Користувача не знайдено");
        }

        console.log("токен пройдений");

        return { userId: payload.sub };
      })
      .patch(
        "/users/me",
        async ({ body, set, userId }) => {
          const user = db.getUserById(userId);

          if (!user) {
            set.status = 401;
            return { error: "Користувача не знайдено" };
          }

          const newUser = db.renameUser(userId, body.name);

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
          const user = db.getUserById(userId);

          if (!user) {
            set.status = 401;
            return { error: "Користувача не знайдено" };
          }

          const valid = await bcrypt.compare(body.password, user.passwordHash);

          if (!valid) {
            set.status = 404;
            return { error: "Неправильний пароль" };
          }

          db.removeUser(userId);

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
          const user = db.getUserById(userId);

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

          db.changeUserPassword(userId, passwordHash);
          return { message: "Пароль успішно змінено" };
        },
        {
          body: t.Object({
            password: t.String(),
            newPassword: t.String({ minLength: 6 }),
          }),
        },
      )

      .get("/users/museums", async ({ userId }) => {
        const museums = db.getUserMuseums(userId) ?? [];
        return museums;
      })

      .post(
        "/users/museums",
        async ({ body, set, userId }) => {
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
