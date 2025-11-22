# Inventory Tracker

A modern, role-based inventory management application built with React, Vite, and Supabase.

## Features

- **Role-Based Access Control**: Admin, Editor, Viewer, and Pending roles
- **Nested Location Hierarchy**: Organize inventory by Centers → Rooms → Shelves → Drawers
- **Item Management**: Track unique items by serial number or bulk items by quantity
- **Check-In/Check-Out System**: Track who has items checked out
- **AI-Powered Search**: Natural language search using OpenRouter LLMs (optional)
- **Advanced Filtering**: Filter by category, status, location with real-time updates
- **Automatic Change Logs**: Every action is logged automatically
- **Category Organization**: Group items by categories (Laptops, Mice, etc.)
- **Image Support**: Upload and display item images via Supabase Storage
- **Email Domain Restriction**: Only @company.com emails can register

## Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: TailwindCSS + Shadcn/UI
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **AI Search**: OpenRouter (optional, with multiple free model fallbacks)
- **Routing**: React Router v6
- **Icons**: Lucide React

## Project Structure

```
TablerInventoryTracker/
├── src/
│   ├── components/
│   │   ├── Layout.jsx              # Main app layout with navigation
│   │   ├── ProtectedRoute.jsx      # Route wrapper for auth/role checks
│   │   └── SearchBar.jsx           # Optimized search input with AI toggle
│   ├── contexts/
│   │   └── AuthContext.jsx         # Authentication state management
│   ├── lib/
│   │   ├── supabase.js            # Supabase client configuration
│   │   ├── aiSearch.js            # OpenRouter AI search integration
│   │   └── utils.js               # Utility functions (cn)
│   ├── pages/
│   │   ├── Login.jsx              # Login/Sign up page
│   │   ├── Pending.jsx            # Pending approval page
│   │   ├── Dashboard.jsx          # Main dashboard with stats
│   │   ├── LocationExplorer.jsx   # Browse location hierarchy
│   │   ├── Items.jsx              # All items with search & filters
│   │   ├── ItemDetail.jsx         # Item details & logs
│   │   └── AdminPanel.jsx         # User & category management
│   ├── App.jsx                    # Main app with routing
│   ├── main.jsx                   # App entry point
│   └── index.css                  # Global styles & Tailwind
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql      # Tables, triggers, functions
│   │   └── 002_row_level_security.sql  # RLS policies
│   └── SETUP.md                        # Supabase setup guide
├── .env                           # Environment variables (not in git)
├── .env.example                   # Environment template
└── README.md                      # This file
```

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Supabase

Follow the instructions in `supabase/SETUP.md` to:
- Create a Supabase project
- Run the database migrations
- Configure Auth settings
- Set up Storage for images
- Get your API credentials

### 3. Set Up Environment Variables

Copy `.env.example` to `.env` and add your Supabase credentials:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_OPENROUTER_API_KEY=sk-or-v1-... # Optional: for AI Search feature
```

### 4. Configure OpenRouter for AI Search (Optional)

The app includes an AI-powered search feature that uses OpenRouter to enable natural language item searches.

#### 🔑 Get Your OpenRouter API Key

1. Go to [OpenRouter.ai](https://openrouter.ai/)
2. Sign up or log in with your account
3. Navigate to [Keys](https://openrouter.ai/keys) in your dashboard
4. Click **Create Key** and copy your API key (starts with `sk-or-v1-...`)

#### ⚙️ Add to Environment Variables

Add your OpenRouter API key to `.env`:

```env
VITE_OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

#### 💡 How AI Search Works

- **Token-Optimized**: Only sends essential item data (id, name, brand, model)
- **Automatic Fallback**: Tries multiple free models if one fails
- **Smart Matching**: Uses LLM to understand natural language queries
- **Zero Cost**: Uses free OpenRouter models by default

**Example searches:**
- "red laptop" → Finds laptops with red in the name/description
- "wireless mouse" → Matches mice with wireless connectivity
- "projector in room 3" → Semantic search across fields

If you don't configure OpenRouter, the regular text search will still work perfectly.

### 5. Run the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 6. Create Your First Admin User

1. Sign up through the app (you'll be created with 'pending' role)
2. In Supabase dashboard, run this SQL:

```sql
UPDATE users
SET role = 'admin'
WHERE email = 'your-email@company.com';
```

## User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access: manage users, categories, items, locations |
| **Editor** | Can create/edit items and locations, check in/out |
| **Viewer** | Read-only access to inventory and logs |
| **Pending** | No access until approved by admin |

## Database Schema

### Tables

- **users**: User accounts with roles
- **locations**: Nested location hierarchy
- **categories**: Item categories (with icons)
- **items**: Inventory items
- **item_logs**: Automatic change logs

See `supabase/migrations/001_initial_schema.sql` for full schema.

## Key Features Implemented

### Authentication
- ✅ Email/password login via Supabase Auth
- ✅ Email domain restriction (@company.com)
- ✅ Role-based access control
- ✅ Protected routes

### Backend
- ✅ Complete database schema with triggers
- ✅ Row Level Security policies for all tables
- ✅ Automatic change logging
- ✅ Nested location paths (auto-calculated)
- ✅ Image storage configuration

### Frontend
- ✅ Responsive layout with navigation
- ✅ Dashboard with stats and filtering
- ✅ Location browser with breadcrumbs
- ✅ Item detail page with logs
- ✅ Admin panel for user/category management
- ✅ Check-in/check-out functionality
- ✅ Quantity management

## Recently Completed Features

### High Priority - ✅ COMPLETED
- ✅ Add/Edit Item modal with image upload
- ✅ Add/Edit Location modal
- ✅ Add Category modal in Admin panel
- ✅ Search functionality across items
- ✅ AI-Powered search with OpenRouter integration
- ✅ Advanced filters (by status, category, location)
- ✅ Bulk operations (check-in multiple items)
- ✅ CSV export for inventory reports
- ✅ Edit items from detail page
- ✅ Delete items with confirmation
- ✅ Full audit trail display in Admin panel

## Future Enhancement Ideas

### Medium Priority
- [ ] PDF export for reports
- [ ] Email notifications for approvals
- [ ] Low stock alerts
- [ ] QR code generation for items
- [ ] Mobile app version

## Development

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Email Configuration (SMTP)

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

## Troubleshooting

### "Missing Supabase environment variables"
- Make sure you've created `.env` and added your credentials
- Restart the dev server after adding environment variables

### Users can't sign up
- Check that email domain restriction is configured in Supabase Auth settings
- Verify the email matches @company.com

### RLS Policy Errors
- Make sure all migrations have been run in order
- Check that the user has been assigned a valid role (not 'pending' for most operations)

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

Private project - All rights reserved
