import "regenerator-runtime/runtime";
import axios from "axios";
import * as constants from "./constants";

const inputAddress = document.getElementById("address");
const btnGetStatement = document.getElementById("btnGetStatement");
const divError = document.getElementById("errorMessage");
const lookupMonths = document.getElementById("months");
const errorMsg = document.getElementById("error");

let csvData = "";
let address;
let startTimestamp;
let endTimestamp;
let selectedMonthNumber;
let selectedYear;
let currentMonthNumber;
let today;

const urlTransactions = `${constants.baseUrl}/transactions/_search`;
const urlSc = `${constants.baseUrl}/scresults/_search`;

lookupMonths.onchange = async () => setTimestamps();
btnGetStatement.onclick = async () => getStatement();

const setTimestamps = async () => {
  errorMsg.classList.remove("d-block");

  startTimestamp = parseInt(lookupMonths.value);

  const initialTimestampOfSelectedMonth = new Date(startTimestamp * 1000);

  currentMonthNumber = getMonthNumberOf(today);

  selectedMonthNumber = getMonthNumberOf(initialTimestampOfSelectedMonth);
  selectedYear = getYearOf(initialTimestampOfSelectedMonth);

  if (selectedMonthNumber === currentMonthNumber) {
    endTimestamp = Math.floor(new Date().getTime() / 1000);
  } else {
    endTimestamp = Math.floor(
      (new Date(selectedYear, selectedMonthNumber + 1, 1).getTime() - 1) / 1000
    );
  }
};

const showSpinner = () => {
  btnGetStatement.innerHTML = `<div class="spinner-border text-success"></div>`;
};

const hideSpinner = () => {
  btnGetStatement.innerHTML = `Get Statement`;
};

const getInitialTimestampForMonth = (selectedYear, selectedMonth) => {
  return Math.floor(new Date(selectedYear, selectedMonth, 1).getTime() / 1000);
};

const getMonthNumberOf = (day) => {
  return day.getMonth();
};

const getYearOf = (day) => {
  return day.getFullYear();
};

const createOption = (selectedYear, selectedMonth) => {
  const initialTimestamp = getInitialTimestampForMonth(
    selectedYear,
    selectedMonth
  );

  const option = `<option value=${initialTimestamp} > ${constants.months[selectedMonth]}  ${selectedYear} </option>`;

  return option;
};

const getPreviousYear = (year) => {
  return --year;
};

const getPreviousMonth = (month) => {
  return --month;
};

const createOptionsForOneYearBack = (today) => {
  selectedMonthNumber = getMonthNumberOf(today);
  selectedYear = getYearOf(today);

  let options = `<option class="form-control" value="" disabled selected>Select month</option>`;

  for (let index = 0; index < constants.NUMBER_OF_MONTHS; index++) {
    options += createOption(selectedYear, selectedMonthNumber);

    if (selectedMonthNumber === constants.months.indexOf("January")) {
      selectedMonthNumber = constants.months.indexOf("December");
      selectedYear = getPreviousYear(selectedYear);
    } else {
      selectedMonthNumber = getPreviousMonth(selectedMonthNumber);
    }
  }

  lookupMonths.innerHTML = options;
};

const populateMonthsLookup = () => {
  today = new Date();

  createOptionsForOneYearBack(today);
};
populateMonthsLookup();

const getAllRecordsSelectedMonth = async (body, txType) => {
  let records =
    txType === constants.transactionTypes.TRANSACTION
      ? await axios.post(urlTransactions, body)
      : await axios.post(urlSc, body);

  let allRecords = new Array();

  appendContentToArray(allRecords, records);

  while (records && records.data && isArrayFull(records)) {
    let lastTimestamp =
      records.data.hits.hits[records.data.hits.hits.length - 1]._source
        .timestamp;

    body = getComplexBody(lastTimestamp, endTimestamp, address);

    records =
      txType === constants.transactionTypes.TRANSACTION
        ? await axios.post(urlTransactions, body)
        : await axios.post(urlSc, body);

    appendContentToArray(allRecords, records);
  }

  allRecords = getUniqueRecords(allRecords);

  return allRecords;
};

const getAllTransactionsForSelectedMonth = async () => {
  startTimestamp += constants.GMT_SECONDS_DIFFERCE;
  endTimestamp += constants.GMT_SECONDS_DIFFERCE;

  const body = getComplexBody(startTimestamp, endTimestamp, address);

  const allTransactionsRaw = await getAllRecordsSelectedMonth(
    body,
    constants.transactionTypes.TRANSACTION
  );

  const allScResultsRaw = await getAllRecordsSelectedMonth(
    body,
    constants.transactionTypes.RESULT
  );

  const allTransactionsFormatted = formatTransactions(
    allTransactionsRaw,
    constants.transactionTypes.TRANSACTION
  );

  const allScResultsFormatted = formatTransactions(
    allScResultsRaw,
    constants.transactionTypes.RESULT
  ).filter(
    (x) =>
      x.action === constants.actionTypes.RECEIVED &&
      x.data &&
      !x.data.startsWith(constants.ok)
  );

  return allTransactionsFormatted.concat(allScResultsFormatted);
};

const getStatementForSelectedMonth = async () => {
  const allTransactionsSelectedMonth =
    await getAllTransactionsForSelectedMonth();

  const allSortedTransactionsSelectedMonth = sortTransactionsByTimestamp(
    allTransactionsSelectedMonth
  );

  setCsvData(allSortedTransactionsSelectedMonth);

  downloadStatement();
};

const getUniqueRecords = (array) => [...new Set(array)];

