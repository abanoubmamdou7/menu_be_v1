# Menu App Backend

## Overview

This backend application syncs menu data from an **MSSQL ERP database** to a **Supabase (PostgreSQL) database** and provides APIs for menu management.

## Architecture

- **Source Database**: MSSQL (SQL Server) - ERP system with menu data
- **Target Database**: Supabase (PostgreSQL) - Menu storage and API
- **ORM**: Prisma
- **Framework**: Express.js
- **Sync Schedule**: Daily at 2:00 AM (configurable)

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env` file with your Supabase connection string:
```bash
DATABASE_URL="postgresql://your-supabase-connection-string"
SQLSERVER_HOST=your-mssql-host
# See MIGRATION_GUIDE.md for all variables
```

### 3. Setup Database
```bash
# Generate Prisma Client
npx prisma generate

# Push schema to Supabase
npx prisma db push
```

### 4. Run the Server
```bash
npm start
# or for development
npm run dev
```

## Features

- ✅ **Automated Sync**: Daily synchronization from ERP to Supabase
- ✅ **Menu Categories**: Hierarchical category management
- ✅ **Menu Items**: Full item details with pricing, images, and attributes
- ✅ **Multi-language**: Arabic and English support
- ✅ **Dietary Tags**: Fasting, vegetarian, healthy choice, signature dish, spicy
- ✅ **Branch Support**: Multi-branch menu management

## Documentation

See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for detailed setup and migration information from MySQL to Supabase.

## API Endpoints

- `GET /` - Health check
- `POST /api/query` - Execute database queries
- See `src/modules/app.router.js` for all available routes

## Tech Stack

- Node.js / Express
- Prisma ORM
- Supabase (PostgreSQL)
- MSSQL (SQL Server)
- node-cron for scheduling

## Migration from MySQL

This project has been migrated from MySQL to Supabase (PostgreSQL). The sync functionality remains the same - it continues to fetch data from the MSSQL ERP database and sync it to the new Supabase database. See `MIGRATION_GUIDE.md` for details.
# menu_backend
# menu_backend
# menu_backend
# menu_be_v1
