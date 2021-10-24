import "regenerator-runtime/runtime";
import axios from "axios";
import * as constants from "./constants";

var inputAddress = document.getElementById("address");
var btnGetStatement = document.getElementById("btnGetStatement");
var divError = document.getElementById("errorMessage");
var lookupMonths = document.getElementById("months");

let isFirstScroll = true;
let csvData = "";
let address;
let startTimestamp;
let endTimestamp;
let selectedMonth;
let selectedYear;
let currentMonthNumber;

const urlTransactions = `${constants.baseUrl}/transactions/_search`;
const urlSc = `${constants.baseUrl}/scresults/_search`;

btnGetStatement.onclick = async () => getStatement();
lookupMonths.onchange = async () => setTimestamps();

const setTimestamps = async () => {
  startTimestamp = parseInt(lookupMonths.value);

  const selectedDate = new Date(startTimestamp);
  //console.log({ selectedDate });

  startTimestamp /= 1000;

  selectedMonth = selectedDate.getMonth() + 1;
  selectedYear = selectedDate.getFullYear();

  if (selectedDate.getMonth() + 1 === currentMonthNumber) {
    endTimestamp = parseInt(String(new Date().getTime()).slice(0, 10));
  } else {
    //console.log({ selectedYear });
    //console.log({ selectedMonth });
    endTimestamp = parseInt(
      String(new Date(selectedYear, selectedMonth, 1).getTime() - 1).slice(
        0,
        10
      )
    );
  }

  //console.log({ startTimestamp });
  //console.log({ endTimestamp });
};

const showSpinner = () => {
  btnGetStatement.innerHTML = `<div class="spinner-border text-success"></div>`;
};

const hideSpinner = () => {
  btnGetStatement.innerHTML = `Get Statement`;
};

const populateMonthsLookup = () => {
  const today = new Date();

  currentMonthNumber = today.getMonth() + 1;
  selectedMonth = today.getMonth() + 1;
  selectedYear = today.getFullYear();

  let options = `<option value="" disabled selected>Select month</option>`;

  for (let index = 0; index < 12; index++) {
    startTimestamp = new Date(selectedYear, selectedMonth - 1, 1).getTime();
    //console.log({ startTimestamp });

    let monthYearOption = `<option value=${startTimestamp}> ${constants.months[selectedMonth]}  ${selectedYear} </option>`;
    options += monthYearOption;

    if (selectedMonth === 1) {
      selectedMonth = 12;
      selectedYear--;
    } else selectedMonth--;
  }

  lookupMonths.innerHTML = options;
};
populateMonthsLookup();

const getAllRecordsSelectedMonth = async (body, txType) => {
  let records =
    txType === constants.transactionTypes.TRANSACTION
      ? await axios.post(urlTransactions, body)
      : await axios.post(urlSc, body);

  let allRecords = new Array();

  appendContentToArray(allRecords, records);

  while (
    records &&
    records.data &&
    records.data.hits.hits.lenght === constants.MAXIMUM_NUMBER_OF_ROWS
  ) {
    let lastTimestamp = records[records.data.data.hits.length - 1].timestamp;

    body = getComplexBody(lastTimestamp, endTimestamp, address);

    records =
      txType === constants.transactionTypes.TRANSACTION
        ? await axios.post(urlTransactions, body)
        : await axios.post(urlSc, body);

    appendContentToArray(allRecords, records);
  }

  allRecords = getUniqueRecords(allRecords);

  console.log({ allRecords });

  return allRecords;
};

const getAllTransactionsForSelectedMonth = async () => {
  let body = getComplexBody(startTimestamp, endTimestamp, address);

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
      x._source && x._source.data && !x._source.data.startsWith(constants.ok)
  );

  return allTransactionsFormatted.concat(allScResultsFormatted);
};

const getStatementForSelectedMonth = async () => {
  const allTransactionsSelectedMonth =
    await getAllTransactionsForSelectedMonth();

  const allTransactionsSelectedMonthSorted = sortTransactionsByTimestamp(
    allTransactionsSelectedMonth
  );

  setCsvData(allTransactionsSelectedMonthSorted);

  downloadStatement();
};

const getUniqueRecords = (array) => [...new Set(array)];

const getStatement = async () => {
  address = inputAddress.value;

  if (!address || !address.startsWith("erd1")) {
    inputAddress.classList.toggle("is-invalid");
    divError.textContent = "Enter a valid address";
    return;
  }

  showSpinner();

  await getStatementForSelectedMonth();

  //const allTransactionsFormatted = await getAllFormattedTransactions();
  //const allTransactionsSortedByTimestamp = sortTransactionsByTimestamp(
  //allTransactionsFormatted
  //);

  //setCsvData(allTransactionsSortedByTimestamp);

  //downloadStatement();

  hideSpinner();
};

const appendContentToArray = (array, content) => {
  if (content && content.data && content.data.hits.hits) {
    content.data.hits.hits.map((row) => array.push(row));
  }
};

const hasAnyTransactions = (array) => {
  return array.data.hits.hits.length > 0;
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
  return transactions.sort((element1, element2) => {
    return element2.timestamp.localeCompare(element1.timestamp);
  });
};

const downloadStatement = () => {
  var blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "Statement.csv");
  document.body.appendChild(link);

  link.click();
};

const setCsvData = (transactionsArray) => {
  csvData = arrayToCsv(transactionsArray);
};
