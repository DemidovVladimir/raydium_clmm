import { Program, BN, Instruction } from "@coral-xyz/anchor";
import { RaydiumClmm } from "../../target/types/raydium_clmm";
import {
  Connection,
  ConfirmOptions,
  PublicKey,
  Keypair,
  Signer,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { ClmmKeys, TickUtils, SqrtPriceMath, MEMO_PROGRAM_ID } from "@raydium-io/raydium-sdk-v2";
import { createTokenMintAndAssociatedTokenAccount } from "./util";
import {
  getNftMetadataAddress,
  getOracleAccountAddress,
  getPersonalPositionAddress,
  getPoolAddress,
  getPoolVaultAddress,
  getProtocolPositionAddress,
  getTickArrayAddress,
  getTickArrayBitmapAddress,
} from "./pda";
import { configAddress, raydiumClmmProgramId } from "../config";

export async function setupInitializeTest(
  connection: Connection,
  owner: Signer,
  transferFeeConfig: { transferFeeBasisPoints: number; MaxFee: number } = {
    transferFeeBasisPoints: 0,
    MaxFee: 0,
  },
  confirmOptions?: ConfirmOptions
) {
  const [{ token0, token0Program }, { token1, token1Program }] =
    await createTokenMintAndAssociatedTokenAccount(
      connection,
      owner,
      new Keypair(),
      transferFeeConfig
    );
  return {
    token0,
    token0Program,
    token1,
    token1Program,
  };
}

export async function initializeClmmPool(
  program: Program<RaydiumClmm>,
  creator: Signer,
  token0: PublicKey,
  token0Program: PublicKey,
  token1: PublicKey,
  token1Program: PublicKey,
  initTick: number,
  confirmOptions?: ConfirmOptions
) {
  const [poolAddress, _bump1] = await getPoolAddress(
    configAddress,
    token0,
    token1,
    raydiumClmmProgramId
  );
  console.log("poolAddress: ", poolAddress.toString());
  const [vault0, _bump2] = await getPoolVaultAddress(
    poolAddress,
    token0,
    raydiumClmmProgramId
  );
  console.log("vault0: ", vault0.toString());
  const [vault1, _bump3] = await getPoolVaultAddress(
    poolAddress,
    token1,
    raydiumClmmProgramId
  );
  console.log("vault1: ", vault1.toString());

  const [tick_array_bitmap, _bump4] = await getTickArrayBitmapAddress(
    poolAddress,
    raydiumClmmProgramId
  );
  console.log("tick_array_bitmap: ", tick_array_bitmap.toString());
  const [observation, _bump5] = await getOracleAccountAddress(
    poolAddress,
    raydiumClmmProgramId
  );
  console.log("observation: ", observation.toString());

  const [bitmapExtension, _bump111] = await getTickArrayBitmapAddress(
    poolAddress,
    program.programId
  );
  console.log("bitmapExtension: ", bitmapExtension.toString());

  const sqrtPriceX64 = SqrtPriceMath.getSqrtPriceX64FromTick(initTick);
  console.log("sqrtPriceX64: ", sqrtPriceX64.toString());

  console.log('program.methods: ', program.methods);
  console.log('configAddress: ', configAddress);

  const tx = await program.methods
    .initializeClmmPool(sqrtPriceX64, new BN(0))
    .accounts({
      clmmProgram: raydiumClmmProgramId,
      poolCreator: creator.publicKey,
      ammConfig: configAddress,
      poolState: poolAddress,
      tokenMint0: token0,
      tokenMint1: token1,
      tokenVault0: vault0,
      tokenVault1: vault1,
      observationState: observation,
      tickArrayBitmap: tick_array_bitmap,
      tokenProgram0: token0Program,
      tokenProgram1: token1Program,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .remainingAccounts([
      { pubkey: bitmapExtension, isSigner: false, isWritable: true },
    ])
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }),
    ])
    .rpc(confirmOptions);

  console.log("tx: ", tx);

  return { poolAddress, tx };
}

