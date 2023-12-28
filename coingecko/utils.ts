import moment from "moment";
import { z } from "zod";
import {
  millisecondsInDay,
  precision,
  productStartInMilliseconds,
} from "./constants";
import { Price, PriceRawResponse, ValidDate } from "./interfaces";

const apiKey = process.env.CG_DEMO_API_KEY;
if (!apiKey) throw new ReferenceError("api key is undefined");

export function isValidDate(date: number): date is ValidDate {
  const currentTimestamp = BigInt(moment().unix() * 1000);
  return (
    moment(date).isValid() ||
    (Number.isInteger(date) && currentTimestamp >= BigInt(date))
  );
}

export const getDayId = (timestamp: number) =>
  (timestamp * 1000 - productStartInMilliseconds) / millisecondsInDay;

export const getDayTimestampFromId = (id: number) =>
  id * millisecondsInDay + productStartInMilliseconds;

export const getCoingeckoRangeURL = (id: string, from: number, to: number) =>
  `https://api.coingecko.com/api/v3/coins/${id}/market_chart/range?vs_currency=usd&from=${from}&to=${to}&precision=${precision}&x_cg_demo_api_key=${apiKey}`;

export const getCoingeckoLastPriceURL = (id: string) =>
  `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=1&precision=${precision}&x_cg_demo_api_key=${apiKey}`;

export const parsePriceResponse = (prices: PriceRawResponse) => {
  const arr: [id: number, price: number][] = [];

  for (const { timestamp, price } of prices) {
    const startOfTheDay = moment(timestamp).utc().startOf("day").unix();

    const id = getDayId(startOfTheDay);

    if (!arr.some((el) => el[0] === id)) arr.push([id, price]);
  }
  return arr;
};

export const parseKVDataToPrice = (arr: [id: number, price: number][]) =>
  arr.map((el) => {
    return {
      id: el[0], // ID
      timestamp: getDayTimestampFromId(el[0]), // ID
      price: el[1].toFixed(8), // PRICE
    } as Price;
  });

export const ResponseValidation = z.object({
  prices: z.array(
    z.tuple([z.number(), z.number()]).transform(([timestamp, price]) => ({
      timestamp,
      price,
    }))
  ),
  market_caps: z.array(
    z.tuple([z.number(), z.number()]).transform(([timestamp, marketCap]) => ({
      timestamp,
      marketCap,
    }))
  ),
  total_volumes: z.array(
    z.tuple([z.number(), z.number()]).transform(([timestamp, volume]) => ({
      timestamp,
      volume,
    }))
  ),
});

//ERRORS

export enum ErrorType {
  InvalidSearchParams = 10001,
  InvalidSymbol = 10002,
  InvalidCoingeckoResponse = 10003,
  InvalidResponseTypes = 10004,
}

export const invalidSearchParamsError = {
  code: ErrorType.InvalidSearchParams,
  message: "Invalid search params",
};

export const invalidSymbolErrorResponse = (symbol: string[]) => {
  return {
    code: ErrorType.InvalidSymbol,
    message: `${symbol.join(", ")} not exist or not supported`,
  };
};

export const coingeckoAPIErrorResponse = (res: Response) => {
  return {
    code: ErrorType.InvalidCoingeckoResponse,
    message: `Coingecko API failed. ${res.statusText}`,
  };
};

export const invalidResponseTypesError = {
  code: ErrorType.InvalidResponseTypes,
  message: "Invalid coingecko response types",
};
