import 'regenerator-runtime/runtime';
import axios from "axios";

const baseUrl = "https://devnet-index.elrond.com";

const url = `${baseUrl}/transactions/_search?scroll=1m`;
const urlScTransactions = `${baseUrl}/scresults/_search?scroll=1m`;

const noIndexUrl = `${baseUrl}/_search/scroll`;

var inputAddress = document.getElementById("address");
var btnGetStatement = document.getElementById("btnGetStatement");
var divError = document.getElementById("errorMessage");
var filterValue = document.getElementById("filter-values");

let isFirstTimeNormalTrans = true;
let isFirstTimeScTrans = true;
let csvData = "";
let showZeroValues = false;
let address;
const size = 10000;

let balance = 0;
let totalGasUsed = 0;

btnGetStatement.onclick = async () => getStatement();

filterValue.onclick = () => changeShowZeroValues();

const getStatement = async () => {
  address = inputAddress.value;

  if (!address || !address.startsWith("erd1")) {
    inputAddress.classList.toggle("is-invalid");
    divError.textContent = "Enter a valid address";
    return;
  }

  btnGetStatement.innerHTML = `<div class="spinner-border text-success"></div>`;
  const allTransactions = await getAllTransactions();
  const allTransactionsSortedByTimestamp = sortTransactionsByTimestamp(allTransactions);

  console.log(allTransactionsSortedByTimestamp);

  setCsvData(allTransactionsSortedByTimestamp);

  downloadStatement();

  refresh();
  btnGetStatement.innerHTML = `Get Statement`;
}

const getValueNonf = (sender, receiver, value) => {
  if (sender === receiver) {
    return 0;
  }

  if (address === sender) {
    value = -value;
  }

  //const formattedValue = value / (10 ** 18);
  value = parseInt(value);

  return value;
}

const getAllTransactions = async () => {

  const allSimpleTransactionsRaw = await getAllSimpleTransactions();
  const allScTransactionsRaw = await getAllScTransactions();

  console.log({ allSimpleTransactionsRaw });
  console.log({ allScTransactionsRaw });

  // allSimpleTransactionsRaw.map((row) => balance += getValueNonf(row._source.sender, row._source.receiver, row._source.value));
  // allScTransactionsRaw.map((row) => balance += getValueNonf(row._source.sender, row._source.receiver, row._source.value));

  const allSimpleTransactions = allSimpleTransactionsRaw ? formatSimpleTransactions(allSimpleTransactionsRaw) : new Array();
  const allScTransactions = allScTransactionsRaw ? formatScTransactions(allScTransactionsRaw) : new Array();

  allSimpleTransactions.map((row) => totalGasUsed += row.gas);
  console.log({ totalGasUsed });

  //totalGasUsed /= (10 ** 18);
  //console.log({ totalGasUsed });

  console.log({ allSimpleTransactions });
  //console.log({ allScTransactions });

  const allTransactions = allSimpleTransactions.concat(allScTransactions);
  allTransactions.map((row) => row.status === "success" ? balance += row.value : balance += 0);
  console.log(allTransactions);
  console.log(parseFloat(balance) - totalGasUsed);
  // allTransactions.map((row) => {
  //   // balance += row.value;
  //   totalGasUsed += row.gas ? row.gas : 0;
  // });

  // console.log({ balance });
  // console.log({ totalGasUsed });
  // console.log(balance / (10 ** 18) - totalGasUsed);

  return allTransactions;
}

const getAllSimpleTransactions = async () => {
  const body = getBody(address);

  let someResultTransactionsRaw = await getSimpleTransactions(body);

  if (!someResultTransactionsRaw.data.hits.hits.length) {
    return;
  }

  let allSimpleTransactionsRaw = new Array();
  someResultTransactionsRaw.data.hits.hits.map((row) => allSimpleTransactionsRaw.push(row));

  const scrollId = someResultTransactionsRaw.data._scroll_id;
  const scrollBody = getScrollBody(scrollId);

  while (someResultTransactionsRaw.data.hits.hits.length === size) {
    someResultTransactionsRaw = await getSimpleTransactions(scrollBody);

    if (someResultTransactionsRaw.data.hits.hits.length) {
      someResultTransactionsRaw.data.hits.hits.map((row) => allSimpleTransactionsRaw.push(row));
    }
  }

  //allSimpleTransactionsRaw.map((row) => { balance += parseInt(address === row._source.receiver ? row._source.value : 0) });

  return allSimpleTransactionsRaw;
}

const getSimpleTransactions = async (neededBody) => {
  let someResultTransactionsRaw;

  if (isFirstTimeNormalTrans) {
    someResultTransactionsRaw = await axios.post(url, neededBody);
    isFirstTimeNormalTrans = false;
  } else {
    someResultTransactionsRaw = await axios.post(noIndexUrl, neededBody);
  }

  return someResultTransactionsRaw;
}