export async function openPosition(
  program: Program<RaydiumClmm>,
  owner: Signer,
  poolKeys: ClmmKeys,
  tickLowerIndex: number,
  tickUpperIndex: number,
  liquidity: BN,
  amount0Max: BN,
  amount1Max: BN,
  confirmOptions?: ConfirmOptions
) {
  // prepare tickArray
  const tickArrayLowerStartIndex = TickUtils.getTickArrayStartIndexByTick(
    tickLowerIndex,
    poolKeys.config.tickSpacing
  );
  const [tickArrayLower] = await getTickArrayAddress(
    new PublicKey(poolKeys.id),
    raydiumClmmProgramId,
    tickArrayLowerStartIndex
  );
  const tickArrayUpperStartIndex = TickUtils.getTickArrayStartIndexByTick(
    tickUpperIndex,
    poolKeys.config.tickSpacing
  );
  const [tickArrayUpper] = await getTickArrayAddress(
    new PublicKey(poolKeys.id),
    raydiumClmmProgramId,
    tickArrayUpperStartIndex
  );
  const positionNftMint = Keypair.generate();
  const positionANftAccount = getAssociatedTokenAddressSync(
    positionNftMint.publicKey,
    owner.publicKey
  );

  const metadataAccount = (
    await getNftMetadataAddress(positionNftMint.publicKey)
  )[0];

  const [personalPosition] = await getPersonalPositionAddress(
    positionNftMint.publicKey,
    raydiumClmmProgramId
  );

  const [protocolPosition] = await getProtocolPositionAddress(
    new PublicKey(poolKeys.id),
    raydiumClmmProgramId,
    tickLowerIndex,
    tickUpperIndex
  );

  const token0Account = getAssociatedTokenAddressSync(
    new PublicKey(poolKeys.mintA.address),
    owner.publicKey,
    false,
    new PublicKey(poolKeys.mintA.programId)
  );

  const token1Account = getAssociatedTokenAddressSync(
    new PublicKey(poolKeys.mintB.address),
    owner.publicKey,
    false,
    new PublicKey(poolKeys.mintB.programId)
  );

  const [bitmapExtension, _bump111] = await getTickArrayBitmapAddress(
    new PublicKey(poolKeys.id),
    raydiumClmmProgramId
  );

  const tx = await program.methods
    .openPosition(
      tickLowerIndex,
      tickUpperIndex,
      tickArrayLowerStartIndex,
      tickArrayUpperStartIndex,
      new BN(liquidity),
      amount0Max,
      amount1Max,
      true
    )
    .accounts({
      clmmProgram: raydiumClmmProgramId,
      payer: owner.publicKey,
      positionNftOwner: owner.publicKey,
      positionNftMint: positionNftMint.publicKey,
      positionNftAccount: positionANftAccount,
      metadataAccount,
      poolState: new PublicKey(poolKeys.id),
      protocolPosition,
      tickArrayLower,
      tickArrayUpper,
      tokenAccount0: token0Account,
      tokenAccount1: token1Account,
      tokenVault0: new PublicKey(poolKeys.vault.A),
      tokenVault1: new PublicKey(poolKeys.vault.B),
      vault0Mint: new PublicKey(poolKeys.mintA.address),
      vault1Mint: new PublicKey(poolKeys.mintB.address),
      personalPosition,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
      tokenProgram2022: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
      metadataProgram: new PublicKey(
        "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
      ),
    })
    .remainingAccounts([
      { pubkey: bitmapExtension, isSigner: false, isWritable: true },
    ])
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }),
    ])
    .signers([positionNftMint])
    .rpc(confirmOptions);

  return { positionNftMint, personalPosition, protocolPosition, tx };
}

export async function addLiquidity(
  program: Program<RaydiumClmm>,
  owner: Signer,
  poolKeys: ClmmKeys,
  tickLowerIndex: number,
  tickUpperIndex: number,
  liquidity: BN,
  amount0Max: BN,
  amount1Max: BN,
  confirmOptions?: ConfirmOptions
) {
   // prepare tickArray
   const tickArrayLowerStartIndex = TickUtils.getTickArrayStartIndexByTick(
    tickLowerIndex,
    poolKeys.config.tickSpacing
  );
  const [tickArrayLower] = await getTickArrayAddress(
    new PublicKey(poolKeys.id),
    raydiumClmmProgramId,
    tickArrayLowerStartIndex
  );
  const tickArrayUpperStartIndex = TickUtils.getTickArrayStartIndexByTick(
    tickUpperIndex,
    poolKeys.config.tickSpacing
  );
  const [tickArrayUpper] = await getTickArrayAddress(
    new PublicKey(poolKeys.id),
    raydiumClmmProgramId,
    tickArrayUpperStartIndex
  );
  const positionNftMint = Keypair.generate();
  const positionANftAccount = getAssociatedTokenAddressSync(
    positionNftMint.publicKey,
    owner.publicKey
  );

  const metadataAccount = (
    await getNftMetadataAddress(positionNftMint.publicKey)
  )[0];

  const [personalPosition] = await getPersonalPositionAddress(
    positionNftMint.publicKey,
    raydiumClmmProgramId
  );

  const [protocolPosition] = await getProtocolPositionAddress(
    new PublicKey(poolKeys.id),
    raydiumClmmProgramId,
    tickLowerIndex,
    tickUpperIndex
  );

  const token0Account = getAssociatedTokenAddressSync(
    new PublicKey(poolKeys.mintA.address),
    owner.publicKey,
    false,
    new PublicKey(poolKeys.mintA.programId)
  );

  const token1Account = getAssociatedTokenAddressSync(
    new PublicKey(poolKeys.mintB.address),
    owner.publicKey,
    false,
    new PublicKey(poolKeys.mintB.programId)
  );

  const [bitmapExtension, _bump111] = await getTickArrayBitmapAddress(
    new PublicKey(poolKeys.id),
    raydiumClmmProgramId
  );

  const ix = await program.methods
    .addLiquidity(liquidity, amount0Max, amount1Max, true)
    .accounts({
      clmmProgram: raydiumClmmProgramId,
      payer: owner.publicKey,
      positionNftOwner: owner.publicKey,
      positionNftMint: positionNftMint.publicKey,
      positionNftAccount: positionANftAccount,
      metadataAccount,
      poolState: new PublicKey(poolKeys.id),
      protocolPosition,
      tickArrayLower,
      tickArrayUpper,
      tokenAccount0: token0Account,
      tokenAccount1: token1Account,
      tokenVault0: new PublicKey(poolKeys.vault.A),
      tokenVault1: new PublicKey(poolKeys.vault.B),
      vault0Mint: new PublicKey(poolKeys.mintA.address),
      vault1Mint: new PublicKey(poolKeys.mintB.address),
      personalPosition,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
      tokenProgram2022: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
      metadataProgram: new PublicKey(
        "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
      ),
    })
    .remainingAccounts([
      { pubkey: bitmapExtension, isSigner: false, isWritable: true },
    ])
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }),
    ])
    .signers([positionNftMint])
    .instruction();

  return { positionNftMint, personalPosition, protocolPosition, ix };
}


