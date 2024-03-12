import { kv } from "@vercel/kv";
import moment from "moment";
import { cacheAssetsKey, cacheAssetsLastSynced } from "./constants";
import {
  ErrorResponse,
  coingeckoAPIErrorResponse,
  invalidResponseTypesError,
} from "./errors";
import { PriceDataResponse } from "./interfaces";
import { coinList } from "./supported-coins";
import {
  CoingeckoResponse,
  KVDataToPrice,
  getCoingeckoRangeURL,
  getDayId,
  getTimestampFromDayId,
} from "./utils";

export const fetchData = async (
  symbol: string,
  start: number,
  finish: number
) => {
  const id = coinList[symbol];
  let modifiedFinish = finish;
  console.log("HERE: ", start === finish);
  if (start === finish) {
    modifiedFinish += 600; // INFO: add 10mins if day timestamps are the same
  }
  const encodedUrl = getCoingeckoRangeURL(id, start, modifiedFinish);
  console.log("encodedUrl: ", encodedUrl);

  // const res = await fetch(
  //   `${scraperURL}/?api_key=${process.env.SCRAPER_API_KEY}&url=${encodedUrl}`
  // );
  // INFO: SCRAPER API ISSUE

  const res = await fetch(`${encodedUrl}`);

  if (res.status !== 200) {
    console.error({ res });
    throw coingeckoAPIErrorResponse;
  }
  const rawResponse = await res.json();

  const parsed = CoingeckoResponse.safeParse(rawResponse);

  if (!parsed.success) {
    console.error(parsed.error.issues);
    throw invalidResponseTypesError;
  }
  return parsed.data.prices;
};

export const fetchCoingeckoPrices = async (
  assets: string[],
  start: number,
  days: number
): Promise<PriceDataResponse | ErrorResponse> => {
  const startTimestamp = moment(start * 1000)
    .utc()
    .startOf("day")
    .unix();

  const finishIntermediate = moment(startTimestamp * 1000)
    .utc()
    .add(days, "days")
    .startOf("day")
    .unix();

  const currentTimestamp = moment().unix();
  const finishTimestamp =
    finishIntermediate > currentTimestamp
      ? moment(currentTimestamp * 1000)
          .utc()
          .startOf("day")
          .unix()
      : finishIntermediate;

  const data: PriceDataResponse = {};

  const dayStartId = getDayId(startTimestamp);
  const dayFinishId = getDayId(finishTimestamp) - 1;
  const invalidSymbols: string[] = [];

  // TODO:
  // assets.map((symbol) => {
  //   const endpointStartId =
  //     stored !== null && stored[symbol] !== null ? stored[symbol][0][0] : 0; //INFO first ID from stored data

  //   if (endpointStartId > dayStartId) {
  //     invalidSymbols.push(symbol);
  //   }
  // });

  // if (invalidSymbols.length !== 0) {
  //   return timestampRangeError(invalidSymbols);
  // }

  await Promise.all(
    assets.map(async (symbol) => {
      const lastSyncedTimestamp: number | null = await kv.hget(
        cacheAssetsLastSynced,
        symbol
      );

      if (!lastSyncedTimestamp) {
        // INFO: empty database

        const response = await fetchData(
          symbol,
          startTimestamp,
          finishTimestamp
        );
        console.log("response: ", response);
        console.info(
          `Requested data(${symbol}): ${response[0][0]}-${response[0][1]}...${
            response[response.length - 1][0]
          }-${response[response.length - 1][1]}`
        );
        data[symbol] = KVDataToPrice.parse(response);
        response.map(async ([id, price]) => {
          await kv.hset(cacheAssetsKey, { [`${symbol}-${id}`]: price });
        });

        await kv.hset(cacheAssetsLastSynced, {
          [`${symbol}`]: finishTimestamp,
        });

        return;
      }
      const preselectedData: [number, number][] = [];
      let lastStoredId: number = 0;

      for (let i = dayStartId; i <= dayFinishId; i++) {
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

      if (lastStoredId === 0) {
        data[symbol] = KVDataToPrice.parse(preselectedData);
      } else {
        const response = await fetchData(
          symbol,
          getTimestampFromDayId(lastStoredId) / 1000,
          finishTimestamp
        );

        await kv.hset(cacheAssetsLastSynced, {
          [`${symbol}`]: finishTimestamp,
        });

        response.map(async ([id, price]) => {
          await kv.hset(cacheAssetsKey, { [`${symbol}-${id}`]: price });
        });

        data[symbol] = KVDataToPrice.parse([...preselectedData, ...response]);
      }

      return;
    })
  );

  return data;
};
