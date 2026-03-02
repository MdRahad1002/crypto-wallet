# 🚀 CRYPTO WALLET PLATFORM - QUICK FIX GUIDE

## ✅ Issues Fixed

### 1. **Backend Network Binding** ✓
- Backend now binds to `0.0.0.0` (all network interfaces)
- Accessible from localhost AND network devices

### 2. **Frontend Network Access** ✓
- Added `HOST=0.0.0.0` to package.json
- React dev server now accessible from network

### 3. **Improved Startup Scripts** ✓
- Created `start-network.bat` for better process management
- Servers run in separate CMD windows that stay open
- Clear instructions and IP address display

---

## 🎯 How to Start the Platform

### **Option 1: Network Mode (Mobile Access)**
**Double-click:** [`start-network.bat`](start-network.bat)

This starts both servers accessible from:
- Your computer: `http://localhost:3000`
- Mobile/Tablet: `http://192.168.0.102:3000`

### **Option 2: Manual Start**

**Backend:**
```bash
cd backend
node server.js
```

**Frontend** (in new terminal):
```bash
cd frontend
npm start
```

---

## 🔥 Windows Firewall Setup

### **Quick Method (Recommended)**
1. Right-click [`setup-firewall.ps1`](setup-firewall.ps1)
2. Select **"Run with PowerShell"**
3. Click **"Yes"** on admin prompt

### **Manual Method**
Open PowerShell as Administrator and run:
```powershell
New-NetFirewallRule -DisplayName "Crypto Wallet Frontend" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Crypto Wallet Backend" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
```

---

## 📱 Access from Mobile/Tablet

1. **Connect** your mobile device to the **SAME WiFi network**
2. **Find your IP address:**
   - Displayed when you run `start-network.bat`
   - Or run: `ipconfig` and look for "IPv4 Address"
3. **Open browser** on mobile and go to:
   ```
   http://YOUR-IP-ADDRESS:3000
   ```
   Example: `http://192.168.0.102:3000`

---

## 🛠️ Troubleshooting

### **"Can't reach this page" on mobile**

**Check 1: Servers Running?**
- Make sure BOTH Backend and Frontend windows are open
- Look for "webpack compiled successfully" in Frontend window
- Look for "Server running on port 5000" in Backend window

**Check 2: Firewall Rules?**
Run PowerShell as Admin:
```powershell
Get-NetFirewallRule -DisplayName "Crypto Wallet*" | Select-Object DisplayName, Enabled, Action
```
Should show 2 rules with `Enabled=True` and `Action=Allow`

**Check 3: Same WiFi Network?**
- Computer and mobile device must be on the SAME WiFi
- Not using mobile data
- Not on guest network (some routers isolate guest networks)

**Check 4: VPN Active?**
- If using VPN (like NordVPN), try disabling it temporarily
- VPNs can block local network access

**Check 5: Network Type**
- Firewall rules only work on "Private" networks
- Go to: Settings → Network & Internet → WiFi → Your Network
- Change to "Private" if it's set to "Public"

### **Frontend compiles but then stops**

This was the original issue. Fixed by:
- Using CMD windows instead of PowerShell background processes
- Proper HOST configuration in package.json
- Better process isolation

### **MongoDB Connection Error**

Start MongoDB:
```bash
net start MongoDB
```

Or check if running:
```bash
sc query MongoDB
```

### **Port Already in Use**

Kill existing processes:
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill process (replace PID with actual number)
taskkill /PID <PID> /F

# Same for port 5000
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

---

## 🧪 Testing Checklist

- [ ] Backend starts and shows "Server running on port 5000"
- [ ] Frontend compiles and shows "webpack compiled successfully"
- [ ] Can access http://localhost:3000 on computer
- [ ] Firewall rules created (2 rules for ports 3000 and 5000)
- [ ] Mobile device on same WiFi network
- [ ] Can access http://YOUR-IP:3000 from mobile browser
- [ ] Login page loads on mobile
- [ ] Mobile responsive design works (hamburger menu visible)

---

## 📊 Network Information

**Check your IP:**
```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike "127.*"} | Select-Object IPAddress, InterfaceAlias
```

**Check open ports:**
```powershell
netstat -ano | Select-String ":3000|:5000" | Where-Object {$_ -match "LISTENING"}
```

**Test connection from another device:**
```bash
# From another computer (PowerShell)
Test-NetConnection -ComputerName YOUR-IP -Port 3000

# From mobile (browser)
http://YOUR-IP:3000
```

---

## 🎨 What Changed in This Fix

### [`backend/server.js`](backend/server.js)
```javascript
// Before
app.listen(PORT, () => { ... });

// After
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => { ... });
```

### [`frontend/package.json`](frontend/package.json)
```json
// Before
"start": "react-scripts start"

// After
"start": "set HOST=0.0.0.0&& react-scripts start"
```

### [`start-network.bat`](start-network.bat) (NEW)
- Displays network IPs automatically
- Better process management (separate CMD windows)
- Clear status messages
- Troubleshooting hints

---

## 🔒 Security Notes

- **Development Mode Only**: Don't expose these servers to the internet
- **Local Network Only**: Firewall rules are for Domain/Private networks
- **Change Default Secrets**: Update JWT_SECRET and ENCRYPTION_KEY in .env
- **Production**: Use proper hosting with HTTPS, rate limiting, and authentication

---

## 📚 Additional Resources

- [FIREWALL_SETUP.md](FIREWALL_SETUP.md) - Detailed firewall guide
- [MOBILE_RESPONSIVE_GUIDE.md](MOBILE_RESPONSIVE_GUIDE.md) - Mobile design docs
- [WALLET_RECOVERY_GUIDE.md](WALLET_RECOVERY_GUIDE.md) - Wallet recovery
- [RECOVERY_IMPLEMENTATION.md](RECOVERY_IMPLEMENTATION.md) - Technical details

---

**Last Updated:** January 26, 2026  
**Issues Fixed:** Backend binding, Frontend HOST config, Process management  
**Testing Status:** ✅ Ready for network access testing
