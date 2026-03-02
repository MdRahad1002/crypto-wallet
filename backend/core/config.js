const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto-wallet',
  encryptionMasterKeyPresent: Boolean(process.env.ENCRYPTION_MASTER_KEY)
};

module.exports = config;
