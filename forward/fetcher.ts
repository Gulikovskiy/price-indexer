const endpointPrefixes = {
  1: "",
  137: "polygon.",
  56: "bsc.",
  10: "optimism.",
  42161: "arbitrum.",
  43114: "avalanche.",
} as const;

class ForwardedError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ForwardedError";
  }
}

export const fetchPriceFrom0x = async (chainId: number, endpoint: string) => {
  const prefix = endpointPrefixes[chainId];
  if (prefix === undefined) {
    throw new ForwardedError("Unsupported chainId", 400);
  }

  const url = `https://${prefix}api.0x.org/swap/v1/${endpoint}`;

  let response = await fetch(url, {
    headers: {
      "0x-api-key": process.env.ZEROEX_API_KEY,
    },
  });
  switch (response.status) {
    case 200:
      return response;
    case 429: {
      console.error("0x API rate-limited");
      const url = `https://api.phuture.finance/${chainId}/swap/v1/${endpoint}`;

      const response = await fetch(url);
      if (response.status !== 200) {
        console.error("Phuture API failed with code %s", response.status);
        return null;
      }

      return response;
    }
    default:
      throw new ForwardedError("0x API failed", response.status);
  }
};
