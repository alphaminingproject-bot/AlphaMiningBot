# ALPHA Platform — Supabase Setup Guide
# Read this FIRST before touching anything

## WHAT YOU NEED TO DO (5 steps, no terminal)

---

## STEP 1 — Get your Supabase credentials

1. Go to supabase.com and log in
2. Click your project (or create one named "alpha-platform")
3. Click the gear icon → "Project Settings" → "API"
4. You will see two things — copy them both:
   - **Project URL** → looks like: https://xyzabc.supabase.co
   - **anon public key** → a long string starting with "eyJ..."
5. Paste them into supabase.js where it says PASTE_YOUR_URL and PASTE_YOUR_ANON_KEY

---

## STEP 2 — Create the database tables

1. In your Supabase dashboard click "SQL Editor" on the left
2. Click "New Query"
3. Open the file called "database.sql" from your files
4. Copy EVERYTHING in it
5. Paste it into the SQL editor
6. Click "Run" (the green button)
7. You should see "Success. No rows returned"

---

## STEP 3 — Set your admin secret

1. Open supabase.js
2. Find ADMIN_SECRET and change it to any long password you will remember
3. Open admin.js and change ADMIN_LOGIN_PASSWORD to your admin login password
4. These two passwords are different:
   - ADMIN_LOGIN_PASSWORD = what you type on the login screen
   - ADMIN_SECRET = sent with every admin API request for security

---

## STEP 4 — Update your app files

Replace these two files in your project:
- data.js → replace with the new data.js from this folder
- supabase.js → new file, add it to your project folder

Add this line to app.html BEFORE all your other scripts:
<script src="supabase.js"></script>

---

## STEP 5 — Host your files

Upload everything to Netlify (drag and drop at netlify.com/drop)
That is it. No terminal needed at all.

---

## HOW SECURITY WORKS (no backend server needed)

Instead of a backend server, security comes from:

1. ROW LEVEL SECURITY (RLS) in Supabase
   - Rules written directly in the database
   - Nobody can read or write anything they are not allowed to
   - Even if someone opens the browser console they cannot cheat

2. SIGNED TOKENS
   - Every write includes a hash generated from the user ID + timestamp + secret
   - If the hash is wrong the database rejects the write

3. SERVER-SIDE FUNCTIONS (Supabase Database Functions)
   - All balance changes happen inside the database itself
   - The browser just says "mine for user 123" 
   - The DATABASE does the actual math and saves it
   - The browser never touches the balance number directly

This is actually MORE secure than the Firebase approach.
