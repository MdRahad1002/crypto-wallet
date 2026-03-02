const { z } = require('zod');

// Regex patterns for validation
const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/;
const ethereumPrivateKeyRegex = /^0x[a-fA-F0-9]{64}$/;
const bitcoinAddressRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/;

// Password validation schema
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(100, 'Password must not exceed 100 characters')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/, 
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$%^&*)');

// Email validation
const emailSchema = z
  .string()
  .email('Please provide a valid email address');

// Network validation
const networkSchema = z
  .enum(['ethereum', 'polygon', 'bsc', 'bitcoin', 'btc'])
  .default('ethereum');

// Ethereum address validation
const ethereumAddressSchema = z
  .string()
  .regex(ethereumAddressRegex, 'Invalid Ethereum address format');

// Ethereum private key validation
const ethereumPrivateKeySchema = z
  .string()
  .regex(ethereumPrivateKeyRegex, 'Invalid private key format');

// Bitcoin address validation
const bitcoinAddressSchema = z
  .string()
  .regex(bitcoinAddressRegex, 'Invalid Bitcoin address format');

// User registration schema
const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters long')
    .max(50, 'Name must not exceed 50 characters'),
});

// User login schema
const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

// Wallet creation schema
const createWalletSchema = z.object({
  network: networkSchema,
  password: passwordSchema,
});

// Wallet import schema
const importWalletSchema = z.object({
  privateKey: ethereumPrivateKeySchema,
  network: networkSchema,
  password: passwordSchema,
});

// Watch-only wallet schema — accepts Ethereum (0x...) and Bitcoin (legacy, P2SH, bech32) addresses
const watchOnlyWalletSchema = z.object({
  address: z
    .string()
    .min(1, 'Address is required')
    .refine(
      (v) =>
        /^0x[a-fA-F0-9]{40}$/.test(v) ||
        /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(v) ||
        /^bc1[a-z0-9]{39,59}$/.test(v),
      { message: 'Invalid address format (must be a valid Ethereum or Bitcoin address)' }
    ),
  network: networkSchema,
  label: z
    .string()
    .max(50, 'Label must not exceed 50 characters')
    .default('Watch-Only Wallet'),
});

// KYC submission schema
const kycSubmitSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(80, 'Full name must not exceed 80 characters'),
  documentType: z
    .enum(['passport', 'drivers_license', 'national_id'], {
      errorMap: () => ({ message: 'Invalid document type' })
    }),
  documentNumber: z
    .string()
    .min(3, 'Document number must be at least 3 characters')
    .max(50, 'Document number must not exceed 50 characters'),
  // Legacy hash — optional for backward compat
  documentHash: z.string().max(128).optional(),
  // Identity document URLs (uploaded to storage)
  idFrontUrl: z.string().url().optional().or(z.literal('')),
  idBackUrl: z.string().url().optional().or(z.literal('')),
  // Address verification
  addressDocType: z
    .enum(['bank_statement', 'utility_bill'], {
      errorMap: () => ({ message: 'Invalid address document type' })
    }),
  addressDocUrl: z.string().url().optional().or(z.literal('')),
  // Optional additional documents
  otherDocUrls: z.array(z.string().url()).optional()
});

// Transaction schema
const sendTransactionSchema = z.object({
  fromAddress: ethereumAddressSchema,
  toAddress: ethereumAddressSchema,
  amount: z
    .number()
    .positive('Amount must be greater than zero'),
  cryptocurrency: z
    .string()
    .default('ETH'),
  network: z
    .enum(['ethereum', 'polygon', 'bsc'])
    .default('ethereum'),
  password: passwordSchema,
});

// Batch transaction schema
const batchTransactionSchema = z.object({
  fromAddress: ethereumAddressSchema,
  recipients: z
    .array(
      z.object({
        address: ethereumAddressSchema,
        amount: z.number().positive('Amount must be greater than zero'),
      })
    )
    .min(1, 'At least one recipient is required')
    .max(50, 'Maximum 50 recipients allowed per batch'),
  cryptocurrency: z
    .string()
    .default('ETH'),
  network: z
    .enum(['ethereum', 'polygon', 'bsc'])
    .default('ethereum'),
  password: passwordSchema,
});

// Withdrawal schema
const withdrawTransactionSchema = z.object({
  fromAddress: z.string().min(1, 'From address is required'),
  toAddress: z.string().min(1, 'Recipient address is required'),
  amount: z
    .number()
    .positive('Amount must be greater than zero')
    .max(1000000, 'Amount exceeds maximum limit'),
  cryptocurrency: z
    .string()
    .default('BTC'),
  network: z.string().default('bitcoin'),
  description: z.string().optional(),
});

// Gas estimation schema
const gasEstimationSchema = z.object({
  toAddress: ethereumAddressSchema,
  amount: z
    .number()
    .positive('Amount must be greater than zero'),
  network: z
    .enum(['ethereum', 'polygon', 'bsc'])
    .default('ethereum'),
});

// Wallet recovery schema
const walletRecoverySchema = z.object({
  mnemonic: z
    .string()
    .min(1, 'Mnemonic is required'),
  network: z
    .enum(['ethereum', 'polygon', 'bsc', 'bitcoin', 'btc'])
    .default('ethereum'),
});

// Middleware to validate request body using Zod
const validate = (schema) => {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issueList = error.issues || error.errors || [];
        const errors = issueList.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        return res.status(400).json({
          message: 'Validation failed',
          errors,
        });
      }
      
      res.status(400).json({
        message: 'Validation error',
      });
    }
  };
};

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

module.exports = {
  validate,
  schemas: {
    register: registerSchema,
    login: loginSchema,
    changePassword: changePasswordSchema,
    createWallet: createWalletSchema,
    importWallet: importWalletSchema,
    watchOnlyWallet: watchOnlyWalletSchema,
    kycSubmit: kycSubmitSchema,
    sendTransaction: sendTransactionSchema,
    withdrawTransaction: withdrawTransactionSchema,
    batchTransaction: batchTransactionSchema,
    gasEstimation: gasEstimationSchema,
    walletRecovery: walletRecoverySchema,
  },
};
