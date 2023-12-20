import { fetchCoingeckoPrices } from "../../../../coingecko/coingecko-fetcher";
import {
  invalidSearchParamsError,
  invalidTimestampErrorResponse,
  isValidDate,
} from "../../../../coingecko/utils";
import { millisecondsInYear } from "../../../../coingecko/constants";
import { NextApiRequest, NextApiResponse } from "next/types";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { coins: rawCoins, timestamp: rawTimestamp } = req.query;
  const timestamp = Number(
    Array.isArray(rawTimestamp) ? rawTimestamp[0] : rawTimestamp
  );
  const coins = Array.isArray(rawCoins) ? rawCoins[0] : rawCoins;
  const timestampInMilliseconds =
    BigInt(timestamp) > BigInt(millisecondsInYear)
      ? timestamp
      : timestamp * 1000;

  const properParams = timestampInMilliseconds > 0 && coins;
  if (!properParams) {
    return res.status(400).json(invalidSearchParamsError);
  }
  const coinList = coins.split(" ");

  if (!isValidDate(timestampInMilliseconds)) {
    return res.status(400).json(invalidTimestampErrorResponse(timestamp));
  }
  try {
    const resp = await fetchCoingeckoPrices(coinList, timestampInMilliseconds);

    return res.status(200).json(resp);
  } catch (error) {
    return res.status(error.code).json(error.message);
  }
};
export default handler;
