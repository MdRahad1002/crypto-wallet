# 🛡️ ADMIN PANEL - SETUP & USAGE GUIDE

## ✅ Admin Panel Created

A comprehensive admin dashboard has been added to the crypto wallet platform with full user management, transaction monitoring, and analytics capabilities.

---

## 🎯 Features

### **1. Dashboard Overview**
- Total users count
- Active users (last 30 days)
- Total wallets
- Transaction statistics (Total, Pending, Completed, Failed)
- Recent users list
- Recent transactions feed

### **2. User Management**
- View all registered users
- Search users by name or email
- User details with wallets and transactions
- Promote/demote user roles (User ↔ Admin)
- Delete users (with safety checks)
- Pagination support

### **3. Transaction Monitoring**
- View all platform transactions
- Filter by status, type, and user
- Real-time transaction status
- Pagination for large datasets

### **4. System Logs**
- Last 100 system activities
- Transaction logs with user details
- Status indicators for quick review

### **5. Analytics**
- User growth charts (30 days)
- Transaction volume trends
- Popular cryptocurrencies statistics
- Customizable time periods

---

## 🚀 Setup Instructions

### **Step 1: Update Database**

The User model has been updated to include admin roles. Existing users will default to 'user' role.

### **Step 2: Create First Admin**

Use the provided script to promote a user to admin:

```bash
cd backend
node scripts/makeAdmin.js user@example.com
```

Example output:
```
✅ MongoDB connected
✅ User promoted to admin successfully!

User Details:
  Name:  John Doe
  Email: user@example.com
  Role:  admin
  Admin: Yes
```

### **Step 3: Restart Servers**

If servers are running, restart them to load the new admin routes:

```bash
# Terminal 1 - Backend
cd backend
node server.js

# Terminal 2 - Frontend
cd frontend
npm start
```

Or use the network startup script:
```bash
.\start-network.bat
```

---

## 🔐 Access Admin Panel

### **Login as Admin**
1. **Access only from localhost** for security:
   - ✅ Use: `http://localhost:3000/admin`
   - ❌ Do NOT use: `http://192.168.x.x:3000/admin` (will be blocked)
2. Login with admin credentials
3. You'll see "🛡️ Admin" link in the navbar
4. Click "Admin" to access the admin dashboard

**Security Note**: The admin panel is restricted to localhost access only. API requests from network IPs will receive a 403 Forbidden error.

### **Admin URL**
```
http://localhost:3000/admin
```

### **Security**
- Only users with `isAdmin: true` or `role: 'admin'` can access
- Non-admin users are redirected to dashboard
- Protected by JWT authentication
- Backend enforces role checks on all admin API calls

---

## 📋 API Endpoints

All admin endpoints require authentication and admin role:

### **GET /api/admin/stats**
Get dashboard statistics
```json
{
  "totalUsers": 150,
  "activeUsers": 45,
  "totalTransactions": 1250,
  "pendingTransactions": 5,
  "completedTransactions": 1200,
  "failedTransactions": 45,
  "totalWallets": 320,
  "totalTokens": 180
}
```

### **GET /api/admin/users**
Get all users with pagination
```
Query Parameters:
- page: Page number (default: 1)
- limit: Results per page (default: 20)
- search: Search by name or email
```

### **GET /api/admin/users/:id**
Get specific user details including wallets, transactions, and tokens

### **PATCH /api/admin/users/:id/role**
Update user role
```json
{
  "role": "admin"  // or "user"
}
```

### **DELETE /api/admin/users/:id**
Delete user and all associated data

### **GET /api/admin/transactions**
Get all transactions with filters
```
Query Parameters:
- page, limit, status, type, userId
```

### **GET /api/admin/logs**
Get last 100 system activity logs

### **GET /api/admin/analytics**
Get analytics data
```
Query Parameters:
- days: Number of days (default: 30)
```

---

## 🎨 Admin Dashboard Tabs

### **📊 Overview**
- Platform statistics cards
- Recent users table
- Recent transactions list
- Quick insights

### **👥 Users**
- Searchable user list
- Role badges (User/Admin)
- Wallet count per user
- 2FA status indicators
- Actions: View, Change Role, Delete

### **💸 Transactions**
- All platform transactions
- User information
- Status filtering
- Transaction types
- Pagination

### **📋 Logs**
- System activity feed
- Color-coded by status
- User tracking
- Timestamp details

### **📈 Analytics**
- User growth chart
- Transaction volume trends
- Popular cryptocurrencies
- Visual data representation

---

## 👤 User Role Management

### **Promote User to Admin**
```bash
# Using the script
node backend/scripts/makeAdmin.js user@example.com

# Or via Admin Dashboard
1. Go to Admin Panel → Users tab
2. Find the user
3. Change dropdown from "User" to "Admin"
4. Confirm the change
```

