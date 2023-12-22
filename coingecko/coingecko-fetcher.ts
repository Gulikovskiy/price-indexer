import { kv } from "@vercel/kv";
import moment from "moment";
import { userKey } from "./constants";
import { Price, PriceDataResponse, PriceRawResponse } from "./interfaces";
import { coinList } from "./supported-coins";
import {
  coingeckoAPIErrorResponse,
  getCoingeckoURL,
  getDayId,
  parsePriceResponse,
} from "./utils";

const fetchData = async (symbol: string, start: number, finish: number) => {
  console.log("FETCH: ", "start: ", start, "finish: ", finish);
  const id = coinList[symbol];
  const url = getCoingeckoURL(id, start, finish);
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
    .add(days, "days")
    .unix();

  const data: PriceDataResponse = {};
  const stored = await kv.hgetall(userKey);
  // TODO: const data = await kv.zrange('mysortedset', 1, 3);

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

        kv.hset(userKey, { [symbol]: response });
        data[symbol] = response;
        return;
      }
      const { id, timestamp } = storedAssetData[storedAssetData.length - 1];

      if (id >= dayFinishId) {
        data[symbol] = storedAssetData.slice(dayStartId, dayFinishId);
        return;
      }
      const latestPrices = await fetchData(
        symbol,
        moment(timestamp).unix(),
        finishTimestamp
      );

      const wholeUpdatedArray = [
        ...storedAssetData.slice(0, -1),
        ...latestPrices,
      ];

      kv.hset(userKey, { [symbol]: wholeUpdatedArray });
      data[symbol] = wholeUpdatedArray.slice(dayStartId, dayFinishId);
    })
  );

  return data;
};
