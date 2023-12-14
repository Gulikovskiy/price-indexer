import { NextRequest } from "next/server";
import { cors } from "./cors";

export const createErrorResponse = (
  req: NextRequest,
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
  req: NextRequest,
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
