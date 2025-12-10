# Supabase Edge Functions Setup

This directory contains Supabase Edge Functions that provide admin capabilities for managing users in the Tabler Inventory Tracker application.

## Available Functions

### 1. `delete-user`
Permanently deletes a user from Supabase Auth and the database.

**Request Body:**
```json
{
  "userId": "uuid-of-user-to-delete"
}
```

### 2. `resend-confirmation`
Resends the email confirmation link to a user.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

### 3. `get-user-details`
Retrieves detailed information about all users, including auth status, email confirmation, last sign-in, and ban status.

**Request Body:** (empty)

**Response:**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "viewer",
      "created_at": "2024-01-01T00:00:00Z",
      "email_confirmed_at": "2024-01-01T01:00:00Z",
      "last_sign_in_at": "2024-01-02T00:00:00Z",
      "confirmed": true,
      "banned": false
    }
  ]
}
```

### 4. `update-user-metadata`
Updates user metadata including email, password, and ban status.

**Request Body:**
```json
{
  "userId": "uuid",
  "email": "newemail@example.com",      // Optional
  "emailConfirm": true,                  // Optional, default true
  "password": "newpassword123",          // Optional
  "banDuration": 24                      // Optional, hours (0 to unban)
}
```

### 5. `notify-admin-new-user`
Sends email notifications to admins who have opted in when a new user signs up.

**Request Body:**
```json
{
  "userId": "uuid-of-new-user",
  "userEmail": "newuser@example.com",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Note:** Requires Gmail SMTP credentials to be configured:
- `GMAIL_USERNAME` - Gmail address for sending
- `GMAIL_APP_PASSWORD` - Gmail App Password (16-character, not regular password)
- `SITE_URL` - Application URL for email links

### 6. `notify-admin-order-status-change`
Sends email notifications to admins who have opted in when an order request status changes.

**Request Body:**
```json
{
  "requestId": "uuid-of-order-request",
  "oldStatus": "new_request",
  "newStatus": "approved_pending",
  "changedByUserId": "uuid-of-user-who-made-change",
  "changedByName": "John Doe",
  "itemName": "Item Name",
  "itemBrand": "Brand Name",           // Optional
  "locationId": "uuid-of-location",
  "categoryId": "uuid-of-category",    // Optional
  "priority": "high",                  // "high" or "standard"
  "quantity": 10
}
```

**Filtering:** Admins can configure their notification preferences to filter by:
- **Statuses**: Which status changes trigger notifications
- **Centers**: Only receive notifications for specific centers (locations)
- **Categories**: Only receive notifications for specific item categories

**Note:** Uses the same Gmail SMTP configuration as `notify-admin-new-user`.

## Prerequisites

1. **Supabase CLI** - Install the Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. **Docker Desktop** - Required for running Supabase locally:
   - Download from https://www.docker.com/products/docker-desktop

3. **Deno** (Optional) - For local testing:
   ```bash
   # Windows (PowerShell)
   irm https://deno.land/install.ps1 | iex
   ```

## Local Development Setup

### 1. Initialize Supabase (if not already done)

If you haven't initialized Supabase in this project:

```bash
supabase init
```

### 2. Link to Your Supabase Project

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

To find your project ref:
1. Go to https://app.supabase.com
2. Open your project
3. Go to Settings > General
4. Copy the "Reference ID"

### 3. Start Local Supabase (Optional)

To test functions locally:

```bash
supabase start
```

This will start:
- Supabase Studio (UI): http://localhost:54323
- Edge Functions: http://localhost:54321
- PostgreSQL: localhost:54322

### 4. Serve Functions Locally

To test a specific function locally:

```bash
supabase functions serve delete-user --env-file .env.local
```

Or serve all functions:

```bash
supabase functions serve
```

## Deployment to Production

### 1. Get Your Service Role Key

1. Go to https://app.supabase.com
2. Open your project
3. Go to Settings > API
4. Copy the `service_role` key (⚠️ Keep this secret!)

### 2. Set Environment Secrets

The Edge Functions need access to your service role key. Set it as a secret:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

Note: The following environment variables are automatically available in Edge Functions:
- `SUPABASE_URL` - Your project URL
- `SUPABASE_ANON_KEY` - Your anon/public key

### 3. Deploy All Functions

Deploy all functions at once:

```bash
supabase functions deploy
```

Or deploy individual functions:

```bash
supabase functions deploy delete-user
supabase functions deploy resend-confirmation
supabase functions deploy get-user-details
supabase functions deploy update-user-metadata
```

### 4. Verify Deployment

After deployment, you can test the functions using curl:

```bash
curl -i --location --request POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/get-user-details' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json'
```

## Environment Variables

### Required Secrets

Set these using `supabase secrets set`:

- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for admin operations)

### Automatically Available

These are provided by Supabase automatically:

- `SUPABASE_URL` - Your project URL
- `SUPABASE_ANON_KEY` - Your anon/public key

## Security Considerations

1. **Service Role Key**: The service role key has full access to your database and bypasses Row Level Security. Never expose it in client-side code.

2. **Admin Verification**: All functions verify that the requesting user is an admin before performing any operations.

3. **CORS**: The functions are configured to accept requests from any origin. In production, you may want to restrict this to your domain.

4. **Audit Logging**: All admin actions are logged to the `audit_logs` table.

## Troubleshooting

### Function Deployment Fails

If deployment fails, check:
1. You're logged in: `supabase login`
2. You're linked to the correct project: `supabase link --project-ref YOUR_REF`
3. Your CLI is up to date: `npm update -g supabase`

### Function Returns 401 Unauthorized

- Make sure you're passing a valid JWT token in the Authorization header
- Verify the user making the request has the 'admin' role

### Function Returns 500 Error

- Check the function logs: `supabase functions logs FUNCTION_NAME`
- Verify the `SUPABASE_SERVICE_ROLE_KEY` secret is set correctly

### Getting Function Logs

View logs for a specific function:

```bash
supabase functions logs delete-user
```

Or follow logs in real-time:

```bash
supabase functions logs delete-user --follow
```

## Testing

### Test Locally with Curl

```bash
# Get user details
curl -i --location --request POST 'http://localhost:54321/functions/v1/get-user-details' \
  --header 'Authorization: Bearer YOUR_LOCAL_ANON_KEY' \
  --header 'Content-Type: application/json'

# Delete a user
curl -i --location --request POST 'http://localhost:54321/functions/v1/delete-user' \
  --header 'Authorization: Bearer YOUR_LOCAL_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"userId": "uuid-here"}'

# Resend confirmation
curl -i --location --request POST 'http://localhost:54321/functions/v1/resend-confirmation' \
  --header 'Authorization: Bearer YOUR_LOCAL_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"email": "user@example.com"}'
```

## Additional Resources

- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [Deno Documentation](https://deno.land/manual)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli/introduction)
