import "server-only";
import { NextRequest } from "next/server";
import { fetchCoingeckoPrices } from "../../../../../forward/coingecko-fetcher";
import { invalidSearchParamsError } from "../../../../../forward/utils";
import { millisecondsInYear } from "../../../../../forward/constants";

export const config = {
  runtime: "edge",
};

function forward(route: string) {
  return async (req: NextRequest) => {
    const searchParams = new URL(req.url).searchParams;

    const timestamp = Number(searchParams.get("timestamp"));
    const timestampInMilliseconds =
      BigInt(timestamp) > BigInt(millisecondsInYear)
        ? timestamp
        : timestamp * 1000;

    const coins = searchParams.get("coins");

    const properParams = timestampInMilliseconds > 0 && coins;

    if (properParams) {
      const coinList = coins.split("+");

      const r = await fetchCoingeckoPrices(coinList, timestampInMilliseconds);
      const resp = new Response(JSON.stringify(r));

      return resp;
    }
    return new Response(JSON.stringify(invalidSearchParamsError));
  };
}

const forwarder = forward("historical-price");

const handler = async (req: NextRequest) => {
  return forwarder(req);
};

export default handler;
