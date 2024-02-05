import { NextApiRequest, NextApiResponse } from "next/types";
import { DefaultError } from "../../../coingecko/interfaces";
import { serverError } from "../../../coingecko/errors";
import { getServerConfig } from "../../../endpoints";

const handler = async (_: NextApiRequest, res: NextApiResponse) => {
  try {
    const config = getServerConfig();

    return res.status(200).json(config);
  } catch (err) {
    const error = err as DefaultError;
    return res.status(error.code ?? 500).json(serverError(error.message));
  }
};
export default handler;
