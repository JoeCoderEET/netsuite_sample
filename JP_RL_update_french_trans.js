/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */
define(["N/error", "N/log", "N/record", "N/search"], /**
 * @param{error} error
 * @param{log} log
 * @param{record} record
 * @param{search} search
 */ (error, log, record, search) => {
  /**
   * Defines the function that is executed when a POST request is sent to a RESTlet.
   * @param {string | Object} requestBody - The HTTP request body; request body is passed as a string when request
   *     Content-Type is 'text/plain' or parsed into an Object when request Content-Type is 'application/json' (in which case
   *     the body must be a valid JSON)
   * @returns {string | Object} HTTP response body; returns a string when request Content-Type is 'text/plain'; returns an
   *     Object when request Content-Type is 'application/json' or 'application/xml'
   * @since 2015.2
   */
  const post = (requestBody) => {
    log.audit("SCRIPT STARTED", requestBody);

    let itemData = requestBody;

    try {

      let error_count = 0;
      let success_count = 0;

      itemData.map(function (itemUpdate) {
        if (itemUpdate.request_type !== "update_french") {
          log.error("PAYLOAD ERROR", "Incorrect request type: " + itemUpdate.request_type);
          return {
            status: "ERROR",
            message: "Wrong request type: " + itemUpdate.request_type,
            response_type: "order_update",
            repl_item_id: itemUpdate.repl_item_id,
          };
        }
        try {
          log.debug("itemUpdate", itemUpdate);

          let itemType = "";
          if (itemUpdate.item_type === "Assembly") {
            itemType = record.Type.ASSEMBLY_ITEM;          
          } else if (itemUpdate.item_type === "Kit/Package") {
            itemType = record.Type.KIT_ITEM;
          }

          let itemRecord = record.load({
            type: itemType,
            id: itemUpdate.ns_internal_id,
            isDynamic: false,
          });

          itemRecord.setValue("custitem_ep_french_description", itemUpdate.french_trans);

          itemRecord.save();

          success_count++;

        } catch (e) {
          error_count++;
          log.error("Item Update Error", e);
        }
      });

      log.audit("RESULT", "Items updated successfully: " + success_count + " Errors: " + error_count);

      return {
        status: success_count > 0 ? "SUCCESS" : "ERROR",
        message: success_count > 0 ? "Items updated successfully!" : "Review NetSuite Script Logs",
        success_count: success_count,
        error_count: error_count,
      };

    } catch (e) {
      log.error("SEVERE ERROR", e.message + " " + e.error);
      return {
        status: "ERROR",
        message: e.message,
      };
    }
  };
  return { post };
});
