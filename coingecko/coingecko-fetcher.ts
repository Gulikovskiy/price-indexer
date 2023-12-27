import { kv } from "@vercel/kv";
import moment from "moment";
import { millisecondsInMinute, refreshInterval, userKey } from "./constants";
import { Price, PriceDataResponse, PriceRawResponse } from "./interfaces";
import { coinList } from "./supported-coins";
import {
  coingeckoAPIErrorResponse,
  getCoingeckoRangeURL,
  getCoingeckoLastPriceURL,
  getDayId,
  parsePriceResponse,
} from "./utils";

const fetchData = async (symbol: string, start: number, finish: number) => {
  console.log("FETCH: ", "start: ", start, "finish: ", finish);
  const id = coinList[symbol];
  const url = getCoingeckoRangeURL(id, start, finish);
  console.log("url: ", url);
  const res = await fetch(
    `https://api.scraperapi.com/?api_key=${
      process.env.SCRAPER_API_KEY
    }&url=${encodeURIComponent(url)}`
  );
  if (res.status !== 200) {
    throw coingeckoAPIErrorResponse(res);
  }
  const rawResponse = (await res.json()) as PriceRawResponse;
  //TODO: validate response with zod

  return parsePriceResponse(rawResponse);
};

const fetchFreshPrice = async (symbol: string, latestId: number) => {
  const url = getCoingeckoLastPriceURL(coinList[symbol]);
  console.log("fetchFreshPrice url: ", url);
  const res = await fetch(
    `https://api.scraperapi.com/?api_key=${
      process.env.SCRAPER_API_KEY
    }&url=${encodeURIComponent(url)}`
  );

  if (res.status !== 200) {
    throw coingeckoAPIErrorResponse(res);
  }
  const rawResponse = (await res.json()) as PriceRawResponse;
  const latestRawPrice = rawResponse.prices[rawResponse.prices.length - 1];
  const latestPrice: Price = {
    id: latestId,
    timestamp: latestRawPrice[0],
    price: latestRawPrice[1].toFixed(8),
  };

  return latestPrice;
};

export const fetchCoingeckoPrices = async (
  assets: string[],
  timestamp: number,
  days: number
): Promise<PriceDataResponse> => {
  const startTimestamp = moment(timestamp * 1000)
    .utc()
    .startOf("day")
    .unix();

  const finishTimestamp = moment(startTimestamp * 1000)
    .utc()
    .add(days, "days")
    .startOf("day")
    .unix();

  const data: PriceDataResponse = {};
  const stored = await kv.hgetall(userKey);
  console.log("stored: ", stored);

  const dayStartId = getDayId(startTimestamp);
  const dayFinishId = getDayId(finishTimestamp);

  await Promise.all(
    assets.map(async (symbol) => {
      const storedAssetData = stored
        ? (stored[symbol] as Price[]) || null
        : null;

      if (!storedAssetData) {
        const response = await fetchData(
          symbol,
          startTimestamp,
          finishTimestamp
        );

        const lastPrice = await fetchFreshPrice(
          symbol,
          response[response.length - 1].id
        );

        const updatedArray = [
          ...response.slice(0, response.length - 1),
          lastPrice,
        ];

        // kv.hset(userKey, { [symbol]: updatedArray });
        data[symbol] = updatedArray;
        return;
      }
      const { id, timestamp } = storedAssetData[storedAssetData.length - 1];
      const currentTimestamp = moment().unix() * 1000;

      const isStoredDataFresh =
        storedAssetData[storedAssetData.length - 1].timestamp +
          refreshInterval * millisecondsInMinute >
        currentTimestamp;

      if (id >= dayFinishId - 1 && isStoredDataFresh) {
        data[symbol] = storedAssetData.slice(dayStartId, dayFinishId);
        return;
      }
      const prices = await fetchData(
        symbol,
        moment(timestamp).unix(),
        moment(finishTimestamp * 1000)
          .add(5, "minute")
          .unix()
      );

      const updatedArray = [
        ...storedAssetData.slice(0, storedAssetData.length - 1),
        ...prices,
      ];

      if (
        updatedArray[updatedArray.length - 1].timestamp +
          refreshInterval * millisecondsInMinute >
        currentTimestamp
      ) {
        // kv.hset(userKey, { [symbol]: updatedArray });
        data[symbol] = updatedArray.slice(dayStartId, dayFinishId);
        return;
      }

      const lastPrice = await fetchFreshPrice(
        symbol,
        updatedArray[updatedArray.length - 1].id
      );

      const wholeUpdatedArray = [
        ...updatedArray.slice(0, updatedArray.length - 1),
        lastPrice,
      ];

      // kv.hset(userKey, { [symbol]: wholeUpdatedArray });
      data[symbol] = wholeUpdatedArray;
    })
  );

  return data;
};
