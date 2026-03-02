# 🔐 User KYC Steps in Recovery Process - Complete Guide

## 📋 Overview

The wallet recovery process uses **KYC (Know Your Customer)** verification to ensure compliance and security. This document explains all steps from the **user's perspective**.

---

## 🎯 Complete Recovery Journey

### **Recovery Status Flow**

```
1. NO_KYC
   ↓
2. KYC_SUBMITTED
   ↓
3. KYC_PROCESSING (admin reviewing)
   ↓
4a. KYC_APPROVED → SEED_READY → SEED_REVEALED
         OR
4b. KYC_REJECTED (user must fix and resubmit)
         OR
4c. KYC_MORE_DOCS (admin requests additional documents)
```

---

## 📝 Step-by-Step KYC Process

### **Step 1: Initial State (NO_KYC)**

**User Status:** Not submitted KYC  
**What User Sees:** "Recover Wallet" button on dashboard  
**Actions Available:** Can start recovery process

---

### **Step 2: KYC Submission (User Action)**

#### **What User Must Provide:**

1. **Personal Information:**
   - Full legal name (as appears on ID document)
   - Document type selection
   - Document number

2. **Identity Document:**
   - **Accepted Types:**
     - Passport
     - Driver's License
     - National ID Card
   
   - **File Requirements:**
     - Format: PNG, JPG, or PDF
     - Maximum size: 5MB
     - Clear, readable, not blurry
     - All corners visible
     - Text legible

3. **Upload Method:**
   - Drag and drop file
   - Or click to browse and select

#### **What Happens:**
- Frontend uploads document
- System calculates document hash
- Backend receives KYC data
- User status changes to **KYC_SUBMITTED**
- User `kycStatus` set to `pending`
- User `recoveryStatus` set to `KYC_SUBMITTED`
- Timestamp recorded in `kycData.submittedAt`

#### **API Call:**
```javascript
POST /api/wallet/kyc-submit
Authorization: Bearer <user_token>

Body: {
  fullName: "John Doe",
  documentType: "Passport",
  documentNumber: "AB123456",
  documentHash: "sha256_hash_of_document"
}

Response: {
  message: "KYC submitted",
  status: "pending"
}
```

---

### **Step 3: Waiting for Admin Review (KYC_SUBMITTED)**

**User Status:** KYC submitted, awaiting review  
**What User Sees:**
- "Your KYC is being reviewed"
- "Processing" indicator
- Estimated review time (if displayed)

**What User Can Do:**
- Check status: `GET /api/wallet/kyc-status`
- Wait for admin decision
- Cannot proceed with wallet creation yet

**Backend State:**
```javascript
{
  kycStatus: "pending",
  recoveryStatus: "KYC_SUBMITTED",
  kycData: {
    fullName: "John Doe",
    documentType: "Passport",
    documentNumber: "AB123456",
    documentHash: "hash...",
    submittedAt: "2026-02-17T10:30:00Z"
  }
}
```

---

### **Step 4a: Admin Marks as Processing (KYC_PROCESSING)**

**Admin Action:** Admin clicks "Set Processing" button  
**User Status:** KYC is being actively reviewed  
**What User Sees:**
- "Your documents are being verified"
- "Processing" status

**Backend Changes:**
```javascript
{
  kycStatus: "pending",           // Still pending
  recoveryStatus: "KYC_PROCESSING" // Now in active review
}
```

#### **Check Status API:**
```javascript
GET /api/wallet/kyc-status
Authorization: Bearer <user_token>

Response: {
  status: "pending",
  walletExists: false,
  message: "",
  recoveryStatus: "KYC_PROCESSING"
}
```

---

### **Step 4b: Admin Requests More Documents (KYC_MORE_DOCS)**

**Admin Action:** Admin clicks "Request Docs" with message  
**User Status:** Additional documents required  
**What User Sees:**
- "Additional documents required"
- Admin's message: "Please provide clearer photo of passport"

