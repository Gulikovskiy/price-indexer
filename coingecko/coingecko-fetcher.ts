import { kv } from "@vercel/kv";
import moment from "moment";
import { userKey } from "./constants";
import { PriceDataResponse } from "./interfaces";
import { coinList } from "./supported-coins";
import {
  ResponseValidation,
  coingeckoAPIErrorResponse,
  getCoingeckoRangeURL,
  getDayId,
  getDayTimestampFromId,
  invalidResponseTypesError,
  parseKVDataToPrice,
  parsePriceResponse,
} from "./utils";

const fetchData = async (symbol: string, start: number, finish: number) => {
  const id = coinList[symbol];
  const url = getCoingeckoRangeURL(id, start, finish);
  const res = await fetch(`${url}`);
  if (res.status !== 200) {
    throw coingeckoAPIErrorResponse(res);
  }
  const rawResponse = await res.json();

  const parsed = ResponseValidation.safeParse(rawResponse);
  if (!parsed.success) {
    throw invalidResponseTypesError;
  }
  const { prices } = parsed.data;
  return parsePriceResponse(prices);
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
        ? (stored[symbol] as [id: number, price: number][]) || null
        : null;

      if (!storedAssetData) {
        const response = await fetchData(
          symbol,
          startTimestamp,
          finishTimestamp
        );

        const updatedArray = parseKVDataToPrice(
          response.slice(0, response.length - 1)
        );

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

        const updatedPrices = parseKVDataToPrice(
          storedAssetData.slice(0, storedAssetData.length - 1)
        );

        data[symbol] = updatedPrices;
      }
    })
  );

  return data;
};
