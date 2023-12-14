import { NextApiRequest } from "next";
import { PriceRawResponse } from "../pages/api/historical-price";

type StaticOrigin = boolean | string | RegExp | (boolean | string | RegExp)[];

type OriginFn = (
  origin: string | undefined,
  req: NextApiRequest
) => StaticOrigin | Promise<StaticOrigin>;

interface CorsOptions {
  origin?: StaticOrigin | OriginFn;
  methods?: string | string[];
  allowedHeaders?: string | string[];
  exposedHeaders?: string | string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

const defaultOptions: CorsOptions = {
  origin: "*",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

function isOriginAllowed(origin: string, allowed: StaticOrigin): boolean {
  return Array.isArray(allowed)
    ? allowed.some((o) => isOriginAllowed(origin, o))
    : typeof allowed === "string"
    ? origin === allowed
    : allowed instanceof RegExp
    ? allowed.test(origin)
    : !!allowed;
}

function getOriginHeaders(reqOrigin: string | undefined, origin: StaticOrigin) {
  const headers = new Headers();

  if (origin === "*") {
    // Allow any origin
    headers.set("Access-Control-Allow-Origin", "*");
  } else if (typeof origin === "string") {
    // Fixed origin
    headers.set("Access-Control-Allow-Origin", origin);
    headers.append("Vary", "Origin");
  } else {
    const allowed = isOriginAllowed(reqOrigin ?? "", origin);

    if (allowed && reqOrigin) {
      headers.set("Access-Control-Allow-Origin", reqOrigin);
    }
    headers.append("Vary", "Origin");
  }

  return headers;
}

// originHeadersFromReq

async function originHeadersFromReq(
  req: NextApiRequest,
  origin: StaticOrigin | OriginFn
) {
  const reqOrigin = req.headers.origin || undefined;
  const value =
    typeof origin === "function" ? await origin(reqOrigin, req) : origin;

  if (!value) return;
  return getOriginHeaders(reqOrigin, value);
}

function getAllowedHeaders(req: NextApiRequest, allowed?: string | string[]) {
  const headers = new Headers();

  if (!allowed) {
    allowed = req.headers["access-control-request-headers"];
    headers.append("Vary", "Access-Control-Request-Headers");
  } else if (Array.isArray(allowed)) {
    // If the allowed headers is an array, turn it into a string
    allowed = allowed.join(",");
  }
  if (allowed) {
    headers.set("Access-Control-Allow-Headers", allowed);
  }

  return headers;
}

export async function cors(
  req: NextApiRequest,
  res: Response,
  options?: CorsOptions
) {
  const opts = { ...defaultOptions, ...options };
  const { headers } = res;
  const originHeaders = await originHeadersFromReq(req, opts.origin ?? false);
  const mergeHeaders = (v: string, k: string) => {
    if (k === "Vary") headers.append(k, v);
    else headers.set(k, v);
  };

  // If there's no origin we won't touch the response
  console.log("! originHeaders", !originHeaders);
  if (!originHeaders) return res;

  originHeaders.forEach(mergeHeaders);

  if (opts.credentials) {
    headers.set("Access-Control-Allow-Credentials", "true");
  }

  const exposed = Array.isArray(opts.exposedHeaders)
    ? opts.exposedHeaders.join(",")
    : opts.exposedHeaders;

  if (exposed) {
    headers.set("Access-Control-Expose-Headers", exposed);
  }

  // Handle the preflight request
  if (req.method === "OPTIONS") {
    if (opts.methods) {
      const methods = Array.isArray(opts.methods)
        ? opts.methods.join(",")
        : opts.methods;

      headers.set("Access-Control-Allow-Methods", methods);
    }

    getAllowedHeaders(req, opts.allowedHeaders).forEach(mergeHeaders);

    if (typeof opts.maxAge === "number") {
      headers.set("Access-Control-Max-Age", String(opts.maxAge));
    }
    console.log("opts.preflightContinue: ", opts.preflightContinue);
    if (opts.preflightContinue) return res;

    headers.set("Content-Length", "0");
    return new Response(null, { status: opts.optionsSuccessStatus, headers });
  }

  // If we got here, it's a normal request
  // console.log(
  //   "res.json().then((el) => el.prices): ",
  //   res.json().then((el) => el.prices)
  // );

  // const test = res.json().then((el: PriceRawResponse) => el.prices);
  // console.log("HERE: ", test);
  // const test2 = new Response(test)
  return res;
}
