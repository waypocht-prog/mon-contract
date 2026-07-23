# Исправление Google-входа (OAuth callback)

## Симптом

Локально вход через Google работал, а на production `https://mon-contract.vercel.app`
после выбора Google-аккаунта страница просто «перезагружалась» и снова показывала
экран входа. Сессия не создавалась.

## Причина

Приложение было рассчитано только на **старый implicit-callback** Supabase:

```
#access_token=...&refresh_token=...
```

Но production-поток возвращает **современный PKCE-callback**:

```
?code=...
```

Этот `code` нужно обменять на сессию вызовом
`supabase.auth.exchangeCodeForSession(code)`. Поскольку `detectSessionInUrl` был
выключен (callback мы обрабатываем сами), а обмена `code` в коде не было, сессия не
создавалась — и приложение снова показывало вход. Внешне это выглядело как обычная
перезагрузка страницы. Дополнительно, ошибки OAuth (`#error=...`, `?error=...`)
могли теряться из-за раннего выхода из функции.

## Что изменено

- **OAuth переведён на PKCE** — `flowType: "pkce"` в `src/core/supabase.js`
  (при этом `detectSessionInUrl: false` — callback обрабатываем вручную и детерминированно).
- **Добавлен обмен кода** — `exchangeCodeForSession(code)` для PKCE-callback `?code=...`.
- **Сохранена поддержка старого implicit-callback** — `#access_token=...&refresh_token=...`
  через `setSession(...)`.
- **Ошибки OAuth читаются первыми** — и из query, и из hash (`error_description` / `error`),
  до проверки `code`/токенов. Их текст показывается **прямо под кнопкой «Войти через Google»**
  (блок `#auth-error`), а не молча теряется.
- **URL очищается** от всех OAuth-параметров после обработки (и при успехе, и при ошибке),
  обычные query-параметры приложения сохраняются.
- **Убраны таймер и гонка авторизации** — вместо `setTimeout(…, 4000)` и зависимости от
  `INITIAL_SESSION` теперь строгая последовательность: callback → сохранённая сессия →
  экран входа + подписка только на будущие изменения. `afterLogin()` вызывается один раз.
- Единый вход в поток — кнопка вызывает `beginGoogleSignIn()` (блокирует кнопку, прячет
  прошлую ошибку, при сбое показывает её и снова включает кнопку).

### Затронутые файлы
- `src/core/supabase.js` — `flowType: "pkce"`.
- `src/core/auth.js` — `consumeAuthCallback()` (PKCE + implicit + ошибки), `getUser` не глотает
  ошибку, `signInGoogle` с корректным `redirectTo`, `signOut` не глотает ошибку,
  `onAuth` возвращает функцию отписки.
- `src/app.js` — `authMessage()`, `showLogin(error)`, `beginGoogleSignIn()`, новый `boot()`.
- `index.html` — кнопка `#google-login-btn` → `beginGoogleSignIn()`, блок `#auth-error`.
- `src/styles/components.css` — стили `.auth-error` и `.gbtn:disabled`.

## Обязательные production-настройки

### Supabase → Authentication → URL Configuration

**Site URL:**
```
https://mon-contract.vercel.app
```

**Redirect URLs:**
```
https://mon-contract.vercel.app/**
http://localhost:5173/**
```

Для preview-деплоев Vercel можно дополнительно добавить шаблон:
```
https://*-<твой-vercel-account>.vercel.app/**
```

### Google Cloud → OAuth Client

**Authorized JavaScript origins:**
```
https://mon-contract.vercel.app
http://localhost:5173
```

**Authorized redirect URIs:**
```
https://iwokltqzjjkfaiarkwzs.supabase.co/auth/v1/callback
```

> Важно: в Google **Authorized redirect URIs** указывается **callback Supabase**
> (`https://<project>.supabase.co/auth/v1/callback`), **а не адрес Vercel**. Google всегда
> возвращает пользователя на Supabase, а Supabase — уже на ваш сайт (по Redirect URLs выше).

### Vercel → Environment Variables

Должны быть заданы (значения — из Supabase, в ответе/логах не выводятся):
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

> Секреты (`service_role` / `sb_secret`) в клиентском коде не используются и в `.env`
> для фронтенда не кладутся. Публикуется только anon/publishable-ключ, защищённый RLS.

## Почему важен один и тот же origin

PKCE `code_verifier` хранится в `localStorage` **конкретного origin**. Поэтому вход должен
начинаться и завершаться строго на одном адресе (origin + pathname). `signInGoogle()`
формирует `redirectTo` из текущего адреса (без query и hash) — не хардкодит ни localhost,
ни production. Если после входа Google/Supabase вернут на **другой** домен (например,
preview-URL, которого нет в Redirect URLs), обмен `code` не найдёт verifier — под кнопкой
появится подсказка проверить Redirect URLs.
