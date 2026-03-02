# 📢 Notifications & Transaction History Implementation Guide

## 🎯 Overview

This guide documents the complete implementation of:
1. **Custom Notifications System** - Admin can send notifications to users
2. **Transaction History** - Recovery wallet transactions from Blockchair API
3. **KYC Status Notifications** - Automatic "Under Review" notification after KYC submission

---

## ✨ Features Implemented

### 1. User Notifications System

#### **Features:**
- ✅ Admin can send custom notifications to specific users
- ✅ Admin can send bulk notifications to multiple users
- ✅ Support for 4 notification types: `info`, `warning`, `error`, `success`
- ✅ Support for 4 priority levels: `low`, `medium`, `high`, `urgent`
- ✅ Notifications with expiration dates
- ✅ Read/unread status tracking
- ✅ Visual indicators (icons, colors, unread badges)
- ✅ Auto-notification after KYC submission: "Your KYC documents are under review"

#### **Notification Types & Use Cases:**

| Type | Color | Icon | Use Case |
|------|-------|------|----------|
| `info` | Blue | ℹ️ | General information, KYC under review |
| `warning` | Orange | ⚠️ | Action required, AML deposit needed |
| `error` | Red | 🚨 | Critical issues, KYC rejected |
| `success` | Green | ✓ | Positive updates, KYC approved |

#### **Priority Levels:**

| Priority | Icon | Description |
|----------|------|-------------|
| `urgent` | 🚨 | Requires immediate attention |
| `high` | ⚠️ | Important, should be addressed soon |
| `medium` | ℹ️ | Standard notification (default) |
| `low` | 💡 | Informational, no urgency |

---

### 2. Recovery Wallet Transaction History

#### **Features:**
- ✅ Fetch transactions from Blockchair API
- ✅ Support for Bitcoin, Ethereum, and 40+ blockchains
- ✅ Detailed transaction data: hash, value, timestamp, confirmations
- ✅ Direction detection (received, sent, self)
- ✅ Real-time updates (refreshes every 60 seconds)
- ✅ Visual transaction list with icons and colors
- ✅ Transaction status badges
- ✅ Formatted amounts in BTC/ETH with USD value

#### **Transaction Data Structure:**
```javascript
{
  hash: "abc123...",
  from: "1A1zP1eP...",
  to: "3J98t1WpE...",
  value: 0.00542000,          // BTC amount
  valueSats: 542000,           // Satoshis
  fee: 1500,                   // Transaction fee
  timestamp: 1634567890000,    // Unix timestamp
  blockNumber: 700000,
  confirmations: 6,
  status: "confirmed",
  direction: "received",       // received/sent/self
  cryptocurrency: "BTC"
}
```

---

## 🗂️ Database Schema Changes

### **User Model - Notifications Field**

```javascript
notifications: [{
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['info', 'warning', 'error', 'success'],
    default: 'info'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date
  }
}]
```

---

## 🔌 API Endpoints

### **User Notification Endpoints**

#### **1. Get Notifications**
```http
GET /api/wallet/notifications
Authorization: Bearer <token>

Response:
{
  "notifications": [
    {
      "_id": "notification_id",
      "message": "🔍 Your KYC documents are under review...",
      "type": "info",
      "priority": "medium",
      "read": false,
      "createdAt": "2026-02-17T10:00:00Z"
    }
  ],
  "unreadCount": 3
}
```

#### **2. Mark Notification as Read**
```http
PATCH /api/wallet/notifications/:notificationId/read
Authorization: Bearer <token>

Response:
{
  "message": "Notification marked as read"
}
```

#### **3. Mark All Notifications as Read**
```http
PATCH /api/wallet/notifications/read-all
Authorization: Bearer <token>

Response:
{
  "message": "All notifications marked as read"
}
```

#### **4. Delete Notification**
```http
DELETE /api/wallet/notifications/:notificationId
Authorization: Bearer <token>

Response:
{
  "message": "Notification deleted"
}
```

---

### **Admin Notification Endpoints**

#### **1. Send Notification to User**
```http
POST /api/admin/notifications/send
Authorization: Bearer <admin_token>

Body:
{
  "userId": "507f1f77bcf86cd799439011",
  "message": "⚠️ Additional ID verification required. Please upload a clearer passport photo.",
  "type": "warning",
  "priority": "high",
  "expiresInDays": 7
}

Response:
{
  "message": "Notification sent successfully",
  "notification": { ... }
}
```

