import "server-only";
import { PriceRawResponse } from "../pages/api/historical-price";
import { kv } from "@vercel/kv";

type Price = {
  timestamp: number;
  price: number;
};
type Response = { [symbol: string]: Price[] | null };

const coinList = {
  USDC: {
    id: "usd-coin",
    contract: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  },
  WBTC: {
    id: "wrapped-bitcoin",
    contract: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
  },
  UNI: {
    id: "uniswap",
    contract: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
  },
};

export const fetchCoingeckoPrices = async (
  assets: string[],
  timestamps: { start: number; finish: number }
) => {
  const fetchResponse: Response = {};
  for (let i = 0; i < assets.length; i++) {
    const symbol = assets[i];
    const currentKey = `test-${symbol}`;
    const stored = await kv.hgetall("test1");

    const selectedAssetData = stored ? (stored[currentKey] as Price[]) : null;
    const isDataInStorage = selectedAssetData !== undefined;
    if (isDataInStorage) {
      fetchResponse[symbol] = selectedAssetData;
    } else {
      const { id, contract } = coinList[symbol];
      const { start, finish } = timestamps;
      //TODO: USE `api.coingecko.com/api/v3/coins/${id}/market_chart` because of the contract address
      const url = `https://api.coingecko.com/api/v3/coins/${id}/contract/${contract}/market_chart/range?vs_currency=usd&from=${start}&to=${finish}&precision=4`;
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

  console.log("fetchResponse: ", fetchResponse);
  return fetchResponse;
};
