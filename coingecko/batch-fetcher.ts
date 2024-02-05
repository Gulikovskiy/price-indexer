import { kv } from "@vercel/kv";
import { cacheKey } from "./constants";

import { RangeMap } from "./interfaces";
import { KVDataToPriceArray, getDayId } from "./utils";

export type Price = {
  price: string;
  timestamp: number;
};

export type PriceRequest = { [asset: string]: Price[][] };

export const fetchBatches = async (
  batches: RangeMap
): Promise<PriceRequest> => {
  // TODO: add error type

  const assets = Object.keys(batches);
  const stored: Record<string, [id: number, price: number][]> | null =
    await kv.hgetall(cacheKey);

  let result: PriceRequest = {};

  for (const symbol of assets) {
    const assetBatches = batches[symbol];
    result[symbol] = [];
    const storedAssetData = stored ? stored[symbol] || null : null;
    for (let i = 0; i < assetBatches.length; i++) {
      const singleBatch = assetBatches[i];
      const startDayId = getDayId(singleBatch.start);
      const endDayId = getDayId(singleBatch.end);
      if (storedAssetData !== null) {
        result[symbol].push(
          KVDataToPriceArray.parse(
            storedAssetData.slice(Math.max(0, startDayId), endDayId)
          )
        );
      }
    }
  }
  return result;
};