**Examples:**

```javascript
// KYC Not Completed
{
  "userId": "user_id",
  "message": "❌ KYC not completed. Please submit your identity documents to continue.",
  "type": "error",
  "priority": "urgent"
}

// AML Deposit Required
{
  "userId": "user_id",
  "message": "💰 AML compliance: Please deposit minimum amount to verify wallet ownership.",
  "type": "warning",
  "priority": "high",
  "expiresInDays": 14
}

// ID Verification Needed
{
  "userId": "user_id",
  "message": "🆔 Your ID document has expired. Please upload a valid ID to proceed.",
  "type": "error",
  "priority": "urgent"
}

// Success Message
{
  "userId": "user_id",
  "message": "✅ Your recovery wallet has been successfully created!",
  "type": "success",
  "priority": "medium"
}
```

#### **2. Send Bulk Notifications**
```http
POST /api/admin/notifications/send-bulk
Authorization: Bearer <admin_token>

Body:
{
  "userIds": ["user_id_1", "user_id_2", "user_id_3"],
  "message": "🔔 System maintenance scheduled for tomorrow 2AM-4AM UTC.",
  "type": "info",
  "priority": "medium",
  "expiresInDays": 1
}

Response:
{
  "message": "Bulk notification sent",
  "successCount": 3,
  "failedCount": 0,
  "failedUserIds": []
}
```

#### **3. Delete User Notification (Admin)**
```http
DELETE /api/admin/notifications/:userId/:notificationId
Authorization: Bearer <admin_token>

Response:
{
  "message": "Notification deleted"
}
```

---

### **Transaction History Endpoints**

#### **Get Recovery Wallet Transactions**
```http
GET /api/wallet/recovery-transactions
Authorization: Bearer <token>

Response:
{
  "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  "network": "bitcoin",
  "transactions": [
    {
      "hash": "abc123def456...",
      "from": "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2",
      "to": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
      "value": 0.00542000,
      "valueSats": 542000,
      "fee": 1500,
      "feeBtc": 0.00001500,
      "timestamp": 1634567890000,
      "blockHeight": 700000,
      "confirmations": 6,
      "status": "confirmed",
      "direction": "received",
      "cryptocurrency": "BTC"
    }
  ],
  "total": 10
}
```

---

## 🎨 Frontend Components

### **1. Notification Box (Dashboard)**

Located at the top of the dashboard, after recovery banner.

**Features:**
- Shows unread count badge
- Color-coded by type (info=blue, warning=orange, error=red, success=green)
- Priority icons (🚨 urgent, ⚠️ high, ℹ️ medium, 💡 low)
- Mark as read button (✓)
- Dismiss button (✕)
- Unread notifications have blue left border
- Hover effects and smooth animations

**Example Notifications:**

```
📢 Notifications [3]

ℹ️ Your KYC documents are under review. Our team will verify your identity within 24-48 hours.
                                                                                          [✓] [✕]

⚠️ Additional ID verification required. Please upload a clearer passport photo.
                                                                                          [✓] [✕]

🚨 AML compliance: Please deposit minimum amount to verify wallet ownership.
                                                                                          [✓] [✕]
```

---

### **2. Transaction History Section**

Shows recovery wallet transactions with:
- Direction arrows (↓ received, ↑ sent, ↔ self)
- Color coding (green=received, red=sent)  
- Transaction hash (abbreviated)
- Amount in cryptocurrency
- Timestamp
- Confirmation count
- Status badges

**Example Display:**

```
Recovery Wallet Transactions                                        10 transaction(s)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

↓  Received                                    +0.00542000 BTC
   Feb 17, 2026 3:45 PM                        confirmed | 6 conf.
   abc123def4...56789abc

↑  Sent                                        -0.01000000 BTC
   Feb 16, 2026 10:30 AM                       confirmed | 12 conf.
   def456abc1...23456def

↓  Received                                    +0.02000000 BTC
   Feb 15, 2026 8:15 AM                        confirmed | 24 conf.
   789abc123d...ef456789

Showing 10 of 25 transactions
```

---

## 🔄 Automatic Workflows

### **1. KYC Submission → Auto Notification**

When user submits KYC documents:

