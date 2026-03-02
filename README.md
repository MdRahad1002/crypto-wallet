# Crypto Wallet Platform 🔐

A secure, full-stack cryptocurrency wallet platform with blockchain integration, live price tracking, and transaction management.

## Features

### 🔒 Security
- AES-256-GCM encryption for private keys
- Password-protected wallet operations
- JWT authentication
- Secure key storage with PBKDF2

### 💰 Wallet Management
- Create new HD wallets
- Import existing wallets
- Multi-network support (Ethereum, Polygon, BSC)
- View balances across all wallets
- Recovery phrase backup

### 📊 Dashboard
- Real-time balance overview
- Live cryptocurrency prices (via CoinGecko)
- Transaction history
- Multi-wallet management
- Network selection

### 💸 Transactions
- Send cryptocurrency
- Deposit tracking
- Withdraw functionality
- Gas fee estimation
- Transaction status monitoring
- Transaction history with filtering

### 📈 Live Prices
- Real-time crypto prices
- 24h price changes
- Market cap information
- Support for major cryptocurrencies

## Tech Stack

### Backend
- **Node.js** with Express
- **MongoDB** for data storage
- **Ethers.js** for blockchain interaction
- **JWT** for authentication
- **bcryptjs** for password hashing
- **Crypto** for encryption

### Frontend
- **React 18** with Hooks
- **React Router** for navigation
- **Axios** for API calls
- **Recharts** for data visualization
- Modern CSS with responsive design

### Blockchain
- **Ethereum** network support
- **Polygon** network support
- **Binance Smart Chain** support
- **Web3** integration
- Smart contract interaction ready

## Installation

### Prerequisites
- Node.js v16 or higher
- MongoDB v5 or higher
- NPM or Yarn

### Setup

1. **Clone or navigate to the project directory:**
```bash
cd C:\crypto-wallet-platform
```

2. **Install backend dependencies:**
```bash
npm install
```

3. **Install frontend dependencies:**
```bash
cd frontend
npm install
cd ..
```

4. **Configure environment variables:**

Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

Edit `.env` with your configurations:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/crypto-wallet
JWT_SECRET=your_secure_jwt_secret_here
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID
POLYGON_RPC_URL=https://polygon-rpc.com
BSC_RPC_URL=https://bsc-dataseed.binance.org
ENCRYPTION_KEY=your_64_character_hex_encryption_key
```

5. **Start MongoDB:**
```bash
# Windows (if installed as service)
net start MongoDB

# Or use MongoDB Compass or Docker
docker run -d -p 27017:27017 mongo
```

6. **Start the backend server:**
```bash
npm run server
```

7. **Start the frontend (in a new terminal):**
```bash
npm run client
```

8. **Or run both concurrently:**
```bash
npm run dev
```

## Persistent Data (Recommended)

To make sure users, wallets, and admin data are remembered across app restarts, run MongoDB with a persistent volume:

```bash
npm run db:up
```

This uses `docker-compose.yml` and stores data in the named volume `mongo_data`.

Then start the app:

```bash
npm start
npm run client
```

To seed demo accounts (one user + one admin):

```bash
npm run seed:demo-users
```

Optional env variables for custom credentials are available in `.env.example`.

## Usage

### Creating an Account
1. Navigate to `http://localhost:3000`
2. Click "Register" and create an account
3. Login with your credentials

### Creating a Wallet
1. Click "Create Wallet" on the dashboard
2. Select network (Ethereum, Polygon, or BSC)
3. Enter a strong password for encryption
4. **IMPORTANT:** Save your recovery phrase securely

### Sending Crypto
1. Click "Send Crypto"
2. Select source wallet
3. Enter recipient address
4. Enter amount
5. Estimate gas fee
6. Enter wallet password
7. Confirm transaction

### Viewing Balances
- Dashboard shows all wallet balances
- Live prices update every 30 seconds
- Transaction history displays recent activity

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Wallet
- `POST /api/wallet/create` - Create new wallet
- `GET /api/wallet/list` - Get all user wallets
- `GET /api/wallet/balance/:address` - Get wallet balance
- `GET /api/wallet/balances` - Get all balances
- `POST /api/wallet/import` - Import existing wallet

### Transactions
- `GET /api/transactions/history` - Get transaction history
- `POST /api/transactions/send` - Send cryptocurrency
- `POST /api/transactions/deposit` - Record deposit
- `POST /api/transactions/withdraw` - Withdraw funds
- `POST /api/transactions/estimate-gas` - Estimate gas fee
- `GET /api/transactions/:id` - Get transaction by ID

### Prices
- `GET /api/prices/live` - Get live crypto prices
- `GET /api/prices/:coinId` - Get specific coin price
- `GET /api/prices/:coinId/history` - Get historical prices
- `GET /api/prices/trending/list` - Get trending coins

## Security Best Practices

### For Development
1. Never commit `.env` files
2. Use strong encryption keys (64 character hex)
3. Change default JWT secrets
4. Use HTTPS in production
5. Enable MongoDB authentication

### For Users
1. Use strong passwords
2. Save recovery phrases offline
3. Never share private keys
4. Verify recipient addresses
5. Start with small test transactions

## Production Deployment

### Backend
1. Set `NODE_ENV=production`
2. Use production MongoDB instance
3. Enable HTTPS
4. Set up proper CORS policies
5. Use environment-specific RPC URLs
6. Implement rate limiting
7. Add request validation

### Frontend
1. Build production bundle: `npm run build`
2. Serve with Nginx or similar
3. Enable HTTPS
4. Configure proper API URL
5. Add error tracking (Sentry)

### Infrastructure
- Use managed MongoDB (Atlas)
- Deploy backend on secure server (AWS, DigitalOcean)
- Use CDN for frontend (Cloudflare, Vercel)
- Set up monitoring and alerts
- Regular backups

## Important Notes

⚠️ **WARNING**: This is a demonstration platform. For production use:
- Conduct thorough security audits
- Implement additional security measures
- Add 2FA authentication
- Use hardware wallet integration
- Add transaction signing confirmations
- Implement withdrawal limits
- Add KYC/AML compliance
- Regular security updates

## RPC URLs

Get your own RPC URLs:
- **Infura**: https://infura.io
- **Alchemy**: https://alchemy.com
- **Polygon**: https://polygon.technology
- **BSC**: Public RPC available

## Support

For issues or questions:
1. Check MongoDB is running
2. Verify .env configuration
3. Ensure Node.js version compatibility
4. Check RPC URL connectivity

## License

MIT License - See LICENSE file for details

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open pull request

## Roadmap

- [ ] Multi-signature wallets
- [ ] Hardware wallet support (Ledger, Trezor)
- [ ] Token swap integration (Uniswap, PancakeSwap)
- [ ] NFT support
- [ ] DeFi integrations
- [ ] Mobile app (React Native)
- [ ] Desktop app (Electron)
- [ ] Advanced charts and analytics
- [ ] Portfolio tracking
- [ ] Price alerts

---

Built with ❤️ for the crypto community
