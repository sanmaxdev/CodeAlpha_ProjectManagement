# Cadence

A collaborative project management tool in the spirit of Trello and Asana. Plan work on shared boards, assign tasks, discuss them in context, and stay in sync with your team in real time.

Built for the **CodeAlpha Full Stack Development Internship — Task 3 (Project Management Tool)**.

## Features

- **Group projects** with owner / admin / member roles and per-project membership
- **Kanban boards** — columns and task cards with drag-and-drop between and within columns
- **Task cards** with description, assignee, priority, due dates, and labels
- **In-task comments** with `@mentions` and a per-task discussion thread
- **Assignments & notifications** — get notified the moment you're assigned, mentioned, or added to a project
- **Live collaboration over WebSockets** — every card move, edit, comment, and membership change appears for teammates instantly, with live presence ("who's viewing")
- **My Tasks** — a personal view of everything assigned to you across every project, grouped by overdue / due today / upcoming
- **Board filters & search** — filter cards by assignee, priority, or label, search by text, or show only your own tasks
- **Live activity feed** — a per-project drawer that streams every action as it happens
- **Due-date reminders** — the server checks for tasks due soon or overdue and notifies the assignee automatically
- Authentication with JWT, light/dark theme, responsive layout, and full loading / empty / error states

## Tech stack

- **Backend:** Node.js, Express, better-sqlite3 (SQLite), JSON Web Tokens, bcryptjs
- **Real-time:** native `ws` WebSocket server sharing the HTTP port, with JWT-authenticated handshakes and per-project rooms
- **Frontend:** vanilla HTML, CSS, and JavaScript (no framework), served statically by Express
- **Type:** Clash Display + Switzer

## Getting started

```bash
npm install
npm start
```

The app runs at **http://localhost:4200**. On first run the database is created and seeded automatically.

### Demo accounts

All seeded users share the password **`cadence1234`**:

| Email | Role |
| --- | --- |
| demo@cadence.app | Product Manager (start here) |
| ava@cadence.app | Product Designer |
| noah@cadence.app | Frontend Engineer |
| mia@cadence.app | Backend Engineer |
| liam@cadence.app | QA Engineer |
| emma@cadence.app | Marketing Lead |

Open the board in two browsers, log in as two different users, and move a card — the other window updates live.

## Real-time architecture

The WebSocket server is attached to the same HTTP server as Express (`server.on('upgrade')`). Clients connect to `/ws?token=<jwt>`; the token is verified on the handshake. After connecting, a client sends `{ type: "join", projectId }` to enter a project room (membership is checked server-side). Mutations made through the REST API broadcast events to everyone in the affected project's room:

- `task:created` · `task:updated` · `task:moved` · `task:deleted`
- `column:created` · `column:updated` · `column:deleted` · `column:reordered`
- `comment:created` · `comment:deleted`
- `member:added` · `member:updated` · `member:removed`
- `presence` (current viewers) · `project:updated` · `project:deleted`

Notifications are pushed directly to the recipient's sockets (`notification`, `unread`) regardless of which room they're in. Each board event carries the acting user's id so clients can skip echoes of their own optimistic updates.

## API reference

### Auth
| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Log in (email or username) |
| GET | `/api/auth/me` | Current user |
| PUT | `/api/auth/me` | Update profile (name, title, avatar) |

### Projects & members
| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/projects` | Projects you belong to |
| POST | `/api/projects` | Create a project (with default columns) |
| GET | `/api/projects/:id` | Board payload (project, columns, tasks) |
| PUT | `/api/projects/:id` | Update project (admins) |
| DELETE | `/api/projects/:id` | Delete project (owner) |
| GET | `/api/projects/:id/activity` | Recent activity |
| GET | `/api/projects/:id/members` | List members |
| POST | `/api/projects/:id/members` | Add a member (admins) |
| PUT | `/api/projects/:id/members/:userId` | Change role (owner) |
| DELETE | `/api/projects/:id/members/:userId` | Remove member / leave |

### Columns
| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/columns` | Create a column |
| PUT | `/api/columns/:id` | Rename a column |
| DELETE | `/api/columns/:id` | Delete an empty column |
| POST | `/api/columns/reorder` | Reorder columns |

### Tasks & comments
| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/tasks` | Create a task |
| GET | `/api/tasks/mine` | Tasks assigned to you across all projects |
| GET | `/api/tasks/:id` | Task + comments |
| PUT | `/api/tasks/:id` | Update fields / assignee / completion |
| PUT | `/api/tasks/:id/move` | Move to a column at an index |
| DELETE | `/api/tasks/:id` | Delete a task |
| GET | `/api/tasks/:id/comments` | List comments |
| POST | `/api/tasks/:id/comments` | Add a comment |
| DELETE | `/api/tasks/:id/comments/:cid` | Delete own comment |

### Notifications & users
| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/notifications` | List + unread count |
| GET | `/api/notifications/unread` | Unread count |
| POST | `/api/notifications/read` | Mark all (or one) read |
| GET | `/api/users?search=` | Find people (for assigning / inviting) |

## Project structure

```
CodeAlpha_ProjectManagement/
├── server.js              Express + HTTP server with the WebSocket upgrade
├── src/
│   ├── db.js              SQLite schema
│   ├── auth.js            JWT helpers and middleware
│   ├── access.js          Project membership / role guards
│   ├── realtime.js        WebSocket server, rooms, presence
│   ├── serialize.js       API response shaping
│   ├── notify.js          Notifications + activity logging
│   ├── seed.js            Demo team, projects, tasks
│   └── routes/            auth, users, projects, columns, tasks, notifications
└── public/                Static frontend (HTML, CSS, JS)
```

## Scripts

- `npm start` — run the server
- `npm run dev` — run with file watching
- `npm run seed` — seed manually (runs automatically on first start)
