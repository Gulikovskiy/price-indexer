import { type NextRequest } from "next/server";
import forward from "../../../../../forward";

export const config = {
  runtime: "edge",
};

const forwarder = forward("price");

const handler = async (req: NextRequest) => forwarder(req);

export default handler;