### **Demote Admin to User**
Use the same process, but select "User" in the dropdown.

**Note:** You cannot demote yourself for safety reasons.

---

## 🔒 Security Features

### **Access Control**
- JWT token required
- Admin role verification on backend
- Frontend route protection
- Middleware checks on all admin endpoints
- **Localhost Only**: Admin API routes only accept requests from localhost (127.0.0.1, ::1)

### **Safety Measures**
- Cannot delete own account
- Cannot demote own admin status
- Confirmation prompts for destructive actions
- Cascading delete for user data (transactions, tokens, balances)
- Network IP requests to admin routes receive 403 Forbidden

### **Rate Limiting**
Admin endpoints use the same rate limiting as other API routes:
- 100 requests per 15 minutes per IP

---

## 📊 User Details Modal

When viewing a user:
- **Personal Info:** Name, email, role, 2FA status, join date
- **Wallets:** All wallet addresses and networks
- **Transactions:** Recent transaction history
- **Tokens:** Custom tokens added by user

---

## 🎯 Admin Actions

### **View User**
Click "View" button to see detailed user information in a modal popup.

### **Change Role**
Use the dropdown to switch between "User" and "Admin" roles. Requires confirmation.

### **Delete User**
Permanently removes:
- User account
- All wallets
- All transactions
- All tokens
- All balances

**Warning:** This action cannot be undone!

---

## 🐛 Troubleshooting

### **1. "Access Denied - Admin panel is only accessible from localhost"**
- **Cause**: You're accessing from a network IP address (e.g., http://192.168.0.102:3000/admin)
- **Solution**: Use `http://localhost:3000/admin` instead
- **Note**: This is intentional for security - admin panel should not be accessed remotely

### **2. Cannot Access Admin Panel**
1. Ensure you're logged in
2. Check if your user has admin role:
   ```bash
   node backend/scripts/makeAdmin.js your-email@example.com
   ```
3. Refresh the page after promotion

### **3. Admin Link Not Showing**
- Make sure `isAdmin: true` is in localStorage:
  ```javascript
  // In browser console
  console.log(JSON.parse(localStorage.getItem('user')));
  ```
- Re-login to update user data

### **4. 403 Forbidden on Admin API**
- Backend is checking admin role
- Verify user role in database:
  ```bash
  # In MongoDB
  db.users.findOne({ email: "your-email@example.com" })
  ```

### **5. Statistics Not Loading**
- Check backend console for errors
- Ensure MongoDB is running
- Verify all models are properly defined

---

## 📱 Mobile Responsive

The admin panel is fully responsive:
- Tablet (768px): Adjusted layouts
- Mobile (640px): Stacked tables, scrollable sections
- Touch-friendly buttons and controls

---

## 🔄 Pagination

All large datasets support pagination:
- **Users:** 20 per page
- **Transactions:** 50 per page
- Previous/Next navigation
- Page number display

---

## 🎨 Dark Mode Support

The admin panel respects the theme setting:
- All colors use CSS variables
- Smooth theme transitions
- Consistent with main app theme

---

## 📚 Files Created/Modified

### **Backend**
- ✨ `backend/middleware/adminAuth.js` - Admin authentication middleware
- ✨ `backend/routes/admin.js` - Admin API routes
- ✨ `backend/scripts/makeAdmin.js` - Promote user to admin script
- 📝 `backend/models/User.js` - Added `role` and `isAdmin` fields
- 📝 `backend/routes/auth.js` - Return role in login/register
- 📝 `backend/server.js` - Register admin routes

### **Frontend**
- ✨ `frontend/src/components/AdminDashboard.js` - Complete admin UI
- 📝 `frontend/src/services/api.js` - Added `adminAPI` methods
- 📝 `frontend/src/App.js` - Added admin route
- 📝 `frontend/src/components/Navbar.js` - Added admin link for admins

---

## 🚀 Quick Start

```bash
# 1. Promote your user to admin
cd backend
node scripts/makeAdmin.js your-email@example.com

# 2. Restart servers (if running)
# Use Ctrl+C to stop, then:
.\start-network.bat

# 3. Access admin panel
# Login and click "🛡️ Admin" in navbar
```

---

## 🎯 Next Steps

Optional enhancements you can add:
- [ ] Export data to CSV/Excel
- [ ] Email notifications to users
- [ ] Bulk user actions
- [ ] Advanced analytics with charts
- [ ] Audit trail logging
- [ ] IP banning system
- [ ] Backup/restore functionality

---

**Admin Panel Status:** ✅ Ready to Use  
**Last Updated:** January 26, 2026  
**Total Admin Endpoints:** 8  
**Security Level:** High (JWT + Role-based)
