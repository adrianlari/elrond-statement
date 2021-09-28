const whitelist = [
  "5.2.213.244", // office RDS
  "83.103.170.152", // office UPC
  "35.228.34.130", // VPN google cloud
  "91.106.123.186", // luci
];

exports.handler = (event, context, callback) => {
  const request = event.Records[0].cf.request;

  if (whitelist.includes(request.clientIp)) {
    const file = request.uri.split("/").slice(-1).pop();

    if (file && !file.includes(".")) {
      const redirectDirectory = {
        status: "301",
        statusDescription: "Moved Permanently",
        headers: {
          location: [
            {
              key: "Location",
              value: `${request.uri}/`,
            },
          ],
        },
      };

      callback(true);
    }

    if (!file) {
      request.uri = `${request.uri}index.html`;
    }

    callback(null, request);
  } else {
    callback(true);
  }
};
