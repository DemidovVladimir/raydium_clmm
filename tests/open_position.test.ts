import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { RaydiumClmm } from "../target/types/raydium_clmm";
import { setupInitializeTest, initializeClmmPool, openPosition } from "./utils";
import { Raydium } from "@raydium-io/raydium-sdk-v2";

describe("open position test", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const owner = anchor.Wallet.local().payer;
  const connection = anchor.getProvider().connection;
  const program = anchor.workspace.RaydiumClmm as Program<RaydiumClmm>;

  const confirmOptions = {
    skipPreflight: true,
  };

  it("open position", async () => {
    const { token0, token0Program, token1, token1Program } =
      await setupInitializeTest(
        connection,
        owner,
        { transferFeeBasisPoints: 0, MaxFee: 0 },
        confirmOptions
      );

    const { poolAddress, tx } = await initializeClmmPool(
      program,
      owner,
      token0,
      token0Program,
      token1,
      token1Program,
      0,
      confirmOptions
    );

    const raydium = await Raydium.load({
      owner,
      connection,
    });

    const data = await raydium.clmm.getPoolInfoFromRpc(poolAddress.toString());

    const { positionNftMint, ix: openIx } = await openPosition(
      program,
      owner,
      data.poolKeys,
      -10,
      10,
      new BN(10100000),
      new BN(10100000000),
      new BN(10100000000),
      confirmOptions
    );

    console.log(" openIx:", openIx);
  });
});