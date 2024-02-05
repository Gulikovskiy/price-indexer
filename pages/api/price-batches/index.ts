import { NextApiRequest, NextApiResponse } from "next/types";
import { z } from "zod";
import { PriceRequest, fetchBatches } from "../../../coingecko/batch-fetcher";
import { maxAssetsAmount } from "../../../coingecko/constants";
import {
  ErrorResponse,
  ErrorType,
  assetAmountExcessError,
  invalidSymbolErrorResponse,
  serverError,
  zodErrorResponse,
} from "../../../coingecko/errors";
import { DefaultError, RangeMap } from "../../../coingecko/interfaces";
import { coinList } from "../../../coingecko/supported-coins";

const ParamsValidation = z.object({
  // TODO: fix
  //   timestamp: z.coerce
  //     .number()
  //     .int()
  //     .positive()
  //     .min(productStartInSeconds)
  //     .max(moment().unix())
  //     .transform((ts) => Math.max(ts, productStartInSeconds)),

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
  req: NextApiRequest,
  res: NextApiResponse<PriceRequest | ErrorResponse>
) => {
  // console.log("test: ", req);
  const data = req.body as RangeMap;
  console.log("BATCHES: ", data);

  const parsed = ParamsValidation.safeParse({
    // timestamp: "", // TODO: add all start timestamps
    coins: Object.keys(data),
  });
  if (!parsed.success) {
    const mes = parsed.error.issues[0];
    return res
      .status(400)
      .json(zodErrorResponse(ErrorType.InvalidSearchParams, mes));
  }

  const { coins } = parsed.data;

  const validatedCoins = ValidateCoinList.safeParse(coins);

  if (!validatedCoins.success) {
    const errorMessage = validatedCoins.error.issues[0].message;
    return res.status(400).json(invalidSymbolErrorResponse(errorMessage));
  }
  if (coins.length > maxAssetsAmount) {
    return res.status(400).json(assetAmountExcessError);
  }

  try {
    const historical = await fetchBatches(data);
    return res.status(200).json(historical);
  } catch (err) {
    console.error(err);
    const error = err as DefaultError;
    return res.status(error.code ?? 500).json(serverError(error.message));
  }
};
export default handler;
