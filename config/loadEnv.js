import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try multiple possible locations for .env file
const possibleEnvPaths = [
    path.join(__dirname, '.env'),           // BackEnd/config/.env
    path.join(__dirname, '../.env'),        // BackEnd/.env
    path.join(__dirname, '../../.env'),     // Root .env
    path.join(process.cwd(), '.env'),       // Current working directory
    '/config/.env'                          // Docker container path
];

let envLoaded = false;
const loadedEnvFiles = [];
const seenPaths = new Set();

// Try to load .env from different locations
possibleEnvPaths.forEach((envPath, index) => {
    const resolvedPath = path.isAbsolute(envPath) ? envPath : path.resolve(envPath);

    if (seenPaths.has(resolvedPath)) {
        return;
    }

    seenPaths.add(resolvedPath);

    if (!fs.existsSync(resolvedPath)) {
        return;
    }

    const result = dotenv.config({
        path: resolvedPath,
        override: index !== 0
    });

    if (!result.error) {
        envLoaded = true;
        loadedEnvFiles.push({ path: resolvedPath, override: index !== 0 });
    }
});

if (loadedEnvFiles.length === 1) {
    console.log(`✅ Loaded environment from ${loadedEnvFiles[0].path}`);
} else if (loadedEnvFiles.length > 1) {
    const mergeInfo = loadedEnvFiles
        .map(({ path: filePath, override }) => `${filePath}${override ? ' (override enabled)' : ''}`)
        .join(' -> ');
    console.log(`✅ Merged environment variables from: ${mergeInfo}`);
}

// If no .env file was found, try to use environment variables from Docker
if (!envLoaded) {
    console.log('⚠️ No .env file found, using environment variables from Docker');
}

// Validate required environment variables
const requiredEnvVars = [ 
    // 'SIGNATURE',
    // 'PASSWORD_HMAC_SECRET',
];


const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
    console.error('Missing required environment variables:', missingEnvVars.join(', '));
    process.exit(1);
}

export default {
    loadEnv: () => {
        // The environment is already loaded above
        return process.env;
    }
};


