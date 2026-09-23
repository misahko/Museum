import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { cors } from "@elysiajs/cors";
import bcrypt from "bcryptjs";

let users = [
  {
    id: "user-test-123",
    name: "Personal Tester",
    email: "personal_test@example.com",
    passwordHash: "password123", // або хеш, залежно від того, як ви зберігаєте
  },
];
let museums = [
  {
    id: "m-1",
    userId: "user-test-123",
    name: "Personal Museum #1",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 1,
    tags: ["AI"],
    published: true,
    createdAt: "2026-03-01T10:00:00Z",
  },
  {
    id: "m-2",
    userId: "user-test-123",
    name: "Secret Archive #2",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 2,
    tags: ["Physics"],
    published: false,
    createdAt: "2026-03-02T10:00:00Z",
  },
  {
    id: "m-3",
    userId: "user-test-123",
    name: "Draft Research #3",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 1,
    tags: ["History"],
    published: true,
    createdAt: "2026-03-03T10:00:00Z",
  },
  {
    id: "m-4",
    userId: "user-test-123",
    name: "Study Notebook #4",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 3,
    tags: ["Mathematics"],
    published: false,
    createdAt: "2026-03-04T10:00:00Z",
  },
  {
    id: "m-5",
    userId: "user-test-123",
    name: "Project Museum #5",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 1,
    tags: ["Art"],
    published: true,
    createdAt: "2026-03-05T10:00:00Z",
  },
  {
    id: "m-6",
    userId: "user-test-123",
    name: "Quantum Archive #6",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 2,
    tags: ["Physics", "AI"],
    published: true,
    createdAt: "2026-03-06T10:00:00Z",
  },
  {
    id: "m-7",
    userId: "user-test-123",
    name: "Neural Study #7",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 1,
    tags: ["AI"],
    published: false,
    createdAt: "2026-03-07T10:00:00Z",
  },
  {
    id: "m-8",
    userId: "user-test-123",
    name: "Cyber Vault #8",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 4,
    tags: ["Computer Science"],
    published: true,
    createdAt: "2026-03-08T10:00:00Z",
  },
  {
    id: "m-9",
    userId: "user-test-123",
    name: "Ancient History #9",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 1,
    tags: ["History", "Art"],
    published: false,
    createdAt: "2026-03-09T10:00:00Z",
  },
  {
    id: "m-10",
    userId: "user-test-123",
    name: "Bio Lab #10",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 2,
    tags: ["Biology", "Chemistry"],
    published: true,
    createdAt: "2026-03-10T10:00:00Z",
  },
  {
    id: "m-11",
    userId: "user-test-123",
    name: "Cosmic Dimension #11",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 1,
    tags: ["Physics"],
    published: true,
    createdAt: "2026-03-11T10:00:00Z",
  },
  {
    id: "m-12",
    userId: "user-test-123",
    name: "Synthetic Core #12",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 3,
    tags: ["AI", "Computer Science"],
    published: false,
    createdAt: "2026-03-12T10:00:00Z",
  },
  {
    id: "m-13",
    userId: "user-test-123",
    name: "Nano Nexus #13",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 1,
    tags: ["Chemistry"],
    published: true,
    createdAt: "2026-03-13T10:00:00Z",
  },
  {
    id: "m-14",
    userId: "user-test-123",
    name: "Algebraic Vault #14",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 2,
    tags: ["Mathematics"],
    published: false,
    createdAt: "2026-03-14T10:00:00Z",
  },
  {
    id: "m-15",
    userId: "user-test-123",
    name: "Echo Exhibition #15",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 1,
    tags: ["Art"],
    published: true,
    createdAt: "2026-03-15T10:00:00Z",
  },
  {
    id: "m-16",
    userId: "user-test-123",
    name: "Personal Museum #16",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 1,
    tags: ["Other"],
    published: true,
    createdAt: "2026-03-16T10:00:00Z",
  },
  {
    id: "m-17",
    userId: "user-test-123",
    name: "Secret Archive #17",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 2,
    tags: ["History"],
    published: false,
    createdAt: "2026-03-17T10:00:00Z",
  },
  {
    id: "m-18",
    userId: "user-test-123",
    name: "Draft Research #18",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 1,
    tags: ["AI"],
    published: true,
    createdAt: "2026-03-18T10:00:00Z",
  },
  {
    id: "m-19",
    userId: "user-test-123",
    name: "Study Notebook #19",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 3,
    tags: ["Physics"],
    published: false,
    createdAt: "2026-03-19T10:00:00Z",
  },
  {
    id: "m-20",
    userId: "user-test-123",
    name: "Project Museum #20",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 1,
    tags: ["Computer Science"],
    published: true,
    createdAt: "2026-03-20T10:00:00Z",
  },
  {
    id: "m-21",
    userId: "user-test-123",
    name: "Quantum Archive #21",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 2,
    tags: ["Mathematics"],
    published: true,
    createdAt: "2026-03-21T10:00:00Z",
  },
  {
    id: "m-22",
    userId: "user-test-123",
    name: "Neural Study #22",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 1,
    tags: ["Biology"],
    published: false,
    createdAt: "2026-03-22T10:00:00Z",
  },
  {
    id: "m-23",
    userId: "user-test-123",
    name: "Cyber Vault #23",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 4,
    tags: ["Art"],
    published: true,
    createdAt: "2026-03-23T10:00:00Z",
  },
  {
    id: "m-24",
    userId: "user-test-123",
    name: "Ancient History #24",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 1,
    tags: ["History"],
    published: false,
    createdAt: "2026-03-24T10:00:00Z",
  },
  {
    id: "m-25",
    userId: "user-test-123",
    name: "Bio Lab #25",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 2,
    tags: ["Chemistry"],
    published: true,
    createdAt: "2026-03-25T10:00:00Z",
  },
  {
    id: "m-26",
    userId: "user-test-123",
    name: "Cosmic Dimension #26",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 1,
    tags: ["Physics"],
    published: true,
    createdAt: "2026-03-26T10:00:00Z",
  },
  {
    id: "m-27",
    userId: "user-test-123",
    name: "Synthetic Core #27",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 3,
    tags: ["AI"],
    published: false,
    createdAt: "2026-03-27T10:00:00Z",
  },
  {
    id: "m-28",
    userId: "user-test-123",
    name: "Nano Nexus #28",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 1,
    tags: ["Computer Science"],
    published: true,
    createdAt: "2026-03-28T10:00:00Z",
  },
  {
    id: "m-29",
    userId: "user-test-123",
    name: "Algebraic Vault #29",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 2,
    tags: ["Mathematics"],
    published: false,
    createdAt: "2026-03-29T10:00:00Z",
  },
  {
    id: "m-30",
    userId: "user-test-123",
    name: "Echo Exhibition #30",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 1,
    tags: ["Art"],
    published: true,
    createdAt: "2026-03-30T10:00:00Z",
  },
  {
    id: "m-31",
    userId: "user-test-123",
    name: "Final Frontier #31",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 2,
    tags: ["Physics", "Other"],
    published: true,
    createdAt: "2026-03-31T10:00:00Z",
  },
  {
    id: "m-32",
    userId: "user-test-123",
    name: "Deep Dive #32",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 1,
    tags: ["Biology"],
    published: false,
    createdAt: "2026-04-01T10:00:00Z",
  },
  {
    id: "m-33",
    userId: "user-test-123",
    name: "Logic Gate #33",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 3,
    tags: ["Computer Science"],
    published: true,
    createdAt: "2026-04-02T10:00:00Z",
  },
  {
    id: "m-34",
    userId: "user-test-123",
    name: "Color Theory #34",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 1,
    tags: ["Art"],
    published: false,
    createdAt: "2026-04-03T10:00:00Z",
  },
  {
    id: "m-35",
    userId: "user-test-123",
    name: "Reaction Center #35",
    rooms: [{ id: "r1", name: "Main Room" }],
    roomCount: 2,
    tags: ["Chemistry"],
    published: true,
    createdAt: "2026-04-04T10:00:00Z",
  },
];

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

      //const valid = await bcrypt.compare(body.password, user.passwordHash);
      const valid = true;
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

      .get(
        "/users/museums",
        async ({ userId, query }) => {
          const searchQuery = query.search?.toLowerCase() || "";

          let museums = db.getUserMuseums(userId) ?? [];
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
