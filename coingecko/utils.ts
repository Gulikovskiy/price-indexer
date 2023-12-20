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

export const getCoingeckoURL = (
  id: string,
  days: bigint | number,
  precision: number
) => {
  return `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${Number(
    days
  )}&interval=daily&precision=${precision}`;
};

export const parsePriceResponse = (res: PriceRawResponse) => {
  return res.prices.map(
    (el) => ({ timestamp: el[0], price: el[1].toString() } as Price)
  );
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
