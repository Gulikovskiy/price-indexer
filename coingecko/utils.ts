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

export const getCoingeckoURL = (id: string, from: number, to: number) =>
  `https://api.coingecko.com/api/v3/coins/${id}/market_chart/range?vs_currency=usd&from=${from}&to=${to}&precision=${precision}`;

export const parsePriceResponse = (symbol: string, res: PriceRawResponse) => {
  //TODO add class-transform / validation
  const arr: Price[] = [];

  res.prices.map((el) => {
    const timestamp = el[0];
    const startOfTheDay = moment(timestamp).utc().startOf("day").unix() * 1000;

    const id = (startOfTheDay - productStartInMilliseconds) / millisecondsInDay;

    const isArrayFilledWithCurrentId = arr.some((el) => el.id === id);
    if (arr.length === 0 || !isArrayFilledWithCurrentId)
      arr.push({
        id,
        timestamp: startOfTheDay,
        price: el[1].toString(),
      } as Price);
  });
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
