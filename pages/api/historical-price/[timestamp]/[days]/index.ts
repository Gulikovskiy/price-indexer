import { NextApiRequest, NextApiResponse } from "next/types";
import { z } from "zod";
import { fetchCoingeckoPrices } from "../../../../../coingecko/coingecko-fetcher";
import { productStartInSeconds } from "../../../../../coingecko/constants";
import { coinList } from "../../../../../coingecko/supported-coins";
import { invalidSymbolErrorResponse } from "../../../../../coingecko/errors";

const SearchParams = z.object({
  timestamp: z.coerce
    .number()
    .int()
    .positive()
    .transform((ts) => Math.max(ts, productStartInSeconds)),
  days: z.coerce.number().int().positive(),
  coins: z.coerce
    .string()
    .transform((coins) => Array.from(new Set(coins.split(" ")))),
});

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { coins: rawCoins, timestamp: rawTimestamp, days: rawDays } = req.query;
  const parsed = SearchParams.safeParse({
    timestamp: rawTimestamp,
    days: rawDays,
    coins: rawCoins,
  });
  if (parsed.success === false) {
    return res.status(400).json(parsed.error.issues);
  }

  const { coins, days, timestamp } = parsed.data;

  const invalidSymbols = [];
  for (const coin of coins) {
    const id = coinList[coin];
    if (id === undefined) {
      invalidSymbols.push(coin);
    }
  }

  if (invalidSymbols.length)
    res.status(400).json(invalidSymbolErrorResponse(invalidSymbols));

  try {
    const historical = await fetchCoingeckoPrices(coins, timestamp, days);

    return res.status(200).json({ historical });
  } catch (error) {
    return res.status(error.code ?? 500).json(error.message);
  }
};
export default handler;
