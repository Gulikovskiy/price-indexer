import { kv } from "@vercel/kv";
import { Price, PriceDataResponse, PriceRawResponse } from "./interfaces";
import { userKey } from "./constants";

export const ceilN = (n: bigint, d: bigint) =>
  n / d + (n % d ? BigInt(1) : BigInt(0));

export const getCoingeckoURL = (
  id: string,
  days: bigint | number,
  precision: number
) => {
  return `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${Number(
    days
  )}&interval=daily&precision=${precision}`;
};

// https%3A%2F%2Fapi.coingecko.com%2Fapi%2Fv3%2Fcoins%2Fbitcoin%2Fmarket_chart%3Fvs_currency%3Dusd%26days%3D1%26in%5B%E2%80%A6%5Dly%26precision%3D8%26x_cg_demo_api_key%3DCG-XBpSvURzDDvsHe2uShigeLwY

export const parsePriceResponse = (res: PriceRawResponse) => {
  return res.prices.map(
    (el) => ({ timestamp: el[0], price: el[1].toString() } as Price)
  );
};

export const setPriceResponse = (
  res: Price[],
  symbol: string,
  arr: PriceDataResponse
) => {
  kv.hset(userKey, { [symbol]: res });
  arr[symbol] = res;
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
