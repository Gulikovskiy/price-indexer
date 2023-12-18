import "server-only";
import { PriceRawResponse } from "../pages/api/historical-price";
import { kv } from "@vercel/kv";
import moment from "moment";

const millisecondsInDay = 86400000;
const millisecondsInMinute = 60000;
const refreshInterval = 5; //minutes

type Price = {
  timestamp: number;
  price: number;
};
type Response = { [symbol: string]: Price[] | null };

const coinList = {
  //BLOCKCHAINS & CHAINS & FAMOUS
  BTC: { id: "bitcoin" },
  ETH: { id: "ethereum" },
  BNB: { id: "binancecoin" },
  SOL: { id: "solana" },
  ADA: { id: "cardano" },
  AVAX: { id: "avalanche-2" },
  MATIC: { id: "matic-network" },
  DOT: { id: "polkadot" },
  TRON: { id: "tron" },
  OP: { id: "optimism" },
  ATOM: { id: "cosmos" },
  NEAR: { id: "near" },
  FTM: { id: "fantom" },
  GNO: { id: "gnosis" },
  TON: { id: "the-open-network" },
  ARB: { id: "arbitrum" },
  LINK: { id: "chainlink" },
  LTC: { id: "litecoin" },
  XLM: { id: "stellar" },
  TIA: { id: "celestia" },
  GRT: { id: "the-graph" },
  ALGO: { id: "algorand" },

  //MEME COINS
  DOGE: { id: "dogecoin" },
  SHIB: { id: "shiba-inu" },
  BONK: { id: "bonk" },

  //STABLES
  USDC: { id: "usd-coin" },
  USDT: { id: "tether" },
  DAI: { id: "dai" },
  TUSD: { id: "true-usd" },
  FDUSD: { id: "first-digital-usd" },
  BUSD: { id: "binance-usd" },
  USDD: { id: "usdd" },

  //WRAPPED
  WBTC: { id: "wrapped-bitcoin" },
  WETH: { id: "weth" },
  WAVAX: { id: "wrapped-avax" },
  WMATIC: { id: "wmatic" },

  //PDI(active)
  LDO: { id: "lido-dao" },
  UNI: { id: "uniswap" },
  SNX: { id: "havven" },
  AAVE: { id: "aave" },
  MKR: { id: "maker" },
  FXS: { id: "frax-share" },
  CRV: { id: "curve-dao-token" },
  RPL: { id: "rocket-pool" },
  CVX: { id: "convex-finance" },
  COMP: { id: "compound-governance-token" },
  YFI: { id: "yearn-finance" },
  BAL: { id: "balancer" },
  //PDI(inactive)
  "1INCH": { id: "1inch" },
  RBN: { id: "ribbon-finance" },
  SUSHI: { id: "sushi" },
  LQTY: { id: "liquity" },
  LRC: { id: "loopring" },
  ALCX: { id: "alchemix" },
  AMP: { id: "amp-token" },

  //CAI(active)
  JOE: { id: "joe" },
  SAVAX: { id: "benqi-liquid-staked-avax" },
  //CAI(inactive)
  QI: { id: "benqi" },
};

export const fetchCoingeckoPrices = async (
  assets: string[],
  timestamp: number
) => {
  const fetchResponse: Response = {};
  const currentTimestamp = moment().unix() * 1000;

  const totalDays = Math.ceil(
    (currentTimestamp - timestamp) / millisecondsInDay
  );

  for (let i = 0; i < assets.length; i++) {
    const symbol = assets[i];
    const { id } = coinList[symbol];
    const currentKey = `test-${symbol}`;
    const stored = await kv.hgetall("test1");

    const selectedAssetData = stored ? (stored[currentKey] as Price[]) : null;
    const isDataInStorage = selectedAssetData !== undefined;
    if (isDataInStorage && totalDays === selectedAssetData.length - 1) {
      const latestTimeStamp =
        selectedAssetData[selectedAssetData.length - 1].timestamp;

      if (
        latestTimeStamp + refreshInterval * millisecondsInMinute <=
        currentTimestamp
      ) {
        const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=1&interval=daily&precision=3`;
        const res = await fetch(url);
        if (res.status !== 200) {
          console.error("Coingecko API failed with code %s", res.status);
          return null;
        }
        const latestPrice = await res
          .json()
          .then((el: PriceRawResponse) =>
            el.prices.map((el) => ({ timestamp: el[0], price: el[1] } as Price))
          );
        const updatedArray = [
          ...selectedAssetData.slice(0, selectedAssetData.length - 1),
          latestPrice[latestPrice.length - 1],
        ];
        kv.hset("test1", { [currentKey]: updatedArray });
        fetchResponse[symbol] = updatedArray;
      } else {
        fetchResponse[symbol] = selectedAssetData;
      }
    } else {
      const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${totalDays}&interval=daily&precision=3`;

      const res = await fetch(url);
      if (res.status !== 200) {
        console.error("Coingecko API failed with code %s", res.status);
        return null;
      }
      const response = await res
        .json()
        .then((el: PriceRawResponse) =>
          el.prices.map((el) => ({ timestamp: el[0], price: el[1] } as Price))
        );

      kv.hset("test1", { [currentKey]: response });
      await (fetchResponse[symbol] = response);
    }
  }

  return fetchResponse;
};
