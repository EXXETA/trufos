import { VariableMap } from 'shim/objects/variables';
import { EnvironmentMap } from '../../../shim/objects/environment';

export interface VariableStateActions {
  /**
   * Initialize the collectionVariables of the current collection
   * @param collectionVariables
   * @param environmentVariables
   */
  initialize(collectionVariables: VariableMap, environmentVariables: EnvironmentMap): void;

  /**
   * Set the variables of the current collection
   * @param variables The new variables to set
   */
  setCollectionVariables(variables: VariableMap): Promise<void>;

  setEnvironmentVariables(environmentVariables: EnvironmentMap): Promise<void>;
}
