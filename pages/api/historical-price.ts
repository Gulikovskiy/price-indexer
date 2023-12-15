import "server-only";
import { NextRequest } from "next/server";
import { fetchCoingeckoPrices } from "../../forward/coingecko-fetcher";
import { kv } from "@vercel/kv";
// import { kv } from "@vercel/kv";

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
    const host = new URL(req.url).host;
    const search = new URL(req.url).search;
    const coins = search.substring(7, search.length).split("+");

    const r = await fetchCoingeckoPrices(coins, {
      start: 1701900000,
      finish: 17024839700,
    });
    const test = new Response(JSON.stringify(r));

    return test;
  };
}

const forwarder = forward("historical-price");

const handler = async (req: NextRequest) => {
  return forwarder(req);
};

export default handler;
