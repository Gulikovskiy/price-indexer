import moment from "moment";
import { NextApiRequest, NextApiResponse } from "next/types";
import { z } from "zod";
import { fetchCoingeckoPrices } from "../../../../../coingecko/coingecko-fetcher";
import {
  maxAssetsAmount,
  maxRange,
  productStartInSeconds,
} from "../../../../../coingecko/constants";
import {
  ErrorResponse,
  ErrorType,
  assetAmountExcessError,
  daysAmountExcessError,
  invalidSymbolErrorResponse,
  serverError,
  zodErrorResponse,
} from "../../../../../coingecko/errors";
import {
  DefaultError,
  PriceDataResponse,
  RangeMap,
} from "../../../../../coingecko/interfaces";
import { coinList } from "../../../../../coingecko/supported-coins";
import { NextRequest } from "next/server";
import { createJsonResponse } from "../../../../../forward/response";

const SearchParams = z.object({
  timestamp: z.coerce
    .number()
    .int()
    .positive()
    .min(productStartInSeconds)
    .max(moment().unix())
    .transform((ts) => Math.max(ts, productStartInSeconds)),
  days: z.coerce.number().int().positive(),
  coins: z.coerce
    .string()
    .transform((coins) => Array.from(new Set(coins.split(" ")))),
});

const ValidateCoinList = z
  .string()
  .array()
  .superRefine((coins, ctx) => {
    coins.map((coin) => {
      const id = coinList[coin];
      if (id === undefined) {
        return ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${coin} not exist or not supported`,
        });
      }
    });
  });

const handler = async (
  // req: NextRequest,
  req: NextApiRequest,
  res: NextApiResponse<PriceDataResponse | ErrorResponse>
) => {
  // console.log("some: ", req.);
  // const url = new URL(req.url);
  // const searchParams = url.searchParams;
  // const rawTimestamp = searchParams.get("timestamp");
  // const rawDays = searchParams.get("days");
  // console.log("rawTimestamp: ", rawTimestamp, "rawDays: ", rawDays);
  // console.log("url: ", url.search);

  // const rawCoins = searchParams.get("");
  // const chainId = Number(searchParams.get("chainId"));
  // const endpoint = `${route}?${searchParams.toString()}`;

  const test = req.body as RangeMap;

  const { coins: rawCoins, timestamp: rawTimestamp, days: rawDays } = req.query;
  const parsed = SearchParams.safeParse({
    timestamp: rawTimestamp,
    days: rawDays,
    coins: rawCoins,
  });
  if (!parsed.success) {
    const mes = parsed.error.issues[0];
    return res
      .status(400)
      .json(zodErrorResponse(ErrorType.InvalidSearchParams, mes));
  }

  const { coins, days, timestamp } = parsed.data;

  const validatedCoins = ValidateCoinList.safeParse(coins);

  if (!validatedCoins.success) {
    const errorMessage = validatedCoins.error.issues[0].message;
    return res.status(400).json(invalidSymbolErrorResponse(errorMessage));
  }
  if (coins.length > maxAssetsAmount) {
    return res.status(400).json(assetAmountExcessError);
  }

  if (days > maxRange) {
    return res.status(400).json(daysAmountExcessError);
  }

  try {
    const historical = await fetchCoingeckoPrices(coins, timestamp, days, test);
    return res.status(200).json(historical);
  } catch (err) {
    console.error(err);
    const error = err as DefaultError;
    return res.status(error.code ?? 500).json(serverError(error.message));
  }
};
export default handler;
