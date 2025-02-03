# Raydium CLMM (Concentrated Liquidity Market Maker)

## This repo is an example of the Raydium CLMM usecase.

In order to use it on the devenv, you will need to adjust config.ts as well as the Anchor.toml file. So be sure that you are using the correct program id and config address.

## How to run the tests

```
anchor test -- --features devnet
```

I decided to use CLMM as I think that it give more granularity to the liquidity management, by utilizing the 'ticks' concept.