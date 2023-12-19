export type PriceRawResponse = {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
};

export type Price = {
  timestamp: number;
  price: string;
};

export type PriceDataResponse = {
  data?: { [symbol: string]: Price[] | null };
};

export type PriceResponse = {
  data?: PriceDataResponse;
  code: number;
  message?: string;
};
