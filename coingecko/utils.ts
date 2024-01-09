import moment from "moment";
import { z } from "zod";
import {
  coingeckoURL,
  millisecondsInDay,
  precision,
  productStartInMilliseconds,
} from "./constants";
import { KeyError, invalidResponseTypesError } from "./errors";

const apiKey = process.env.CG_DEMO_API_KEY;
if (!apiKey) throw new KeyError();

export const getDayId = (timestamp: number) =>
  (timestamp * 1000 - productStartInMilliseconds) / millisecondsInDay;

export const getTimestampFromDayId = (id: number) =>
  id * millisecondsInDay + productStartInMilliseconds;

export const getCoingeckoRangeURL = (id: string, from: number, to: number) =>
  encodeURIComponent(
    `${coingeckoURL}/coins/${id}/market_chart/range?vs_currency=usd&from=${from}&to=${to}&precision=${precision}&x_cg_demo_api_key=${apiKey}`
  );

export const parsePriceResponse = (rawResponse: unknown) => {
  const parsed = CoingeckoResponse.safeParse(rawResponse);

  if (!parsed.success) {
    console.error(parsed.error.issues);
    throw invalidResponseTypesError;
  }
  return parsed.data.prices;
};

export const KVDataToPrice = z.array(
  z
    .tuple([z.number().int(), z.number().positive()])
    .transform(([id, price]) => ({
      id,
      timestamp: getTimestampFromDayId(id),
      price: price.toFixed(8),
    }))
);

export const CoingeckoResponse = z.object({
  prices: z
    .array(
      z.tuple([z.number(), z.number()]).transform(([timestamp, price]) => ({
        timestamp,
        price,
      }))
    )
    .transform((prices) => {
      const arr: [id: number, price: number][] = [];

      for (const { timestamp, price } of prices) {
        const startOfTheDay = moment(timestamp).utc().startOf("day").unix();
        const id = getDayId(startOfTheDay);
        if (!arr.some((el) => el[0] === id)) arr.push([id, price]);
      }
      console.log("arr: ", arr);
      return arr;
    }),
});