const allFieldsValid = () => {
  let areAllFieldsValid = true;

  if (
    !address ||
    !address.startsWith("erd1") ||
    address.length !== constants.ADDRESS_LENGTH
  ) {
    inputAddress.classList.add("is-invalid");
    divError.textContent = "Enter a valid address.";
    areAllFieldsValid = false;
  } else {
    inputAddress.classList.remove("is-invalid");
  }

  if (!lookupMonths.value) {
    errorMsg.classList.add("d-block");
    errorMsg.textContent = "Please select a month.";
    areAllFieldsValid = false;
  }

  return areAllFieldsValid;
};

const getStatement = async () => {
  if (!inputAddress) {
    return;
  }

  console.log("click");

  address = inputAddress.value;

  if (!allFieldsValid()) {
    return;
  }

  showSpinner();

  await getStatementForSelectedMonth();

  hideSpinner();
};

const appendContentToArray = (array, content) => {
  if (content && content.data && content.data.hits.hits) {
    content.data.hits.hits.map((row) => array.push(row));
  }
};

const isArrayFull = (array) => {
  return array.data.hits.hits.length === constants.MAXIMUM_NUMBER_OF_ROWS;
};

const arrayToCsv = (array) => {
  const csvHeader =
    "Timestamp,Value,Type,Address,Status,TxType,Fee,TxHash,Data\n";
  const csvContent = array
    .map((row) =>
      [
        row.timestamp,
        row.value,
        row.action,
        row.address,
        row.status,
        row.transactionType,
        row.fee,
        row.txHash,
        row.data,
      ].join(",")
    )
    .join("\n");

  const csvData = csvHeader + csvContent;

  return csvData;
};

const getAction = (sender, receiver) => {
  if (sender === receiver) {
    return constants.actionTypes.SELF;
  } else if (receiver === address) {
    return constants.actionTypes.RECEIVED;
  } else if (sender === address) {
    return constants.actionTypes.SEND;
  }
};

const getAddress = (sender, receiver) => {
  if (sender === address) {
    return receiver;
  } else if (receiver === address) {
    return sender;
  }
};

const deleteFrontZeroes = (string) => {
  for (let index = 0; index < string.length; index++) {
    if (string[index] === "0" && string[index + 1] !== ".") {
      string = string.slice(1, string.length);
      index--;
    } else {
      return string;
    }
  }
};

const deleteBackZeroes = (string) => {
  for (let index = string.length - 1; index >= 0; index--) {
    if (string[index] === "0" && string[index - 1] !== ".") {
      string = string.slice(0, index);
    } else {
      return string;
    }
  }
};

const denominateValue = (value) => {
  let zeroes = "000000000000000000";

  let isValueNegative = value < 0;
  if (isValueNegative) {
    value = -value;
  }

  let stringValue = String(value);

  let zeroesBeforeStringValue = zeroes + stringValue;

  const lenght = zeroesBeforeStringValue.length;

  let denominatedValue =
    zeroesBeforeStringValue.slice(0, lenght - 18) +
    "." +
    zeroesBeforeStringValue.slice(length - 18);

  denominatedValue = deleteFrontZeroes(denominatedValue);
  denominatedValue = deleteBackZeroes(denominatedValue);

  if (isValueNegative) denominatedValue = "-" + denominatedValue;

  return denominatedValue;
};

const getFee = (txType, row) => {
  if (
    txType === constants.transactionTypes.TRANSACTION &&
    row.sender === address
  ) {
    return denominateValue(parseInt(row.fee));
  }

  return BigInt(0);
};

const formatTransactions = (rawTransactions, txType) => {
  const formattedTransactions = rawTransactions.map((row) => ({
    timestamp: formatToDate(row._source.timestamp),
    value: getValue(
      row._source.sender,
      row._source.receiver,
      row._source.value
    ),
    action: getAction(row._source.sender, row._source.receiver),
    address: getAddress(row._source.sender, row._source.receiver),
    status: getStatus(txType, row._source),
    transactionType: txType,
    fee: getFee(txType, row._source),
    txHash: row._id,
    data: getData(row._source.data),
  }));

  return formattedTransactions;
};

const getData = (data) => {
  return data ? Buffer.from(data, "base64").toString("binary") : "";
};

const getStatus = (transactionType, row) => {
  return transactionType === constants.transactionTypes.TRANSACTION
    ? row.status
    : constants.status.SUCCESS;
};

const getValue = (sender, receiver, value) => {
  if (sender === receiver) {
    return BigInt(0);
  }

  if (sender === address) {
    value = -value;
  }

  return denominateValue(BigInt(value));
};

const formatToDate = (timestamp) => {
  const date = new Date(timestamp * 1000);
  const formattedDate =
    date.toISOString().slice(0, 10) + " " + date.toTimeString().slice(0, 8);

  return formattedDate;
};

const getComplexBody = (startTimestamp, endTimestamp, address) => {
  const body = {
    size: constants.MAXIMUM_NUMBER_OF_ROWS,
    sort: {
      timestamp: {
        order: "asc",
      },
    },
    query: {
      bool: {
        filter: [
          {
            range: {
              timestamp: {
                gte: startTimestamp,
                lte: endTimestamp,
              },
            },
          },
          {
            query_string: {
              query: `sender: ${address} OR  receiver: ${address}`,
            },
          },
        ],
      },
    },
  };

  return body;
};

const sortTransactionsByTimestamp = (transactions) => {
  if (transactions) {
    return transactions.sort((element1, element2) => {
      return element2.timestamp.localeCompare(element1.timestamp);
    });
  }
};

const downloadStatement = () => {
  var blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${constants.months[selectedMonthNumber]}.csv`);
  document.body.appendChild(link);

  link.click();
};

const setCsvData = (transactionsArray) => {
  csvData = arrayToCsv(transactionsArray);
};
