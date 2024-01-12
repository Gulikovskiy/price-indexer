import { kv } from "@vercel/kv";
import { cacheKey } from "../coingecko/constants";
import { coinList } from "../coingecko/supported-coins";
import { getTimestampFromDayId } from "../coingecko/utils";

export const getEndpoints = async () => {
  const stored: Record<string, [id: number, price: number][]> | null =
    await kv.hgetall(cacheKey);
  const keys = Object.keys(coinList);
  const endpoints = keys.map((symbol) => {
    const storedAssetData = stored ? stored[symbol] || null : null;
    if (storedAssetData === null) {
      return [symbol, 0];
    }
    const endpoint = storedAssetData[0][0];

    return [symbol, getTimestampFromDayId(endpoint)];
  });
  return endpoints;
};