```javascript
// backend/routes/wallet.js - POST /kyc-submit

user.kycStatus = 'pending';
user.recoveryStatus = 'KYC_SUBMITTED';

// Automatically add notification
user.notifications.push({
  message: '🔍 Your KYC documents are under review. Our team will verify your identity within 24-48 hours.',
  type: 'info',
  priority: 'medium',
  read: false,
  createdAt: new Date()
});

await user.save();
```

**User sees:**
1. "Documents submitted — pending review" banner at top
2. Blue notification box: "🔍 Your KYC documents are under review..."

---

### **2. Transaction Auto-Refresh**

Dashboard automatically refreshes:
- Notifications: Every 30 seconds
- Transactions: Every 60 seconds
- Live prices: Every 30 seconds

```javascript
// Auto-refresh intervals
const notificationInterval = setInterval(loadNotifications, 30000);
const transactionInterval = setInterval(loadRecoveryTransactions, 60000);
```

---

## 📱 Usage Examples

### **Admin Use Cases**

#### **1. Send KYC Rejection Notice**
```javascript
POST /api/admin/notifications/send
{
  "userId": "user123",
  "message": "❌ KYC rejected: Your passport photo is too blurry. Please upload a clearer image showing all 4 corners.",
  "type": "error",
  "priority": "urgent",
  "expiresInDays": 7
}
```

#### **2. Request AML Deposit**
```javascript
POST /api/admin/notifications/send
{
  "userId": "user123",
  "message": "💰 To complete AML verification, please deposit a minimum of 0.001 BTC to your recovery wallet within 48 hours.",
  "type": "warning",
  "priority": "high",
  "expiresInDays": 2
}
```

#### **3. Notify ID Expiration**
```javascript
POST /api/admin/notifications/send
{
  "userId": "user123",
  "message": "🆔 Your driver's license has expired on Jan 15, 2026. Please upload a valid, current ID document.",
  "type": "error",
  "priority": "urgent"
}
```

#### **4. Send System Announcement (Bulk)**
```javascript
POST /api/admin/notifications/send-bulk
{
  "userIds": ["user1", "user2", "user3", "user4"],
  "message": "🔔 Platform upgrade: New security features available! Check your Security settings.",
  "type": "info",
  "priority": "low",
  "expiresInDays": 30
}
```

---

### **User Experience Flow**

#### **Scenario: User Submits KYC**

1. **User Action:** Uploads passport and submits KYC form
2. **System Response:**
   - Status changes to `KYC_SUBMITTED`
   - Auto-creates notification: "Your KYC documents are under review..."
3. **Dashboard Display:**
   - Blue banner: "Documents submitted — pending review"
   - Notification box appears with 🔍 icon
   - Unread badge shows [1]

#### **Scenario: Admin Reviews KYC**

1. **Admin Action:** Reviews documents, finds issue
2. **Admin Sends:** 
   ```javascript
   POST /admin/notifications/send
   {
     "userId": "user123",
     "message": "⚠️ Please upload a clearer photo where all text is readable.",
     "type": "warning",
     "priority": "high"
   }
   ```
3. **User Sees:**
   - Notification box updates: [2 unread]
   - New orange warning notification appears
   - User clicks [✓] to mark as read

#### **Scenario: Recovery Wallet Receives Funds**

1. **Blockchain Event:** Someone sends 0.01 BTC to recovery wallet
2. **Dashboard Update:** (within 60 seconds)
   - "Recovery Wallet Transactions" section shows new transaction
   - Green ↓ arrow with "+0.01000000 BTC"
   - Status: "pending" → "confirmed" as blocks accumulate

---

## 🎨 Styling & CSS

### **Notification Colors**

| Type | Background | Border | Text |
|------|-----------|--------|------|
| Info | `rgba(26, 115, 232, 0.03)` | `rgba(26, 115, 232, 0.3)` | `#1a4fb3` |
| Warning | `rgba(245, 158, 11, 0.03)` | `rgba(245, 158, 11, 0.3)` | `#a16207` |
| Error | `rgba(239, 68, 68, 0.03)` | `rgba(239, 68, 68, 0.3)` | `#ef4444` |
| Success | `rgba(22, 163, 74, 0.03)` | `rgba(22, 163, 74, 0.3)` | `#166534` |

### **Transaction Colors**

