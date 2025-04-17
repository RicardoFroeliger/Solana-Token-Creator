# 🔮 Solana Token Creator

This project lets you **programmatically create SPL tokens** on the Solana blockchain — including setting metadata, minting tokens, and optional authority revoking.

---

## 🚀 Features

- ✅ Token minting with custom name, symbol, amount etc.
- 🖼️ Metadata support (image, description & more if wanted)  
- 🧾 Verifies creator to ensure your visibility on DEX screeners 
- 🔐 Optional authority revoking (update, mint, freeze)  
- 🛠️ Easily configurable with environment variables  
- 🔗 Works on **Mainnet-Beta**, and also for developers: **Devnet** & **Testnet**

---

## 📦 Installation

### 1. Install [Node.js](https://nodejs.org/) (v18 or newer recommended)

If you don’t have Node.js installed yet:

- 📥 Download from [nodejs.org](https://nodejs.org/)
- 📦 Includes `npm`, the Node.js package manager

### 2. Clone this project

```bash
git clone https://github.com/RicardoFroeliger/solana-token-creator.git
cd solana-token-creator
```

### 3. Install dependencies

```bash
npm install
```

### 4. Create a `.env` file

Copy the example environment configuration file: `.env.example` and update it to your liking.
Do this manually or use the command below:

```bash
cp .env.example .env
```

**`.env` config example:**

```env
NETWORK=devnet
WALLET_PRIVATE_KEY=your_wallet_private_key_in_base58

TOKEN_NAME=MyToken
TOKEN_SYMBOL=MT
TOKEN_METADATA_URI=https://your-metadata-url.json
TOKEN_DECIMALS=6
TOKEN_MINT_AMOUNT=1_000_000_000
TOKEN_FEE_PERCENTAGE=0.5

REVOKE_UPDATE=true
REVOKE_MINT=true
REVOKE_FREEZE=true
```

> 💡 Use a new wallet with SOL for testing. You can get Devnet SOL from [Solana Faucet](https://faucet.solana.com/).

---

## 🧪 Run the Script

```bash
npm run create
# OR 
node index.js
```

You’ll see:

- The mint address  
- Associated token account  
- Verified creator log  
- Transaction status (confirmed or error)

---

## 🛡️ Security Tips

- Never share your `.env` file.  
- For production use, keep your wallet private key secure.  
- Revoke mint/freeze/update authorities if you want to create more trust in your token.

---

## 📚 Resources

- [Solana Web3.js Docs](https://solana-labs.github.io/solana-web3.js/)
- [Solana SPL Token Program](https://spl.solana.com/token)
- [Metaplex Token Metadata](https://docs.metaplex.com/programs/token-metadata/overview)
- [Node.js Downloads](https://nodejs.org/)

---

## 🧠 License

MIT License. Use responsibly.
