import { kv } from "@vercel/kv";
import moment from "moment";
import {
  cacheAssetsKey,
  cacheAssetsLastSynced,
  fourHoursInSeconds,
} from "./constants";
import {
  ErrorResponse,
  coingeckoAPIErrorResponse,
  invalidResponseTypesError,
} from "./errors";
import { Price, PriceDataResponse } from "./interfaces";
import { coinList } from "./supported-coins";
import {
  CoingeckoDailyResponse,
  CoingeckoFreshResponse,
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
  if (start === finish) {
    modifiedFinish += 600; // INFO: add 10mins if day timestamps are the same
  }
  const encodedUrl = getCoingeckoRangeURL(id, start, modifiedFinish);

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

  const parsed = CoingeckoDailyResponse.safeParse(rawResponse);

  if (!parsed.success) {
    console.error(parsed.error.issues);
    throw invalidResponseTypesError;
  }
  return parsed.data.prices;
};

export const fetchFreshData = async (
  symbol: string,
  start: number,
  finish: number
) => {
  const id = coinList[symbol];
  let modifiedFinish = finish;
  if (start === finish) {
    modifiedFinish += 600; // INFO: add 10mins if day timestamps are the same
  }
  const encodedUrl = getCoingeckoRangeURL(id, start, modifiedFinish);

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

  const parsed = CoingeckoFreshResponse.safeParse(rawResponse);

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
  const currentDayTimestamp = moment(currentTimestamp * 1000)
    .utc()
    .startOf("day")
    .unix();

  const isShifting = finishIntermediate > currentTimestamp;
  const finishTimestamp = isShifting ? currentDayTimestamp : finishIntermediate;
  const data: PriceDataResponse = {};

  const dayStartId = getDayId(startTimestamp);
  const dayFinishId = isShifting
    ? getDayId(finishTimestamp)
    : getDayId(finishTimestamp) - 1;
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
        const shift = preselectedData.length - 1;
        if (
          currentDayTimestamp * 1000 ===
          getTimestampFromDayId(preselectedData[shift][0])
        ) {
          const filteredData = preselectedData.slice(0, shift);
          const { prices, timestamps } = KVDataToPrice.parse(filteredData);

          data[symbol] = {
            prices: [...prices, preselectedData[shift][1].toString()],
            timestamps: [...timestamps, lastSyncedTimestamp * 1000],
          };
        } else {
          data[symbol] = KVDataToPrice.parse(preselectedData);
        }
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

      if (currentTimestamp - fourHoursInSeconds > lastSyncedTimestamp) {
        const response = await fetchFreshData(
          symbol,
          lastSyncedTimestamp,
          currentTimestamp
        );

        const { prices, timestamps } = data[symbol] as Price;

        await kv.hset(cacheAssetsKey, {
          [`${symbol}-${getDayId(currentTimestamp)}`]: response.price,
        });
        await kv.hset(cacheAssetsLastSynced, {
          [`${symbol}`]: currentTimestamp,
        });

        data[symbol] = {
          prices: [...prices.slice(0, prices.length - 1), response.price],
          timestamps: [
            ...timestamps.slice(0, timestamps.length - 1),
            response.timestamp,
          ],
        };
      }

      return;
    })
  );

  return data;
};
