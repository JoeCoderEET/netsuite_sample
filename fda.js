/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 */

define(["N/log", "N/encode", "N/crypto", "N/https", "N/runtime", "../library/constants"], function (
  log,
  encode,
  crypto,
  https,
  runtime,
  constants
) {
  /**
   * @function handleFDA
   * @param {object} options
   * @param {string} options.apiEndpoint
   * @param {object} [payload]
   * @returns {object[]}
   */
  function handleFDA(options, payload, requestMethod) {
    var CONSTANTS = constants[runtime.accountId];
    const { FDA_API_BASE_URL } = CONSTANTS.FDA;
    let result = null;

    const { apiEndpoint } = options;

    if (!apiEndpoint) {
      return log.error({ title: "No endpoint specified", details: payload });
    }

    let sendMethod;
    switch (requestMethod) {
      case "POST":
        sendMethod = https.Method.POST;
        break;

      case "PUT":
        sendMethod = https.Method.PUT;
        break;

      case "GET":
        sendMethod = https.Method.GET;
        break;

      default:
        sendMethod = https.Method.GET;
        break;
    }

    const requestURLInfo = {
      method: sendMethod,
      url: `${FDA_API_BASE_URL}${apiEndpoint}`,
    };

    log.debug({
      title: "Request URL",
      details: `Sending: ${JSON.stringify(requestURLInfo)}`,
    });

    let authorization = "Bearer " + CONSTANTS.FDA.TOKEN;

    const requestOptions = {
      ...requestURLInfo,
      body: "",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",
        Authorization: authorization,
      },
    };

    if (payload) {
      requestOptions.body = JSON.stringify(payload);
    }

    log.debug({
      title: "Sending Request",
      details: `Sending: ${JSON.stringify(requestOptions)}`,
    });

    let responseBody = null;

    // Send request to FDA
    try {
      result = https.request(requestOptions);

      log.debug("Body value", result.body);

      responseBody = JSON.parse(result.body);

      log.debug("responseBody", responseBody);
      if (parseInt(result.code) !== 200) {
        if (parseInt(result.code) !== 201 && parseInt(result.code) !== 502) {
          if (parseInt(result.code) !== 500) {
            throw new Error(`StatusCode: ${result.code} and data: ${result.data[0]}`);
          } else {
            //This is a check in case the item is systemized already an resends as update in FDA Interface
            if (!responseBody.data[0].includes("already exist")) {
              throw new Error(`StatusCode: ${result.code} and data: ${responseBody.data[0]}`);
            }
          }
        }
      }

      // REMOVE THIS WHEN response has valid JSON format
    } catch (err) {
      log.debug("response", result);

      // only log err.error to not include connect credentials in logs
      const expandedErr = new Error(
        `[FDA] Send Error: endpoint (${apiEndpoint}): ${err.error ? err.error : err.message}`
      );
      log.error({ title: "Request Error", details: expandedErr });
      throw expandedErr;
    }

    log.audit("Returned dcResult", responseBody.data ? responseBody.data : responseBody);

    return responseBody.data ? responseBody.data : responseBody;
  }

  /**
   * @function fdaPost
   * @param {object} options
   * @param {string} options.apiEndpoint
   * @param {object} payload
   * @returns {object[]}
   */
  function fdaPost(options, payload) {
    return handleFDA(options, payload, "POST");
  }

  /**
   * @function fdaPut
   * @param {object} options
   * @param {string} options.apiEndpoint
   * @param {object} payload
   * @returns {object[]}
   */
  function fdaPut(options, payload) {
    return handleFDA(options, payload, "PUT");
  }

  /**
   * @function fdaGet
   * @param {object} options
   * @param {string} options.apiEndpoint
   * @returns {object[]}
   */
  function fdaGet(options) {
    return handleFDA(options, null, "GET");
  }

  return {
    fdaGet,
    fdaPost,
    fdaPut,
  };
});
