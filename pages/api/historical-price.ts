// import { type NextRequest, NextResponse } from "next/server";
import "server-only";
import { NextRequest } from "next/server";
import { set, get } from "../../session/session-store";
import { fetchCoingeckoPrice } from "../../forward/coingecko-fetcher";

const coinList = {
  USDC: {
    id: "usd-coin",
    contract: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  },
  ETH: {
    id: "ethereum",
    contract: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
  },
};

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
    console.log("host: ", host);
    console.log("route: ", route);
    const coins = search.substring(7, search.length).split("+");
    console.log("coins: ", coins);
    // Storing a user's name in the session
    await set("username", host);

    const r = await fetchCoingeckoPrice();
    const test = new Response(JSON.stringify(r));
    return test;
  };
}

const forwarder = forward("historical-price");

const handler = async (req: NextRequest) => {
  return forwarder(req);
};

export default handler;
