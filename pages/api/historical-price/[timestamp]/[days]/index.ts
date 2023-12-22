import { NextApiRequest, NextApiResponse } from "next/types";
import { fetchCoingeckoPrices } from "../../../../../coingecko/coingecko-fetcher";
import { productStartInSeconds } from "../../../../../coingecko/constants";
import {
  invalidSearchParamsError,
  invalidSymbolErrorResponse,
  invalidTimestampErrorResponse,
  isValidDate,
} from "../../../../../coingecko/utils";
import { coinList } from "../../../../../coingecko/supported-coins";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { coins: rawCoins, timestamp: rawTimestamp, days: rawDays } = req.query;

  const timestamp = Number(
    Array.isArray(rawTimestamp) ? rawTimestamp[0] : rawTimestamp
  );
  const days = Number(Array.isArray(rawDays) ? rawDays[0] : rawDays);

  const coins = Array.isArray(rawCoins) ? rawCoins[0] : rawCoins;

  const properParams =
    !Number.isNaN(timestamp) &&
    !Number.isNaN(days) &&
    timestamp > 0 &&
    coins &&
    days;
  if (!properParams) {
    return res.status(400).json(invalidSearchParamsError);
  }

  if (!isValidDate(timestamp)) {
    return res.status(400).json(invalidTimestampErrorResponse(timestamp));
  }

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