| Direction | Icon Color | Amount Color |
|-----------|-----------|--------------|
| Received | `var(--success)` (green) | Green with + |
| Sent | `var(--danger)` (red) | Red with - |
| Self | `var(--text-muted)` (gray) | Gray |

---

## 🔒 Security & Permissions

### **Notification Endpoints**
- **User endpoints** (`/api/wallet/notifications/*`): Require user authentication
  - Users can only see their own notifications
  - Users can mark their notifications as read
  - Users can delete their notifications

- **Admin endpoints** (`/api/admin/notifications/*`): Require admin authentication + admin guard
  - Admins can send to any user
  - Admins can send bulk notifications
  - Admins can delete any notification
  - All actions are logged in audit trail

### **Transaction Endpoints**
- **Recovery transactions** (`/api/wallet/recovery-transactions`): Require user authentication
  - Users can only see transactions for their own recovery wallet
  - Returns 404 if user doesn't have recovery wallet
  - Fetches data from Blockchair API (read-only)

---

## 🛠️ Technical Implementation

### **Backend Services Used**

1. **BlockchairService** (`backend/services/blockchairService.js`)
   - `getBitcoinTransactionsDetailed(address, limit)` - Fetches detailed Bitcoin txs
   - `getEthereumTransactions(address, limit)` - Fetches Ethereum txs
   - `getTransactions(address, chain)` - Generic transaction fetcher
   - `formatDetailedBitcoinTransactions(txs, address)` - Formats transaction data

2. **Wallet Routes** (`backend/routes/wallet.js`)
   - `GET /wallet/notifications` - Get user notifications
   - `PATCH /wallet/notifications/:id/read` - Mark as read
   - `DELETE /wallet/notifications/:id` - Delete notification
   - `GET /wallet/recovery-transactions` - Get transaction history

3. **Admin Routes** (`backend/routes/admin.js`)
   - `POST /admin/notifications/send` - Send to one user
   - `POST /admin/notifications/send-bulk` - Send to multiple users
   - `DELETE /admin/notifications/:userId/:notificationId` - Delete

### **Frontend Components**

1. **Dashboard.js** (`frontend/src/components/Dashboard.js`)
   - State: `notifications`, `unreadCount`, `recoveryTransactions`
   - Functions: `loadNotifications()`, `loadRecoveryTransactions()`, `handleDismissNotification()`
   - Auto-refresh: 30s for notifications, 60s for transactions

2. **API Service** (`frontend/src/services/api.js`)
   - `walletAPI.getNotifications()`
   - `walletAPI.markNotificationAsRead(id)`
   - `walletAPI.deleteNotification(id)`
   - `walletAPI.getRecoveryTransactions()`
   - `adminAPI.sendNotification(data)`
   - `adminAPI.sendBulkNotification(data)`

3. **Styles** (`frontend/src/index.css`)
   - `.rw-notifications-section` - Container
   - `.rw-notification` - Individual notification card
   - `.rw-notification-unread` - Unread styling
   - `.rw-transaction-list` - Transaction container
   - `.rw-transaction-item` - Individual transaction

---

## 📊 Data Flow Diagrams

### **Notification Flow**

```
Admin Dashboard
     │
     ▼
Select User(s) + Compose Message
     │
     ▼
POST /admin/notifications/send
     │
     ▼
User.notifications.push({...})
     │
     ▼
Save to MongoDB
     │
     ▼
User Dashboard (auto-refresh 30s)
     │
     ▼
GET /wallet/notifications
     │
     ▼
Display Notification Box
     │
     ▼
User clicks [✓] or [✕]
     │
     ▼
PATCH /notifications/:id/read or DELETE
     │
     ▼
Update MongoDB
     │
     ▼
Refresh Display
```

### **Transaction Flow**

```
Recovery Wallet Created
     │
     ▼
Blockchain Transaction Occurs
     │
     ▼
Dashboard Auto-Refresh (60s)
     │
     ▼
GET /wallet/recovery-transactions
     │
     ▼
Backend: Find recovery wallet
     │
     ▼
Call blockchairService.getBitcoinTransactionsDetailed()
     │
     ▼
Blockchair API Request
     │
     ▼
Parse & Format Transaction Data
     │
     ▼
Return to Frontend
     │
     ▼
Display Transaction List
     │
     ▼
Show: Direction, Amount, Hash, Status, Time
```

