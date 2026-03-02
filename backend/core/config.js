const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  // Supabase Configuration
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET,
  // PostgreSQL Connection (via Supabase)
  postgresHost: process.env.POSTGRES_HOST,
  postgresUser: process.env.POSTGRES_USER,
  postgresPassword: process.env.POSTGRES_PASSWORD,
  postgresDatabase: process.env.POSTGRES_DATABASE,
  postgresUrl: process.env.POSTGRES_URL,
  postgresUrlNonPooling: process.env.POSTGRES_URL_NON_POOLING,
  postgresPrismaUrl: process.env.POSTGRES_PRISMA_URL,
  // Legacy MongoDB support (for backwards compatibility)
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto-wallet',
  // Security
  encryptionMasterKeyPresent: Boolean(process.env.ENCRYPTION_MASTER_KEY)
};

module.exports = config;
