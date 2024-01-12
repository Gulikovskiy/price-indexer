import { NextApiRequest, NextApiResponse } from "next/types";
import { DefaultError } from "../../../coingecko/interfaces";
import { serverError } from "../../../coingecko/errors";
import { getEndpoints } from "../../../endpoints";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const endpoints = await getEndpoints();

    return res.status(200).json({ endpoints });
  } catch (err) {
    const error = err as DefaultError;
    return res.status(error.code ?? 500).json(serverError(error.message));
  }
};
export default handler;