**Backend Changes:**
```javascript
{
  kycStatus: "pending",
  recoveryStatus: "KYC_MORE_DOCS",
  kycReviewMessage: "Please provide clearer photo of passport"
}
```

**What User Must Do:**
1. Read admin's message
2. Prepare better documents
3. Resubmit KYC with improved documents
4. Process returns to **KYC_SUBMITTED**

---

### **Step 5a: KYC Approved (KYC_APPROVED)**

**Admin Action:** Admin clicks "Approve" button  
**User Status:** KYC verified and approved  
**What User Sees:**
- "KYC Approved ✅"
- "Your wallet is ready to be provisioned"

**Backend Changes:**
```javascript
{
  kycStatus: "approved",        // Changed from pending
  recoveryStatus: "KYC_APPROVED",
  kycReviewMessage: ""          // Cleared
}
```

#### **What Happens Next:**
Admin must now provision the recovery wallet:

**Admin Action:**
```javascript
POST /api/admin/wallets/provision
Authorization: Bearer <admin_token>

Body: {
  userId: "507f1f77bcf86cd799439011",
  mnemonic: "word1 word2 word3 ... word12"
}
```

**This Creates:**
- Recovery wallet in database
- Encrypted seed phrase stored
- Wallet linked to user
- Status changes to **SEED_READY**

---

### **Step 5b: KYC Rejected (KYC_REJECTED)**

**Admin Action:** Admin clicks "Reject" with reason  
**User Status:** KYC verification failed  
**What User Sees:**
- "KYC Rejected ❌"
- Admin's message: "Document appears to be expired"

**Backend Changes:**
```javascript
{
  kycStatus: "rejected",
  recoveryStatus: "KYC_REJECTED",
  kycReviewMessage: "Document appears to be expired"
}
```

**What User Must Do:**
1. Read rejection reason
2. Fix the issue (get new document, etc.)
3. Submit new KYC application
4. Process starts over from **KYC_SUBMITTED**

---

### **Step 6: Wallet Provisioned (SEED_READY)**

**Status:** Wallet created by admin, seed ready to reveal  
**What User Sees:**
- "Your recovery wallet is ready!"
- "Reveal Seed Phrase" button

**Backend State:**
```javascript
// Wallet document created:
{
  userId: "user_id",
  address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  network: "bitcoin",
  encryptedSeed: { ciphertext: "...", iv: "...", tag: "..." },
  seedShownAt: null,  // Not yet shown
  revoked: false
}

// User recoveryStatus:
recoveryStatus: "SEED_READY"
```

**What User Can Do:**
- Request to see seed phrase once
- Call: `GET /api/wallet/recovery-seed`

---

### **Step 7: Seed Phrase Revealed (SEED_REVEALED)**

**User Action:** User clicks "Reveal Seed Phrase" button  
**One-Time Display:** Seed phrase shown only once  
**Security:** User MUST save it now or lose access forever

#### **API Call:**
```javascript
GET /api/wallet/recovery-seed
Authorization: Bearer <user_token>

Response: {
  network: "bitcoin",
  address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  mnemonic: "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12",
  warning: "Write this seed phrase down and never share it. It cannot be shown again."
}
```

**What User Sees:**
- 12-word seed phrase displayed
- Numbered list (1-12)
- Copy to clipboard button
- Security warnings:
  - ⚠️ "Write this down immediately"
  - 🚨 "Never share with anyone"
  - 🔐 "Store in secure offline location"
  - ❌ "Cannot be shown again"

**Backend Changes:**
```javascript
// Wallet updated with timestamp:
{
  seedShownAt: "2026-02-17T11:00:00Z"  // Timestamp recorded
}

// User status:
recoveryStatus: "SEED_REVEALED"
```

