import { ZodIssue } from "zod";

export const ErrorType = {
  InvalidSearchParams: 10001,
  InvalidSymbol: 10002,
  InvalidAssetsAmount: 10003,
  InvalidDaysAmount: 10004,
  InvalidTimestampRange: 10005,
  InvalidCoingeckoResponse: 10006,
  InvalidResponseTypes: 10007,
  InternalServerError: 10008,
} as const;

type ValueOf<T> = T[keyof T];

export type ErrorResponse = {
  code: ValueOf<typeof ErrorType>;
  message?: string;
};

export class KeyError extends ReferenceError {
  constructor() {
    super("api key is undefined");
    this.name = "KeyError";
    Object.setPrototypeOf(this, KeyError.prototype);
  }
}

export const zodErrorResponse = (
  code: ValueOf<typeof ErrorType>,
  issue: ZodIssue
): ErrorResponse => ({
  message: `${issue.path} param ${issue.message.toLowerCase()}`,
  code,
});

export const invalidSymbolErrorResponse = (message: string) => {
  return {
    code: ErrorType.InvalidSymbol,
    message,
  };
};

export const assetAmountExcessError = {
  code: ErrorType.InvalidAssetsAmount,
  message: "Invalid assets amount",
};

export const daysAmountExcessError = {
  code: ErrorType.InvalidDaysAmount,
  message: "Invalid range",
};

export const timestampRangeError = (symbols: string[]) => ({
  code: ErrorType.InvalidTimestampRange,
  message: `Invalid timestamp range for ${symbols.join(", ")} assets`,
});

export const coingeckoAPIErrorResponse = {
  code: ErrorType.InvalidCoingeckoResponse,
  message: "Coingecko API failed.",
};

export const invalidResponseTypesError = {
  code: ErrorType.InvalidResponseTypes,
  message: "Invalid coingecko response types",
};

export const serverError = (message = "Internal Server Error") => ({
  code: ErrorType.InternalServerError,
  message: message,
});
