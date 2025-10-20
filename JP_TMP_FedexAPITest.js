/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define([
  "N/error",
  "N/https",
  "N/log",
  "N/record",
  "N/runtime",
  "../library/constants",
  "../library/fedex",
  "../library/api_tools_21",
], /**
 * @param{error} error
 * @param{https} https
 * @param{log} log
 * @param{record} record
 * @param{runtime} runtime
 */ (error, https, log, record, runtime, constants, fedex, api_tools_21) => {
  /**
   * Defines the Scheduled script trigger point.
   * @param {Object} scriptContext
   * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
   * @since 2015.2
   */
  const execute = (scriptContext) => {
    const CONSTANTS = constants[runtime.accountId];
    const { fedExAuth, fedExTrack } = fedex;
    const { api_tools } = api_tools_21;
    let scriptObj = runtime.getCurrentScript();

    //Get the sample tracking number from parameters
    let testTrack = scriptObj.getParameter({
      name: "custscript_ep_test_track",
    });
    let bearerToken;
    try {
      bearerToken = fedExAuth();
      log.debug("RESPONSE", bearerToken);

      let trackingNumbers = [
        {
          trackingNumberInfo: {
            trackingNumber: testTrack,
          },
        },
      ];

      let API_LOG_MASTER = api_tools.log_API_MasterRequest(trackingNumbers);
      log.debug("API_LOG_MASTER", API_LOG_MASTER.RequestID);
      let trackingData = fedExTrack(bearerToken, trackingNumbers);
      api_tools.log_API_MasterResponse(API_LOG_MASTER.ID, trackingData);
      log.debug("TRACKING DATA", trackingData);
      let results = trackingData.response.output.completeTrackResults;
      results.forEach((element) => {
        log.debug("RESULT DATA", element);
        log.debug("trackResults", element.trackResults);
        element.trackResults.forEach((parcel) => {
          log.debug("trackingNumberInfo", parcel.trackingNumberInfo);
          log.debug("dateAndTimes", parcel.dateAndTimes);
          log.debug("latestStatusDetail", parcel.latestStatusDetail);
          log.debug("packageDetails", parcel.packageDetails);
          log.debug("scanEvents", parcel.scanEvents);
          log.debug("serviceDetail", parcel.serviceDetail);
        });
      });
    } catch (error) {
      log.debug("ERROR", error);
    }
  };

  return { execute };
});