**Important:**
- This is a **ONE-TIME action**
- After this, user can NEVER see seed again
- User must confirm they saved it (checkbox)
- `seedShownAt` timestamp prevents re-revelation

---

## 🔄 Status Check Endpoints

### **Check KYC Status**
```javascript
GET /api/wallet/kyc-status
Authorization: Bearer <user_token>

Response: {
  status: "pending" | "approved" | "rejected",
  walletExists: boolean,
  message: "Admin review message",
  recoveryStatus: "KYC_SUBMITTED" | "KYC_PROCESSING" | etc.
}
```

### **Check Recovery Status**
```javascript
GET /api/wallet/recovery-status
Authorization: Bearer <user_token>

Response: {
  status: "NO_KYC" | "KYC_SUBMITTED" | "KYC_PROCESSING" | 
          "KYC_MORE_DOCS" | "KYC_APPROVED" | "KYC_REJECTED" | 
          "SEED_READY" | "SEED_REVEALED",
  message: "Optional admin message",
  walletExists: boolean
}
```

### **Get Wallet Summary**
```javascript
GET /api/wallet/my-wallet
Authorization: Bearer <user_token>

Response: {
  id: "wallet_id",
  address: "1A1zP1eP...",
  network: "bitcoin",
  seedShownAt: "2026-02-17T11:00:00Z" | null
}
```

---

## 📊 Complete State Diagram

```
User Dashboard
     │
     ▼
Click "Recover Wallet"
     │
     ▼
┌────────────────────────┐
│ Step 1: KYC Submission │
│ Status: NO_KYC        │
└───────────┬────────────┘
            │
            ▼ User submits KYC
┌────────────────────────┐
│ Step 2: Waiting Review │
│ Status: KYC_SUBMITTED │
└───────────┬────────────┘
            │
            ▼ Admin reviews
     ┌──────┴──────┐
     │             │
     ▼             ▼
┌─────────┐   ┌──────────────┐
│Processing│   │Request More  │
│ Status: │   │Docs          │
│KYC_      │   │Status:       │
│PROCESSING│   │KYC_MORE_DOCS │
└────┬─────┘   └──────┬───────┘
     │                 │
     │                 ▼
     │         User resubmits
     │         (back to KYC_SUBMITTED)
     │
     ▼
Decision Point
     │
     ├──────────────┬──────────────┐
     │              │              │
     ▼              ▼              ▼
┌─────────┐   ┌─────────┐   ┌──────────┐
│Approved │   │Rejected │   │More Docs │
│Status:  │   │Status:  │   │(see above)│
│KYC_     │   │KYC_     │   └──────────┘
│APPROVED │   │REJECTED │
└────┬────┘   └────┬────┘
     │             │
     │             ▼
     │         User must fix
     │         and resubmit
     │
     ▼ Admin provisions wallet
┌────────────────────────┐
│ Step 3: Wallet Ready   │
│ Status: SEED_READY    │
└───────────┬────────────┘
            │
            ▼ User reveals seed
┌────────────────────────┐
│ Step 4: Seed Shown     │
│ Status: SEED_REVEALED │
│ ⚠️ ONE TIME ONLY!     │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ Recovery Complete!     │
│ User has wallet access │
└────────────────────────┘
```

---

## ⏱️ Timeline Example

**Day 1 - 10:00 AM:**  
User submits KYC → Status: `KYC_SUBMITTED`

**Day 1 - 2:00 PM:**  
Admin marks as processing → Status: `KYC_PROCESSING`

**Day 1 - 3:00 PM:**  
Admin approves → Status: `KYC_APPROVED`

**Day 1 - 3:05 PM:**  
Admin provisions wallet → Status: `SEED_READY`

**Day 1 - 3:10 PM:**  
User reveals seed phrase → Status: `SEED_REVEALED`

**Total Time:** ~5 hours (varies based on admin availability)

---

## 🚨 Important Security Notes

### For Users:

