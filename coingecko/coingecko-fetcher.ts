// import "server-only";
import { kv } from "@vercel/kv";
import moment from "moment";
import {
  millisecondsInDay,
  productStartInMilliseconds,
  userKey,
} from "./constants";
import { Price, PriceDataResponse, PriceRawResponse } from "./interfaces";
import { coinList } from "./supported-coins";
import {
  coingeckoAPIErrorResponse,
  getCoingeckoURL,
  invalidSymbolErrorResponse,
  parsePriceResponse,
} from "./utils";

export const fetchCoingeckoPrices = async (
  assets: string[],
  timestamp: number,
  days: number
): Promise<PriceDataResponse> => {
  const currentTimestamp = moment().unix();
  const startTimestamp = moment(timestamp * 1000)
    .utc()
    .startOf("day")
    .unix();

  const finishTimestamp = moment(startTimestamp * 1000)
    .add(days, "days")
    .unix();

  const data: PriceDataResponse = {};

  //TODO: floor day timestamp
  const apiKey = process.env.CG_DEMO_API_KEY ?? "";

  const fetchData = async (symbol: string, start: number, finish: number) => {
    console.log("FETCH: ", "start: ", start, "finish: ", finish);
    const id = coinList[symbol];
    const url = getCoingeckoURL(id, start, finish);
    console.log("URL: ", url);
    const newURL = encodeURIComponent(`${url}&x_cg_demo_api_key=${apiKey}`);
    const res = await fetch(
      `https://api.scraperapi.com/?api_key=${process.env.SCRAPER_API_KEY}&url=${newURL}`
    );
    if (res.status !== 200) {
      throw coingeckoAPIErrorResponse(res);
    }
    const rawResponse = (await res.json()) as PriceRawResponse;
    return parsePriceResponse(symbol, rawResponse);
  };

  const stored = await kv.hgetall(userKey);

  await Promise.all(
    assets.map(async (symbol) => {
      const id = coinList[symbol];
      if (id === undefined) {
        throw invalidSymbolErrorResponse(symbol);
      }

      const storedAssetData = stored
        ? (stored[symbol] as Price[]) || null
        : null;
      const isDataInStorage = storedAssetData !== null;

      if (isDataInStorage) {
        const latestTimeStamp =
          storedAssetData[storedAssetData.length - 1].timestamp;

        const dayStartId =
          (startTimestamp * 1000 - productStartInMilliseconds) /
          millisecondsInDay;

        const dayFinishId =
          (finishTimestamp * 1000 - productStartInMilliseconds) /
          millisecondsInDay;

        const lastStoredTimestamp =
          storedAssetData[storedAssetData.length - 1].timestamp;

        if (lastStoredTimestamp < finishTimestamp * 1000) {
          const newLatestPrices = await fetchData(
            symbol,
            moment(lastStoredTimestamp).unix(),
            finishTimestamp
          );

          const wholeUpdatedArray = [
            ...storedAssetData.slice(0, storedAssetData.length - 1),
            ...newLatestPrices,
          ];

          kv.hset(userKey, { [symbol]: wholeUpdatedArray });
          data[symbol] = wholeUpdatedArray.slice(dayStartId, dayFinishId);
        } else {
          data[symbol] = storedAssetData.slice(dayStartId, dayFinishId);
        }
      } else {
        const response = await fetchData(
          symbol,
          startTimestamp,
          finishTimestamp
        );

        kv.hset(userKey, { [symbol]: response });
        data[symbol] = response;
      }
    })
  );

  return data;
};
