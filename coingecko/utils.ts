import moment from "moment";
import { z } from "zod";
import {
  coingeckoURL,
  millisecondsInDay,
  precision,
  productStartInMilliseconds,
} from "./constants";
import { KeyError } from "./errors";
import { Price as BatchPrice } from "./batch-fetcher";
import { Price } from "./interfaces";

const apiKey = process.env.CG_DEMO_API_KEY;
if (!apiKey) throw new KeyError();

export const isType = <T>(thing: any): thing is T => true;

export const getDayId = (timestamp: number) =>
  (timestamp * 1000 - productStartInMilliseconds) / millisecondsInDay;

export const getTimestampFromDayId = (id: number) =>
  id * millisecondsInDay + productStartInMilliseconds;

export const getCoingeckoRangeURL = (id: string, from: number, to: number) =>
  encodeURIComponent(
    `${coingeckoURL}/coins/${id}/market_chart/range?vs_currency=usd&from=${from}&to=${to}&precision=${precision}&x_cg_demo_api_key=${apiKey}`
  );

export const KVDataToPrice = z
  .array(z.tuple([z.number().int(), z.number().positive()]))
  .transform((pricesArray) => {
    const prices: string[] = [];
    const timestamps: number[] = [];
    for (const [id, price] of pricesArray) {
      prices.push(price.toFixed(8));
      timestamps.push(getTimestampFromDayId(id));
    }
    return { prices, timestamps } as Price;
  });

export const KVDataToPriceArray = z
  .array(z.tuple([z.number().int(), z.number().positive()]))
  .transform((pricesArray) => {
    let array: BatchPrice[] = [];

    for (const [id, price] of pricesArray) {
      array.push({
        price: price.toFixed(8),
        timestamp: getTimestampFromDayId(id) / 1000,
      });
    }
    return array;
  });

export const CoingeckoResponse = z.object({
  prices: z.array(z.tuple([z.number(), z.number()])).transform((prices) => {
    const arr: [id: number, price: number][] = [];

    for (const [timestamp, price] of prices) {
      const startOfTheDay = moment(timestamp).utc().startOf("day").unix();
      const id = getDayId(startOfTheDay);
      if (!arr.some((el) => el[0] === id)) arr.push([id, price]);
    }
    return arr;
  }),
});
