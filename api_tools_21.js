/**
 * @NApiVersion 2.1
 */
define(["N/error", "N/log", "N/record", "N/runtime", "N/search"], /**
 * @param{error} error
 * @param{log} log
 * @param{record} record
 * @param{runtime} runtime
 * @param{search} search
 */ /**
 * Description placeholder
 *
 * @param {*} error
 * @param {*} log
 * @param {*} record
 * @param {*} runtime
 * @param {*} search
 * @returns {{ api_tools: { log_API_CreateMaster(): { ID: number; RequestID: string; }; log_API_UpdateMaster(toUpdate: any): void; ... 4 more ...; log_API_TaskResponse(TaskID: any, responseData: any): void; }; }}
 */ (error, log, record, runtime, search) => {
  let api_tools = {};
  let inproc = "in process...";
  let na = "n/a";

  /**
   * Description placeholder
   *
   * @param {*} scriptID
   * @returns {*}
   */
  const searchScriptName = (scriptID) => {
    let scriptdeploymentSearchObj = search.create({
      type: "scriptdeployment",
      filters: [["scriptid", "contains", scriptID]],
      columns: [search.createColumn({ name: "title" })],
    });
    let scriptSearch = scriptdeploymentSearchObj.run().getRange({ start: 0, end: 1 });

    return scriptSearch && scriptSearch.length > 0
      ? scriptSearch[0].getValue("title")
      : "API REQUEST";
  };

  api_tools.log_API_CreateMaster = () => {
    let API_LOG_MASTER = {
      ID: 0,
      RequestID: "",
    };

    let recNewRequest = record.create({ type: "customrecord_ep_api_request_log", isDynamic: true });
    recNewRequest.setValue({ fieldId: "name", value: inproc });
    recNewRequest.setValue({ fieldId: "custrecord_ep_apilog_master", value: "MASTER REQUEST" });
    recNewRequest.setValue({ fieldId: "custrecord_ep_apilog_when", value: new Date() });
    let MasterID = recNewRequest.save();
    API_LOG_MASTER.ID = MasterID;

    if (!MasterID || MasterID === 0) {
      return API_LOG_MASTER;
    }

    var requestID = "API" + MasterID;
    record.submitFields({
      type: "customrecord_ep_api_request_log",
      id: MasterID,
      values: {
        custrecord_ep_apilog_parent: MasterID,
        custrecord_ep_apilog_id: requestID,
      },
      options: {
        enableSourcing: false,
        ignoreMandatoryFields: true,
      },
    });

    API_LOG_MASTER.RequestID = requestID;

    return API_LOG_MASTER;
  };

  api_tools.log_API_UpdateMaster = (toUpdate) => {
    if (toUpdate) {
      record.submitFields({
        type: "customrecord_ep_api_request_log",
        id: toUpdate.id,
        values: toUpdate.values,
        options: {
          enableSourcing: false,
          ignoreMandatoryFields: true,
        },
      });
    }
  };

  api_tools.log_API_UpdateMasterRequest = (API_LOG_MASTER, apiRequest) => {
    if (apiRequest && API_LOG_MASTER && API_LOG_MASTER.ID) {
      api_tools.log_API_UpdateMaster({
        id: API_LOG_MASTER.ID,
        values: {
          custrecord_ep_apilog_request: JSON.stringify(apiRequest),
        },
      });
    }
    return API_LOG_MASTER;
  };

  api_tools.log_API_MasterRequest = (apiRequest) => {
    let API_LOG_MASTER = api_tools.log_API_CreateMaster();

    if (API_LOG_MASTER && API_LOG_MASTER.ID) {
      let scriptObj = runtime.getCurrentScript();
      let scriptID = scriptObj.deploymentId;

      let taskType = searchScriptName(scriptID);

      let toUpdate = {
        id: API_LOG_MASTER.ID,
        values: {
          name: taskType,
        },
      };
      if (apiRequest) {
        toUpdate.values.custrecord_ep_apilog_request = JSON.stringify(apiRequest);
      }

      api_tools.log_API_UpdateMaster(toUpdate);
    }

    return API_LOG_MASTER;
  };

  api_tools.log_API_MasterResponse = (MasterID, responseData) => {
    if (MasterID && MasterID > 0) {
      api_tools.log_API_UpdateMaster({
        id: MasterID,
        values: {
          custrecord_ep_apilog_response: responseData ? JSON.stringify(responseData) : "",
        },
      });
    }
  };

  api_tools.log_API_TaskPayload = (masterInfo, apiRequest, taskData) => {
    let TaskID = 0;
    if (!taskData) {
      return TaskID;
    }

    let request_repl_item_id = na;
    if (taskData.repl_item_id) {
      request_repl_item_id = taskData.repl_item_id;
    } else if (apiRequest && apiRequest.repl_item_id) {
      request_repl_item_id = apiRequest.repl_item_id;
    }

    let taskType = na;
    if (taskData.request_type) {
      taskType = taskData.request_type.toUpperCase();
    } else if (apiRequest && apiRequest.request_type) {
      taskType = apiRequest.request_type.toUpperCase();
    }

    let recNewRequest = record.create({ type: "customrecord_ep_api_request_log", idDynamic: true });
    recNewRequest.setValue({ fieldId: "name", value: taskType });
    recNewRequest.setValue({ fieldId: "custrecord_ep_apilog_master", value: "detail" });
    recNewRequest.setValue({ fieldId: "custrecord_ep_apilog_tracenr", request_repl_item_id });
    recNewRequest.setValue({ fieldId: "custrecord_ep_apilog_when", value: new Date() });
    recNewRequest.setValue({
      fieldId: "custrecord_ep_apilog_request",
      value: JSON.stringify(taskData),
    });
    recNewRequest.setValue({
      fieldId: "custrecord_ep_apilog_parent",
      value: masterInfo && masterInfo.ID ? masterInfo.ID : 0,
    });
    recNewRequest.setValue({
      fieldId: "custrecord_ep_apilog_id",
      value: masterInfo && masterInfo.RequestID ? masterInfo.RequestID : na,
    });
    TaskID = recNewRequest.save();

    return TaskID;
  };

  api_tools.log_API_TaskResponse = (TaskID, responseData) => {
    if (TaskID && TaskID > 0) {
      record.submitFields({
        type: "customrecord_ep_api_request_log",
        id: TaskID,
        values: {
          custrecord_ep_apilog_response: JSON.stringify(responseData),
        },
        options: {
          enableSourcing: false,
          ignoreMandatoryFields: true,
        },
      });
    }
  };

  return {
    api_tools,
  };
});
