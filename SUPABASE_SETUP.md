# Supabase Setup Guide

## Quick Setup Steps

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Sign in or create an account
3. Click "New Project"
4. Fill in:
   - **Project Name**: `mashwiz-menu` (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose closest to your location
5. Click "Create new project"
6. Wait ~2 minutes for database to be provisioned

### 2. Get Connection String
1. In your Supabase project, go to **Project Settings** (gear icon)
2. Click **Database** in the left sidebar
3. Scroll to **Connection string** section
4. Select **URI** tab
5. Copy the connection string
6. Replace `[YOUR-PASSWORD]` with your database password

Example connection string:
```
postgresql://postgres.xxxxxxxxxxxx:your-password@aws-0-us-west-1.pooler.supabase.com:5432/postgres
```

### 3. Configure Backend
Create `.env` file in the `BackEnd` directory:

```bash
# Supabase Database Connection
DATABASE_URL="postgresql://postgres.[YOUR-REF]:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres"

# Server Config
PORT=3000
HOST=localhost

# MSSQL ERP Database (Source)
SQLSERVER_HOST=your-mssql-host
SQLSERVER_PORT=1433
SQLSERVER_USER=your-mssql-username
SQLSERVER_PASSWORD_ENCRYPTED=your-encrypted-password
MASTER_DB_NAME=your-database-name
ENCRYPTION_KEY=your-encryption-key

# Sync Config
SYNC_BATCH_SIZE=100
```

### 4. Install and Setup
```bash
# Install dependencies
npm install

# Generate Prisma Client
npx prisma generate

# Create tables in Supabase
npx prisma db push
```

### 5. Verify Setup
```bash
# Start the server
npm start
```

You should see:
```
✅ Prisma Client initialized
✅ Connected to [your-database] DB
🚀 Server running on http://localhost:3000
📊 Using Supabase (PostgreSQL) for menu storage
🔄 Syncing data from MSSQL ERP database
```

### 6. Test the Sync
To manually trigger a sync (for testing):
```bash
# Using curl or Postman
POST http://localhost:3000/api/menu/sync
Content-Type: application/json

{
  "branch_code": "YOUR_BRANCH_CODE"
}
```

## Database Tables Created

After running `npx prisma db push`, these tables will be created in Supabase:

- `customer_details` - Customer information
- `item_main_group` - Menu categories (synced from ERP)
- `item_master` - Menu items (synced from ERP)
- `tags` - Dietary tags configuration
- `web_themes` - Website theme settings
- `restaurant_info` - Restaurant configuration
- `social_links` - Social media links
- `buckets` - Storage bucket info
- `locations` - Restaurant locations

## Viewing Your Data

### Option 1: Prisma Studio (Recommended)
```bash
npx prisma studio
```
Opens browser at `http://localhost:5555` with a visual database editor.

### Option 2: Supabase Dashboard
1. Go to your Supabase project
2. Click **Table Editor** in the left sidebar
3. Browse your tables

### Option 3: SQL Editor
1. In Supabase, click **SQL Editor**
2. Run queries like:
```sql
SELECT COUNT(*) FROM item_master;
SELECT * FROM item_main_group WHERE show_in_website = true;
```

## Sync Schedule

The backend automatically syncs data from your MSSQL ERP database:

- **Frequency**: Daily at 2:00 AM
- **What's synced**:
  - Menu categories (`item_main_group`)
  - Menu items (`item_master`)
  - Pricing information
  - Product attributes and descriptions

**To change sync schedule**, edit `src/modules/menu/itemSyncScheduler.js`:

```javascript
// Current: Daily at 2 AM
cron.schedule('0 2 * * *', async () => { ... });

// Every hour:
cron.schedule('0 * * * *', async () => { ... });

// Every 30 minutes:
cron.schedule('*/30 * * * *', async () => { ... });
```

## Troubleshooting

### ❌ "Can't reach database server"
**Solution**: 
- Check your `DATABASE_URL` is correct
- Ensure Supabase project is active (not paused)
- Check if special characters in password are URL-encoded

### ❌ "Authentication failed for user postgres"
**Solution**:
- Verify password in connection string
- URL-encode special characters: `!` → `%21`, `@` → `%40`, `#` → `%23`

### ❌ "Prisma Client is not initialized"
**Solution**:
```bash
npx prisma generate
```

### ❌ "Table 'item_master' does not exist"
**Solution**:
```bash
npx prisma db push
```

### ❌ "ERP sync failing"
**Solution**:
- Check MSSQL connection credentials
- Verify `SQLSERVER_HOST` is accessible
- Test encrypted password and encryption key

## Monitoring Sync Activity

### Check Logs
Logs are stored in `logs/` directory:
- `logs/combined.log` - All logs
- `logs/error.log` - Errors only

### View Console Output
When server is running, you'll see:
```
⏰ Starting daily item sync at [timestamp]
Starting full sync for branch [code]...
✅ Daily item sync completed: { success: true, ... }
```

## Backup Your Data

### Export from Supabase
```bash
# Using pg_dump (requires PostgreSQL client installed)
pg_dump "YOUR_DATABASE_URL" > backup_$(date +%Y%m%d).sql
```

### Restore to Supabase
```bash
psql "YOUR_DATABASE_URL" < backup_20251108.sql
```

## Performance Optimization

### Connection Pooling
Supabase includes connection pooling by default. The URL with `pooler.supabase.com` uses Supavisor for connection pooling.

### Batch Size
Adjust sync batch size in `.env`:
```bash
SYNC_BATCH_SIZE=200  # Increase for faster sync (uses more memory)
```

### Indexes
All necessary indexes are defined in `prisma/schema.prisma` and created automatically.

## Security Notes

1. **Never commit `.env` file** - It contains sensitive credentials
2. **Use strong passwords** - For Supabase database
3. **Rotate credentials** - Periodically update passwords
4. **Limit API access** - Use authentication middleware
5. **Enable RLS** - In Supabase for row-level security (optional)

## Support Resources

- **Supabase Docs**: https://supabase.com/docs
- **Prisma Docs**: https://prisma.io/docs
- **Node-cron**: https://www.npmjs.com/package/node-cron

## Next Steps

1. ✅ Setup Supabase project
2. ✅ Configure environment variables
3. ✅ Run database migrations
4. ✅ Test manual sync
5. ✅ Verify data in Prisma Studio
6. 🔄 Let automatic sync run overnight
7. 📊 Monitor logs and performance

---

**Last Updated**: November 2025  
**Compatible with**: Node.js 18+, Prisma 6+

