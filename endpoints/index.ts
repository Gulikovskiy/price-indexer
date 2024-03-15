import { kv } from "@vercel/kv";
import {
  precision,
  maxAssetsAmount,
  maxRangeDays,
  maxBatchNumber,
  millisecondsInDay,
  cacheAssetsLastSynced,
} from "../coingecko/constants";
import { coinList } from "../coingecko/supported-coins";
import { getTimestampFromDayId } from "../coingecko/utils";

export const getEndpoints = async () => {
  const keys = Object.keys(coinList);
  const endpoints = await Promise.all(
    keys.map(async (symbol) => [
      symbol,
      await kv.hget(cacheAssetsLastSynced, symbol),
    ])
  );
  return await endpoints;
};

export const getServerConfig = () => ({
  assetPrecision: precision,
  maxAssetsAmount,
  maxRangeDays,
  maxBatchNumber,
  granularity: millisecondsInDay / 1000,
});
