/**
 * Zod Validation Schema Test
 * Quick test to ensure all schemas parse correctly
 */

const { schemas } = require('../utils/validation');

async function runTests() {
  console.log('🧪 Running Zod schema validation tests...\n');

  const testCases = [
    {
      name: 'Login Schema - Valid',
      schema: schemas.login,
      data: { email: 'user@example.com', password: process.env.TEST_PASSWORD || 'generated-test-pass-' + Math.random().toString(36) },
      shouldPass: true,
    },
    {
      name: 'Login Schema - Invalid email',
      schema: schemas.login,
      data: { email: 'invalid-email', password: process.env.TEST_PASSWORD || 'generated-test-pass-' + Math.random().toString(36) },
      shouldPass: false,
    },
    {
      name: 'Register Schema - Valid',
      schema: schemas.register,
      data: { 
        email: 'newuser@example.com', 
        password: process.env.TEST_PASSWORD || 'generated-test-pass-' + Math.random().toString(36),
        name: 'John Doe'
      },
      shouldPass: true,
    },
    {
      name: 'Register Schema - Weak password',
      schema: schemas.register,
      data: { 
        email: 'newuser@example.com', 
        password: 'weak',
        name: 'John Doe'
      },
      shouldPass: false,
    },
    {
      name: 'Create Wallet Schema - Valid',
      schema: schemas.createWallet,
      data: { 
        network: 'ethereum',
        password: process.env.TEST_PASSWORD || 'generated-test-pass-' + Math.random().toString(36)
      },
      shouldPass: true,
    },
    {
      name: 'Watch Only Wallet Schema - Valid',
      schema: schemas.watchOnlyWallet,
      data: { 
        address: '0x1234567890abcdef1234567890abcdef12345678',
        network: 'ethereum',
        label: 'My Watch Wallet'
      },
      shouldPass: true,
    },
    {
      name: 'Watch Only Wallet Schema - Invalid address',
      schema: schemas.watchOnlyWallet,
      data: { 
        address: 'invalid-address',
        network: 'ethereum'
      },
      shouldPass: false,
    },
    {
      name: 'KYC Submit Schema - Valid',
      schema: schemas.kycSubmit,
      data: { 
        fullName: 'Jane Smith',
        documentType: 'passport',
        documentNumber: 'AB123456',
        documentHash: '0'.repeat(64)
      },
      shouldPass: true,
    },
    {
      name: 'Wallet Recovery Schema - Valid',
      schema: schemas.walletRecovery,
      data: { 
        mnemonic: 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12',
        network: 'ethereum'
      },
      shouldPass: true,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      const result = testCase.schema.safeParse(testCase.data);
      const success = testCase.shouldPass ? result.success : !result.success;

      if (success) {
        console.log(`✅ PASS: ${testCase.name}`);
        passed++;
      } else {
        console.log(`❌ FAIL: ${testCase.name}`);
        console.log(`   Expected ${testCase.shouldPass ? 'success' : 'failure'}, got ${result.success ? 'success' : 'failure'}`);
        if (result.error) console.log(`   Errors: ${JSON.stringify(result.error.errors)}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${testCase.name}`);
      console.log(`   ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
