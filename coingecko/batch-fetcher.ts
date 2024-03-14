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
  // let stored: Record<string, [id: number, price: number][]> | null =
  //   await kv.hgetall(cacheKey);

  let result: PriceRequest = {};
  for (const symbol of assets) {
    result[symbol] = [];
    let updatedStoredAssetData: [id: number, price: number][] = [];

    const assetBatches = batches[symbol];
    // let storedAssetData = stored ? stored[symbol] || null : null;

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

    // if (storedAssetData === null) {
    //   const response = await fetchData(
    //     symbol,
    //     productStartInSeconds,
    //     lastBatchFinish
    //   );
    //   console.info(
    //     `BATCHES Requested data(${symbol}): ${response[0][0]}-${
    //       response[0][1]
    //     }...${response[response.length - 1][0]}-${
    //       response[response.length - 1][1]
    //     }. SAVED TO CACHE`
    //   );
    //   await kv.hset(cacheKey, { [symbol]: response });
    //   updatedStoredAssetData = response;
    // }
    const preselectedData: [number, number][] = [];
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
    }

    const lastSyncedTimestamp: number | null = await kv.hget(
      cacheAssetsLastSynced,
      symbol
    );

    if (preselectedData && lastSyncedTimestamp) {
      // const [lastStoredId] = storedAssetData[storedAssetData.length - 1];

      // const lastBatchId = getDayId(lastBatchFinish);
      const freshAsset = lastSyncedTimestamp < lastBatchFinish;

      // if (lastStoredId < lastBatchId) {
      //   const lastStoredTimestamp = getTimestampFromDayId(lastStoredId);
      //   const prices = await fetchData(
      //     symbol,
      //     moment(lastStoredTimestamp).unix(),
      //     moment(lastBatchFinish * 1000)
      //       .add(10, "minute")
      //       .unix()
      //   );

      //   const updatedKVStorageData = [
      //     ...storedAssetData.slice(0, -1),
      //     ...prices,
      //   ];
      //   console.info(
      //     `BATCHES Data from cache(${symbol}): ${storedAssetData[0][0]}-${
      //       storedAssetData[0][1]
      //     }...${storedAssetData[storedAssetData.length - 1][0]}-${
      //       storedAssetData[storedAssetData.length - 1][1]
      //     }`
      //   );

      //   if (prices.length !== 0) {
      //     console.info(`BATCHES Requested data(${symbol}):
      //   ${prices[0][0]}-${prices[0][1]}...${prices[prices.length - 1][0]}-${
      //       prices[prices.length - 1][1]
      //     }
      //   . SAVED TO CACHE`);
      //   }
      //   await kv.hset(cacheKey, { [symbol]: updatedKVStorageData });
      //   if (stored !== null) {
      //     await updatedStoredAssetData.push(...updatedKVStorageData);
      //   }
      // } else {
      await updatedStoredAssetData.push(...preselectedData);
      // }

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

// import { kv } from "@vercel/kv";
// import { cacheAssetsKey, cacheAssetsLastSynced, cacheKey, productStartInSeconds } from "./constants";

// import moment from "moment";
// import { fetchData } from "./coingecko-fetcher";
// import { RangeMap } from "./interfaces";
// import { KVDataToPrice, KVDataToPriceArray, getDayId, getTimestampFromDayId } from "./utils";

// export type Price = {
//   price: string;
//   timestamp: number;
// };

// export type PriceRequest = { [asset: string]: Price[][] };

// export const fetchBatches = async (
//   batches: RangeMap
// ): Promise<PriceRequest> => {
//   // TODO: add error type

//   const assets = Object.keys(batches);
//   // let stored: Record<string, [id: number, price: number][]> | null =
//   //   await kv.hgetall(cacheKey);

//   const currentTimestamp = moment().unix();
//   const currentDayTimestamp = moment(currentTimestamp * 1000)
//     .utc()
//     .startOf("day")
//     .unix();

//   let result: PriceRequest = {};
//   for (const symbol of assets) {
//     result[symbol] = [];
//     let updatedStoredAssetData: [id: number, price: number][] = [];

//     const assetBatches = batches[symbol];
//     // let storedAssetData = stored ? stored[symbol] || null : null;

//     const lastBatchFinish = moment(
//       assetBatches[assetBatches.length - 1].end * 1000
//     )
//       .utc()
//       .startOf("day")
//       .unix();

//     // TODO: update
//     for (const { start, end } of assetBatches) {
//       const startId = getDayId(
//         moment(start * 1000)
//           .utc()
//           .startOf("day")
//           .unix()
//       );

//       const endId = getDayId(
//         moment(end * 1000)
//           .utc()
//           .startOf("day")
//           .unix()
//       );

//       const lastSyncedTimestamp: number | null = await kv.hget(
//         cacheAssetsLastSynced,
//         symbol
//       );

//       // if (!lastSyncedTimestamp) {
//       //   // INFO: empty database

//       //   const response = await fetchData(
//       //     symbol,
//       //     startTimestamp,
//       //     finishTimestamp
//       //   );
//       //   console.info(
//       //     `Requested data(${symbol}): ${response[0][0]}-${response[0][1]}...${
//       //       response[response.length - 1][0]
//       //     }-${response[response.length - 1][1]}`
//       //   );
//       //   data[symbol] = KVDataToPrice.parse(response);
//       //   response.map(async ([id, price]) => {
//       //     await kv.hset(cacheAssetsKey, { [`${symbol}-${id}`]: price });
//       //   });

//       //   await kv.hset(cacheAssetsLastSynced, {
//       //     [`${symbol}`]: finishTimestamp,
//       //   });

//       //   return;
//       // }

//       if (lastSyncedTimestamp) {

//         // const lastSyncedTimestamp: number | null = await kv.hget(
//         //   cacheAssetsLastSynced,
//         //   symbol
//         // );

//         // const [lastStoredId] = storedAssetData[storedAssetData.length - 1];

//         const lastBatchId = getDayId(lastBatchFinish);
//         const freshAsset = getDayId(lastSyncedTimestamp) < lastBatchId;

//         const preselectedData: [number, number][] = [];
//       let lastStoredId: number = 0;
//       for (let i = startId; i <= endId; i++) {
//         // const storedAssetData = await kv.hget(cacheAssetKey, `${symbol}-${i}`);
//         const dailyAssetPrice: number | null = await kv.hget(
//           cacheAssetsKey,
//           `${symbol}-${i}`
//         );

//         if (dailyAssetPrice) {
//           preselectedData.push([i, dailyAssetPrice]);
//         } else {
//           lastStoredId = i;
//           break;
//         }
//       }

//       if (lastStoredId === 0) {
//         const shift = preselectedData.length - 1;
//         if (
//           currentDayTimestamp * 1000 ===
//           getTimestampFromDayId(preselectedData[shift][0])
//         ) {
//           const filteredData = preselectedData.slice(0, shift);
//           const { prices, timestamps } = KVDataToPrice.parse(filteredData);

//           data[symbol] = {
//             prices: [...prices, preselectedData[shift][1].toString()],
//             timestamps: [...timestamps, lastSyncedTimestamp * 1000],
//           };
//         } else {
//           data[symbol] = KVDataToPrice.parse(preselectedData);
//         }
//       } else {
//         const response = await fetchData(
//           symbol,
//           getTimestampFromDayId(lastStoredId) / 1000,
//           finishTimestamp
//         );

//         await kv.hset(cacheAssetsLastSynced, {
//           [`${symbol}`]: finishTimestamp,
//         });

//         response.map(async ([id, price]) => {
//           await kv.hset(cacheAssetsKey, { [`${symbol}-${id}`]: price });
//         });

//         data[symbol] = KVDataToPrice.parse([...preselectedData, ...response]);
//       }

//         if (lastSyncedTimestamp < lastBatchFinish) {
//           const lastStoredTimestamp = lastSyncedTimestamp
//           const prices = await fetchData(
//             symbol,
//             moment(lastStoredTimestamp).unix(),
//             moment(lastBatchFinish * 1000)
//               .add(10, "minute")
//               .unix()
//           );

//           // const updatedKVStorageData = [
//           //   ...storedAssetData.slice(0, -1),
//           //   ...prices,
//           // ];
//           // console.info(
//           //   `BATCHES Data from cache(${symbol}): ${storedAssetData[0][0]}-${
//           //     storedAssetData[0][1]
//           //   }...${storedAssetData[storedAssetData.length - 1][0]}-${
//           //     storedAssetData[storedAssetData.length - 1][1]
//           //   }`
//           // );

//           // if (prices.length !== 0) {
//           //   console.info(`BATCHES Requested data(${symbol}):
//           // ${prices[0][0]}-${prices[0][1]}...${prices[prices.length - 1][0]}-${
//           //     prices[prices.length - 1][1]
//           //   }
//           // . SAVED TO CACHE`);
//           // }
//           // await kv.hset(cacheKey, { [symbol]: updatedKVStorageData });
//           // if (stored !== null) {
//           //   await updatedStoredAssetData.push(...updatedKVStorageData);
//           // }
//         } else {
//           await updatedStoredAssetData.push(...storedAssetData);
//         }

//         for (let i = 0; i < assetBatches.length; i++) {
//           const singleBatch = assetBatches[i];
//           const startDayId = getDayId(singleBatch.start);
//           const endDayId = getDayId(singleBatch.end);
//           const [lastUpdatedId] =
//             updatedStoredAssetData[updatedStoredAssetData.length - 1];
//           const startOffset = freshAsset
//             ? updatedStoredAssetData.length - 1 - (lastUpdatedId - startDayId)
//             : startDayId;
//           const finishOffset = startOffset + (endDayId - startDayId);
//           console.info(
//             `BATCHES Data from cache(${symbol}): ${
//               updatedStoredAssetData[0][0]
//             }-${updatedStoredAssetData[0][1]}...${
//               updatedStoredAssetData[updatedStoredAssetData.length - 1][0]
//             }-${updatedStoredAssetData[updatedStoredAssetData.length - 1][1]}`
//           );
//           result[symbol].push(
//             KVDataToPriceArray.parse(
//               updatedStoredAssetData.slice(
//                 Math.max(0, startOffset),
//                 finishOffset + 1
//               )
//             )
//           );
//         }
//         updatedStoredAssetData = [];
//       }

//     }

//     // if (storedAssetData === null) {
//     //   const response = await fetchData(
//     //     symbol,
//     //     productStartInSeconds,
//     //     lastBatchFinish
//     //   );
//     //   console.info(
//     //     `BATCHES Requested data(${symbol}): ${response[0][0]}-${
//     //       response[0][1]
//     //     }...${response[response.length - 1][0]}-${
//     //       response[response.length - 1][1]
//     //     }. SAVED TO CACHE`
//     //   );
//     //   await kv.hset(cacheKey, { [symbol]: response });
//     //   updatedStoredAssetData = response;
//     // }

//   }
//   return result;
// };
