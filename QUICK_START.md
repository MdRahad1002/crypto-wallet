# 🚀 Crypto Wallet Platform - Quick Start Guide

## ✅ System Status

Your crypto wallet platform is now configured and ready to use!

### Services Running:
- **Backend API**: http://localhost:5000
- **Frontend App**: http://localhost:3000
- **MongoDB**: Running locally

---

## 🎯 Quick Start

### Option 1: Using the Start Script (Recommended)
Simply double-click or run:
```bash
start.bat
```

This will automatically:
1. Start MongoDB (if not running)
2. Start the backend server on port 5000
3. Start the frontend development server on port 3000
4. Open your browser to http://localhost:3000

### Option 2: Manual Start

#### Start Backend:
```bash
cd crypto-wallet-platform
node backend/server.js
```

#### Start Frontend (in a new terminal):
```bash
cd crypto-wallet-platform/frontend
npm start
```

---

## 🎨 New BlueWallet-Inspired Interface

Your platform now features a modern, dark-themed UI inspired by BlueWallet:

### Key Features:
- ✨ **Dark Theme** - Professional iOS-style dark mode
- 🎯 **Clean Dashboard** - Intuitive wallet management
- 💳 **Gradient Wallet Cards** - Beautiful network-specific gradients
- 🔐 **Secure Authentication** - Modern login/register flows
- ⚡ **Live Crypto Prices** - Real-time market data
- 📊 **Transaction History** - Clear transaction tracking
- 🚀 **Smooth Animations** - Professional UI transitions

### Color Scheme:
- Primary Blue: #0A84FF
- Dark Background: #1C1C1E
- Card Background: #2C2C2E
- Success Green: #30D158
- Warning Yellow: #FFD60A
- Danger Red: #FF453A

---

## 📱 Using the Platform

### 1. Register/Login
- Navigate to http://localhost:3000
- Create a new account or login
- Your credentials are securely stored with JWT authentication

### 2. Create a Wallet
- Click "Create Wallet" button
- Choose your blockchain network:
  - Ethereum (ETH)
  - Polygon (MATIC)
  - Binance Smart Chain (BNB)
- Set an encryption password
- **IMPORTANT**: Save your recovery phrase!

### 3. View Balances
- See all your wallets on the dashboard
- View native token balances
- Check live cryptocurrency prices

### 4. Send Transactions
- Click "Send" button
- Select source wallet
- Enter recipient address
- Specify amount and cryptocurrency
- Estimate gas fees
- Confirm with your password

---

## 🛠️ Configuration Files

### Backend (.env):
Located at: `crypto-wallet-platform/.env`
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/crypto-wallet
JWT_SECRET=crypto_wallet_secret_key_2026_production_change_this
ETHEREUM_RPC_URL=https://eth.llamarpc.com
POLYGON_RPC_URL=https://polygon-rpc.com
BSC_RPC_URL=https://bsc-dataseed.binance.org
```

### Frontend (.env):
Located at: `crypto-wallet-platform/frontend/.env`
```env
REACT_APP_API_URL=http://localhost:5000/api
```

---

## 🔧 Troubleshooting

### Frontend won't start:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps --force
npm start
```

### Backend connection issues:
1. Check MongoDB is running: `net start MongoDB`
2. Verify .env file exists in root directory
3. Check port 5000 is not in use

### Build errors:
```bash
cd frontend
npm run build
```
Check the output for specific error messages.

---

## 📦 Project Structure

```
crypto-wallet-platform/
├── backend/
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Balance.js
│   │   └── Transaction.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── wallet.js
│   │   ├── transactions.js
│   │   └── prices.js
│   ├── utils/
│   │   ├── walletService.js
│   │   └── encryption.js
│   └── server.js
├── frontend/
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── components/
│       │   ├── Dashboard.js
│       │   ├── BalanceCard.js
│       │   ├── TransactionList.js
│       │   ├── Login.js
│       │   ├── Register.js
│       │   ├── Navbar.js
│       │   ├── SendModal.js
│       │   ├── CreateWalletModal.js
│       │   └── LivePrices.js
│       ├── services/
│       │   └── api.js
│       ├── App.js
│       ├── index.js
│       └── index.css
├── .env
├── start.bat
└── package.json
```

---

## 🔐 Security Notes

1. **Never share your recovery phrases**
2. **Change default JWT_SECRET in production**
3. **Use strong encryption passwords**
4. **Keep your .env file secure**
5. **Never commit .env to version control**

---

## 🚀 Production Deployment

### Build Frontend:
```bash
cd frontend
npm run build
```

### Deploy Backend:
- Use environment variables for sensitive data
- Enable HTTPS
- Configure proper CORS settings
- Use production-grade MongoDB (MongoDB Atlas)
- Implement rate limiting

---

## 📚 API Endpoints

### Authentication:
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Wallet:
- `POST /api/wallet/create` - Create new wallet
- `GET /api/wallet/list` - List all wallets
- `GET /api/wallet/balance` - Get wallet balances

### Transactions:
- `POST /api/transactions/send` - Send cryptocurrency
- `GET /api/transactions/history` - Get transaction history
- `POST /api/transactions/estimate-gas` - Estimate gas fees

### Prices:
- `GET /api/prices/live` - Get live cryptocurrency prices

---

## 💡 Support

For issues or questions:
1. Check MongoDB is running
2. Verify all dependencies are installed
3. Check console for error messages
4. Review .env configuration

---

## 🎉 Enjoy Your Crypto Wallet Platform!

Your platform is ready to use with a beautiful, modern interface inspired by BlueWallet. Start by creating an account and your first wallet!

**Access your application at: http://localhost:3000**
