# VidTube Backend — Video Streaming Platform API

A production-style **RESTful backend** for a YouTube/Twitter-hybrid video platform, built with **Node.js, Express, and MongoDB (Mongoose)**. It implements complete user authentication, video publishing, social engagement (likes, comments, subscriptions), micro-blogging (tweets), playlists, and a creator analytics dashboard — all backed by MongoDB aggregation pipelines and Cloudinary media storage.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Data Models](#data-models)
- [API Reference](#api-reference)
- [Authentication & Security](#authentication--security)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Design Highlights](#design-highlights)
- [Known Limitations / Roadmap](#known-limitations--roadmap)
- [Author](#author)

---

## Overview

This project is the backend service layer for a full-featured video-sharing platform (in the spirit of YouTube), extended with lightweight social features similar to Twitter (tweets, likes on tweets). It exposes a versioned REST API (`/api/v1/...`) consumed by a frontend client, and is designed around clean separation of concerns: **routes → controllers → models**, with reusable middleware and utility layers for cross-cutting concerns like authentication, file uploads, and standardized responses.

## Key Features

- **User Management** — registration with avatar/cover image upload, login, logout, JWT-based session handling with access & refresh tokens, password change, profile updates.
- **Channel Profiles** — MongoDB aggregation pipelines compute a user's subscriber count, subscriptions count, and whether the current viewer is subscribed — in a single database query.
- **Video Management** — upload (video + thumbnail) to Cloudinary, paginated & searchable video listing, view-count tracking, ownership-gated update/delete, publish/unpublish toggle.
- **Engagement System** — polymorphic **Likes** (videos, comments, and tweets share one `Like` model), threaded **Comments** on videos, and channel **Subscriptions**.
- **Micro-blogging** — Twitter-style **Tweets** with full CRUD, scoped to the authenticated owner.
- **Playlists** — create, update, delete playlists; add/remove videos; fetch playlists per user.
- **Creator Dashboard** — aggregated channel statistics (total views, subscribers, videos, likes) and a channel's video list, via `$lookup`-based aggregation.
- **Health Check Endpoint** — reports live database connectivity for uptime/monitoring checks.
- **Centralized Error & Response Handling** — every controller returns a consistent JSON envelope (`ApiResponse` / `ApiError`) via an `asyncHandler` wrapper, eliminating repetitive try/catch blocks.

## Tech Stack

| Layer                 | Technology                                            |
| ---------------------- | ------------------------------------------------------ |
| Runtime                | Node.js (ES Modules)                                  |
| Framework              | Express.js                                            |
| Database               | MongoDB with Mongoose ODM                              |
| Authentication          | JSON Web Tokens (access + refresh token pattern)       |
| Password Hashing        | bcrypt                                                 |
| File Uploads            | Multer (disk storage) → Cloudinary (media CDN)         |
| Pagination              | mongoose-aggregate-paginate-v2                          |
| Cross-Origin Support     | cors + cookie-parser (httpOnly cookie-based auth)      |
| Dev Tooling             | nodemon, Prettier                                      |

## Architecture

The service follows a **layered MVC-inspired architecture**:

```
Client Request
      │
      ▼
   Routes (src/routes)        → defines endpoints, wires middleware
      │
      ▼
 Middleware (src/middlewares) → JWT verification, multer file handling
      │
      ▼
 Controllers (src/controllers)→ business logic, aggregation pipelines
      │
      ▼
   Models (src/models)        → Mongoose schemas / MongoDB collections
      │
      ▼
   Utils (src/utils)          → ApiError, ApiResponse, asyncHandler, Cloudinary
```

Every controller is wrapped in a shared `asyncHandler` utility, so asynchronous errors are automatically forwarded to Express's error pipeline instead of requiring per-route try/catch blocks. All successful responses and errors are normalized through `ApiResponse` and `ApiError` classes, giving the API a predictable, self-documenting contract:

```json
{
  "statusCode": 200,
  "data": { "...": "..." },
  "message": "Videos fetched successfully",
  "success": true
}
```

## Project Structure

```
Project-Backend/
├── Public/temp/                  # Temporary local storage before Cloudinary upload
├── src/
│   ├── controllers/              # Business logic per resource
│   │   ├── comments.controller.js
│   │   ├── dashboard.controller.js
│   │   ├── healthcheck.controller.js
│   │   ├── likes.controller.js
│   │   ├── playlist.controller.js
│   │   ├── subscription.controller.js
│   │   ├── tweet.controller.js
│   │   ├── user.controller.js
│   │   └── video.controller.js
│   ├── db/
│   │   └── index.js              # MongoDB connection handler
│   ├── middlewares/
│   │   ├── auth.middleware.js    # JWT verification (verifyJWT)
│   │   └── multer.middleware.js  # Multipart file upload handling
│   ├── models/                   # Mongoose schemas
│   │   ├── comments.models.js
│   │   ├── likes.models.js
│   │   ├── playlist.models.js
│   │   ├── subscription.models.js
│   │   ├── tweets.models.js
│   │   ├── users.models.js
│   │   └── video.models.js
│   ├── routes/                   # Express routers per resource
│   ├── utils/
│   │   ├── ApiError.js
│   │   ├── ApiResponse.js
│   │   ├── asyncHandler.js
│   │   └── cloudinary.js         # Upload / delete helpers
│   ├── app.js                    # Express app configuration & route mounting
│   ├── constants.js               # DB name, request size limits
│   └── index.js                  # Entry point — loads env, connects DB, starts server
├── package.json
└── .gitignore
```

## Data Models

| Model            | Purpose                                                                 | Key Relationships |
| ----------------- | ------------------------------------------------------------------------ | ------------------ |
| **User**          | Auth identity: username, email, hashed password, avatar, cover image, watch history, refresh token. Includes instance methods for password comparison and JWT generation. | Referenced by nearly every other model as `owner` |
| **Video**         | title, description, duration, view count, publish status, Cloudinary URLs for file & thumbnail. Uses `mongoose-aggregate-paginate-v2` for efficient paginated queries. | `owner → User` |
| **Comment**       | Content tied to a video and its author.                                 | `video → Video`, `owner → User` |
| **Like**          | A single polymorphic schema referencing an optional `video`, `comment`, or `tweet`, plus the user who liked it. | `likedBy → User` |
| **Subscription**  | Join model connecting a `subscriber` to a `channel` (both are `User` references). | `subscriber → User`, `channel → User` |
| **Tweet**         | Short-form text post owned by a user.                                  | `owner → User` |
| **Playlist**      | Named, described collection of videos owned by a user.                  | `videos[] → Video`, `owner → User` |

## API Reference

All endpoints are prefixed with `/api/v1`. Routes marked 🔒 require a valid JWT (via `Authorization: Bearer <token>` header or `accessToken` cookie).

### Health
| Method | Endpoint         | Description        |
| ------ | ----------------- | -------------------- |
| GET    | `/healthcheck`    | Returns API/DB health |

### Users (`/users`)
| Method | Endpoint                | Auth | Description |
| ------ | ------------------------- | ---- | ------------- |
| POST   | `/register`               |      | Register with avatar + optional cover image upload |
| POST   | `/login`                  |      | Login via username or email |
| POST   | `/logout`                 | 🔒   | Clears auth cookies, invalidates refresh token |
| POST   | `/refresh-token`          |      | Issues a new access token from a valid refresh token |
| POST   | `/change-password`        | 🔒   | Update the current user's password |
| POST   | `/get-current-user`       |      | Returns the authenticated user's profile |
| PATCH  | `/update-account`         | 🔒   | Update fullname / email |
| PATCH  | `/update-avatar`          | 🔒   | Replace avatar image |
| PATCH  | `/update-cover-image`     | 🔒   | Replace cover image |
| GET    | `/c/:username`            | 🔒   | Aggregated channel profile (subscriber counts, is-subscribed flag) |

### Videos (`/videos`)
| Method | Endpoint                     | Auth | Description |
| ------ | ------------------------------ | ---- | ------------- |
| GET    | `/`                            | 🔒   | Paginated, searchable, sortable video feed |
| POST   | `/`                            | 🔒   | Upload a new video (video file + thumbnail) |
| GET    | `/:videoId`                    | 🔒   | Fetch a video, increments view count |
| PATCH  | `/:videoId`                    | 🔒   | Update title/description/thumbnail (owner only) |
| DELETE | `/:videoId`                    | 🔒   | Delete video + Cloudinary assets (owner only) |
| PATCH  | `/toggle/publish/:videoId`     | 🔒   | Toggle published/unpublished status |

### Comments (`/comments`) 🔒
| Method | Endpoint             | Description |
| ------ | ---------------------- | ------------- |
| GET    | `/:videoId`            | List comments on a video |
| POST   | `/:videoId`            | Add a comment |
| PATCH  | `/c:commentId`         | Edit a comment |
| DELETE | `/c:commentId`         | Delete a comment |

### Likes (`/likes`) 🔒
| Method | Endpoint                 | Description |
| ------ | --------------------------- | ------------- |
| POST   | `/toggle/v/:videId`         | Like / unlike a video |
| POST   | `/toggle/c/:commentId`      | Like / unlike a comment |
| POST   | `/toggle/t/:tweetId`        | Like / unlike a tweet |
| GET    | `/videos`                   | List videos liked by the current user |

### Subscriptions (`/subscriptions`) 🔒
| Method | Endpoint                | Description |
| ------ | -------------------------- | ------------- |
| GET    | `/c/:channelId`            | Channels the user is subscribed to |
| POST   | `/c/:channelId`            | Subscribe / unsubscribe toggle |
| GET    | `/u/:suscriberId`          | Get a channel's subscriber list |

### Tweets (`/tweets`) 🔒
| Method | Endpoint             | Description |
| ------ | ---------------------- | ------------- |
| POST   | `/`                    | Create a tweet |
| PATCH  | `/:tweetId`            | Edit own tweet |
| DELETE | `/:tweetId`            | Delete own tweet |
| GET    | `/user/:userId`        | Get a user's tweets |

### Playlists (`/playlists`) 🔒
| Method | Endpoint                          | Description |
| ------ | ------------------------------------ | ------------- |
| POST   | `/`                                 | Create a playlist |
| GET    | `/:playlistId`                      | Get playlist by ID |
| PATCH  | `/:playlistId`                      | Rename / edit description |
| DELETE | `/:playlistId`                      | Delete playlist |
| PATCH  | `/add/:videoId/:playlistId`         | Add a video to a playlist |
| PATCH  | `/remove/:videoId/:playlistId`      | Remove a video from a playlist |
| GET    | `/user/:userId`                     | Get all playlists for a user |

### Dashboard (`/dashboard`) 🔒
| Method | Endpoint                          | Description |
| ------ | ------------------------------------ | ------------- |
| GET    | `/:channelId/channel-stats`         | Aggregated total views, videos, subscribers, likes |
| GET    | `/:channelId/videos`                | All videos uploaded by a channel |

> **Note:** the dashboard router is implemented but not yet mounted in `app.js` — see [Roadmap](#known-limitations--roadmap).

## Authentication & Security

- **JWT dual-token strategy** — short-lived **access tokens** authorize requests; long-lived **refresh tokens** (stored on the `User` document and set as an `httpOnly` cookie) allow silent renewal via `/refresh-token` without forcing re-login.
- **Password hashing** — handled in a Mongoose `pre("save")` hook using `bcrypt`, so plaintext passwords never touch the database.
- **Cookie-based + header-based auth** — `verifyJWT` middleware accepts a token from either an `httpOnly` cookie or an `Authorization: Bearer` header, supporting both browser and non-browser clients.
- **Ownership checks** — mutation endpoints (video update/delete, publish toggle) verify `req.user._id` against the resource's `owner` before allowing the action.
- **Request size limiting** — JSON and URL-encoded body size is capped (`constants.js`) to reduce payload-based abuse.

## Getting Started

### Prerequisites
- Node.js ≥ 18
- A MongoDB instance (local or Atlas)
- A Cloudinary account (for media storage)

### Installation

```bash
git clone https://github.com/Tennobis/Project-Backend.git
cd Project-Backend
npm install
```

### Environment Setup
Create a `.env` file in the project root (see [Environment Variables](#environment-variables)).

### Run in development

```bash
npm run dev
```

The server starts on `http://localhost:<PORT>` (default `8000`) and connects to MongoDB using `MONGODB_URI` from your `.env` file.

## Environment Variables

| Variable                 | Description                                  |
| -------------------------- | ----------------------------------------------- |
| `PORT`                    | Port the Express server listens on            |
| `MONGODB_URI`             | MongoDB connection string (DB name is appended automatically) |
| `CORS_ORIGIN`             | Allowed origin for cross-origin requests       |
| `ACCESS_TOKEN_SECRET`     | Secret used to sign JWT access tokens          |
| `ACCESS_TOKEN_EXPIRY`     | Access token lifetime (e.g. `1d`)              |
| `REFRESH_TOKEN_SECRET`    | Secret used to sign JWT refresh tokens         |
| `REFRESH_TOKEN_EXPIRY`    | Refresh token lifetime (e.g. `10d`)            |
| `CLOUDINARY_CLOUD_NAME`   | Cloudinary cloud name                          |
| `CLOUDINARY_API_KEY`      | Cloudinary API key                             |
| `CLOUDINARY_API_SECRET`   | Cloudinary API secret                          |

## Design Highlights

A few implementation details worth calling out in an interview walkthrough:

- **Polymorphic Like model** — rather than three separate like collections, a single `Like` schema with optional `video` / `comment` / `tweet` references keeps the like/toggle logic (and future extension to new likeable types) in one place.
- **Aggregation-driven read models** — channel profiles and dashboard statistics are computed with MongoDB `$lookup` + `$addFields` pipelines rather than N+1 application-level queries, keeping expensive joins on the database side.
- **Reusable async error handling** — `asyncHandler` is a higher-order function that wraps every controller, so a single `throw new ApiError(...)` anywhere in the call stack is enough to produce a correctly-shaped error response.
- **Two-stage file upload** — Multer first writes uploads to a local temp directory; a Cloudinary utility then streams the file to the CDN and deletes the local copy, keeping the server stateless with respect to media storage.

## Known Limitations / Roadmap

This project was built as a hands-on learning exercise in backend architecture, and there are a few areas intentionally left open for future iteration:

- Mount the `dashboard` router in `app.js` (currently defined but not wired up).
- Add centralized Express error-handling middleware to catch errors thrown outside `asyncHandler`.
- Add input validation (e.g. `express-validator` / `zod`) ahead of controller logic.
- Add automated tests (unit tests for controllers/models, integration tests for routes).
- Add rate limiting and helmet-based HTTP header hardening for production readiness.
- Delete the user's previous avatar/cover image from Cloudinary when replaced (currently only new uploads are handled).

## Author

**Tanveer Hossain** — Full Stack Developer
Built as a backend engineering project to practice REST API design, JWT authentication, MongoDB aggregation pipelines, and cloud media handling with Node.js and Express.
