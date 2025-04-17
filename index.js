require('dotenv/config');
const { Connection, PublicKey, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction, SendTransactionError } = require('@solana/web3.js');
const {
    MINT_SIZE,
    TOKEN_PROGRAM_ID,
    createInitializeMintInstruction,
    getMinimumBalanceForRentExemptMint,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    createMintToInstruction,
    setAuthority,
    AuthorityType,
} = require('@solana/spl-token');
const {
    createCreateMetadataAccountV3Instruction,
    createUpdateMetadataAccountV2Instruction,
    Metadata,
    PROGRAM_ID,
} = require('@metaplex-foundation/mpl-token-metadata');
const { base58_to_binary } = require('base58-js');
const parseBool = require('to-boolean');

// Check if network is correct
if (!['devnet', 'testnet', 'mainnet-beta'].includes(process.env.NETWORK || '')) {
    console.error('❌ Network invalid');
    return;
}

// Define keypair by wallet base 58
const keypair = Keypair.fromSecretKey(base58_to_binary(process.env.WALLET_PRIVATE_KEY || ''));
console.log("🔑 Using Wallet PublicKey:", keypair.publicKey.toBase58());

// Initialize connection
const connection = new Connection(`https://api.${process.env.NETWORK || ''}.solana.com`, "confirmed");

// Send transaction function
const sendTransaction = async (transaction, signers = []) => {
    try {
        // Ensure blockhash and fee payer are set
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        transaction.feePayer = keypair.publicKey;

        // Sign and send transaction
        const signature = await sendAndConfirmTransaction(connection, transaction, signers);
        console.log('✅ Transaction confirmed with signature:', signature);
        return signature;
    } catch (error) {
        console.error('❌ Transaction failed:', error.message);

        // Check for insufficient lamports message
        insufficientLamports = error.transactionLogs.filter(log => log.includes('insufficient lamports'))?.[0];
        if (insufficientLamports != null) {

            // Convert to readable SOL message
            const solMessage = insufficientLamports.replace(/(\d+)/g, (_, num) =>
                (parseInt(num) / 1_000_000_000).toFixed(9)
            ).replace("lamports", "SOL");

            throw solMessage + '\n⚠️  Your current SOL amount may differ here and in your wallet because part of your SOL is reserved for rent-reserve or other costs';
        }
        throw error;
    }
}

// Function to check if creator is verified
const checkVerifiedCreator = async (metadataPDA) => {
    try {
        const metadata = await Metadata.fromAccountAddress(connection, metadataPDA);
        const verifiedCreators = metadata.data.creators?.filter(creator => creator.verified);

        if (verifiedCreators?.length > 0) {
            console.log("✅ Verified Creators Found:", verifiedCreators.map(c => c.address.toBase58()));
        } else {
            console.log("❌ No Verified Creators Found.");
        }
    } catch (error) {
        console.error("❌ Failed to fetch metadata:", error.message);
    }
};

