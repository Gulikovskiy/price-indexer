// import "server-only";
import { kv } from "@vercel/kv";
import moment from "moment";
import {
  ceilN,
  coingeckoAPIErrorResponse,
  getCoingeckoURL,
  invalidSymbolErrorResponse,
  parsePriceResponse,
} from "./utils";
import {
  millisecondsInDay,
  millisecondsInMinute,
  precision,
  productStartInMilliseconds,
  refreshInterval,
  userKey,
} from "./constants";
import { coinList } from "./supported-coins";
import {
  Price,
  PriceDataResponse,
  PriceRawResponse,
  ValidDate,
} from "./interfaces";

export const fetchCoingeckoPrices = async (
  assets: string[],
  timestamp: ValidDate,
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

        // const dayStartId =
        //   (startTimestamp * 1000 - productStartInMilliseconds) /
        //   millisecondsInDay;

        const lastStoredTimestamp =
          storedAssetData[storedAssetData.length - 1].timestamp;

        const newLatestPrices = await fetchData(
          symbol,
          moment(lastStoredTimestamp).unix(),
          finishTimestamp
        );

        const updatedArray = [
          ...storedAssetData.slice(0, storedAssetData.length - 1),
          ...newLatestPrices,
        ];

        kv.hset(userKey, { [symbol]: updatedArray });
        data[symbol] = updatedArray;
      } else {
        const response = await fetchData(
          symbol,
          startTimestamp,
          finishTimestamp
        );
        console.log("response: ", response);

        kv.hset(userKey, { [symbol]: response });
        data[symbol] = response;
      }
    })
  );

  return data;
};