const getAllScTransactions = async () => {
  let body = getBody(address);

  let someScResultTransactionsRaw = await getScTransactions(body);

  if (!someScResultTransactionsRaw.data.hits.hits.length) {
    return;
  }

  let allScTransactionsRaw = new Array();
  someScResultTransactionsRaw.data.hits.hits.map((row) => allScTransactionsRaw.push(row));

  const scrollId = someScResultTransactionsRaw.data._scroll_id;
  let scrollBody = getScrollBody(scrollId);

  while (someScResultTransactionsRaw.data.hits.hits.length === size) {
    someScResultTransactionsRaw = await getScTransactions(scrollBody);

    if (someScResultTransactionsRaw.data.hits.hits.length) {
      someScResultTransactionsRaw.data.hits.hits.map((row) => allScTransactionsRaw.push(row));
    }
  }

  return allScTransactionsRaw;
}

const getScTransactions = async (neededBody) => {
  let someScResultTransactionsRaw;

  if (isFirstTimeScTrans) {
    someScResultTransactionsRaw = await axios.post(urlScTransactions, neededBody);
    isFirstTimeScTrans = false;
  } else {
    someScResultTransactionsRaw = await axios.post(noIndexUrl, neededBody);
  }

  return someScResultTransactionsRaw;
}

const refresh = () => {
  isFirstTimeNormalTrans = true;
  isFirstTimeScTrans = true;
  balance = 0;
  totalGasUsed = 0;
}

const trimAddress = (address) => {
  return address.slice(0, 5) + "..." + address.slice(address.length - 4);
}

const arrayToCsv = (array) => {
  const csvHeader = "TxHash,Timestamp,Value,Sender,Receiver,Data,Status,Type,Gas,Fee\n";
  const csvContent = array.map(
    (row) =>
      [row.txHash, row.timestamp, row.value, row.sender, row.receiver, "row.data", row.status, row.type, row.gas, row.fee].join(
        ","
      )
  ).join("\n");

  const csvData = csvHeader + csvContent;

  return csvData;
}

const formatValue = (value) => {
  //   return new BigInt(value)
  //     .dividedBy(new BigNumber(10 ** networkConfig.data.config.erd_denomination))
  // //     .toFixed(7);
  // console.log(BigInt(value));
  // let a = BigInt(10 ** 18);
  // console.log({ a });



  const formattedValue = value / (10 ** 18);

  return formattedValue;
}

const getValue = (sender, receiver, value) => {
  if (sender === receiver) {
    return 0;
  }

  if (address === sender) {
    value = -value;
  }

  const formattedValue = value / (10 ** 18);

  return formattedValue;
}

const formatToDate = (timestamp) => {
  const date = new Date(timestamp * 1000);

  return (
    date.toISOString().slice(0, 10) + " " + date.toTimeString().slice(0, 8)
  );
}

const formatScTransactions = (resultScTransactionsRaw) => {
  const someScTransactions = resultScTransactionsRaw
    .filter((x) => (showZeroValues ? x : x._source.value !== "0"))
    .map((row) => ({
      txHash: row._id,
      sender: row._source.sender,
      receiver: row._source.receiver,
      senderTrimmed: trimAddress(row._source.sender),
      receiverTrimmed: trimAddress(row._source.receiver),
      value: 0,//getValue(row._source.sender, row._source.receiver, row._source.value),
      timestamp: formatToDate(row._source.timestamp),
      status: "success",
      type: "scResult",
      gas: 0,
      fee: 0
    }));

  return someScTransactions;
}

const formatSimpleTransactions = (someResultTransactionsRaw) => {
  const transactions = someResultTransactionsRaw
    .filter((row) => (showZeroValues ? row : row._source.value !== "0"))
    .map((row) => ({
      txHash: row._id,
      sender: row._source.sender,
      receiver: row._source.receiver,
      senderTrimmed: trimAddress(row._source.sender),
      receiverTrimmed: trimAddress(row._source.receiver),
      data: row._source.data
        ? Buffer.from(row._source.data, "base64").toString("binary")
        : "",
      value: getValue(row._source.sender, row._source.receiver, row._source.value),
      timestamp: formatToDate(row._source.timestamp),
      status: row._source.status,
      type: "Transaction",
      gas: row._source.sender === address ? (row._source.gasUsed * row._source.gasPrice) / (10 ** 18) : 0,  //getValue(address, '', row._source.sender === address ? row._source.fee : '0')
      fee: row._source.sender === address ? parseInt(row._source.fee) / (10 ** 18) : 0
    }));

  return transactions;
}

const getBody = (address) => {
  const body = {
    size: size,
    query: {
      bool: {
        should: [
          {
            match: {
              sender: {
                query: `${address}`,
              },
            },
          },
          {
            match: {
              receiver: {
                query: `${address}`,
              },
            },
          },
        ],
      },
    },
  };
  return body;
}

const getScrollBody = (scrollId) => {
  const scrollBody = {
    scroll: "1m",
    scroll_id: `${scrollId}`,
  };

  return scrollBody;
}

const sortTransactionsByTimestamp = (transactions) => {
  return transactions.sort((element1, element2) => { return element2.timestamp.localeCompare(element1.timestamp) });
}

const downloadStatement = () => {
  var blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "Statement.csv");
  document.body.appendChild(link);

  link.click();
}

const changeShowZeroValues = () => {
  showZeroValues = filterValue.checked;
}

const setCsvData = (transactionsArray) => {
  csvData = arrayToCsv(transactionsArray);
}
