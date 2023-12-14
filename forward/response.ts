// import { NextRequest } from "next/server";
import { cors } from "./cors";
import type { NextApiRequest, NextApiResponse } from "next";

export const createErrorResponse = (
  req: NextApiRequest,
  message: string,
  status: number = 500
) =>
  cors(
    req,
    new Response(message, {
      status,
      headers: {
        "content-type": "text/plain",
      },
    })
  );

export const createJsonResponse = (
  req: NextApiRequest,
  body: any,
  status: number = 200
) => {
  console.log("body: ", body);
  return cors(
    req,
    new Response(body, {
      status,
      headers: {
        "content-type": "application/json",
      },
    })
  );
};
