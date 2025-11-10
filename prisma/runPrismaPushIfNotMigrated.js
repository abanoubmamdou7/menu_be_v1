import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

export async function runPrismaPushIfNotMigrated(databaseName) {
  const migrationFlagFile = path.resolve(`./.migrated_${databaseName}`);

  if (fs.existsSync(migrationFlagFile)) {
    console.log(`✅ Migration already applied for ${databaseName}`);
    return;
  }

  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const host = process.env.DB_HOST;
const connectionString = `mysql://${user}:${password}@${host}:${process.env.DB_PORT || 3306}/${databaseName}`;


  console.log(`🚀 Running Prisma migration for ${databaseName}...`);
  await new Promise((resolve, reject) => {
  
    exec(
      `npx prisma db push --accept-data-loss --schema=./prisma/schema.prisma`,
      {
        env: {
          ...process.env,
          DATABASE_URL: connectionString,
        },
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error('❌ Migration failed:', stderr);
          return reject(error);
        }
        console.log('✅ Migration success:\n', stdout);
        fs.writeFileSync(migrationFlagFile, 'migrated');
        resolve();
      }
    );
    
  });
}
