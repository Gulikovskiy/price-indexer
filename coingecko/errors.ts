export enum ErrorType {
  InvalidSearchParams = 10001,
  InvalidSymbol = 10002,
  InvalidCoingeckoResponse = 10003,
  InvalidResponseTypes = 10004,
}

export const invalidSymbolErrorResponse = (symbol: string[]) => {
  return {
    code: ErrorType.InvalidSymbol,
    message: `${symbol.join(", ")} not exist or not supported`,
  };
};

export const coingeckoAPIErrorResponse = (res: Response) => {
  return {
    code: ErrorType.InvalidCoingeckoResponse,
    message: `Coingecko API failed. ${res.statusText}`,
  };
};

export const invalidResponseTypesError = {
  code: ErrorType.InvalidResponseTypes,
  message: "Invalid coingecko response types",
};
