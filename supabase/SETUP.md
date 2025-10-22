# Supabase Setup Guide

## 1. Apply Database Migrations

In your Supabase project dashboard, go to **SQL Editor** and run each migration in order:

1. Run `migrations/001_initial_schema.sql` - Creates tables, indexes, and triggers
2. Run `migrations/002_row_level_security.sql` - Sets up RLS policies
3. Run `migrations/003_storage_setup.sql` - Creates storage bucket for images
4. Run `migrations/004_add_description_column.sql` - Adds description field to items
5. Run `migrations/005_checkout_system.sql` - Creates checkout logs table and updates triggers
6. Run `migrations/006_checkout_logs_rls.sql` - Sets up RLS policies for checkout logs

**Important**: Run migrations in the exact order listed above.

## 2. Configure Auth Settings

### Email Domain Restriction

1. Go to **Authentication** → **Settings**
2. Scroll to **Email Auth**
3. Enable "Restrict email domains"
4. Add `company.com` to the allowed domains list

### Email Templates (Optional)

Customize the email templates for:
- Confirmation emails
- Password reset emails
- Magic link emails

## 3. Verify Storage Bucket

The `item-images` storage bucket should have been created automatically by the `003_storage_setup.sql` migration. To verify:

1. Go to **Storage** in the Supabase dashboard
2. Confirm the `item-images` bucket exists and is set to **Public**

If you need to create it manually:
1. Go to **Storage** → **Create a new bucket**
2. Name it `item-images`
3. Set it to **Public** (so images can be displayed without auth tokens)
4. The policies will be applied automatically by the migration

## 4. Get Your Credentials

1. Go to **Settings** → **API**
2. Copy your:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **Anon/Public Key** (starts with `eyJ...`)
3. Add these to your `.env` file:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## 5. Create First Admin User

After running the migrations:

1. Sign up through the app UI (you'll be created as 'pending')
2. In Supabase dashboard, go to **SQL Editor**
3. Run this query to promote yourself to admin:

```sql
UPDATE users
SET role = 'admin'
WHERE email = 'your-email@company.com';
```

## 6. Configure Email (SMTP)

### Using Google SMTP with Supabase

#### 🔧 Prerequisites
- A **Gmail account**
- **2-Step Verification** enabled
  → [https://myaccount.google.com/security](https://myaccount.google.com/security)

#### 🔐 Generate an App Password

1. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
2. Sign in with your Gmail credentials.
3. Under **Select app**, choose `Mail`.
4. Under **Select device**, choose `Other (Custom name)` → enter `Supabase`.
5. Click **Generate** and copy the **16-character password** (no spaces).

#### ⚙️ Configure Supabase SMTP Settings

In **Supabase Dashboard** → `Project Settings → Authentication → SMTP Settings`, fill in:

| Field | Value |
|-------|--------|
| **Sender email** | your@gmail.com |
| **Sender name** | Your Name or App Name |
| **Host** | smtp.gmail.com |
| **Port number** | 587 |
| **Username** | your@gmail.com |
| **Password** | *App Password from Google* |
| **Minimum interval** | 60 (recommended) |

Save your settings.

#### 🧪 Test the Connection
1. Click **"Send test email"** in Supabase.
2. Check your inbox for the test message.

If it succeeds, your Supabase project is now ready to send authentication and magic link emails via Gmail SMTP.

#### ✅ Notes
- Gmail's daily limit: ~100–500 emails/day (depending on your account).
- Use this setup for development or low-volume apps.
- For production, consider Mailgun, SendGrid, or Brevo.

## 7. Seed Initial Data (Optional)

Create some initial categories:

```sql
INSERT INTO categories (name, icon) VALUES
  ('Laptops', '💻'),
  ('Mice', '🖱️'),
  ('Keyboards', '⌨️'),
  ('Monitors', '🖥️'),
  ('Cables', '🔌'),
  ('Adapters', '🔄'),
  ('Headphones', '🎧'),
  ('Webcams', '📹'),
  ('Other', '📦');
```

Create some initial locations:

```sql
-- Centers
INSERT INTO locations (id, name, parent_id) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Center A', NULL),
  ('22222222-2222-2222-2222-222222222222', 'Center B', NULL);

-- Rooms in Center A
INSERT INTO locations (id, name, parent_id) VALUES
  ('33333333-3333-3333-3333-333333333333', 'Room 101', '11111111-1111-1111-1111-111111111111'),
  ('44444444-4444-4444-4444-444444444444', 'Room 102', '11111111-1111-1111-1111-111111111111');

-- Shelves in Room 101
INSERT INTO locations (id, name, parent_id) VALUES
  ('55555555-5555-5555-5555-555555555555', 'Shelf 1', '33333333-3333-3333-3333-333333333333'),
  ('66666666-6666-6666-6666-666666666666', 'Shelf 2', '33333333-3333-3333-3333-333333333333');
```

## Done!

Your Supabase backend is now ready. Start the development server and test the app!
