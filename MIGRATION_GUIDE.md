# Migration Guide: MySQL to Supabase (PostgreSQL)

This guide explains how the backend has been migrated from MySQL to Supabase (PostgreSQL) and what you need to do to set it up.

## Overview

The backend now uses **Supabase (PostgreSQL)** instead of MySQL for storing menu data, while still syncing data from the **MSSQL ERP database**.

### Architecture

```
┌─────────────────────┐
│  MSSQL ERP Database │  (Source: Menu data from ERP)
│   (SQL Server)      │
└──────────┬──────────┘
           │
           │ Sync via cron job (daily at 2 AM)
           │
           ▼
┌─────────────────────┐
│  Backend API        │
│  (Node.js/Express)  │
└──────────┬──────────┘
           │
           │ Prisma ORM
           │
           ▼
┌─────────────────────┐
│  Supabase Database  │  (Target: PostgreSQL)
│   (PostgreSQL)      │
└─────────────────────┘
```

## What Changed?

### 1. Database Provider
- **Before**: MySQL with raw SQL queries
- **After**: Supabase (PostgreSQL) with Prisma ORM

### 2. Database Connection
- **Before**: MySQL connection pool (`mysql2` package)
- **After**: Prisma Client with Supabase connection string

### 3. Query Methods
- **Before**: Raw SQL with `INSERT ... ON DUPLICATE KEY UPDATE`
- **After**: Prisma's `upsert()` method for insert/update operations

### 4. Files Modified
- `prisma/schema.prisma` - Changed provider from `mysql` to `postgresql`
- `src/modules/query/controller/query.controller.js` - Now uses Prisma instead of MySQL
- `src/modules/menu/itemTransferService.js` - Uses Prisma upsert operations
- `index.js` - Removed MySQL connection, kept MSSQL for ERP queries

## Setup Instructions

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the database to be provisioned
3. Go to **Project Settings** → **Database**
4. Copy the **Connection String** (under "Connection string" tab)
5. Choose "URI" format and copy it

### Step 2: Configure Environment Variables

Create a `.env` file in the `BackEnd` directory with the following:

```bash
# Supabase Database URL (PostgreSQL)
DATABASE_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres"

# Server Configuration
PORT=3000
HOST=localhost

# MSSQL Configuration (ERP Source Database)
SQLSERVER_HOST=your-sqlserver-host
SQLSERVER_PORT=1433
SQLSERVER_USER=your-username
SQLSERVER_PASSWORD_ENCRYPTED=your-encrypted-password
MASTER_DB_NAME=your-master-db-name
ENCRYPTION_KEY=your-encryption-key

# Sync Configuration
SYNC_BATCH_SIZE=100
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Generate Prisma Client

```bash
npx prisma generate
```

### Step 5: Run Database Migrations

Push the Prisma schema to your Supabase database:

```bash
npx prisma db push
```

This will create all the necessary tables in your Supabase database.

### Step 6: (Optional) Seed Initial Data

If you have a seed file:

```bash
npm run seed
```

### Step 7: Start the Server

```bash
npm start
# or for development
npm run dev
```

## How Data Syncing Works

### Daily Sync Schedule
- **When**: Daily at 2:00 AM
- **What**: Syncs menu items and categories from MSSQL ERP to Supabase
- **File**: `src/modules/menu/itemSyncScheduler.js`

### Manual Sync
You can trigger a manual sync by calling the sync endpoint (if exposed) or running:

```javascript
import ItemTransferService from './src/modules/menu/itemTransferService.js';
await ItemTransferService.transferAllItems('YOUR_BRANCH_CODE');
```

### Sync Process

1. **Fetch from ERP** (MSSQL)
   - Queries `INV_ITEM_MAIN_GROUP` for menu categories
   - Queries `INV_ITEM_MASTER` for menu items
   - Fetches pricing from `POS_ITEM_SALES_PRICE`

2. **Transform Data**
   - Normalizes data structure
   - Handles hierarchical categories
   - Converts boolean values

3. **Upsert to Supabase**
   - Uses Prisma's `upsert()` for each record
   - Creates new records or updates existing ones
   - Maintains data integrity with foreign keys

## Database Schema

### Main Tables

#### `item_main_group` (Menu Categories)
- `itm_group_code` - Unique category code
- `itm_group_name` - Category name
- `order_group` - Display order
- `show_in_website` - Visibility flag
- `nested_level` - Hierarchy level
- `parent_group_code` - Parent category
- Descriptions and names in Arabic/English

#### `item_master` (Menu Items)
- `itm_code` - Unique item code
- `itm_name` - Item name
- `itm_group_code` - Category reference
- `sales_price` - Item price
- `photo_url` - Image data
- `show_in_website` - Visibility flag
- Dietary tags: fasting, vegetarian, healthy_choice, signature_dish, spicy
- Descriptions in Arabic/English

## Troubleshooting

### Connection Issues

**Error**: `Can't reach database server`
- Check your `DATABASE_URL` is correct
- Ensure your IP is allowlisted in Supabase (by default, it allows all)
- Verify Supabase project is running

**Error**: `Authentication failed`
- Check your password in the connection string
- Ensure special characters in password are URL-encoded

### Migration Issues

**Error**: `Table already exists`
- If tables already exist, use `npx prisma db pull` to introspect existing schema
- Or use `npx prisma migrate dev` for proper migrations

### Sync Issues

**Error**: `ERP query failed`
- Check MSSQL connection settings
- Verify the ERP database is accessible
- Check encrypted password and encryption key

**Error**: `Prisma upsert failed`
- Check data types match schema
- Verify foreign key constraints (e.g., category exists for items)
- Check for null values in required fields

## Prisma Studio

To view and manage your Supabase data visually:

```bash
npx prisma studio
```

This opens a browser interface at `http://localhost:5555` to browse and edit records.

## Backup and Restore

### Backup Supabase Data

```bash
# Using pg_dump (requires PostgreSQL client)
pg_dump "postgresql://postgres.[REF]:[PASSWORD]@[HOST]:5432/postgres" > backup.sql
```

### Restore to Supabase

```bash
psql "postgresql://postgres.[REF]:[PASSWORD]@[HOST]:5432/postgres" < backup.sql
```

## Performance Considerations

### Batch Size
- Default: 100 items per batch
- Adjust `SYNC_BATCH_SIZE` in `.env` for optimization
- Larger batches = faster sync but more memory usage

### Upsert Operations
- Prisma upserts run in parallel using `Promise.all()`
- This is efficient but may hit connection pool limits
- Monitor Supabase connection usage in dashboard

### Indexing
- Prisma schema includes indexes on frequently queried fields
- Additional indexes can be added if needed for performance

## Support

For issues related to:
- **Supabase**: [supabase.com/docs](https://supabase.com/docs)
- **Prisma**: [prisma.io/docs](https://prisma.io/docs)
- **This Project**: Contact your development team

---

**Migration Date**: November 2025
**Version**: 2.0.0

