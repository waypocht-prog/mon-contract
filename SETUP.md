# Настройка бэкенда (Supabase + вход через Google + деплой на Vercel)

Пошагово. Всё бесплатно. Занимает ~30–40 минут в первый раз.

> Важно: **без этой настройки** приложение всё равно работает — но локально (данные только в телефоне). Настройка ниже включает вход и облако.

---

## Шаг 1. Supabase (база данных)

1. Зайти на **supabase.com** → Sign in (через GitHub удобно) → **New project**.
2. Название любое, регион — ближе к Европе (**West EU / Frankfurt**). Придумать пароль базы — **сохранить его**.
3. Дождаться создания проекта (1–2 минуты).
4. Слева **SQL Editor** → New query → вставить всё содержимое файла **`supabase/schema.sql`** → **Run**. Должно написать «Success».
5. Слева **Project Settings → API** → скопировать и сохранить два значения:
   - **Project URL** (вида `https://xxxxx.supabase.co`)
   - **anon public** ключ (длинная строка).

---

## Шаг 2. Google-вход (самая кропотливая часть)

### 2а. Google Cloud
1. Зайти на **console.cloud.google.com** → создать проект (кнопка вверху) → любое имя.
2. Слева **APIs & Services → OAuth consent screen**:
   - тип **External** → Create;
   - App name: «Мой договор», укажи свой email в support и developer contact → Save and continue до конца;
   - если попросит **Test users** — добавь email'ы всех, кто будет пользоваться (пока приложение не «опубликовано»). Или позже нажми **Publish app**.
3. Слева **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**;
   - **Authorized JavaScript origins** — добавить:
     - `http://localhost:5173`
     - (позже) адрес с Vercel, например `https://moy-dogovor.vercel.app`
   - **Authorized redirect URIs** — добавить адрес Supabase:
     - `https://ВАШ-ПРОЕКТ.supabase.co/auth/v1/callback`
   - Create → скопировать **Client ID** и **Client Secret**.

### 2б. Включить Google в Supabase
1. Supabase → **Authentication → Providers → Google** → включить;
2. вставить **Client ID** и **Client Secret** → Save.
3. Supabase → **Authentication → URL Configuration**:
   - **Site URL** — пока `http://localhost:5173` (позже поменяешь на адрес Vercel);
   - **Redirect URLs** — добавить `http://localhost:5173` и (позже) адрес Vercel.

---

## Шаг 3. Локальный запуск и проверка

```bash
cd mon-contrat
cp .env.example .env       # создать файл .env
# открыть .env и вставить VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY из Шага 1.5
npm install
npm run dev
```
Открыть http://localhost:5173 → должен появиться экран входа с кнопкой **«Войти через Google»**. Войти → появится приложение с твоим именем из Google. Сделай тестовое дело → оно уйдёт в Supabase (проверь: Supabase → Table Editor → таблица `kv`).

---

## Шаг 4. Деплой через GitHub → Vercel

1. Создать репозиторий на **github.com** и запушить папку `mon-contrat` (файл `.env` НЕ попадёт — он в `.gitignore`, это правильно).
2. Зайти на **vercel.com** → Sign in через GitHub → **Add New → Project** → выбрать репозиторий.
3. Vercel сам определит **Vite**. В разделе **Environment Variables** добавить те же два:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. **Deploy** → получить адрес вида `https://moy-dogovor.vercel.app`.
5. **Дописать этот адрес в трёх местах** (иначе Google-вход не сработает на боевом сайте):
   - Google Cloud → Credentials → твой OAuth client → **Authorized JavaScript origins** → добавить адрес Vercel;
   - Supabase → Authentication → **URL Configuration → Site URL** = адрес Vercel; в **Redirect URLs** добавить его же;
6. Открыть адрес Vercel на телефоне → войти через Google → добавить на экран «Домой».

Готово. Теперь у каждого свои данные в облаке, вход по Google, доступ с любого телефона.

---

## Частые ошибки
- **«redirect_uri_mismatch»** при входе → в Google Cloud не добавлен `https://ВАШ-ПРОЕКТ.supabase.co/auth/v1/callback` в Redirect URIs.
- **Вход проходит, но возвращает не на сайт** → в Supabase → URL Configuration не указан Site URL / Redirect URL с адресом сайта.
- **Кнопки входа нет, сразу приложение** → не заданы переменные `VITE_SUPABASE_*` (тогда включается локальный режим — это нормально для теста без бэкенда).