const createToken = async (data) => {
    const lamports = await getMinimumBalanceForRentExemptMint(connection);

    // Create token mint
    const mintKeypair = Keypair.generate();
    console.log("🪙  Created mint address:", mintKeypair.publicKey.toBase58());

    // Create token account
    const tokenATA = await getAssociatedTokenAddress(mintKeypair.publicKey, keypair.publicKey);

    // Create PDA for metadata instructions
    const metadataPDA = PublicKey.findProgramAddressSync(
        [
            Buffer.from("metadata"),
            PROGRAM_ID.toBuffer(),
            mintKeypair.publicKey.toBuffer(),
        ],
        PROGRAM_ID
    )[0];

    // Setup instructions for transaction
    const instructions = [
        // Create account for the mint
        SystemProgram.createAccount({
            fromPubkey: keypair.publicKey,
            newAccountPubkey: mintKeypair.publicKey,
            space: MINT_SIZE,
            lamports: lamports,
            programId: TOKEN_PROGRAM_ID,
        }),

        // Initialize mint with specified decimals and authority
        createInitializeMintInstruction(
            mintKeypair.publicKey,
            data.decimals,
            keypair.publicKey,
            keypair.publicKey,
            TOKEN_PROGRAM_ID
        ),

        // Create associated token account for the mint
        createAssociatedTokenAccountInstruction(
            keypair.publicKey,
            tokenATA,
            keypair.publicKey,
            mintKeypair.publicKey
        ),

        // Mint tokens to the associated token account
        createMintToInstruction(
            mintKeypair.publicKey,
            tokenATA,
            keypair.publicKey,
            data.amount * Math.pow(10, data.decimals)
        ),

        // Create metadata for the mint
        createCreateMetadataAccountV3Instruction(
            {
                metadata: metadataPDA,
                mint: mintKeypair.publicKey,
                mintAuthority: keypair.publicKey,
                payer: keypair.publicKey,
                updateAuthority: keypair.publicKey,
            },
            {
                createMetadataAccountArgsV3: {
                    data: {
                        name: data.name,
                        symbol: data.symbol,
                        uri: data.metadata,
                        creators: [
                            {
                                address: new PublicKey(keypair.publicKey.toBase58()),
                                verified: true, // For some fucking reason I have to put this here to even be eligible for verification wtf
                                share: 100, // 100% of the fee goes to this address
                            }
                        ],
                        sellerFeeBasisPoints: data.feePercentage * 100,
                        uses: null,
                        collection: null,
                    },
                    isMutable: false,
                    collectionDetails: null,
                },
            },
        ),
    ];

    // Revoke update authority
    if (data.revoke_update) {
        instructions.push(createUpdateMetadataAccountV2Instruction(
            {
                metadata: metadataPDA,
                updateAuthority: keypair.publicKey,
            },
            {
                updateMetadataAccountArgsV2: {
                    data: null, // Keep metadata unchanged
                    updateAuthority: new PublicKey("11111111111111111111111111111111"), // Set to SystemProgram, revoking it
                    primarySaleHappened: null,
                    isMutable: false,
                },
            }
        ));
        console.log("🔒 Update authority instruction added to transaction");
    }

    // Send bundled transaction including all necessary actions
    await sendTransaction(
        new Transaction().add(...instructions),
        [keypair, mintKeypair],
    );

    // After transaction confirmation, check for verified creator
    // This is to make sure the token is visible on dex screeners and not a fraud
    await checkVerifiedCreator(metadataPDA); // This checks if any creator is verified

    // Revoke mint authority
    if (data.revoke_freeze) {
        await setAuthority(
            connection,
            keypair,
            mintKeypair.publicKey,
            keypair.publicKey,
            AuthorityType.FreezeAccount,
            null
        );
        console.log("❄️  Freeze authority revoked");
    }

    // Revoke freeze authority
    if (data.revoke_mint) {
        await setAuthority(
            connection,
            keypair,
            mintKeypair.publicKey,
            keypair.publicKey,
            AuthorityType.MintTokens,
            null
        );
        console.log("🛑 Mint authority revoked");
    }

    return mintKeypair.publicKey.toBase58();
};

// Function call with set or default params
createToken({
    name: process.env.TOKEN_NAME || 'My token',
    symbol: process.env.TOKEN_SYMBOL || 'MT',
    metadata: process.env.TOKEN_METADATA_URI || null,

    decimals: parseInt(process.env.TOKEN_DECIMALS || 6),
    amount: parseInt(process.env.TOKEN_MINT_AMOUNT.replaceAll('_', '') || 1_000_000_000),
    feePercentage: parseFloat(process.env.TOKEN_FEE_PERCENTAGE || 0),

    revoke_freeze: parseBool(process.env.REVOKE_FREEZE || false), // Freeze Authority allows you to freeze token accounts of holders.
    revoke_mint: parseBool(process.env.REVOKE_MINT || false), // Mint Authority allows you to mint more supply of your token.
    revoke_update: parseBool(process.env.REVOKE_UPDATE || false), // Update Authority allows you to update the token metadata about your token.
})
    .then((tokenMint) => {
        console.log('✅ Token creation complete, visible in your wallet shortly');
        console.log(`🔗 View token at: https://solana.fm/address/${tokenMint}/metadata?cluster=${process.env.NETWORK || ''}-solana`);
        console.log(`⚠️  Revoking authorities takes some time, refresh the solana.fm page until the selected authorities are removed`)
    })
    .catch(err => console.error('❌ Error during token creation:', err));
