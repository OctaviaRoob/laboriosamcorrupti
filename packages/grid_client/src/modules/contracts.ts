import * as PATH from "path";

import { TFClient } from "../clients/tf-grid/client";
import { GridClientConfig } from "../config";
import { events } from "../helpers/events";
import { expose } from "../helpers/expose";
import { validateInput } from "../helpers/validator";
import { Nodes } from "../primitives/nodes";
import { BaseModule } from "./base";
import {
  BatchCancelContractsModel,
  ContractCancelModel,
  ContractConsumption,
  ContractGetByNodeIdAndHashModel,
  ContractGetModel,
  ContractsByAddress,
  ContractsByTwinId,
  ContractState,
  CreateServiceContractModel,
  GetServiceContractModel,
  NameContractCreateModel,
  NameContractGetModel,
  NodeContractCreateModel,
  NodeContractUpdateModel,
  RentContractGetModel,
  ServiceContractApproveModel,
  ServiceContractBillModel,
  ServiceContractCancelModel,
  SetServiceContractFeesModel,
  SetServiceContractMetadataModel,
} from "./models";
import { checkBalance } from "./utils";

class Contracts {
  client: TFClient;
  nodes: Nodes;
  constructor(public config: GridClientConfig) {
    this.client = new TFClient(config.substrateURL, config.mnemonic, config.storeSecret, config.keypairType);
    this.nodes = new Nodes(config.graphqlURL, config.proxyURL, config.rmbClient);
  }

  private async invalidateDeployment(contractId: number) {
    const baseModule = new BaseModule(this.config);
    const contractPath = PATH.join(this.config.storePath, "contracts", `${contractId}.json`);
    let contractInfo;
    try {
      contractInfo = await baseModule.backendStorage.load(contractPath);
    } catch (e) {
      events.emit("logs", `Couldn't delete the deployment's cached data for contract id: ${contractId} due to ${e}`);
    }
    if (contractInfo) {
      baseModule.moduleName = contractInfo["moduleName"];
      baseModule.projectName = contractInfo["projectName"];
      await baseModule._get(contractInfo["deploymentName"]);
    }
  }

  @expose
  @validateInput
  @checkBalance
  async create_node(options: NodeContractCreateModel) {
    return await this.client.contracts.createNode(
      options.node_id,
      options.hash,
      options.data,
      options.public_ip,
      options.solutionProviderID,
    );
  }
  @expose
  @validateInput
  @checkBalance
  async create_name(options: NameContractCreateModel) {
    return await this.client.contracts.createName(options.name);
  }
  @expose
  @validateInput
  async get(options: ContractGetModel) {
    return await this.client.contracts.get(options.id);
  }
  @expose
  @validateInput
  async get_contract_id_by_node_id_and_hash(options: ContractGetByNodeIdAndHashModel) {
    return await this.client.contracts.getContractIdByNodeIdAndHash(options.node_id, options.hash);
  }

  @expose
  @validateInput
  async get_name_contract(options: NameContractGetModel) {
    return await this.client.contracts.getNameContract(options.name);
  }

  @expose
  @validateInput
  async activeRentContractForNode(options: RentContractGetModel) {
    return await this.client.contracts.activeRentContractForNode(options.nodeId);
  }

  @expose
  @validateInput
  @checkBalance
  async update_node(options: NodeContractUpdateModel) {
    return await this.client.contracts.updateNode(options.id, options.data, options.hash);
  }
  @expose
  @validateInput
  @checkBalance
  async cancel(options: ContractCancelModel) {
    const deletedContract = await this.client.contracts.cancel(options.id);
    await this.invalidateDeployment(options.id);
    return deletedContract;
  }

  @expose
  @validateInput
  async listMyContracts(options?: ContractState) {
    return await this.client.contracts.listMyContracts(this.config.graphqlURL, options?.state);
  }

  @expose
  @validateInput
  async listContractsByTwinId(options: ContractsByTwinId) {
    return await this.client.contracts.listContractsByTwinId(this.config.graphqlURL, options.twinId);
  }

  @expose
  @validateInput
  async listContractsByAddress(options: ContractsByAddress) {
    return await this.client.contracts.listContractsByAddress(this.config.graphqlURL, options.address);
  }

  @expose
  @validateInput
  @checkBalance
  async createServiceContract(options: CreateServiceContractModel) {
    return await this.client.contracts.createServiceContract(options.serviceAccount, options.consumerAccount);
  }
  @expose
  @validateInput
  @checkBalance
  async approveServiceContract(options: ServiceContractApproveModel) {
    return await this.client.contracts.serviceContractApprove(options.serviceContractId, options.approve);
  }

  @expose
  @validateInput
  @checkBalance
  async billServiceContract(options: ServiceContractBillModel) {
    return await this.client.contracts.serviceContractBill(
      options.serviceContractId,
      options.variableAmount,
      options.metadata,
    );
  }

  @expose
  @validateInput
  @checkBalance
  async cancelServiceContract(options: ServiceContractCancelModel) {
    return await this.client.contracts.serviceContractCancel(options.serviceContractId);
  }

  @expose
  @validateInput
  @checkBalance
  async setFeesServiceContract(options: SetServiceContractFeesModel) {
    return await this.client.contracts.setServiceContractFees(
      options.serviceContractId,
      options.baseFee,
      options.variableFee,
    );
  }

  @expose
  @validateInput
  @checkBalance
  async setMetadataServiceContract(options: SetServiceContractMetadataModel) {
    return await this.client.contracts.setServiceContractMetadata(options.serviceContractId, options.metadata);
  }
  @expose
  @validateInput
  async getServiceContract(options: GetServiceContractModel) {
    return await this.client.contracts.getServiceContract(options.serviceContractId);
  }
  /**
   * WARNING: Please be careful when executing this method, it will delete all your contracts.
   * @returns Promise
   */
  @expose
  @validateInput
  @checkBalance
  async cancelMyContracts(): Promise<Record<string, number>[]> {
    const contracts = await this.client.contracts.cancelMyContracts(this.config.graphqlURL);
    for (const contract of contracts) {
      await this.invalidateDeployment(contract.contractId);
    }
    return contracts;
  }

  @expose
  @validateInput
  @checkBalance
  async batchCancelContracts(options: BatchCancelContractsModel): Promise<number[]> {
    const contracts = await this.client.contracts.batchCancelContracts(options.ids);
    for (const id of options.ids) {
      await this.invalidateDeployment(id);
    }
    return contracts;
  }

  /**
   * Get contract consumption per hour in TFT.
   *
   * @param  {ContractConsumption} options
   * @returns {Promise<number>}
   */
  @expose
  @validateInput
  async getConsumption(options: ContractConsumption): Promise<number> {
    return await this.client.contracts.getConsumption(options.id, this.config.graphqlURL);
  }

  @expose
  @validateInput
  async getDeletionTime(options: ContractGetModel): Promise<string | number> {
    return await this.client.contracts.getDeletionTime(options.id);
  }
}

export { Contracts as contracts };
