import { NextApiRequest, NextApiResponse } from "next/types";
import { z } from "zod";
import { fetchCoingeckoPrices } from "../../../../../coingecko/coingecko-fetcher";
import { productStartInSeconds } from "../../../../../coingecko/constants";
import { coinList } from "../../../../../coingecko/supported-coins";
import {
  invalidSearchParamsError,
  invalidSymbolErrorResponse,
} from "../../../../../coingecko/utils";

const SearchParams = z.object({
  timestamp: z.coerce.number().int().positive(),
  days: z.coerce.number().int().positive(),
  coins: z.coerce.string(),
});

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { coins: rawCoins, timestamp: rawTimestamp, days: rawDays } = req.query;
  const parsed = SearchParams.safeParse({
    timestamp: rawTimestamp,
    days: rawDays,
    coins: rawCoins,
  });
  if (!parsed.success) {
    return res.status(400).json(invalidSearchParamsError);
  }

  const { coins, days, timestamp } = parsed.data;

  const timestampInSeconds = Math.max(timestamp, productStartInSeconds);

  const coinSet = Array.from(new Set(coins.split(" ")));

  const invalidSymbols = [];
  for (const coin of coinSet) {
    const id = coinList[coin];
    if (id === undefined) {
      invalidSymbols.push(coin);
    }
  }

  if (invalidSymbols.length)
    res.status(400).json(invalidSymbolErrorResponse(invalidSymbols));

  try {
    //TODO fetch 1 day price
    const historical = await fetchCoingeckoPrices(
      coinSet,
      timestampInSeconds,
      days
    );

    return res.status(200).json({ historical });
  } catch (error) {
    return res.status(error.code).json(error.message);
  }
};
export default handler;
