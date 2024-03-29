import moment from "moment";
import { NextApiRequest, NextApiResponse } from "next/types";
import { z } from "zod";
import { fetchCoingeckoPrices } from "../../../../../coingecko/coingecko-fetcher";
import {
  maxAssetsAmount,
  maxRangeDays,
  productStartInSeconds,
  maxBatchNumber,
  secondsInDay,
} from "../../../../../coingecko/constants";
import {
  ErrorResponse,
  ErrorType,
  assetAmountExcessError,
  batchesAmountExcessError,
  batchesRangeExcessError,
  batchesSortExcessError,
  daysAmountExcessError,
  invalidSymbolErrorResponse,
  serverError,
  zodErrorResponse,
} from "../../../../../coingecko/errors";
import {
  DefaultError,
  PriceDataResponse,
  Range,
  RangeMap,
} from "../../../../../coingecko/interfaces";
import { coinList } from "../../../../../coingecko/supported-coins";
import {
  PriceRequest,
  fetchBatches,
} from "../../../../../coingecko/batch-fetcher";

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

const ValidateBatchesSort = z
  .array(z.object({ start: z.number(), end: z.number() }))
  .nonempty()
  .superRefine((batches, ctx) => {
    batches.map((batch, i) => {
      if (i !== batches.length - 1 && batch.start > batches[i + 1].start) {
        return ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Sort error`,
        });
      }
    });
  });

const ValidateBatchesList = z
  .array(z.object({ start: z.number(), end: z.number() }))
  .nonempty()
  .max(maxBatchNumber);

const ValidateBatchesRange = z.array(
  z
    .object({ start: z.number().nonnegative(), end: z.number().nonnegative() })
    .refine((batch) => {
      const diff = batch.end - batch.start;
      const maxRangeSeconds = maxRangeDays * secondsInDay;

      return (
        diff >= 0 &&
        diff <= maxRangeSeconds &&
        batch.start >= productStartInSeconds
      );
    })
);

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<PriceDataResponse | PriceRequest | ErrorResponse>
) => {
  const data = req.body as RangeMap;

  const coins = Object.keys(data);
  if (coins.length !== 0) {
    const validatedCoins = ValidateCoinList.safeParse(coins);

    if (!validatedCoins.success) {
      const errorMessage = validatedCoins.error.issues[0].message;
      return res.status(400).json(invalidSymbolErrorResponse(errorMessage));
    }

    const errorBatchesSort = coins.filter((symbol) => {
      const batchSortStatus = ValidateBatchesSort.safeParse(data[symbol]);
      console.log("batchSortStatus: ", batchSortStatus);
      if (!batchSortStatus.success) {
        return symbol;
      }
    });
    if (errorBatchesSort.length !== 0) {
      return res.status(400).json(batchesSortExcessError(errorBatchesSort));
    }

    const errorBatchesAmount = coins.filter((symbol) => {
      const batchNumberStatus = ValidateBatchesList.safeParse(data[symbol]);
      if (!batchNumberStatus.success) {
        return symbol;
      }
    });
    if (errorBatchesAmount.length !== 0) {
      return res.status(400).json(batchesAmountExcessError(errorBatchesAmount));
    }

    const errorBatchesRange = coins.filter((symbol) => {
      const batchRangeStatus = ValidateBatchesRange.safeParse(data[symbol]);
      if (!batchRangeStatus.success) {
        return symbol;
      }
    });

    if (errorBatchesRange.length !== 0) {
      return res.status(400).json(batchesRangeExcessError(errorBatchesRange));
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
  } else {
    const {
      coins: rawCoins,
      timestamp: rawTimestamp,
      days: rawDays,
    } = req.query;
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

    if (days > maxRangeDays) {
      return res.status(400).json(daysAmountExcessError);
    }

    try {
      const historical = await fetchCoingeckoPrices(coins, timestamp, days);
      return res.status(200).json(historical);
    } catch (err) {
      console.error(err);
      const error = err as DefaultError;
      return res.status(error.code ?? 500).json(serverError(error.message));
    }
  }
};
export default handler;
