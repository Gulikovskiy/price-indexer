import { ZodIssue } from "zod";

export const ErrorType = {
  InvalidSearchParams: 10001,
  InvalidSymbol: 10002,
  InvalidCoingeckoResponse: 10003,
  InvalidResponseTypes: 10004,
  InternalServerError: 10005,
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
