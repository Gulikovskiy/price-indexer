import { NextRequest } from "next/server";
import { fetchPriceFrom0x } from "./fetcher";
import { createErrorResponse, createJsonResponse } from "./response";

export default function forward(route: string) {
  return async (req: NextRequest) => {
    const searchParams = new URL(req.url).searchParams;
    console.log("searchParams: ", searchParams);

    const chainId = Number(searchParams.get("nextParamchainId"));
    const endpoint = `${route}?${searchParams.toString()}`;

    try {
      const r = await fetchPriceFrom0x(chainId, endpoint);
      if (r === null) {
        return createErrorResponse(req, "API failed");
      }

      return createJsonResponse(req, r.body, 200);
    } catch (event) {
      const e = event as { message?: string; status?: number };
      return createErrorResponse(
        req,
        e.message ?? "API failed",
        e.status ?? 500
      );
    }
  };
}
