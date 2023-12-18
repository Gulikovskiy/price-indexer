import "server-only";
import { NextRequest } from "next/server";
import { fetchCoingeckoPrices } from "../../forward/coingecko-fetcher";

export const config = {
  runtime: "edge",
};

export type PriceRawResponse = {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
};

function forward(route: string) {
  return async (req: NextRequest) => {
    const search = new URL(req.url).search;

    const properParams =
      search.includes("?coins=") && search.includes("start=");

    const searchGroups = search.split("&");
    if (searchGroups.length >= 2 && properParams) {
      const coins = searchGroups[0]
        .substring("?coins=".length, searchGroups[0].length)
        .split("+");
      const start = +searchGroups[1].substring(
        "start=".length,
        searchGroups[1].length
      );

      const r = await fetchCoingeckoPrices(coins, start);
      const test = new Response(JSON.stringify(r));

      return test;
    }
    return new Response(JSON.stringify("FAILED. Wrong url"));
  };
}

const forwarder = forward("historical-price");

const handler = async (req: NextRequest) => {
  return forwarder(req);
};

export default handler;
