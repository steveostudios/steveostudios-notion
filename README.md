# steveostudios

Personal site. Eleventy for the build, Notion for authoring.

## How it fits together

Three systems, deliberately separate. The point of the split is that Notion is
never on the deploy path, so a slow or rate-limited Notion cannot break a deploy.

| System | Owns | Runs |
|---|---|---|
| Sync | All Notion I/O, HTML conversion, image resizing | GitHub Action, daily at 14:00 UTC, or on demand |
| Build | Eleventy templates and derived stats | Netlify, on push |

**Sync** (`scripts/sync/`) reads the five Notion databases and writes plain JSON to
`content/` plus optimized images to `src/assets/img/notion/`. Both are committed.

**Build** reads only those committed files. `src/_data/*.js` are thin readers. The
build makes no network calls and does no image processing, so it is fast and
deterministic. `NOTION_API_KEY` is not needed to build.

The committed JSON *is* the cache. Every record carries its Notion `id` and
`lastEditedTime`, so an unchanged page costs zero API calls on the next sync.
Resized images are hashed before writing, so unrelated Notion edits do not churn git.

## Commands

```sh
npm run dev         # Eleventy dev server, offline
npm run build       # production build, offline
npm run sync        # pull changes from Notion
npm run sync:force  # re-fetch everything, ignoring the incremental check
```

`npm run sync` needs `.env` with `NOTION_API_KEY` and the five `NOTION_DB_*` ids.
Nothing else does.

## Deploy

Pushing to `main` deploys via Netlify. The sync workflow waits for that deploy and
fails the Action if it fails, so GitHub notifications cover the whole chain.

GitHub secrets required: `NOTION_API_KEY`, `NOTION_DB_BOOKS`, `NOTION_DB_POSTS`,
`NOTION_DB_PROJECTS`, `NOTION_DB_RESUMES`, `NOTION_DB_MARVEL_MOVIES`,
`NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`.
