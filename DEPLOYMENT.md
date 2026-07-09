# Deployment Guide: Aptitude Arena

Follow these steps to set up your Supabase database and deploy the application to Netlify.

---

## Step 1: Run the Database Migrations

Since your Supabase database does not have the tables yet, you need to run the SQL migration script:

1. Open your **Supabase Dashboard** and navigate to your project (`kphbocotcwxhsbqwhgqf`).
2. Click on the **SQL Editor** tab in the left sidebar (the `SQL` icon).
3. Click **New query** (or **New Blank Query**).
4. Open the SQL file in this project: [20260709173142_create_competition_schema.sql](file:///c:/Users/shaisty%20priya/Downloads/aptitudeareana-main/aptitudeareana-main/supabase/migrations/20260709173142_create_competition_schema.sql)
5. Copy the entire contents of that file and paste it into the Supabase SQL editor.
6. Click the **Run** button at the bottom right.
7. Once successfully executed, your tables (`students`, `questions`, `responses`, `competition_state`) and Row-Level Security (RLS) policies will be created and configured.

---

## Step 2: Get Your Supabase Service Role Key

To enable admin account setup and user management:

1. In the **Supabase Dashboard**, go to **Project Settings** (the gear icon at the bottom left).
2. Click on **API** under the settings menu.
3. Locate the `service_role` key (labeled `service_role` and `secret`). Click **Reveal** and copy it.
   - *WARNING: Never share this key publicly or check it into Git!*

---

## Step 3: Add Environment Variables to `.env.local` (Local Development)

Add the `SUPABASE_SERVICE_ROLE_KEY` to your local environment file so that admin setup works during local development. Open your [.env.local](file:///c:/Users/shaisty%20priya/Downloads/aptitudeareana-main/aptitudeareana-main/.env.local) file and append the key:

```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

Once added, start the local development server:
```bash
npm run dev
```
You can now access `/admin` to trigger the First Time Setup, which creates the admin credentials.

---

## Step 4: Deploy to Netlify

To deploy the application to Netlify:

1. Connect your Git repository to **Netlify**.
2. Set the build command to `npm run build` (or `npx next build`) and the publish directory to `.next`.
3. In the Netlify dashboard under **Site Settings > Environment Variables**, add the following variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://kphbocotcwxhsbqwhgqf.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - `SUPABASE_SERVICE_ROLE_KEY` = `your_actual_service_role_key`
4. Deploy the site.
