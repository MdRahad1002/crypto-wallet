const bip39 = require('bip39');
const { BIP32Factory } = require('bip32');
const ecc = require('tiny-secp256k1');
const bitcoin = require('bitcoinjs-lib');
const { ethers } = require('ethers');

const bip32 = BIP32Factory(ecc);

function validateMnemonic(mnemonic) {
  const normalized = mnemonic.trim().replace(/\s+/g, ' ');
  const words = normalized.split(' ').filter(Boolean);
  if (words.length !== 12 && words.length !== 24) {
    const error = new Error(`Seed phrase must be 12 or 24 words (got ${words.length})`);
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

function deriveBTCAddress(mnemonic) {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, bitcoin.networks.bitcoin);

  const child = root
    .deriveHardened(44)
    .deriveHardened(0)
    .deriveHardened(0)
    .derive(0)
    .derive(0);

  const { address } = bitcoin.payments.p2pkh({
    pubkey: child.publicKey,
    network: bitcoin.networks.bitcoin
  });

  return address;
}

function deriveETHAddress(mnemonic) {
  const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic);
  const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");
  return wallet.address;
}

function deriveBitcoinAddress(mnemonic) {
  return deriveBTCAddress(mnemonic);
}

module.exports = {
  validateMnemonic,
  deriveBTCAddress,
  deriveETHAddress,
  deriveBitcoinAddress
};
