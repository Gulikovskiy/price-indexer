export type PriceRawResponse = {
  prices: [timestamp: number, price: number][];
  market_caps: [timestamp: number, marketCap: number][];
  total_volumes: [timestamp: number, volume: number][];
};

export type Price = {
  timestamp: number;
  price: string;
};

export type PriceDataResponse = { [symbol: string]: Price[] | null };

export type ValidDate = number & { __brand: "ValidDate" };