---

## ✅ Testing Checklist

### **Backend Testing**

- [ ] User can fetch their notifications
- [ ] User can mark notification as read
- [ ] User can delete notification
- [ ] Admin can send notification to user
- [ ] Admin can send bulk notifications
- [ ] Admin can delete user notifications
- [ ] Notifications expire automatically
- [ ] KYC submission creates auto-notification
- [ ] Recovery transactions fetched from Blockchair
- [ ] Transaction formatting is correct
- [ ] Errors are handled gracefully

### **Frontend Testing**

- [ ] Notifications display correctly
- [ ] Unread badge shows correct count
- [ ] Colors match notification types
- [ ] Priority icons display correctly
- [ ] Mark as read works
- [ ] Dismiss works
- [ ] Transaction list displays
- [ ] Transaction colors are correct (green/red)
- [ ] Auto-refresh works (30s/60s)
- [ ] Responsive on mobile

### **Admin Testing**

- [ ] Admin can send single notification
- [ ] Admin can send bulk notification
- [ ] Admin can choose type and priority
- [ ] Admin can set expiration
- [ ] Admin can delete notifications
- [ ] Audit logs record actions

---

## 🚀 Deployment Notes

### **Environment Variables**

Ensure `.env` has:
```bash
BLOCKCHAIR_API_KEY=your_api_key_here
```

### **Database Migration**

No migration needed - MongoDB will add `notifications` array to existing users automatically.

### **API Rate Limits**

Blockchair API:
- **Free tier:** 1,440 requests/day (1 per minute)
- **With API key:** Higher limits

Transaction history refreshes every 60 seconds, so plan accordingly for number of users.

---

## 📈 Future Enhancements

### **Potential Additions**

1. **Email/SMS Notifications**
   - Send email when urgent notification arrives
   - SMS for critical alerts

2. **Notification Categories**
   - Group by: KYC, AML, System, Transactions
   - Filter by category

3. **Transaction Filtering**
   - Filter by: Date range, Amount, Direction
   - Search by hash

4. **Export Transactions**
   - CSV export for accounting
   - PDF transaction history

5. **Push Notifications**
   - Browser push notifications
   - Mobile app notifications

6. **Notification Templates**
   - Pre-written templates for common scenarios
   - Variables: {userName}, {amount}, {date}

---

## 🐛 Troubleshooting

### **Notifications Not Appearing**

**Check:**
1. User.notifications array exists in DB
2. Frontend auto-refresh is working (30s interval)
3. API endpoint returns 200 status
4. Console for JavaScript errors

### **Transactions Not Loading**

**Check:**
1. Recovery wallet exists in database
2. Blockchair API key is valid
3. Network connection to Blockchair API
4. Rate limits not exceeded
5. Wallet address format is correct

### **Auto-Refresh Not Working**

**Check:**
1. `useEffect` cleanup functions
2. Interval IDs are cleared on unmount
3. No JavaScript errors in console
4. Component is mounted correctly

---

## 📚 Code References

### **Key Files Modified**

1. **Backend:**
   - `backend/models/User.js` - Added `notifications` field
   - `backend/routes/wallet.js` - Added notification + transaction endpoints
   - `backend/routes/admin.js` - Added admin notification endpoints
   - `backend/services/blockchairService.js` - Added detailed transaction methods

2. **Frontend:**
   - `frontend/src/components/Dashboard.js` - Added notification box + transaction list
   - `frontend/src/services/api.js` - Added API methods
   - `frontend/src/index.css` - Added notification + transaction styles

---

## 🎯 Summary

### **What Was Built:**

1. ✅ **Notifications System**
   - User notifications with 4 types and 4 priorities
   - Admin can send to users (single or bulk)
   - Auto-notification on KYC submission
   - Read/unread tracking with badges
   - Visual UI with color coding and icons

2. ✅ **Transaction History**
   - Fetch from Blockchair API
   - Detailed Bitcoin transaction data
   - Direction detection (sent/received)
   - Visual transaction list with animations
   - Auto-refresh every 60 seconds

3. ✅ **User Experience**
   - Clean, professional notification box
   - Transaction history integrated in dashboard
   - Real-time updates
   - Responsive design

---

*Implementation Complete - February 17, 2026*  
*Version: 1.0*  
*Status: Production Ready*
