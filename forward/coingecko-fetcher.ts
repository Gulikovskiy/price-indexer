import "server-only";
import { kv } from "@vercel/kv";
import moment from "moment";
import {
  ceilN,
  coingeckoAPIErrorResponse,
  getCoingeckoURL,
  invalidSymbolErrorResponse,
  invalidTimestampErrorResponse,
  parsePriceResponse,
  setPriceResponse,
} from "./utils";
import {
  millisecondsInDay,
  millisecondsInMinute,
  precision,
  refreshInterval,
  userKey,
} from "./constants";
import { coinList } from "./supported-coins";
import {
  Price,
  PriceDataResponse,
  PriceRawResponse,
  PriceResponse,
} from "./interfaces";

export const fetchCoingeckoPrices = async (
  assets: string[],
  timestamp: number
): Promise<PriceResponse> => {
  const currentTimestamp = BigInt(moment().unix() * 1000);
  const isValidDate =
    moment(timestamp).isValid() ||
    (Number.isInteger(timestamp) && currentTimestamp >= BigInt(timestamp));

  if (!isValidDate) {
    return invalidTimestampErrorResponse(timestamp);
  }

  const fetchResponse: PriceDataResponse = {};
  const totalDays = ceilN(
    currentTimestamp - BigInt(timestamp),
    BigInt(millisecondsInDay)
  );

  for (let i = 0; i < assets.length; i++) {
    const symbol = assets[i];
    const symbolId = coinList[symbol];

    if (symbolId === undefined) {
      return invalidSymbolErrorResponse(symbol);
    }

    const { id } = symbolId;
    const stored = await kv.hgetall(userKey);

    const storedAssetData = stored ? (stored[symbol] as Price[]) || null : null;
    const isDataInStorage = storedAssetData !== null;
    const apiKey = process.env.CG_DEMO_API_KEY ?? "";

    if (isDataInStorage && Number(totalDays) === storedAssetData.length - 1) {
      const latestTimeStamp =
        storedAssetData[storedAssetData.length - 1].timestamp;

      if (
        latestTimeStamp + refreshInterval * millisecondsInMinute <=
        currentTimestamp
      ) {
        const url = getCoingeckoURL(id, 1, precision); //get only last 24h entity

        const res = await fetch(`${url}&x_cg_demo_api_key=${apiKey}`);

        if (res.status !== 200) {
          return coingeckoAPIErrorResponse(res);
        }

        const rawResponse: PriceRawResponse = await res.json().then((el) => el);
        const latestPrice = parsePriceResponse(rawResponse);
        const updatedArray = [
          ...storedAssetData.slice(0, storedAssetData.length - 1),
          latestPrice[latestPrice.length - 1],
        ];

        setPriceResponse(updatedArray, symbol, fetchResponse);
      } else {
        fetchResponse[symbol] = storedAssetData;
      }
    } else {
      const url = getCoingeckoURL(id, totalDays, precision);

      const res = await fetch(`${url}&x_cg_demo_api_key=${apiKey}`);

      if (res.status !== 200) {
        return coingeckoAPIErrorResponse(res);
      }

      const rawResponse = await res.json().then((el: PriceRawResponse) => el);
      const response = parsePriceResponse(rawResponse);

      setPriceResponse(response, symbol, fetchResponse);
    }
  }

  return {
    data: fetchResponse,
    code: 200,
    message: "OK",
  };
};
