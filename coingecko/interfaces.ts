export type PriceRawResponse = {
  timestamp: number;
  price: number;
}[];

export type Price = {
  id: number;
  timestamp: number;
  price: string;
};

export type PriceDataResponse = { [symbol: string]: Price[] | null };
