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
  getDayTimestampFromId,
  parseKVDataToPrice,
} from "./utils";

const fetchData = async (symbol: string, start: number, finish: number) => {
  const id = coinList[symbol];
  const url = getCoingeckoRangeURL(id, start, finish);
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
  const res = await fetch(
    `https://api.scraperapi.com/?api_key=${
      process.env.SCRAPER_API_KEY
    }&url=${encodeURIComponent(url)}`,
    { next: { revalidate: 300 } }
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
  start: number,
  days: number
): Promise<PriceDataResponse> => {
  const startTimestamp = moment(start * 1000)
    .utc()
    .startOf("day")
    .unix();

  const finish = moment(startTimestamp * 1000)
    .utc()
    .add(days, "days")
    .startOf("day")
    .unix();

  const currentTimestamp = moment().unix();
  const finishTimestamp =
    finish > currentTimestamp
      ? moment(currentTimestamp * 1000)
          .utc()
          .startOf("day")
          .unix()
      : finish;

  const data: PriceDataResponse = {};
  const stored = await kv.hgetall(userKey);

  const dayStartId = getDayId(startTimestamp);
  const dayFinishId = getDayId(finishTimestamp);

  await Promise.all(
    assets.map(async (symbol) => {
      const storedAssetData = stored
        ? (stored[symbol] as [id: number, price: string][]) || null
        : null;

      if (!storedAssetData) {
        const response = await fetchData(
          symbol,
          startTimestamp,
          finishTimestamp
        );

        const lastPrice = await fetchFreshPrice(
          symbol,
          response[response.length - 1][0] // ID
        );

        const updatedArray = [
          ...parseKVDataToPrice(response.slice(0, response.length - 1)),
          lastPrice,
        ];

        kv.hset(userKey, { [symbol]: response });
        data[symbol] = updatedArray;
        return;
      }

      const { 0: lastStoredId } = storedAssetData[storedAssetData.length - 1];

      if (lastStoredId < dayFinishId) {
        const lastStoredTimestamp = getDayTimestampFromId(lastStoredId);
        const prices = await fetchData(
          symbol,
          moment(lastStoredTimestamp).unix(),
          moment(finishTimestamp * 1000)
            .add(5, "minute")
            .unix()
        );

        const freshPrice = await fetchFreshPrice(
          symbol,
          prices[prices.length - 1][0] // ID
        );

        const updatedKVStorageData = [
          ...storedAssetData.slice(0, storedAssetData.length - 1),
          ...prices,
        ];

        kv.hset(userKey, { [symbol]: updatedKVStorageData });

        const updatedPrices = [
          ...parseKVDataToPrice(
            storedAssetData.slice(0, storedAssetData.length - 1)
          ),
          ...parseKVDataToPrice(prices.slice(0, prices.length - 1)),
          freshPrice,
        ];

        data[symbol] = updatedPrices;
      }

      if (lastStoredId >= dayFinishId) {
        const startOfTheDay = moment(currentTimestamp * 1000)
          .utc()
          .startOf("day")
          .unix();

        if (dayFinishId < getDayId(startOfTheDay)) {
          data[symbol] = parseKVDataToPrice(
            storedAssetData.slice(dayStartId, dayFinishId)
          );

          return;
        }

        const freshPrice = await fetchFreshPrice(
          symbol,
          storedAssetData[storedAssetData.length - 1][0] // ID
        );

        const updatedPrices = [
          ...parseKVDataToPrice(
            storedAssetData.slice(0, storedAssetData.length - 1)
          ),
          freshPrice,
        ];

        data[symbol] = updatedPrices;
      }
    })
  );

  return data;
};
