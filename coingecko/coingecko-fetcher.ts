import { kv } from "@vercel/kv";
import moment from "moment";
import { cacheKey, scraperURL } from "./constants";
import { coingeckoAPIErrorResponse, invalidResponseTypesError } from "./errors";
import { PriceDataResponse } from "./interfaces";
import { coinList } from "./supported-coins";
import {
  CoingeckoResponse,
  getCoingeckoRangeURL,
  getDayId,
  getTimestampFromDayId,
  KVDataToPrice,
} from "./utils";

const fetchData = async (symbol: string, start: number, finish: number) => {
  const id = coinList[symbol];
  const encodedUrl = getCoingeckoRangeURL(id, start, finish);

  const res = await fetch(
    `${scraperURL}/?api_key=${process.env.SCRAPER_API_KEY}&url=${encodedUrl}`
  );

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

  const stored: Record<string, [id: number, price: number][]> | null =
    await kv.hgetall(cacheKey);

  const dayStartId = getDayId(startTimestamp);
  const dayFinishId = getDayId(finishTimestamp);

  await Promise.all(
    assets.map(async (symbol) => {
      //INFO: potentially stored data can be null
      const storedAssetData = stored ? stored[symbol] || null : null;

      if (!storedAssetData) {
        const response = await fetchData(
          symbol,
          startTimestamp,
          finishTimestamp
        );
        data[symbol] = KVDataToPrice.parse(response);
        await kv.hset(cacheKey, { [symbol]: response });

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

        data[symbol] = KVDataToPrice.parse(updatedKVStorageData);
        await kv.hset(cacheKey, { [symbol]: updatedKVStorageData });
        return;
      }

      if (lastStoredId >= dayFinishId) {
        data[symbol] = KVDataToPrice.parse(
          storedAssetData.slice(dayStartId, dayFinishId + 1)
          //INFO: lastID + 1, because slice is working with arr length
        );
        return;
      }
    })
  );

  return data;
};
