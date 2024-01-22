import { kv } from "@vercel/kv";
import moment from "moment";
import { cacheKey, scraperURL } from "./constants";
import {
  ErrorResponse,
  coingeckoAPIErrorResponse,
  invalidResponseTypesError,
  timestampRangeError,
} from "./errors";
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
): Promise<PriceDataResponse | ErrorResponse> => {
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
  const invalidSymbols: string[] = [];

  assets.map((symbol) => {
    const endpointStartId =
      stored !== null && stored[symbol] !== null ? stored[symbol][0][0] : 0; //INFO first ID from stored data

    if (endpointStartId > dayStartId) {
      invalidSymbols.push(symbol);
    }
  });

  if (invalidSymbols.length !== 0) {
    return timestampRangeError(invalidSymbols);
  }

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
        console.info(
          `Requested data(${symbol}): ${response[0][0]}-${response[0][1]}...${
            response[response.length - 1][0]
          }-${response[response.length - 1][1]}`
        );
        data[symbol] = KVDataToPrice.parse(response);
        await kv.hset(cacheKey, { [symbol]: response });

        return;
      }

      const [lastStoredId] = storedAssetData[storedAssetData.length - 1];

      const freshAsset = storedAssetData.length - 1 < dayFinishId;

      const startOffset = freshAsset
        ? storedAssetData.length - 1 - (lastStoredId - dayStartId)
        : dayStartId;
      const finishOffset = startOffset + days;

      if (lastStoredId < dayFinishId) {
        const lastStoredTimestamp = getTimestampFromDayId(lastStoredId);
        const prices = await fetchData(
          symbol,
          moment(lastStoredTimestamp).unix(),
          moment(finishTimestamp * 1000)
            .add(10, "minute")
            .unix()
        );

        const updatedKVStorageData = [
          ...storedAssetData.slice(0, -1),
          ...prices,
        ];
        console.info(
          `Data from cache(${symbol}): ${storedAssetData[0][0]}-${
            storedAssetData[0][1]
          }...${storedAssetData[storedAssetData.length - 1][0]}-${
            storedAssetData[storedAssetData.length - 1][1]
          }`
        );

        console.info(`Requested data(${symbol}): 
        ${prices[0][0]}-${prices[0][1]}...${prices[prices.length - 1][0]}-${
          prices[prices.length - 1][1]
        }
        `);

        data[symbol] = KVDataToPrice.parse(
          updatedKVStorageData.slice(Math.max(0, startOffset), finishOffset)
        );
        await kv.hset(cacheKey, { [symbol]: updatedKVStorageData });

        return;
      }

      if (lastStoredId >= dayFinishId) {
        console.info(
          `Data from cache(${symbol}): ${storedAssetData[0][0]}-${
            storedAssetData[0][1]
          }...${storedAssetData[storedAssetData.length - 1][0]}-${
            storedAssetData[storedAssetData.length - 1][1]
          }`
        );
        data[symbol] = KVDataToPrice.parse(
          storedAssetData.slice(Math.max(0, startOffset), finishOffset)
        );
        return;
      }
    })
  );

  return data;
};
