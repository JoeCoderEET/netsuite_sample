/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define([
  "N/error",
  "N/https",
  "N/log",
  "N/record",
  "N/runtime",
  "N/search",
  "../library/constants",
  "../library/fedex",
  "../library/courier",
  "../library/api_tools_21",
], /**
 * @param{error} error
 * @param{https} https
 * @param{log} log
 * @param{record} record
 * @param{runtime} runtime
 * @param{search} search
 */ (error, https, log, record, runtime, search, constants, fedex, courier, api_tools_21) => {
  /**
   * Defines the function that is executed at the beginning of the map/reduce process and generates the input data.
   * @param {Object} inputContext
   * @param {boolean} inputContext.isRestarted - Indicates whether the current invocation of this function is the first
   *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
   * @param {Object} inputContext.ObjectRef - Object that references the input data
   * @typedef {Object} ObjectRef
   * @property {string|number} ObjectRef.id - Internal ID of the record instance that contains the input data
   * @property {string} ObjectRef.type - Type of the record instance that contains the input data
   * @returns {Array|Object|Search|ObjectRef|File|Query} The input data to use in the map/reduce process
   * @since 2015.2
   */

  const getInputData = (inputContext) => {
    const CONSTANTS = constants[runtime.accountId];
    let trackingNumbers = [];
    let numberSet = [];

    log.audit("START", "Script Started.........................................");

    let scriptObj = runtime.getCurrentScript();
    //Get the date to sample from
    let paramPages = parseInt(
      scriptObj.getParameter({
        name: "custscript_ep_param_pages",
      })
    );

    //Search for courier records that are not marked delivered for FedEx.

    let customrecord_ep_courier_info_recordSearchObj = search.create({
      type: "customrecord_ep_courier_info_record",
      filters: [
        ["custrecord_ep_courier_3pl_carrier", "startswith", "FEDEXP3D"],
        "AND",
        ["custrecord_ep_courier_is_delivered", "is", "F"],
      ],
      columns: [
        search.createColumn({ name: "name" }),
        search.createColumn({ name: "created" }),
        search.createColumn({ name: "lastmodified", sort: search.Sort.ASC }), //ensures that the oldest is updated first.
      ],
    });
    let pagedData = customrecord_ep_courier_info_recordSearchObj.runPaged({ pageSize: 30 });
    log.audit("PAGES FOUND", pagedData.pageRanges.length);
    log.debug("PAGES tyypeof", typeof pagedData.pageRanges.length);

    if (paramPages > parseInt(pagedData.pageRanges.length)) {
      paramPages = pagedData.pageRanges.length;
    }
    for (let i = 0; i < paramPages; i++) {
      let currentPage = pagedData.fetch(i);
      //Create an array of 30 tracking numbers
      currentPage.data.forEach(function (trackNum) {
        try {
          this_number = {
            trackingNumberInfo: {
              trackingNumber: trackNum.getValue({ name: "name" }),
            },
          };
          numberSet.push(this_number);
        } catch (e) {
          log.error("ERROR", "Error processing row ");
          return false;
        }
        return true;
      });
      trackingNumbers.push(numberSet);
      numberSet = [];
    }
    log.debug("trackingNumbers", trackingNumbers);
    return trackingNumbers;
  };

  /**
   * Defines the function that is executed when the map entry point is triggered. This entry point is triggered automatically
   * when the associated getInputData stage is complete. This function is applied to each key-value pair in the provided
   * context.
   * @param {Object} mapContext - Data collection containing the key-value pairs to process in the map stage. This parameter
   *     is provided automatically based on the results of the getInputData stage.
   * @param {Iterator} mapContext.errors - Serialized errors that were thrown during previous attempts to execute the map
   *     function on the current key-value pair
   * @param {number} mapContext.executionNo - Number of times the map function has been executed on the current key-value
   *     pair
   * @param {boolean} mapContext.isRestarted - Indicates whether the current invocation of this function is the first
   *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
   * @param {string} mapContext.key - Key to be processed during the map stage
   * @param {string} mapContext.value - Value to be processed during the map stage
   * @since 2015.2
   */

  const map = (mapContext) => {
    const CONSTANTS = constants[runtime.accountId];
    const { fedExAuth, fedExTrack } = fedex;
    const { updateCourierDelivery } = courier;
    const { api_tools } = api_tools_21;
    let apiID = "API";

    let trackingInfo = JSON.parse(mapContext.value);
    let bearerToken;

    try {
      //Get bearer token using the fedex library to add to the trancking number object
      bearerToken = fedExAuth();
      log.debug("RESPONSE", bearerToken);

      let API_LOG_MASTER = api_tools.log_API_MasterRequest(trackingInfo); //Log the request payload
      let trackingData = fedExTrack(bearerToken, trackingInfo); //Send the  tracking numbers to FedEx
      api_tools.log_API_MasterResponse(API_LOG_MASTER.ID, trackingData); //Log the response payload
      apiID = apiID + API_LOG_MASTER.ID;
      log.audit("API LOG ID", apiID);

      //Parse the data from the payload array for each parcel/tracking number and update the records
      let labelCreated;
      let trackingNumber;
      let pickUpTime;
      let deliveryTime;
      let packageData;
      let serviceDetail;
      let estitmatedTime;
      let scanHistory;
      let latestStatus;
      let isDelivered = false;

      if (trackingData.response.output.completeTrackResults != undefined) {
        log.audit("TRACKING DATA", trackingData);
        let results = trackingData.response.output.completeTrackResults;
        results.forEach((trackNumber) => {
          trackNumber.trackResults.forEach((parcel) => {
            //this error is a FedEx internal server error usually the parcel is not in the system yet.
            if (!parcel.error) {
              log.debug("trackingNumberInfo", parcel.trackingNumberInfo);
              trackingNumber = parcel.trackingNumberInfo.trackingNumber;

              if (parcel.dateAndTimes != undefined) {
                log.debug("dateAndTimes", parcel.dateAndTimes);
                parcel.dateAndTimes.forEach((dateNTime) => {
                  switch (dateNTime.type) {
                    case "ACTUAL_DELIVERY":
                      deliveryTime = dateNTime.dateTime;
                      isDelivered = true;
                      break;
                    case "ACTUAL_PICKUP":
                      pickUpTime = dateNTime.dateTime;
                      break;

                    default:
                      break;
                  }
                });
              }

              if (parcel.scanEvents != undefined) {
                parcel.scanEvents.forEach((event) => {
                  switch (event.eventType) {
                    case "OC":
                      labelCreated = event.date;
                      break;

                    default:
                      break;
                  }
                });
              }

              if (
                parcel.latestStatusDetail.description != undefined &&
                parcel.latestStatusDetail != undefined &&
                parcel != undefined &&
                parcel.latestStatusDetail.description &&
                parcel.latestStatusDetail
              ) {
                log.debug("latestStatusDetail", parcel.latestStatusDetail);
                latestStatus = parcel.latestStatusDetail.description;
              }

              packageData = parcel.packageDetails;

              scanHistory = parcel.scanEvents;

              serviceDetail = parcel.serviceDetail;

              estitmatedTime = parcel.estimatedDeliveryTimeWindow.window.ends;
            }
          });
          updateCourierDelivery(
            labelCreated,
            trackingNumber,
            pickUpTime,
            deliveryTime,
            packageData,
            serviceDetail,
            estitmatedTime,
            scanHistory,
            latestStatus,
            isDelivered
          );
        });
      }
    } catch (error) {
      log.error("ERROR", apiID + ": " + error);
    }
    log.audit("FINISH MAP", "Script Ended.........................................");
  };

  /**
   * Defines the function that is executed when the reduce entry point is triggered. This entry point is triggered
   * automatically when the associated map stage is complete. This function is applied to each group in the provided context.
   * @param {Object} reduceContext - Data collection containing the groups to process in the reduce stage. This parameter is
   *     provided automatically based on the results of the map stage.
   * @param {Iterator} reduceContext.errors - Serialized errors that were thrown during previous attempts to execute the
   *     reduce function on the current group
   * @param {number} reduceContext.executionNo - Number of times the reduce function has been executed on the current group
   * @param {boolean} reduceContext.isRestarted - Indicates whether the current invocation of this function is the first
   *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
   * @param {string} reduceContext.key - Key to be processed during the reduce stage
   * @param {List<String>} reduceContext.values - All values associated with a unique key that was passed to the reduce stage
   *     for processing
   * @since 2015.2
   */
  const reduce = (reduceContext) => {};

  /**
   * Defines the function that is executed when the summarize entry point is triggered. This entry point is triggered
   * automatically when the associated reduce stage is complete. This function is applied to the entire result set.
   * @param {Object} summaryContext - Statistics about the execution of a map/reduce script
   * @param {number} summaryContext.concurrency - Maximum concurrency number when executing parallel tasks for the map/reduce
   *     script
   * @param {Date} summaryContext.dateCreated - The date and time when the map/reduce script began running
   * @param {boolean} summaryContext.isRestarted - Indicates whether the current invocation of this function is the first
   *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
   * @param {Iterator} summaryContext.output - Serialized keys and values that were saved as output during the reduce stage
   * @param {number} summaryContext.seconds - Total seconds elapsed when running the map/reduce script
   * @param {number} summaryContext.usage - Total number of governance usage units consumed when running the map/reduce
   *     script
   * @param {number} summaryContext.yields - Total number of yields when running the map/reduce script
   * @param {Object} summaryContext.inputSummary - Statistics about the input stage
   * @param {Object} summaryContext.mapSummary - Statistics about the map stage
   * @param {Object} summaryContext.reduceSummary - Statistics about the reduce stage
   * @since 2015.2
   */
  const summarize = (summaryContext) => {};

  return { getInputData, map, reduce, summarize };
});
