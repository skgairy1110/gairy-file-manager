# Vault — Image File Manager

A minimal, private file manager for hosting and sharing images. Organize images in folders and get a public link for each upload — perfect for embedding images on a website.

- **Login** — Google OAuth or a simple admin username/password
- **Folders** — create, browse, and delete nested folders
- **Upload** — drag-and-drop or click to upload images (PNG, JPG, GIF, WEBP, SVG, AVIF)
- **Public links** — every upload gets an instant public URL, click any image to copy its link
- **Storage** — [Vercel Blob](https://vercel.com/docs/vercel-blob), no database required

## 1. Deploy to Vercel

```bash
npm install
```

Push this project to a GitHub repo, then import it in Vercel — or deploy directly:

```bash
npx vercel --prod
```

## 2. Create a Blob store

In your Vercel project → **Storage** tab → **Create Database** → **Blob**. Connect it to this project. Vercel will automatically add `BLOB_READ_WRITE_TOKEN` to your project's environment variables.

## 3. Set environment variables

Copy `.env.example` to `.env.local` for local development, and add the same values in **Vercel → Project → Settings → Environment Variables** for production.

| Variable | Description |
|---|---|
| `NEXTAUTH_SECRET` | Random string. Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your app URL (only needed locally, e.g. `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | From Google Cloud Console (see below) |
| `ALLOWED_EMAILS` | Comma-separated emails allowed to sign in with Google. Leave blank to allow any Google account. |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Credentials for the simple username/password login |
| `BLOB_READ_WRITE_TOKEN` | Auto-added when you connect a Blob store (see step 2) |

### Setting up Google login

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** (type: Web application).
3. Add an authorized redirect URI:
   `https://your-app.vercel.app/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google` for local dev).
4. Copy the generated Client ID and Client Secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. Set `ALLOWED_EMAILS` to the emails you want to permit — this keeps the tool private even though Google login is enabled.

## 4. Run locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

## How folders work

Vercel Blob doesn't have real directories — folders are simulated using path prefixes (e.g. `campaigns/summer/banner.png`). Creating a folder adds a tiny hidden `.keep` file so empty folders still show up. Deleting a folder removes every file inside it — this can't be undone.

## Notes

- Uploads are capped at 20MB per file and restricted to image types.
- Every uploaded image is public by design, since the whole point is to get a shareable link. Don't upload anything you don't want publicly accessible.
- This is built for a small, trusted team — there's no per-user file isolation. Everyone who logs in shares the same file tree.
