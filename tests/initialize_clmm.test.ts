import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { RaydiumClmm } from "../target/types/raydium_clmm";
import { setupInitializeTest, initializeClmmPool } from "./utils";

describe("initialize test", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const owner = anchor.Wallet.local().payer;
  const program = anchor.workspace.RaydiumClmm as Program<RaydiumClmm>;

  const confirmOptions = {
    skipPreflight: true,
  };

  it("create pool", async () => {
    const { token0, token0Program, token1, token1Program } =
      await setupInitializeTest(
        anchor.getProvider().connection,
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

    console.log("pool address: ", poolAddress.toString(), " tx:", tx);
  });
});
