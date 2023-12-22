import { fetchCoingeckoPrices } from "../../../../../coingecko/coingecko-fetcher";
import {
  invalidSearchParamsError,
  invalidTimestampErrorResponse,
  isValidDate,
} from "../../../../../coingecko/utils";
import { NextApiRequest, NextApiResponse } from "next/types";

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

  const timestampInSeconds = timestamp;

  const coinList = Array.from(new Set(coins.split(" ")));

  if (!isValidDate(timestampInSeconds)) {
    return res.status(400).json(invalidTimestampErrorResponse(timestamp));
  }
  try {
    const resp = await fetchCoingeckoPrices(coinList, timestampInSeconds, days);

    return res.status(200).json(resp);
  } catch (error) {
    return res.status(error.code).json(error.message);
  }
};
export default handler;
