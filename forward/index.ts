import { NextRequest } from "next/server";
import { fetchPriceFrom0x } from "./fetcher";
import { createErrorResponse, createJsonResponse } from "./response";

export default function forward(route: string) {
  return async (req: NextRequest) => {
    const searchParams = new URL(req.url).searchParams;

    const chainId = Number(searchParams.get("nextParamchainId"));
    const endpoint = `${route}?${searchParams.toString()}`;

    try {
      const r = await fetchPriceFrom0x(chainId, endpoint);
      if (r === null) {
        return createErrorResponse(req, "API failed", r.status);
      }

      return createJsonResponse(req, r.body, 200);
    } catch (e) {
      return createErrorResponse(req, e.message, e.status);
    }
  };
}
