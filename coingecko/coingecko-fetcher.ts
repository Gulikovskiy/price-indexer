import { kv } from "@vercel/kv";
import moment from "moment";
import { userKey } from "./constants";
import { coingeckoAPIErrorResponse, invalidResponseTypesError } from "./errors";
import { PriceDataResponse } from "./interfaces";
import { coinList } from "./supported-coins";
import {
  CoingeckoResponse,
  getCoingeckoRangeURL,
  getDayId,
  getTimestampFromDayId,
  KVDataToPrice,
  parsePriceResponse,
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
  const rawResponse = await res.json();

  const parsed = CoingeckoResponse.safeParse(rawResponse);

  if (parsed.success === false) {
    console.error(parsed.error.issues);
    throw invalidResponseTypesError;
  }

  return parsePriceResponse(parsed.data.prices);
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

  const stored: Record<string, [id: number, price: number][]> =
    await kv.hgetall(userKey);

  const dayStartId = getDayId(startTimestamp);
  const dayFinishId = getDayId(finishTimestamp);

  await Promise.all(
    assets.map(async (symbol) => {
      const storedAssetData = stored ? stored[symbol] || null : null;

      if (!storedAssetData) {
        const response = await fetchData(
          symbol,
          startTimestamp,
          finishTimestamp
        );
        data[symbol] = KVDataToPrice.parse(response.slice(0, -1));
        kv.hset(userKey, { [symbol]: response });

        return;
      }

      const [lastStoredId] = storedAssetData[storedAssetData.length - 1];

      if (lastStoredId < dayFinishId) {
        const lastStoredTimestamp = getTimestampFromDayId(lastStoredId);
        const prices = await fetchData(
          symbol,
          moment(lastStoredTimestamp).unix(),
          moment(finishTimestamp * 1000)
            .add(5, "minute")
            .unix()
        );

        const updatedKVStorageData = [
          ...storedAssetData.slice(0, -1),
          ...prices,
        ];
        kv.hset(userKey, { [symbol]: updatedKVStorageData });

        data[symbol] = KVDataToPrice.parse([
          ...storedAssetData.slice(0, -1),
          ...prices,
        ]);
      }

      if (lastStoredId >= dayFinishId) {
        data[symbol] = KVDataToPrice.parse(
          storedAssetData.slice(dayStartId, dayFinishId + 1)
        );
        return;
      }
    })
  );

  return data;
};