1. **Document Quality Matters:**
   - Clear, high-resolution photo
   - All corners visible
   - Text readable
   - No glare or shadows

2. **Seed Phrase is CRITICAL:**
   - Write it down on paper
   - Store in multiple secure locations
   - NEVER share with anyone (not even support)
   - Cannot be recovered if lost

3. **One-Time Reveal:**
   - Seed phrase shown only ONCE
   - After viewing, timestamp recorded
   - Cannot request it again
   - Must save it immediately

4. **Status Monitoring:**
   - Check status regularly
   - Read admin messages carefully
   - Respond quickly to document requests
   - Don't miss notification emails

---

## ❌ Common Issues & Solutions

### **Issue: KYC Stuck in "Submitted"**
**Cause:** Admin has not reviewed yet  
**Solution:** Wait for admin review, typically 1-24 hours

### **Issue: KYC Rejected**
**Cause:** Document not acceptable (expired, unclear, wrong type)  
**Solution:** 
- Read admin's rejection message
- Fix the specific issue mentioned
- Submit new KYC application

### **Issue: "Additional Documents Required"**
**Cause:** Admin needs clearer/additional proof  
**Solution:**
- Read admin's specific request
- Provide exactly what was requested
- Resubmit through KYC form

### **Issue: Can't See Seed Phrase**
**Cause:** Already revealed once  
**Solution:**
- Check if `seedShownAt` has timestamp
- If shown before, it's permanently hidden
- User must have saved it during first reveal
- **No recovery possible** if lost

### **Issue: Wallet Not Created After KYC Approval**
**Cause:** Admin approved but hasn't provisioned wallet yet  
**Solution:**
- Status shows `KYC_APPROVED` but not `SEED_READY`
- Admin must provision wallet manually
- Contact admin to complete provisioning

---

## 🔐 Privacy & Security Compliance

### **Data Storage:**
- KYC documents: Hashed and stored securely
- Personal info: Encrypted at rest
- Seed phrase: AES-256-GCM encrypted
- Never stored in plain text

### **Access Control:**
- Only user can see their seed (once)
- Only admins can approve/reject KYC
- Audit logs track all actions
- IP addresses recorded

### **Compliance:**
- Meets KYC/AML requirements
- GDPR-compliant data handling
- Right to be forgotten supported
- Data retention policies enforced

---

## 📞 Support & Help

### **If You're Stuck:**

1. **Check Status First:**
   ```bash
   GET /api/wallet/recovery-status
   ```

2. **Read Admin Messages:**
   - Check `kycReviewMessage` field
   - Follow instructions exactly

3. **Common Solutions:**
   - Wait for admin review (1-24 hours)
   - Provide clearer documents
   - Ensure document not expired
   - Use supported file formats

4. **Contact Support:**
   - Provide your user ID
   - Describe current status
   - Include any error messages
   - **NEVER share your seed phrase**

---

## ✅ Success Checklist

Before completing recovery, ensure:

- [ ] KYC submitted with clear document
- [ ] Received KYC approval notification
- [ ] Revealed seed phrase (ONE TIME!)
- [ ] **WRITTEN DOWN seed phrase on paper**
- [ ] Stored seed phrase in secure location
- [ ] Confirmed wallet address is correct
- [ ] Understand seed phrase cannot be shown again
- [ ] Know how to use wallet for transactions

---

## 🎯 Summary

**The KYC recovery process has 4 main user stages:**

1. **Submit KYC** - Provide ID document
2. **Wait for Approval** - Admin reviews (may request more docs)
3. **Wallet Provisioned** - Admin creates wallet
4. **Reveal Seed** - **ONE TIME** - Save it immediately!

**Total Process:** Usually 1-48 hours depending on admin availability

**Most Important:** SAVE YOUR SEED PHRASE when revealed - it's your only way to recover your wallet!

---

*Last Updated: February 17, 2026*  
*Version: 1.0*  
*Status: Production*
