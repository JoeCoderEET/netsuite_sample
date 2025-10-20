/**
 *@NApiVersion 2.1
 *@NScriptType usereventscript
 *@NModuleScope Public
 */
define(["N/search", "N/record", "N/runtime", "N/log", "../library/constants"], (
  search,
  record,
  runtime,
  log,
  constants
) => {
  function beforeSubmit(context) {}
  function beforeLoad(context) {}

  function isEmpty(stValue) {
    if (stValue === "" || stValue == null || stValue == undefined) {
      return true;
    }
    if (stValue.constructor === Array && stValue.length == 0) {
      return true;
    }
    if (stValue.constructor === Object) {
      for (let i in stValue) {
        if (stValue.hasOwnProperty(i)) {
          return false;
        }
      }
      return true;
    }
    return false;
  }

  function afterSubmit(context) {
    log.audit("afterSubmit", "Script started ------------------------------------");
    // log.debug('afterSubmit', "context : " + JSON.stringify(context));

    const CONSTANTS = constants[runtime.accountId];

    let newRecord = context.newRecord;
    let oldRecord = context.oldRecord;
    let internalid = newRecord.id;
    let newItemMembers = [];
    let oldItemMembers = [];
    let newItemMembersJoin = "";
    let oldItemMembersJoin = "";

    // log.debug('afterSubmit', "oldRecord : " + JSON.stringify(oldRecord));
    // log.debug('afterSubmit', "newRecord : " + JSON.stringify(newRecord));

    log.debug("afterSubmit", "Record id: " + internalid + " type: " + newRecord.type);

    // Limit to Edit or Create as there is no new record on DELETE 

    if (newRecord.type == "kititem" && 
          (context.type == context.UserEventType.EDIT ||
           context.type == context.UserEventType.CREATE))  {
            
      try {
        oldItemMembers = oldRecord.getText("custitem_mmbr_item_sptauto").split(",");
      } catch (e) {
        oldItemMembers = [];
      }

      if (!isEmpty(oldItemMembers)) {
        oldItemMembers.sort();
        oldItemMembersJoin = oldItemMembers.join();
      }

      let filters = [];
      filters.push(search.createFilter("internalid", null, "is", internalid));

      let columns = [];
      columns.push(search.createColumn({ name: "displayname" }));
      columns.push(search.createColumn({ name: "memberitem" }));
      columns.push(search.createColumn({ name: "memberquantity" }));

      let itemSearch = search.create({
        type: "item",
        filters: filters,
        columns: columns,
      });

      log.debug("afterSubmit", "serching the item record...");
      itemSearch.run().each(function (result) {
        let memberitem = result.getText({ name: "memberitem" });
        newItemMembers.push(memberitem);
        return true;
      });

      if (!isEmpty(newItemMembers)) {
        newItemMembers.sort();
        newItemMembersJoin = newItemMembers.join();
      }

      log.debug("afterSubmit", "new item members list: " + newItemMembersJoin);
      log.debug("afterSubmit", "old item members list: " + oldItemMembersJoin);

      if (newItemMembersJoin != oldItemMembersJoin) {
        log.audit("afterSubmit", "Updating item members list field: " + newItemMembersJoin);
        let otherId = record.submitFields({
          type: newRecord.type,
          id: internalid,
          values: {
            custitem_mmbr_item_sptauto: newItemMembersJoin,
            custitem_ep_last_component_change: new Date(),
          },
        });
      } else {
        log.debug("afterSubmit", "The item members list is not changed, nothing to update");
      }
    }

    log.audit("afterSubmit", "Script ended");
  }

  return {
    afterSubmit: afterSubmit,
    beforeSubmit: beforeSubmit,
    beforeLoad: beforeLoad,
  };
});
