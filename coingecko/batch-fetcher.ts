import { kv } from "@vercel/kv";
import {
  cacheAssetsKey,
  cacheAssetsLastSynced,
  fourHoursInSeconds,
} from "./constants";

import moment from "moment";
import { fetchData, fetchFreshData } from "./coingecko-fetcher";
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
  const currentTimestamp = moment().unix();
  const currentDayTimestamp = moment(currentTimestamp * 1000)
    .utc()
    .startOf("day")
    .unix();

  let result: PriceRequest = {};
  for (const symbol of assets) {
    result[symbol] = [];

    const lastSyncedTimestamp: number | null = await kv.hget(
      cacheAssetsLastSynced,
      symbol
    );

    let updatedStoredAssetData: [id: number, price: number][] = [];

    const assetBatches = batches[symbol];

    const lastBatchFinish = moment(
      assetBatches[assetBatches.length - 1].end * 1000
    )
      .utc()
      .startOf("day")
      .unix();

    for (const { start, end } of assetBatches) {
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
      if (lastStoredId === 0) {
        const shift = preselectedData.length - 1;
        if (
          lastSyncedTimestamp &&
          currentDayTimestamp * 1000 ===
            getTimestampFromDayId(preselectedData[shift][0])
        ) {
          const filteredData = preselectedData.slice(0, shift);

          result[symbol].push([
            ...KVDataToPriceArray.parse([...filteredData]),
            ...[
              {
                price: preselectedData[shift][1].toString(),
                timestamp: lastSyncedTimestamp,
              },
            ],
          ]);
        } else {
          result[symbol].push(KVDataToPriceArray.parse(preselectedData));
        }
      } else {
        const response = await fetchData(
          symbol,
          getTimestampFromDayId(lastStoredId) / 1000,
          end
        );

        await kv.hset(cacheAssetsLastSynced, {
          [`${symbol}`]: end,
        });

        response.map(async ([id, price]) => {
          await kv.hset(cacheAssetsKey, { [`${symbol}-${id}`]: price });
        });

        result[symbol].push(
          KVDataToPriceArray.parse([...preselectedData, ...response])
        );
      }
    }

    const lastBatch = result[symbol][result[symbol].length - 1];

    if (
      lastSyncedTimestamp &&
      currentTimestamp - fourHoursInSeconds > lastSyncedTimestamp &&
      getDayId(lastBatch[lastBatch.length - 1].timestamp) ===
        getDayId(currentDayTimestamp)
    ) {
      const response = await fetchFreshData(
        symbol,
        lastSyncedTimestamp,
        currentTimestamp
      );

      await kv.hset(cacheAssetsKey, {
        [`${symbol}-${getDayId(currentTimestamp)}`]: response.price,
      });
      await kv.hset(cacheAssetsLastSynced, {
        [`${symbol}`]: currentTimestamp,
      });
      result[symbol] = {
        ...[
          ...result[symbol].slice(0, result[symbol].length - 1),
          [
            ...lastBatch.slice(0, lastBatch.length - 1),
            { timestamp: currentTimestamp, price: response.price },
          ],
        ],
      };
    }
  }
  return result;
};
