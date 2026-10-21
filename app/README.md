# Кабинет дистрибьютора — MVP Demo

Фронтенд без бэкенда: React 18 + TypeScript + Redux Toolkit + RTK Query + Ant Design.
Данные — мок-БД в `localStorage` (`src/mocks`); слой API (`src/app/api.ts`) готов к замене на реальный бэкенд.

## Запуск

Нужен Node 20+. На этой машине portable Node лежит в `../.tools/node`:

```powershell
$env:Path = "C:\Users\103EP\Work\basf\.tools\node;" + $env:Path
npm install
npm run dev        # http://localhost:5173
npm test           # логика, мок-API (доступ, отправка заказа, черновики)
npm run lint       # ESLint (typescript-eslint, react-hooks)
npm run format     # Prettier
npm run build
```

## Демо-доступ

Пароль всех демо-пользователей: `Demo2027`. На экране входа есть плитки «Войти без пароля» для ролей:
клиент (Пётр Иванов), коллега клиента, менеджер, одобряющий менеджер, руководитель региона, администратор.
Письмо-приглашение: ссылка «Открыть письмо-приглашение» на экране входа. Письма не отправляются — ссылка показывается на экране.
Меню пользователя → «Сбросить демо-данные» возвращает исходное состояние. Отключить демо-плитки: `VITE_DEMO=false`.

## Документы

- `DEMO.md` — сценарий показа за 10 минут (роли, шаги, что говорить).
- `../PLAN.md` — план, границы MVP и допущения.
- В приложении: меню пользователя → «Справка» (короткие инструкции для клиента и сотрудника).

## Качество

`npm test` (111+ тестов: правила заказа, доступ и видимость, обмен с 1С, уведомления, меню по правам), `npm run lint`, `npm run build`. Доступность: skip-link, перенос фокуса на заголовок при навигации, строки таблиц открываются с клавиатуры, единые состояния ошибок (`shared/ui/ErrorState`), мобильная вёрстка списков.

## Структура

- `src/app` — store, роутер (ленивые страницы), тема, оболочка (шапка, меню по правам), ErrorBoundary
- `src/features/auth` — вход, восстановление и активация, профиль, права, сессия
- `src/features/orders` — мастер заказа, список и карточка заказов
- `src/features/approvals` и `src/features/exchange` — очередь одобрения и обмен с 1С (эмулятор в `src/mocks/exchange.ts`)
- `src/features/clients` — клиенты: список, карточка, группы, импорт из Excel
- `src/features/catalog` — продукты, массовые операции, цены с историей; `src/features/applications` — приложения и ответственные; `src/features/dictionaries` — справочники
- `src/features/employees` и `src/features/roles` — сотрудники, зона ответственности, иерархия, роли; правила видимости и их объяснение — в `src/mocks/access.ts`
- `src/features/notifications` — центр уведомлений, подписки, письма (шаблоны в `shared/lib/emailTemplates.ts`, рассылка в `src/mocks/notify.ts`); `src/features/audit` — журнал действий; `src/features/settings` — системные настройки
- Импорт из Excel везде построен на общем `shared/ui/ImportFlow` и `shared/lib/xlsxImport`
- `src/mocks` — seed (клиенты, ~40 продуктов, приложения, сотрудники, заказы) и «сервер» (`mock`, `access`)
- Дизайн: тема `src/app/theme.ts` и `src/styles.css` по руководству BASF (корпоративные цвета, Helvetica/Arial, плоский стиль); логотип — `src/assets/basf-logo.png` с agro.basf.ru.
- `src/shared` — типы домена, русские строки (`i18n/ru.ts`), форматирование, суммы/НДС, парольная политика, UI-компоненты

## Соглашения

- Все тексты интерфейса — в `src/shared/i18n/ru.ts`.
- Бизнес-правила — чистые функции (`validate.ts`, `rules.ts`, `money.ts`) с тестами; компоненты только отображают.
- Новый раздел = `features/<имя>` с `*Api.ts` (инъекция эндпоинтов в общий `api`), страницами и подключением в `app/router.tsx`.
- Файлы сохранять в UTF-8.