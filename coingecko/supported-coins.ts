export const coinList: { [key: string]: string } = {
  //BLOCKCHAINS & CHAINS & FAMOUS
  BTC: "bitcoin",
  ETH: "ethereum",
  // BNB: "binancecoin",
  // SOL: "solana",
  // ADA: "cardano",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  // DOT: "polkadot",
  // TRON: "tron",
  OP: "optimism",
  // ATOM: "cosmos",
  // NEAR: "near",
  // FTM: "fantom",
  // GNO: "gnosis",
  // ARB: "arbitrum",
  LINK: "chainlink",
  // LTC: "litecoin",
  // XLM: "stellar",
  // GRT: "the-graph",
  // ALGO: "algorand",

  //MEME COINS
  // DOGE: "dogecoin",
  // SHIB: "shiba-inu",

  //STABLES
  USDC: "usd-coin",
  USDT: "tether",
  DAI: "dai",
  TUSD: "true-usd",
  FDUSD: "first-digital-usd",
  BUSD: "binance-usd",

  //WRAPPED
  WBTC: "wrapped-bitcoin",
  WETH: "weth",
  WAVAX: "wrapped-avax",
  WMATIC: "wmatic",

  //PDI(active)
  LDO: "lido-dao",
  UNI: "uniswap",
  SNX: "havven",
  AAVE: "aave",
  MKR: "maker",
  FXS: "frax-share",
  CRV: "curve-dao-token",
  RPL: "rocket-pool",

  CVX: "convex-finance",
  COMP: "compound-governance-token",
  YFI: "yearn-finance",
  BAL: "balancer",
  //PDI(inactive)
  "1INCH": "1inch",
  RBN: "ribbon-finance",
  SUSHI: "sushi",
  LQTY: "liquity",
  LRC: "loopring",
  ALCX: "alchemix",
  AMP: "amp-token",

  //CAI(active)
  JOE: "joe",
  SAVAX: "benqi-liquid-staked-avax",
  XAVA: "avalaunch",
  //
  //CAI(inactive)
  QI: "benqi",
  //test
  // VET: "vechain",
  // AXS: "axie-infinity",
} as const;

export type TokenId = (typeof coinList)[keyof typeof coinList];
