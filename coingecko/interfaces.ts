export type Price = { timestamps: number[]; prices: string[] };

export type PriceDataResponse = { [symbol: string]: Price | null };

export type DefaultError = {
  code: number;
  message: string;
};
