/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */
define(["N/error", "N/log", "N/record", "N/search", "../library/moment"], /**
 * @param{error} error
 * @param{log} log
 * @param{record} record
 * @param{search} search
 */ (error, log, record, search, moment) => {
  /**
   * Defines the function that is executed when a GET request is sent to a RESTlet.
   * @param {Object} requestParams - Parameters from HTTP request URL; parameters passed as an Object (for all supported
   *     content types)
   * @returns {string | Object} HTTP response body; returns a string when request Content-Type is 'text/plain'; returns an
   *     Object when request Content-Type is 'application/json' or 'application/xml'
   * @since 2015.2
   */
  const get = (requestParams) => {
    log.debug(
      "Script Started",
      "Starting script with requestParams: " + JSON.stringify(requestParams)
    );

    let itemUpdates = [];
    try {
      let itemRequest = requestParams;

      if (itemRequest.request_type !== "get_item_info") {
        log.error({
          title: "GetItemInfo.get: Wrong request type",
          details: { request_type: itemRequest.request_type },
        });
        return {
          status: "ERROR",
          message: `GetItemInfo.get: Wrong request type: ${itemRequest.request_type}`,
        };
      }

      if (itemRequest.full_update === "false") {
        var itemSearchObj = search.create({
          type: "item",
          filters: [["type", "anyof", "Kit", "Assembly"], "AND", ["modified", "within", "today"]],
          columns: [
            search.createColumn({ name: "internalid", label: "Internal ID" }),
            search.createColumn({
              name: "itemid",
              sort: search.Sort.ASC,
              label: "Name",
            }),
            search.createColumn({ name: "salesdescription", label: "Description" }),
            search.createColumn({ name: "type", label: "Type" }),
            search.createColumn({ name: "islotitem", label: "Is Lot Numbered Item" }),
            search.createColumn({ name: "isinactive", label: "Inactive" }),
            search.createColumn({ name: "custitem_ep_productiontype", label: "Production Type" }),
            search.createColumn({
              name: "custitem_ep_productionsubtype",
              label: "Production Sub Type`",
            }),
            search.createColumn({ name: "modified" }),
          ],
        });
        const pageItemSearchObj = itemSearchObj.runPaged({ pageSize: 1000 });
        for (let i = 0; i < pageItemSearchObj.pageRanges.length; i++) {
          const currentPage = pageItemSearchObj.fetch(i);
          currentPage.data.map((result) => {
            let modTime = new Date(result.getValue({ name: "modified" }));
            if (moment(new Date(Date.now())).diff(modTime, "minutes") < 30) {
              let itemInfo = {
                ns_internal_id: result.getValue({ name: "internalid" }),
                ns_item_number: result.getValue({ name: "itemid" }),
                description: result.getValue({ name: "salesdescription" }),
                item_type: result.getValue({ name: "type" }),
                is_lotted: result.getValue({ name: "islotitem" }),
                is_inactive: result.getValue({ name: "isinactive" }),
                production_type: result.getText({ name: "custitem_ep_productiontype" }),
                production_sub_type: result.getText({ name: "custitem_ep_productionsubtype" }),
              };
              itemUpdates.push(itemInfo);
            }
          });
        }
      } else {
        let itemSearchObj = search.create({
          type: "item",
          filters: [["type", "anyof", "Kit", "Assembly"]],
          columns: [
            search.createColumn({ name: "internalid" }),
            search.createColumn({
              name: "itemid",
              sort: search.Sort.ASC,
            }),
            search.createColumn({ name: "salesdescription" }),
            search.createColumn({ name: "type" }),
            search.createColumn({ name: "islotitem" }),
            search.createColumn({ name: "isinactive" }),
            search.createColumn({ name: "custitem_ep_productiontype" }),
            search.createColumn({
              name: "custitem_ep_productionsubtype",
            }),
          ],
        });
        const pageItemSearchObj = itemSearchObj.runPaged({ pageSize: 1000 });
        for (let i = 0; i < pageItemSearchObj.pageRanges.length; i++) {
          const currentPage = pageItemSearchObj.fetch(i);
          currentPage.data.map((result) => {
            let itemInfo = {
              ns_internal_id: result.getValue({ name: "internalid" }),
              ns_item_number: result.getValue({ name: "itemid" }),
              description: result.getValue({ name: "salesdescription" }),
              item_type: result.getValue({ name: "type" }),
              is_lotted: result.getValue({ name: "islotitem" }),
              is_inactive: result.getValue({ name: "isinactive" }),
              production_type: result.getText({ name: "custitem_ep_productiontype" }),
              production_sub_type: result.getText({ name: "custitem_ep_productionsubtype" }),
            };

            itemUpdates.push(itemInfo);
          });
        }

        log.debug("Script Ended", "Script ended successfully...");
      }
    } catch (err) {
      log.error({ title: "GET: Error during item information transmission", details: err });
      return {
        status: "ERROR",
        message: err,
      };
    }

    let itemUpdate = {
      status: "OK",
      message: "Updates retrieved sucessfully!",
      updated_items: itemUpdates,
    };
    return itemUpdate;
  };

  return { get };
});
