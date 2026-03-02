# 🔥 Windows Firewall Configuration Guide

## Problem
Cannot access the crypto wallet platform from other devices (phones, tablets) on the same network.

## Solution
Windows Firewall is blocking incoming connections on ports 3000 and 5000. You need to create firewall rules to allow these connections.

## 📋 Quick Fix (Recommended)

### Option 1: Run the Setup Script (Easiest)

1. **Right-click** on `setup-firewall.bat` in your project folder
2. Select **"Run as administrator"**
3. Click "Yes" when Windows asks for permission
4. Press any key when prompted
5. Done! ✅

### Option 2: Manual Firewall Configuration

#### Using Windows Defender Firewall GUI:

1. **Open Windows Defender Firewall**
   - Press `Win + R`
   - Type: `wf.msc`
   - Press Enter

2. **Create Inbound Rule for Frontend (Port 3000)**
   - Click "Inbound Rules" in left panel
   - Click "New Rule..." in right panel
   - Select "Port" → Next
   - Select "TCP" and enter "3000" → Next
   - Select "Allow the connection" → Next
   - Check all three boxes (Domain, Private, Public) → Next
   - Name: "Crypto Wallet Frontend" → Finish

3. **Create Inbound Rule for Backend (Port 5000)**
   - Repeat steps above but use port "5000"
   - Name: "Crypto Wallet Backend"

#### Using PowerShell (Run as Administrator):

```powershell
# Open PowerShell as Administrator
# Right-click PowerShell → Run as Administrator

# Add frontend rule
New-NetFirewallRule -DisplayName "Crypto Wallet Frontend" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow

# Add backend rule
New-NetFirewallRule -DisplayName "Crypto Wallet Backend" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
```

#### Using Command Prompt (Run as Administrator):

```cmd
# Open Command Prompt as Administrator
# Right-click CMD → Run as Administrator

# Add frontend rule
netsh advfirewall firewall add rule name="Crypto Wallet Frontend" dir=in action=allow protocol=TCP localport=3000

# Add backend rule
netsh advfirewall firewall add rule name="Crypto Wallet Backend" dir=in action=allow protocol=TCP localport=5000
```

## 🧪 Testing the Connection

### Step 1: Verify Servers are Running
Make sure both servers are running on your computer:
- Backend should show: "Server running on port 5000"
- Frontend should show: "webpack compiled with warnings"

### Step 2: Find Your IP Address
Your computer's IP: **192.168.0.102**

### Step 3: Test from Another Device
On your phone/tablet (connected to same WiFi):

1. Open any browser (Chrome, Safari, Firefox)
2. Go to: `http://192.168.0.102:3000`
3. You should see the login page!

## 🔍 Troubleshooting

### Issue: Still can't connect after firewall setup

**Check 1: Are servers running?**
```powershell
netstat -ano | findstr ":3000"
netstat -ano | findstr ":5000"
```
You should see both ports listed.

**Check 2: Is firewall rule active?**
```powershell
Get-NetFirewallRule -DisplayName "Crypto Wallet*"
```
Should show two rules with "Enabled: True"

**Check 3: Is device on same network?**
- Both devices must be on the SAME WiFi network
- Check your phone's WiFi settings
- Should connect to same network name as your computer

**Check 4: Antivirus blocking?**
Some antivirus software may also block connections:
- Temporarily disable antivirus and test
- Add exception for ports 3000 and 5000

**Check 5: Network isolation enabled?**
Some routers have "AP Isolation" or "Client Isolation":
- Log into your router settings
- Disable AP/Client Isolation
- This feature prevents devices from talking to each other

### Issue: Firewall script requires administrator

**Solution:**
1. Right-click `setup-firewall.bat`
2. Select "Run as administrator"
3. Click "Yes" when UAC prompt appears

### Issue: PowerShell execution policy error

**Solution:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 📱 Testing Checklist

- [ ] Firewall rules created (port 3000 and 5000)
- [ ] Backend server running on port 5000
- [ ] Frontend server running on port 3000
- [ ] Mobile device on same WiFi network
- [ ] Tested URL: http://192.168.0.102:3000
- [ ] Can see login page on mobile
- [ ] Can login and use features

## 🎯 Expected Results

After setup, you should be able to:

✅ Access from any device on your network:
- **Phones**: iPhone, Android
- **Tablets**: iPad, Android tablets
- **Other computers**: Laptops, desktops

✅ Full functionality:
- Login/Register
- View dashboard
- Create wallets
- Send transactions
- All features work as on desktop

## 🔒 Security Notes

### Port Forwarding (Don't do this!)
⚠️ **DO NOT** enable port forwarding on your router for ports 3000/5000
- This would expose your wallet to the internet
- Only use on your LOCAL network
- Keep router firewall enabled

### Network Security
- Only access on trusted WiFi networks
- Don't use on public WiFi without VPN
- Keep Windows Firewall enabled
- Don't disable antivirus completely

### Development Only
This setup is for development/testing:
- For production, use HTTPS
- Deploy to secure hosting
- Use proper SSL certificates
- Implement additional security measures

## 🌐 Alternative Access Methods

### Option 1: Use Computer Name
Instead of IP address:
```
http://YOUR-COMPUTER-NAME:3000
```
(Replace YOUR-COMPUTER-NAME with your actual computer name)

### Option 2: Use ngrok (Internet Access)
If you want to access from anywhere:

1. Install ngrok: https://ngrok.com/download
2. Run: `ngrok http 3000`
3. Use the ngrok URL provided

⚠️ Only use for testing - ngrok exposes to internet!

## 📊 Verify Firewall Rules

### Check if rules exist:
```powershell
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*Crypto Wallet*"} | Format-Table DisplayName, Enabled, Direction, Action
```

### Remove rules (if needed):
```powershell
Remove-NetFirewallRule -DisplayName "Crypto Wallet Frontend"
Remove-NetFirewallRule -DisplayName "Crypto Wallet Backend"
```

### View all port 3000/5000 rules:
```powershell
Get-NetFirewallPortFilter | Where-Object {$_.LocalPort -eq 3000 -or $_.LocalPort -eq 5000} | Get-NetFirewallRule
```

## 🎉 Success!

Once configured, your URLs:

**On your computer:**
- http://localhost:3000

**On other devices (same network):**
- http://192.168.0.102:3000

Enjoy testing your mobile-responsive crypto wallet! 📱💰

---

**Quick Commands Reference:**

```bash
# Check if servers running
netstat -ano | findstr ":3000"
netstat -ano | findstr ":5000"

# Check firewall rules
Get-NetFirewallRule -DisplayName "Crypto Wallet*"

# Test connection
curl http://localhost:3000
curl http://192.168.0.102:3000
```
