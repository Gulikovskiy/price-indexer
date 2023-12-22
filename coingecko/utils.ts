import {
  millisecondsInDay,
  precision,
  productStartInMilliseconds,
} from "./constants";
import { Price, PriceRawResponse, ValidDate } from "./interfaces";
import moment from "moment";

export const ceilN = (n: bigint, d: bigint) =>
  n / d + (n % d ? BigInt(1) : BigInt(0));

export function isValidDate(date: number): date is ValidDate {
  const currentTimestamp = BigInt(moment().unix() * 1000);
  return (
    moment(date).isValid() ||
    (Number.isInteger(date) && currentTimestamp >= BigInt(date))
  );
}

export const getDayId = (timestamp: number) =>
  (timestamp * 1000 - productStartInMilliseconds) / millisecondsInDay;

export const getCoingeckoURL = (id: string, from: number, to: number) =>
  `https://api.coingecko.com/api/v3/coins/${id}/market_chart/range?vs_currency=usd&from=${from}&to=${to}&precision=${precision}`;

export const parsePriceResponse = (res: PriceRawResponse) => {
  const arr: Price[] = [];

  for (const [timestamp, price] of res.prices) {
    const startOfTheDay = moment(timestamp).utc().startOf("day").unix();

    const id = getDayId(startOfTheDay);

    if (!arr.some((el) => el.id === id))
      arr.push({
        id,
        timestamp: startOfTheDay * 1000,
        price: price.toString(),
      });
  }
  return arr;
};

//ERRORS
export const coingeckoAPIErrorResponse = (res: Response) => {
  return {
    code: res.status,
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
