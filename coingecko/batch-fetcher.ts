import { kv } from "@vercel/kv";
import { cacheKey, productStartInSeconds } from "./constants";

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
  let stored: Record<string, [id: number, price: number][]> | null =
    await kv.hgetall(cacheKey);

  let result: PriceRequest = {};
  for (const symbol of assets) {
    result[symbol] = [];
    let updatedStoredAssetData: [id: number, price: number][] = [];

    const assetBatches = batches[symbol];
    let storedAssetData = stored ? stored[symbol] || null : null;

    const lastBatchFinish = moment(
      assetBatches[assetBatches.length - 1].end * 1000
    )
      .utc()
      .startOf("day")
      .unix();

    // TODO: update
    // for (const { start, end } of assetBatches) {
    //   const startId = getDayId(
    //     moment(start * 1000)
    //       .utc()
    //       .startOf("day")
    //       .unix()
    //   );

    //   const endId = getDayId(
    //     moment(end * 1000)
    //       .utc()
    //       .startOf("day")
    //       .unix()
    //   );
    //   for (let i = startId; i <= endId; i++) {
    //     const storedAssetData = await kv.hget(cacheAssetKey, `${symbol}-${i}`);
    //   }
    // }

    if (storedAssetData === null) {
      const response = await fetchData(
        symbol,
        productStartInSeconds,
        lastBatchFinish
      );
      console.info(
        `BATCHES Requested data(${symbol}): ${response[0][0]}-${
          response[0][1]
        }...${response[response.length - 1][0]}-${
          response[response.length - 1][1]
        }. SAVED TO CACHE`
      );
      await kv.hset(cacheKey, { [symbol]: response });
      updatedStoredAssetData = response;
    }

    if (storedAssetData !== null && storedAssetData.length !== 0) {
      const [lastStoredId] = storedAssetData[storedAssetData.length - 1];

      const lastBatchId = getDayId(lastBatchFinish);
      const freshAsset = storedAssetData.length - 1 < lastBatchId;

      if (lastStoredId < lastBatchId) {
        const lastStoredTimestamp = getTimestampFromDayId(lastStoredId);
        const prices = await fetchData(
          symbol,
          moment(lastStoredTimestamp).unix(),
          moment(lastBatchFinish * 1000)
            .add(10, "minute")
            .unix()
        );

        const updatedKVStorageData = [
          ...storedAssetData.slice(0, -1),
          ...prices,
        ];
        console.info(
          `BATCHES Data from cache(${symbol}): ${storedAssetData[0][0]}-${
            storedAssetData[0][1]
          }...${storedAssetData[storedAssetData.length - 1][0]}-${
            storedAssetData[storedAssetData.length - 1][1]
          }`
        );

        if (prices.length !== 0) {
          console.info(`BATCHES Requested data(${symbol}): 
        ${prices[0][0]}-${prices[0][1]}...${prices[prices.length - 1][0]}-${
            prices[prices.length - 1][1]
          }
        . SAVED TO CACHE`);
        }
        await kv.hset(cacheKey, { [symbol]: updatedKVStorageData });
        if (stored !== null) {
          await updatedStoredAssetData.push(...updatedKVStorageData);
        }
      } else {
        await updatedStoredAssetData.push(...storedAssetData);
      }

      for (let i = 0; i < assetBatches.length; i++) {
        const singleBatch = assetBatches[i];
        const startDayId = getDayId(singleBatch.start);
        const endDayId = getDayId(singleBatch.end);
        const [lastUpdatedId] =
          updatedStoredAssetData[updatedStoredAssetData.length - 1];
        const startOffset = freshAsset
          ? updatedStoredAssetData.length - 1 - (lastUpdatedId - startDayId)
          : startDayId;
        const finishOffset = startOffset + (endDayId - startDayId);
        console.info(
          `BATCHES Data from cache(${symbol}): ${
            updatedStoredAssetData[0][0]
          }-${updatedStoredAssetData[0][1]}...${
            updatedStoredAssetData[updatedStoredAssetData.length - 1][0]
          }-${updatedStoredAssetData[updatedStoredAssetData.length - 1][1]}`
        );
        result[symbol].push(
          KVDataToPriceArray.parse(
            updatedStoredAssetData.slice(
              Math.max(0, startOffset),
              finishOffset + 1
            )
          )
        );
      }
      updatedStoredAssetData = [];
    }
  }
  return result;
};
