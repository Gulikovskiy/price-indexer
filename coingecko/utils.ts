import { kv } from "@vercel/kv";
import {
  millisecondsInDay,
  precision,
  productStartInMilliseconds,
  userKey,
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

export const getCoingeckoURL = (id: string, from: number, to: number) =>
  `https://api.coingecko.com/api/v3/coins/${id}/market_chart/range?vs_currency=usd&from=${from}&to=${to}&precision=${precision}`;

export const parsePriceResponse = (symbol: string, res: PriceRawResponse) => {
  //TODO add class-transform / validation
  const arr: Price[] = [];
  // kv.hset(userKey, { [symbol]: response });

  res.prices.map((el) => {
    const id = (el[0] - productStartInMilliseconds) / millisecondsInDay;
    // console.log("dayId: ", {
    //   [dayId]: { timestamp: el[0], price: el[1].toString() },
    // });
    // return { [dayId]: { timestamp: el[0], price: el[1].toString() } as Price };
    arr.push({ id, timestamp: el[0], price: el[1].toString() } as Price);
    // return { timestamp: el[0], price: el[1].toString() } as Price;
  });
  return arr;
  // console.log("struct: ", struct);
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

export const invalidSymbolErrorResponse = (symbol: unknown) => {
  return {
    code: 400,
    message: `${symbol} symbol does not exist or not supported`,
  };
};

export const invalidSearchParamsError = {
  code: 400,
  message: "Invalid search params",
};
