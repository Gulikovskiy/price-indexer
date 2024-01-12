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
} from "../../../../../coingecko/interfaces";
import { coinList } from "../../../../../coingecko/supported-coins";
import { isType } from "../../../../../coingecko/utils";

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
  req: NextApiRequest, //& NextApiResponse<{ historical: PriceDataResponse }>
  res: NextApiResponse<{ historical: PriceDataResponse } | ErrorResponse>
) => {
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
    const historical = await fetchCoingeckoPrices(coins, timestamp, days);
    if (isType<ErrorResponse>(historical)) {
      return res.status(400).json(historical);
    } else {
      return res.status(200).json({ historical });
    }
  } catch (err) {
    const error = err as DefaultError;
    return res.status(error.code ?? 500).json(serverError(error.message));
  }
};
export default handler;
