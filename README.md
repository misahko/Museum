# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
# Museum

3D museum app built with React, Vite, and React Three Fiber.

## Запуск

**Вимоги:** [Bun](https://bun.sh) (або Node.js + npm)

### Встановлення залежностей

```bash
bun install
```

### Режим розробки

Запускає dev-сервер з HMR (автооновлення):

```bash
bun run dev
```

Відкрий у браузері: `http://localhost:5173`

### Продакшн-збірка

```bash
bun run build
```

### Перегляд продакшн-збірки локально

```bash
bun run preview
```

### Лінтинг

```bash
bun run lint
```

## Налаштування LLM

Додаток використовує локальну мовну модель через [Ollama](https://ollama.com). Для роботи функції генерації музею з PDF потрібно запустити два сервери — Ollama і Python-бекенд.

### 1. Встановити Ollama

Завантаж і встанови з [ollama.com](https://ollama.com), потім завантаж модель:

```bash
ollama pull llama3
```

Запусти Ollama (якщо не запускається автоматично):

```bash
ollama serve
```

Ollama слухає на `http://localhost:11434`.

### 2. Встановити Python-залежності

```bash
cd LLMSorting
pip install -r requirements.txt
```

### 3. Запустити Python-сервер

```bash
cd LLMSorting
python server.py
```

Сервер запуститься на `http://localhost:8765`.

### 4. Запустити все одночасно

```bash
bun run start
```

Ця команда запускає Vite і Python-сервер одночасно (`concurrently`). Альтернативно можна запустити їх окремо:

```bash
bun run dev          # тільки Vite
python3 LLMSorting/server.py  # тільки LLM-сервер
```

Vite автоматично проксує `/api/llm/*` на порт `8765`, тому нічого додатково налаштовувати не потрібно.

### Щоб змінити модель

Відкрий `LLMSorting/Tools/llm.py` і зміни константу:

```python
MODEL = "llama3"  # замінити на будь-яку модель з `ollama list`
```
