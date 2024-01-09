export type Price = {
  id: number;
  timestamp: number;
  price: string;
};

export type PriceDataResponse = { [symbol: string]: Price[] | null };

export type DefaultError = {
  code: number;
  message: string;
};