export async function removeLiquidity(
  program: Program<RaydiumClmm>,
  owner: Signer,
  poolKeys: ClmmKeys,
  tickLowerIndex: number,
  tickUpperIndex: number,
  liquidity: BN,
  amount0Max: BN,
  amount1Max: BN,
  confirmOptions?: ConfirmOptions
) {
   // prepare tickArray
   const tickArrayLowerStartIndex = TickUtils.getTickArrayStartIndexByTick(
    tickLowerIndex,
    poolKeys.config.tickSpacing
  );
  const [tickArrayLower] = await getTickArrayAddress(
    new PublicKey(poolKeys.id),
    raydiumClmmProgramId,
    tickArrayLowerStartIndex
  );
  const tickArrayUpperStartIndex = TickUtils.getTickArrayStartIndexByTick(
    tickUpperIndex,
    poolKeys.config.tickSpacing
  );
  const [tickArrayUpper] = await getTickArrayAddress(
    new PublicKey(poolKeys.id),
    raydiumClmmProgramId,
    tickArrayUpperStartIndex
  );
  const positionNftMint = Keypair.generate();
  const positionANftAccount = getAssociatedTokenAddressSync(
    positionNftMint.publicKey,
    owner.publicKey
  );

  const metadataAccount = (
    await getNftMetadataAddress(positionNftMint.publicKey)
  )[0];

  const [personalPosition] = await getPersonalPositionAddress(
    positionNftMint.publicKey,
    raydiumClmmProgramId
  );

  const [protocolPosition] = await getProtocolPositionAddress(
    new PublicKey(poolKeys.id),
    raydiumClmmProgramId,
    tickLowerIndex,
    tickUpperIndex
  );

  const token0Account = getAssociatedTokenAddressSync(
    new PublicKey(poolKeys.mintA.address),
    owner.publicKey,
    false,
    new PublicKey(poolKeys.mintA.programId)
  );

  const token1Account = getAssociatedTokenAddressSync(
    new PublicKey(poolKeys.mintB.address),
    owner.publicKey,
    false,
    new PublicKey(poolKeys.mintB.programId)
  );

  const [bitmapExtension, _bump111] = await getTickArrayBitmapAddress(
    new PublicKey(poolKeys.id),
    raydiumClmmProgramId
  );

  const ix = await program.methods
    .removeLiquidity(liquidity, amount0Max, amount1Max)
    .accounts({
      clmmProgram: raydiumClmmProgramId,
      payer: owner.publicKey,
      positionNftOwner: owner.publicKey,
      positionNftMint: positionNftMint.publicKey,
      positionNftAccount: positionANftAccount,
      metadataAccount,
      poolState: new PublicKey(poolKeys.id),
      protocolPosition,
      tickArrayLower,
      tickArrayUpper,
      tokenAccount0: token0Account,
      tokenAccount1: token1Account,
      tokenVault0: new PublicKey(poolKeys.vault.A),
      tokenVault1: new PublicKey(poolKeys.vault.B),
      vault0Mint: new PublicKey(poolKeys.mintA.address),
      vault1Mint: new PublicKey(poolKeys.mintB.address),
      personalPosition,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
      tokenProgram2022: TOKEN_2022_PROGRAM_ID,
      memoProgram: MEMO_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
      metadataProgram: new PublicKey(
        "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
      ),
    })
    .remainingAccounts([
      { pubkey: bitmapExtension, isSigner: false, isWritable: true },
    ])
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }),
    ])
    .signers([positionNftMint])
    .instruction();

  return { positionNftMint, personalPosition, protocolPosition, ix };
}
