use anchor_lang::prelude::*;

mod instructions;
use instructions::*;

declare_id!("G6QgP9DbJ2u4fAdi34xC7jAJzKTZERvT7sqmmkgjAC9D");

#[program]
pub mod raydium_clmm {
    use super::*;

    pub fn initialize_clmm_pool(ctx: Context<InitializeClmmPool>, sqrt_price_x64: u128, open_time: u64) -> Result<()> {
        instructions::initialize_clmm_pool_handler(ctx, sqrt_price_x64, open_time)
    }

    pub fn open_position<'a, 'b, 'c: 'info, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, OpenPosition<'info>>,
        tick_lower_index: i32,
        tick_upper_index: i32,
        tick_array_lower_start_index: i32,
        tick_array_upper_start_index: i32,
        liquidity: u128,
        amount_0_max: u64,
        amount_1_max: u64,
        with_matedata: bool,
        // base_flag: Option<bool>,
    ) -> Result<()> {
        instructions::open_position(
            ctx,
            tick_lower_index,
            tick_upper_index,
            tick_array_lower_start_index,
            tick_array_upper_start_index,
            liquidity,
            amount_0_max,
            amount_1_max,
            with_matedata,
            None,
        )
    }

    pub fn add_liquidity<'a, 'b, 'c: 'info, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, AddLiquidity<'info>>,
        liquidity: u128,
        amount_0_max: u64,
        amount_1_max: u64,
        base_flag: Option<bool>,
    ) -> Result<()> {
        instructions::add_liquidity(
            ctx,
            liquidity,
            amount_0_max,
            amount_1_max,
            base_flag,
        )
    }
    pub fn remove_liquidity<'a, 'b, 'c: 'info, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, RemoveLiquidity<'info>>,
        liquidity: u128,
        amount_0_min: u64,
        amount_1_min: u64,
    ) -> Result<()> {
        instructions::remove_liquidity(ctx, liquidity, amount_0_min, amount_1_min)
    }
}

