// import "server-only";
import { NextRequest } from "next/server";
import { fetchCoingeckoPrices } from "../../../../forward/coingecko-fetcher";
import { invalidSearchParamsError } from "../../../../forward/utils";
import { millisecondsInYear } from "../../../../forward/constants";
import { NextApiRequest, NextApiResponse } from "next/types";

// export const config = {
//   runtime: "edge",
// };

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { coins: rawCoins, timestamp: rawTimestamp } = req.query;
  const timestamp = Number(
    Array.isArray(rawTimestamp) ? rawTimestamp[0] : rawTimestamp
  );
  const coins = Array.isArray(rawCoins) ? rawCoins[0] : rawCoins;
  console.log("rawTimestamp:  ", rawTimestamp);
  console.log("timestamp:  ", timestamp);
  const timestampInMilliseconds =
    BigInt(timestamp) > BigInt(millisecondsInYear)
      ? timestamp
      : timestamp * 1000;
  console.log("rawCoins: ", rawCoins);
  const properParams = timestampInMilliseconds > 0 && coins;
  if (!properParams) {
    return res.status(400).json(invalidSearchParamsError);
  }
  const coinList = coins.split(" ");
  console.log("coinList: ", coinList);
  const resp = await fetchCoingeckoPrices(coinList, timestampInMilliseconds);
  if (resp.code !== 200) {
    return res.status(resp.code).json(resp.message);
  }
  return res.status(resp.code).json(resp.data);
};
export default handler;
