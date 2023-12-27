import {
  millisecondsInDay,
  precision,
  productStartInMilliseconds,
} from "./constants";
import { Price, PriceRawResponse, ValidDate } from "./interfaces";
import moment from "moment";

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

export const parsePriceResponse = (res: PriceRawResponse) => {
  const arr: [id: number, price: string][] = [];

  for (const [timestamp, price] of res.prices) {
    const startOfTheDay = moment(timestamp).utc().startOf("day").unix();

    const id = getDayId(startOfTheDay);

    if (!arr.some((el) => el[0] === id)) arr.push([id, price.toFixed(8)]);
  }
  return arr;
};

export const parseKVDataToPrice = (arr: [id: number, price: string][]) =>
  arr.map((el) => {
    return {
      id: el[0], // ID
      timestamp: getDayTimestampFromId(el[0]), // ID
      price: el[1], // PRICE
    } as Price;
  });

//ERRORS
export const coingeckoAPIErrorResponse = (res: Response) => {
  return {
    code: 500,
    message: `Coingecko API failed. ${res.statusText}`,
  };
};

export const invalidTimestampErrorResponse = (timestamp: unknown) => {
  return {
    code: 400,
    message: `Timestamp is invalid: ${timestamp}`,
  };
};

export const invalidSymbolErrorResponse = (symbol: string[]) => {
  return {
    code: 400,
    message: `${symbol.join(", ")} not exist or not supported`,
  };
};

export const invalidSearchParamsError = {
  code: 400,
  message: "Invalid search params",
};
