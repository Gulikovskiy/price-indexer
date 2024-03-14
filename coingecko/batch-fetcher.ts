import { kv } from "@vercel/kv";
import {
  cacheAssetsKey,
  cacheAssetsLastSynced,
  cacheKey,
  productStartInSeconds,
} from "./constants";

import moment from "moment";
import { fetchData } from "./coingecko-fetcher";
import { RangeMap } from "./interfaces";
import { KVDataToPriceArray, getDayId, getTimestampFromDayId } from "./utils";

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

  let result: PriceRequest = {};
  for (const symbol of assets) {
    result[symbol] = [];
    let updatedStoredAssetData: [id: number, price: number][] = [];

    const assetBatches = batches[symbol];

    const lastBatchFinish = moment(
      assetBatches[assetBatches.length - 1].end * 1000
    )
      .utc()
      .startOf("day")
      .unix();

    for (const { start, end } of assetBatches) {
      console.log(
        "asset: ",
        symbol,
        "start: ",
        start,
        "startID: ",
        getDayId(start),
        "end: ",
        end,
        "endID: ",
        getDayId(end)
      );
      const startId = getDayId(
        moment(start * 1000)
          .utc()
          .startOf("day")
          .unix()
      );

      const endId = getDayId(
        moment(end * 1000)
          .utc()
          .startOf("day")
          .unix()
      );

      let lastStoredId: number = 0;
      const preselectedData: [number, number][] = [];

      for (let i = startId; i <= endId; i++) {
        const dailyAssetPrice: number | null = await kv.hget(
          cacheAssetsKey,
          `${symbol}-${i}`
        );

        if (dailyAssetPrice) {
          preselectedData.push([i, dailyAssetPrice]);
        } else {
          lastStoredId = i;
          break;
        }
      }
      console.info(
        `BATCHES Data from cache(${symbol}): ${preselectedData[0][0]}-${
          preselectedData[0][1]
        }...${preselectedData[preselectedData.length - 1][0]}-${
          preselectedData[preselectedData.length - 1][1]
        }`
      );
      result[symbol].push(KVDataToPriceArray.parse(preselectedData));
    }

    const lastSyncedTimestamp: number | null = await kv.hget(
      cacheAssetsLastSynced,
      symbol
    );
  }
  return result;
};
