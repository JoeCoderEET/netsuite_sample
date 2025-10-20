/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define([
  "N/error",
  "N/log",
  "N/record",
  "N/runtime",
  "N/search",
  "../library/item_collection",
  "../library/constants",
  "../library/email_alert",
], /**
 * @param{error} error
 * @param{log} log
 * @param{record} record
 * @param{runtime} runtime
 * @param{search} search
 */ (error, log, record, runtime, search, item_collection, constants, email_alert) => {
  /**
   * Defines the Scheduled script trigger point.
   * @param {Object} scriptContext
   * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
   * @since 2015.2
   */
  const execute = (scriptContext) => {
    const CONSTANTS = constants[runtime.accountId];
    let masterArray = [];
    const { processBaseLines } = item_collection;
    const { emailError } = email_alert;
    let lineNumber = 0;
    let me_order_number = "";
    let ship_with = "";

    try {
      /**
       * This function clears out all of of the previous customs details records to start fresh after any error in processing.
       * masterID is pulled from the manster customs record.
       * @param {*} masterID
       */
      const clearCustomsDetails = (masterID) => {
        let customrecord_ep_customs_detailSearchObj = search.create({
          type: "customrecord_ep_customs_detail",
          filters: [["custrecord_ep_cus_mas_id", "equalto", masterID]],
          columns: [search.createColumn({ name: "internalid" })],
        });

        customrecord_ep_customs_detailSearchObj.run().each(function (result) {
          log.debug("DELETE", result.getValue("internalid"));
          record.delete({
            type: "customrecord_ep_customs_detail",
            id: result.getValue("internalid"),
          });
          return true;
        });
      };

      let customrecord_ep_master_customs_recordSearchObj = search.create({
        type: "customrecord_ep_master_customs_record",
        filters: [["custrecord_ep_customs_status", "anyof", CONSTANTS.CUSTOMS_STATE.EXPAND]],
        columns: [
          search.createColumn({ name: "name" }),
          search.createColumn({ name: "id" }),
          search.createColumn({ name: "custrecord_ep_customs_so_internal" }),
        ],
      });
      var searchResultCount = customrecord_ep_master_customs_recordSearchObj.runPaged().count;
      log.debug("customrecord_ep_master_customs_recordSearchObj result count", searchResultCount);
      let searchResults = customrecord_ep_master_customs_recordSearchObj.run().getRange({
        start: 0,
        end: 1, // revise based on amount of governance consumed
      });

      searchResults.forEach(function (result) {
        let master = {
          soID: result.getValue({ name: "custrecord_ep_customs_so_internal" }),
          soNumber: result.getValue({ name: "name" }),
          masterID: result.getValue({ name: "id" }),
        };
        log.debug("Master", master);
        masterArray.push(master);
        return true;
      });

      if (masterArray.length > 0) {
        let masterInfo = masterArray[0];

        log.debug("CALLING", masterInfo.masterID);
        clearCustomsDetails(masterInfo.masterID);

        let salesorderSearchObj = search.create({
          type: "salesorder",
          settings: [{ name: "consolidationtype", value: "ACCTTYPE" }],
          filters: [
            ["type", "anyof", "SalesOrd"],
            "AND",
            ["mainline", "is", "T"],
            "AND",
            ["internalidnumber", "equalto", masterInfo.soID],
          ],
          columns: [
            search.createColumn({ name: "shipaddressee" }),
            search.createColumn({ name: "shipaddress1" }),
            search.createColumn({ name: "shipaddress2" }),
            search.createColumn({ name: "shipcity" }),
            search.createColumn({ name: "shipstate" }),
            search.createColumn({ name: "shipcountry" }),
            search.createColumn({ name: "shipzip" }),
            search.createColumn({ name: "custbody_ep_shipwith" }),
            search.createColumn({ name: "custbody_ep_me_ordernumber" }),
            search.createColumn({
              name: "custbody_ep_so_total_customs_value",
            }),
          ],
        });

        let salesorderResults = salesorderSearchObj.run().getRange({ start: 0, end: 1 });

        log.debug("shipaddressee", salesorderResults[0].getValue("shipaddressee"));
        log.debug("shipaddress1", salesorderResults[0].getValue("shipaddress1"));
        log.debug("shipaddress2", salesorderResults[0].getValue("shipaddress2"));
        log.debug("shipcity", salesorderResults[0].getValue("shipcity"));
        log.debug("shipstate", salesorderResults[0].getValue("shipstate"));
        log.debug("shipcountry", salesorderResults[0].getValue("shipcountry"));
        log.debug("shipzip", salesorderResults[0].getValue("shipzip"));
        log.debug(
          "custbody_ep_so_total_customs_value",
          salesorderResults[0].getValue("custbody_ep_so_total_customs_value")
        );
        log.debug("MasterInfo", masterInfo);

        //NEED to check if there is a host for H&G to add more to the shipment
        me_order_number = salesorderResults[0].getValue("custbody_ep_me_ordernumber");
        ship_with = salesorderResults[0].getValue("custbody_ep_shipwith");

        //Get the top level shipment information from the SO for the master record.
        record.submitFields({
          type: "customrecord_ep_master_customs_record",
          id: parseInt(masterInfo.masterID),
          values: {
            custrecord_ep_customs_name: salesorderResults[0].getValue("shipaddressee"),
            custrecord_ep_customs_address1: salesorderResults[0].getValue("shipaddress1"),
            custrecord_ep_customs_address2: salesorderResults[0].getValue("shipaddress2"),
            custrecord_ep_customs_city: salesorderResults[0].getValue("shipcity"),
            custrecord_ep_customs_state: salesorderResults[0].getValue("shipstate"),
            custrecord_ep_customs_country: salesorderResults[0].getValue("shipcountry"),
            custrecord_ep_customs_zip: salesorderResults[0].getValue("shipzip"),
            custrecord_ep_customs_total: salesorderResults[0].getValue(
              "custbody_ep_so_total_customs_value"
            ),
          },
        });

        //start of main processing----------------------------------------------------------
        lineNumber = processBaseLines(masterInfo.soID, masterInfo);
        record.submitFields({
          type: "customrecord_ep_master_customs_record",
          id: parseInt(masterInfo.masterID),
          values: {
            custrecord_ep_cus_me_order_number: me_order_number,
            custrecord_ep_customs_status: CONSTANTS.CUSTOMS_STATE.FDA,
          },
        });

        //Check for the host of an H&G
        if (ship_with && ship_with != "") {
          let shipWithObj = JSON.parse(ship_with);
          let salesorderSearchObj = search.create({
            type: "salesorder",
            filters: [
              ["type", "anyof", "SalesOrd"],
              "AND",
              ["custbody_ep_me_orderid", "startswith", shipWithObj[1]],
              "AND",
              ["mainline", "is", "T"],
            ],
            columns: [
              search.createColumn({ name: "internalid" }),
              search.createColumn({ name: "tranid" }),
              search.createColumn({
                name: "custbody_ep_me_ordernumber",
              }),
            ],
          });

          let shipWithSearch = salesorderSearchObj.run().getRange({ start: 0, end: 1 });
          log.debug("HOST ORDER", shipWithSearch[0].getValue("tranid"));
          me_order_number =
            me_order_number + "," + shipWithSearch[0].getValue("custbody_ep_me_ordernumber");

          processBaseLines(shipWithSearch[0].getValue("internalid"), masterInfo, lineNumber);
          record.submitFields({
            type: "customrecord_ep_master_customs_record",
            id: parseInt(masterInfo.masterID),
            values: {
              custrecord_ep_cus_me_order_number: me_order_number,
              custrecord_ep_customs_status: CONSTANTS.CUSTOMS_STATE.FDA,
              custrecord_ep_cus_retry_count: 0,
            },
          });
        }
      } else {
        log.audit("SCRIPT", "No orders in EXPAND to process....");
      }
      log.audit("SCRIPT", "Script has finished successfully!");
    } catch (error) {
      log.error("SEVERE ERROR", "ERROR: " + error.message);
      emailError(
        "Epicure SS EXPAND LARGE ORDERS",
        new Date(Date.now()),
        "Error transmitting: " + masterInfo.soNumber + " " + error.message
      );
      record.submitFields({
        type: "customrecord_ep_master_customs_record",
        id: masterInfo.masterID,
        values: {
          custrecord_ep_customs_status: CONSTANTS.CUSTOMS_STATE.ERROR,
          custrecord_ep_cus_err_desc: "EXPAND ERROR: " + error.message,
        },
        options: {
          enableSourcing: false,
          ignoreMandatoryFields: true,
        },
      });
    }
  };

  return { execute };
});
