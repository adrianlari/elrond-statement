import config from "./config.json";

export const months = {
  1: "JANUARY",
  2: "FEBRUARY",
  3: "MARCH",
  4: "ARPIL",
  5: "MAY",
  6: "JUNE",
  7: "JULY",
  8: "AUGUST",
  9: "SEPTEMBER",
  10: "OCTOBER",
  11: "NOVEMBER",
  12: "DECEMBER",
};

export const transactionTypes = {
  TRANSACTION: "Transaction",
  RESULT: "Result",
};

export const actionTypes = {
  SEND: "Sent",
  RECEIVED: "Received",
  SELF: "Self",
};

export const status = {
  SUCCESS: "success",
  FAIL: "fail",
  INVALID: "invalid",
};

export const baseUrl = config.indexUrl;
export const url = `${baseUrl}/transactions/_search?scroll=1m`;
export const urlScTransactions = `${baseUrl}/scresults/_search?scroll=1m`;

export const noIndexUrl = `${baseUrl}/_search/scroll`;
export const MAXIMUM_NUMBER_OF_ROWS = 10000;
export const ok = "QDZmNm";
